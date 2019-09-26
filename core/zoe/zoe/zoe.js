import harden from '@agoric/harden';

import { insist } from '../../../util/insist';
import { isOfferSafeForAll } from './isOfferSafe';
import { areRightsConserved } from './areRightsConserved';
import { toAmountMatrix, makeEmptyQuantities } from '../contractUtils';

import {
  makePayments,
  escrowEmptyOffer,
  escrowOffer,
  mintEscrowReceiptPayment,
  mintClaimPayoffPayment,
} from './zoeUtils';

import { makeState } from './state';
import { makeSeatMint } from '../../seatMint';
import { makeEscrowReceiptConfig } from './escrowReceiptConfig';
import { makeMint } from '../../issuers';

const makeZoe = () => {
  // The seatIssuer and escrowReceiptIssuer are long-lived identities
  // over many contract instances
  const { seatMint, seatIssuer, addUseObj } = makeSeatMint('zoeSeats');
  const escrowReceiptMint = makeMint(
    'zoeEscrowReceipts',
    makeEscrowReceiptConfig,
  );
  const escrowReceiptIssuer = escrowReceiptMint.getIssuer();

  return harden({
    makeInstance: (makeContract, issuers) => {
      const { adminState, readOnlyState } = makeState(issuers);

      // A zoeInstance has two different facets: the userFacet and the
      // governingContract facet. Neither facet should give direct access to
      // the `adminState`.

      // The `userFacet` of the zoeInstance only has two methods:
      // `escrow`, which allows users to securely escrow and get an
      // escrow receipt and winnings payment in return, and
      // `getIssuers` which provides a readOnly view of the issuers.

      const userFacet = harden({
        escrow: async (offerDesc, payments) => {
          const { offerId, result } = await escrowOffer(
            adminState,
            readOnlyState.getStrategies(),
            offerDesc,
            payments,
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
        getIssuers: readOnlyState.getIssuers,
      });

      // The `governingContractFacet` is what is accessible by the
      // governing contract. The governing contract at no time has
      // access to the users' payments or the Zoe purses, or any of
      // the `adminState` of Zoe. The governing contract can do a
      // couple of things. It can propose a reallocation of
      // quantities, eject an offer, and interestingly, can create a
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
         * @param  {array} offerIds - an array of offerIds
         * @param  {matrix} reallocation - a matrix of quantities,
         * with one array of quantities per offerId. This is likely
         * a subset of the full quantitiesMatrix.
         */
        reallocate: (offerIds, reallocation) => {
          const offerDescs = readOnlyState.getOfferDescsFor(offerIds);
          const currentQuantities = readOnlyState.getQuantitiesFor(offerIds);

          // 1) ensure that rights are conserved
          insist(
            areRightsConserved(
              readOnlyState.getStrategies(),
              currentQuantities,
              reallocation,
            ),
          )`Rights are not conserved in the proposed reallocation`;

          // 2) ensure 'offer safety' for each player
          const amounts = toAmountMatrix(
            readOnlyState.getAssays(),
            reallocation,
          );
          insist(
            isOfferSafeForAll(readOnlyState.getAssays(), offerDescs, amounts),
          )`The proposed reallocation was not offer safe`;

          // 3) save the reallocation
          adminState.setQuantitiesFor(offerIds, reallocation);
        },

        /**
         * The governing contract can "eject" a player to remove them
         * from the ongoing governing contract and resolve the
         * `result` promise with their payouts (either winnings or
         * refunds). Because Zoe only allows for reallocations that
         * conserve rights and are 'offer safe', we don't need to do
         * those checks at this step and can assume that the
         * invariants hold.
         * @param  {array} offerIds - an array of offerIds
         */
        eject: offerIds => {
          const quantities = readOnlyState.getQuantitiesFor(offerIds);
          const amounts = toAmountMatrix(readOnlyState.getAssays(), quantities);
          const payments = makePayments(adminState.getPurses(), amounts);
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
        escrowEmptyOffer: () =>
          escrowEmptyOffer(
            adminState,
            readOnlyState.getAssays(),
            readOnlyState.getStrategies(),
          ),

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
            adminState,
            readOnlyState.getStrategies(),
            offerDesc,
            offerPayments,
          );
          return offerId;
        },

        burnEscrowReceipt: async escrowReceipt => {
          const amount = await escrowReceiptIssuer.burnAll(escrowReceipt);
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

      return harden({
        zoeInstance: userFacet,
        governingContract: makeContract(governingContractFacet),
      });
    },
    getSeatIssuer: () => seatIssuer,
    getEscrowReceiptIssuer: () => escrowReceiptIssuer,
  });
};

export { makeZoe };
