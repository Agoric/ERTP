import harden from '@agoric/harden';

import { insist } from '../../../util/insist';
import { isOfferSafeForAll } from './isOfferSafe';
import { areRightsConserved } from './areRightsConserved';
import { toAmountMatrix, makeEmptyQuantities } from '../contractUtils';

import { importManager } from '../../../more/imports/importManager';

import {
  makePayments,
  escrowEmptyOffer,
  escrowOffer,
  mintEscrowReceiptPayment,
  mintClaimPayoffPayment,
  fillInUndefinedQuantities,
} from './zoeUtils';

import { makeState } from './state';
import { makeSeatMint } from '../../seatMint';
import { makeEscrowReceiptConfig } from './escrowReceiptConfig';
import { makeMint } from '../../issuers';

// Governing contracts
// TODO: move into own file
import { makeAutomaticRefund } from '../contracts/automaticRefund';
import { makeSimpleOfferMaker } from '../contracts/simpleOffer/simpleOffer';
import { makeSecondPriceSrcs } from '../contracts/simpleOffer/srcs/secondPriceSrcs';
import { swapSrcs } from '../contracts/simpleOffer/srcs/swapSrcs';

const makeZoe = () => {
  // The seatIssuer and escrowReceiptIssuer are long-lived identities
  // over many contract instances
  const { seatMint, seatIssuer, addUseObj } = makeSeatMint('zoeSeats');
  const escrowReceiptMint = makeMint(
    'zoeEscrowReceipts',
    makeEscrowReceiptConfig,
  );
  const escrowReceiptIssuer = escrowReceiptMint.getIssuer();

  const manager = importManager();
  const contractLib = manager.addExports({
    automaticRefund: makeAutomaticRefund,
    secondPriceAuction3Bids: makeSimpleOfferMaker(makeSecondPriceSrcs(3)),
    simpleOfferSwap: makeSimpleOfferMaker(swapSrcs),
  });

  const { adminState, readOnlyState } = makeState();

  // Zoe has two different facets: the public facet and the
  // governingContract facet. Neither facet should give direct access
  // to the `adminState`.

  // The `governingContractFacet` is what is accessible by the
  // governing contract. The governing contract at no time has
  // access to the users' payments or the Zoe purses, or any of
  // the `adminState` of Zoe. The governing contract can do a
  // couple of things. It can propose a reallocation of
  // quantities, complete an offer, and interestingly, can create a
  // new offer itself for recordkeeping and other various
  // purposes.

  const governingContractFacet = harden({
    /**
     * The governing contract can propose a reallocation of
     * quantities per player, which will only succeed if the
     * reallocation 1) conserves rights, and 2) is 'offer safe' for
     * all parties involved. This reallocation is partial, meaning
     * that it applies only to the quantities associated with the
     * offerIds that are passed in, rather than applying to all of
     * the quantities in the quantityMatrix. We are able to ensure
     * that with each reallocation, rights are conserved and offer
     * safety is enforced for all quantities, even though the
     * reallocation is partial, because once these invariants are
     * true, they will remain true until changes are made.
     * @param  {object[]} offerIds - an array of offerIds
     * @param  {quantity[][]} reallocation - a matrix of quantities,
     * with one array of quantities per offerId. This is likely
     * a subset of the full quantitiesMatrix.
     */
    reallocate: (instanceId, offerIds, reallocation) => {
      const offerDescs = readOnlyState.getOfferDescsFor(offerIds);
      const currentQuantities = readOnlyState.getQuantitiesFor(offerIds);

      // 1) ensure that rights are conserved
      insist(
        areRightsConserved(
          readOnlyState.getStrategies(instanceId),
          currentQuantities,
          reallocation,
        ),
      )`Rights are not conserved in the proposed reallocation`;

      // 2) ensure 'offer safety' for each player
      insist(
        isOfferSafeForAll(
          readOnlyState.getStrategies(instanceId),
          offerDescs,
          reallocation,
        ),
      )`The proposed reallocation was not offer safe`;

      // 3) save the reallocation
      adminState.setQuantitiesFor(offerIds, reallocation);
    },

    /**
     * The governing contract can "complete" an offer to remove it
     * from the ongoing governing contract and resolve the
     * `result` promise with the player's payouts (either winnings or
     * refunds). Because Zoe only allows for reallocations that
     * conserve rights and are 'offer safe', we don't need to do
     * those checks at this step and can assume that the
     * invariants hold.
     * @param  {object[]} offerIds - an array of offerIds
     */
    complete: (instanceId, offerIds) => {
      const quantities = readOnlyState.getQuantitiesFor(offerIds);
      const amounts = toAmountMatrix(
        readOnlyState.getAssays(instanceId),
        quantities,
      );
      const payments = makePayments(adminState.getPurses(instanceId), amounts);
      const results = adminState.getResultsFor(offerIds);
      results.map((result, i) => result.res(payments[i]));
      adminState.removeOffers(offerIds);
    },

    /**
     *  The governing contract can create an empty offer and get
     *  the associated offerId. This allows the governing contract
     *  to use this offer slot for recordkeeping. For instance, to
     *  represent a pool, the governing contract can create an
     *  empty offer and then reallocate other quantities to this offer.
     */
    escrowEmptyOffer: length => {
      // attenuate the authority by not passing along the result
      // promise object and only passing the offerId
      const { offerId } = escrowEmptyOffer(adminState.recordOffer, length);
      return offerId;
    },
    /**
     *  The governing contract can also create a real offer and
     *  get the associated offerId, bypassing the seat and receipt
     *  creation. This allows the governing contract to make
     *  offers on the users' behalf, as happens in the
     *  `addLiquidity` step of the `autoswap` contract.
     */
    escrowOffer: async (offerDesc, offerPayments) => {
      // attenuate the authority by not passing along the result
      // promise object and only passing the offerId
      const { offerId } = await escrowOffer(
        adminState.recordOffer,
        adminState.getPurseForIssuer,
        offerDesc,
        offerPayments,
      );
      return offerId;
    },

    burnEscrowReceipt: async (instanceId, escrowReceipt) => {
      const amount = await escrowReceiptIssuer.burnAll(escrowReceipt);
      const { id } = amount.quantity;
      const offerIds = harden([id]);
      fillInUndefinedQuantities(
        adminState,
        readOnlyState,
        offerIds,
        instanceId,
      );
      return amount.quantity;
    },

    // read-only, side-effect-free access below this line:
    makeEmptyQuantities: () =>
      makeEmptyQuantities(readOnlyState.getStrategies()),
    getStrategies: readOnlyState.getStrategies,
    getQuantitiesFor: readOnlyState.getQuantitiesFor,
    getOfferDescsFor: readOnlyState.getOfferDescsFor,
    getSeatIssuer: () => seatIssuer,
    getEscrowReceiptIssuer: () => escrowReceiptIssuer,
  });

  // The `publicFacet` of the zoe has three main methods: `makeInstance`
  // installs a governing contract and creates an instance,
  // `getInstance` credibly retrieves an instance from zoe, and
  // `escrow` allows users to securely escrow and get an escrow
  // receipt and claimPayoffs payment in return.

  const publicFacet = harden({
    getSeatIssuer: () => seatIssuer,
    getEscrowReceiptIssuer: () => escrowReceiptIssuer,
    getIssuersForInstance: instanceId => readOnlyState.getIssuers(instanceId),

    /**
     * Installs a governing contract and returns a reference to the
     * instance object, a unique id for the instance that can be
     * shared, and the name of the governing contract installed.
     * @param  {string} libraryName - the wellknown name for the
     * governing contract to be installed
     * @param  {object[]} issuers - an array of issuers to be used in
     * the governing contract. This determines the order of the offer
     * description elements and offer payments accepted by the
     * governing contract.
     */
    makeInstance: (libraryName, issuers) => {
      const makeContractFn = contractLib[libraryName];
      const instanceId = harden({});
      const instance = makeContractFn(governingContractFacet, instanceId);
      adminState.addInstance(instanceId, instance, libraryName, issuers);
      return harden({
        instance,
        instanceId,
        libraryName,
      });
    },
    /**
     * Credibly retrieves an instance given an instanceId.
     * @param {object} instanceId - the unique object for the instance
     */
    getInstance: instanceId => {
      const instance = adminState.getInstance(instanceId);
      const libraryName = adminState.getLibraryName(instanceId);
      return harden({
        instance,
        instanceId,
        libraryName,
      });
    },

    /**
     * @param  {offerDescElem[]} offerDesc - the offer description, an
     * array of objects with `rule` and `amount` properties.
     * @param  {payment[]} offerPayments - payments corresponding to
     * the offer description. A payment may be `undefined` in the case
     * of specifying a `want`.
     */
    escrow: async (offerDesc, offerPayments) => {
      const { offerId, result } = await escrowOffer(
        adminState.recordOffer,
        adminState.getPurseForIssuer,
        offerDesc,
        offerPayments,
      );

      const escrowReceiptPaymentP = mintEscrowReceiptPayment(
        escrowReceiptMint,
        offerId,
        offerDesc,
      );

      const claimPayoffPaymentP = mintClaimPayoffPayment(
        seatMint,
        addUseObj,
        offerDesc,
        result,
      );

      return {
        escrowReceipt: escrowReceiptPaymentP,
        claimPayoff: claimPayoffPaymentP,
      };
    },
  });
  return publicFacet;
};

export { makeZoe };
