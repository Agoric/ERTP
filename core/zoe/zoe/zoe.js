import harden from '@agoric/harden';
import { E } from '@agoric/eventual-send';

import { insist } from '../../../util/insist';
import makePromise from '../../../util/makePromise';

import { isOfferSafeForAll } from './invariantChecks/isOfferSafe';
import { areRightsConserved } from './invariantChecks/areRightsConserved';
import { evalContractCode } from './evalContractCode';

import {
  escrowEmptyOffer,
  completeOffers,
  makeEmptyExtents,
  getAssaysFromPayoutRules,
} from './zoeUtils';

import { makeState } from './db/views';
import { makeSeatMint } from '../../seatMint';
import { makeEscrowReceiptConfig } from './escrowReceiptConfig';
import { makeMint } from '../../mint';

/**
 * Create an instance of Zoe.
 *
 * @param additionalEndowments pure or pure-ish endowments to add to evaluator
 */
const makeZoe = (additionalEndowments = {}) => {
  // Zoe has two mints: a mint for invites and a mint for
  // escrowReceipts. The invite mint can be used by a smart contract
  // to create invites to take certain actions in the smart contract.
  // An escrowReceipt is an ERTP payment that is proof of
  // escrowing assets with Zoe.
  const {
    seatMint: inviteMint,
    seatAssay: inviteAssay,
    addUseObj: inviteAddUseObj,
  } = makeSeatMint('zoeInvite');

  const escrowReceiptMint = makeMint(
    'zoeEscrowReceipts',
    makeEscrowReceiptConfig,
  );
  const escrowReceiptAssay = escrowReceiptMint.getAssay();

  const {
    installationTable,
    instanceTable,
    offerTable,
    assayTable,
  } = makeState();

  // Zoe has two different facets: the public Zoe service and the
  // contract facet. The contract facet is what is accessible to the
  // smart contract instance and is remade for each instance. The
  // contract at no time has access to the users' payments or the Zoe
  // purses. The contract can only do a few things through the Zoe
  // contract facet. It can propose a reallocation of extents,
  // complete an offer, and can create a new offer itself for
  // record-keeping and other various purposes.

  const makeContractFacet = instanceHandle => {
    const contractFacet = harden({
      /**
       * The contract can propose a reallocation of units per
       * offer, which will only succeed if the reallocation 1)
       * conserves rights, and 2) is 'offer-safe' for all parties
       * involved. This reallocation is partial, meaning that it
       * applies only to the units associated with the offerHandles
       * that are passed in. We are able to ensure that with
       * each reallocation, rights are conserved and offer safety is
       * enforced for all offers, even though the reallocation is
       * partial, because once these invariants are true, they will
       * remain true until changes are made.
       * @param  {object[]} offerHandles - an array of offerHandles
       * @param  {assay[]} assays - the canonical ordering of assays
       * for this reallocation. The units in each newUnitMatrix row
       * will be in this order.
       * @param  {unit[][]} newUnitMatrix - a matrix of units, with
       * one array of units per offerHandle.
       */
      reallocate: (offerHandles, assays, newUnitMatrix) => {
        const payoutRuleMatrix = offerTable.getPayoutRuleMatrix(
          offerHandles,
          assays,
        );
        const currentUnitMatrix = offerTable.getUnitsMatrix(
          offerHandles,
          assays,
        );
        const unitOpsArray = assayTable.getUnitOpsArray(assays);

        // 1) ensure that rights are conserved
        insist(
          areRightsConserved(unitOpsArray, currentUnitMatrix, newUnitMatrix),
        )`Rights are not conserved in the proposed reallocation`;

        // 2) ensure 'offer safety' for each player
        insist(
          isOfferSafeForAll(unitOpsArray, payoutRuleMatrix, newUnitMatrix),
        )`The proposed reallocation was not offer safe`;

        // 3) save the reallocation
        offerTable.setExtentMatrix(offerHandles, assays, newUnitMatrix);
      },

      /**
       * The contract can "complete" an offer to remove it from the
       * ongoing contract and resolve the player's payouts (either
       * winnings or refunds). Because Zoe only allows for
       * reallocations that conserve rights and are 'offer-safe', we
       * don't need to do those checks at this step and can assume
       * that the invariants hold.
       * @param  {object[]} offerHandles - an array of offerHandles
       */
      complete: offerHandles =>
        completeOffers(adminState, readOnlyState, offerHandles),

      /**
       *  The contract can create an empty offer and get the
       *  associated offerHandle. This allows the contract to use this
       *  offer slot for record-keeping. For instance, to represent a
       *  pool, the contract can create an empty offer and then
       *  reallocate other extents to this offer.
       */
      escrowEmptyOffer: () => {
        const assays = readOnlyState.getAssays(instanceHandle);
        const labels = readOnlyState.getLabelsForInstanceHandle(instanceHandle);
        const extentOpsArray = readOnlyState.getExtentOpsArrayForInstanceHandle(
          instanceHandle,
        );

        const { offerHandle } = escrowEmptyOffer(
          adminState.recordOffer,
          assays,
          labels,
          extentOpsArray,
        );
        return offerHandle;
      },
      /**
       *  The contract can also create a real offer and get the
       *  associated offerHandle, bypassing the escrow receipt
       *  creation. This allows the contract to make offers on the
       *  users' behalf, as happens in the `addLiquidity` step of the
       *  `autoswap` contract.
       */
      escrowOffer: async (offerRules, offerPayments) => {
        const { offerHandle } = await escrowOffer(
          adminState.recordOffer,
          adminState.recordAssay,
          offerRules,
          offerPayments,
        );
        return offerHandle;
      },

      /**
       * Burn the escrowReceipt ERTP payment using the escrowReceipt
       * assay. Burning in ERTP also validates that the alleged payment was
       * produced by the assay, and returns the
       * units of the payment.
       *
       * This method also checks if the offer has been completed and
       * errors if it has, so that a smart contract doesn't continue
       * thinking that the offer is live. Additionally, we record that
       * the escrowReceipt is used in this particular contract.
       *
       * @param  {object} escrowReceipt - an ERTP payment
       * representing proof of escrowing specific assets with Zoe.
       */

      burnEscrowReceipt: async escrowReceipt => {
        const units = await escrowReceiptAssay.burnAll(escrowReceipt);
        const { offerHandle } = units.extent;
        const { inactive } = readOnlyState.getStatusFor(harden([offerHandle]));
        if (inactive.length > 0) {
          return Promise.reject(new Error('offer was cancelled'));
        }
        return units;
      },
      /**
       * Make a credible Zoe invite for a particular smart contract
       * indicated by the unique `instanceHandle`. The other
       * information in the extent of this invite is decided by the
       * governing contract and should include whatever information is
       * necessary for a potential buyer of the invite to know what
       * they are getting. Note: if information can be derived in
       * queries based on other information, we choose to omit it. For
       * instance, `installationHandle` can be derived from
       * `instanceId` and is omitted even though it is useful.
       * @param  {object} contractDefinedExtent - an object of
       * information to include in the extent, as defined by the smart
       * contract
       * @param  {object} useObj - an object defined by the smart
       * contract that is the use right associated with the invite. In
       * other words, buying the invite is buying the right to call
       * methods on this object.
       */
      makeInvite: (contractDefinedExtent, useObj) => {
        const inviteExtent = harden({
          ...contractDefinedExtent,
          handle: harden({}),
          instanceHandle,
        });
        const invitePurseP = inviteMint.mint(inviteExtent);
        inviteAddUseObj(inviteExtent.handle, useObj);
        const invitePaymentP = invitePurseP.withdrawAll();
        return invitePaymentP;
      },

      /** read-only, side-effect-free access below this line */
      getStatusFor: readOnlyState.getStatusFor,
      makeEmptyExtents: () =>
        makeEmptyExtents(
          readOnlyState.getExtentOpsArrayForInstanceHandle(instanceHandle),
        ),
      getExtentOpsArray: () =>
        readOnlyState.getExtentOpsArrayForInstanceHandle(instanceHandle),
      getLabels: () => readOnlyState.getLabelsForInstanceHandle(instanceHandle),
      getExtentsFor: readOnlyState.getExtentsFor,
      getPayoutRulesFor: readOnlyState.getPayoutRulesFor,
      getInviteAssay: () => inviteAssay,
    });
    return contractFacet;
  };

  // The public Zoe service has four main methods: `install` takes
  // contract code and registers it with Zoe associated with an
  // `installationHandle` for identification, `makeInstance` creates
  // an instance from an installation, `getInstance` credibly
  // retrieves an instance from zoe, and `escrow` allows users to
  // securely escrow and get an escrow receipt and payouts in return.

  const zoeService = harden({
    getEscrowReceiptAssay: () => escrowReceiptAssay,
    getInviteAssay: () => inviteAssay,
    /**
     * Create an installation by safely evaluating the code and
     * registering it with Zoe.
     */
    install: code => {
      const installation = evalContractCode(code, additionalEndowments);
      const installationHandle = harden({});
      const installationRecord = installationTable.create(
        installationHandle,
        harden({ installation }),
      );
      return installationRecord;
    },
    /**
     * Makes a contract instance from an installation and returns a
     * unique handle for the instance that can be shared, as well as
     * other information, such as the terms used in the instance.
     * @param  {object} installationHandle - the unique handle for the
     * installation
     * @param  {object} terms - arguments to the contract. These
     * arguments depend on the contract, apart from the `assays`
     * property, which is required.
     */
    makeInstance: async (installationHandle, userDefinedTerms) => {
      const { installation } = installationTable.get(installationHandle);
      const instanceHandle = harden({});
      const contractFacet = makeContractFacet(instanceHandle);
      const { instance, assays } = installation.makeContract(
        contractFacet,
        userDefinedTerms,
      );
      const terms = harden({ ...userDefinedTerms, assays });
      const instanceRecord = harden({
        instanceHandle,
        installationHandle,
        instance,
        terms,
        assays,
      });

      return instanceTable.create(instanceHandle, instanceRecord);
    },
    /**
     * Credibly retrieves an instance record given an instanceHandle.
     * @param {object} instanceHandle - the unique, unforgeable
     * identifier (empty object) for the instance
     */
    getInstance: instanceTable.get,

    /**
     * @param  {object} instanceHandle - unique, unforgeable
     * identifier for instances. (This is an empty object.)
     * @param  {offerRule[]} offerRules - the offer rules, an object
     * with properties `payoutRules` and `exitRule`.
     * @param  {payment[]} offerPayments - payments corresponding to
     * the offer description. A payment may be `undefined` in the case
     * of specifying a `want`.
     */
    escrow: (instanceHandle, offerRules, offerPayments) => {
      // Columns: offerHandle | instanceHandle | assays | payoutRules
      // | exitRule | extents | payoutPromise

      const assays = getAssaysFromPayoutRules(offerRules.payoutRules);
      const offerHandle = harden({}); // the unique unforgeable identifer

      const offerImmutableRecord = {
        offerHandle,
        instanceHandle,
        payoutRules: offerRules.payoutRules,
        exitRule: offerRules.exitRule,
        assays,
        payoutPromise: makePromise(),
      };

      // extents should only be gotten after the payments are deposited
      offerTable.create(offerHandle, offerImmutableRecord);

      const getOrCreateAssay = assay => {
        const makeExtentOps = (library, extentOpsName, extentOpsArgs) =>
          library[extentOpsName](...extentOpsArgs);

        if (!assayTable.has(assay)) {
          const extentOpsDescP = E(assay).getExtentOps();
          const assayRecord = {
            assay,
            purseP: E(assay).makeEmptyPurse(),
            extentOpsDescP,
            unitOpsP: E(assay).getUnitOps(),
            labelP: E(assay).getLabel(),
            extentOpsP: extentOpsDescP.then(({ name, extentOpArgs = [] }) =>
              makeExtentOps(extentOpsLib, name, extentOpArgs),
            ),
          };
          return assayTable.create(assay, assayRecord);
        }
        return assayTable.get(assay);
      };

      // Promise flow = assay -> purse -> deposit payment -> escrow receipt
      const paymentBalancesP = assays.map((assay, i) => {
        const { purseP, extentOpsP } = getOrCreateAssay(assay);
        const payoutRule = offerRules.payoutRules[i];
        const offerPayment = offerPayments[i];

        return Promise.all([purseP, extentOpsP]).then(([purse, extentOps]) => {
          if (payoutRule.kind === 'offer') {
            return E(purse)
              .depositExactly(payoutRule.units, offerPayment)
              .then(balance => balance.extent);
          }
          insist(
            offerPayments[i] === undefined,
          )`payment was included, but the rule kind was ${payoutRule.kind}`;
          return Promise.resolve(extentOps.empty());
        });
      });

      const giveEscrowReceipt = extents => {
        // Record extents for offer.
        offerTable.createExtents(offerHandle, extents);

        // Create escrow receipt.
        const escrowReceiptExtent = harden({
          offerHandle,
          offerRules,
        });
        const escrowReceiptPurse = escrowReceiptMint.mint(escrowReceiptExtent);
        const escrowReceiptPaymentP = escrowReceiptPurse.withdrawAll();

        // Create escrow result to be returned. Depends on exitRules.
        const escrowResult = {
          escrowReceipt: escrowReceiptPaymentP,
          payout: offerImmutableRecord.payoutPromise.p,
        };
        const { exitRule } = offerRules;

        // Automatically cancel on deadline.
        if (exitRule.kind === 'afterDeadline') {
          exitRule.timer.setWakeup(
            exitRule.deadline,
            harden({
              wake: () =>
                completeOffers(
                  adminState,
                  readOnlyState,
                  harden([offerHandle]),
                ),
            }),
          );
        }

        // Add an object with a cancel method to escrow result in
        // order to cancel on demand.
        if (exitRule.kind === 'onDemand') {
          escrowResult.cancelObj = {
            cancel: () =>
              completeOffers(adminState, readOnlyState, harden([offerHandle])),
          };
        }
        return harden(escrowResult);
      };

      const allDepositedP = Promise.all(paymentBalancesP);
      return allDepositedP.then(giveEscrowReceipt);
    },
  });
  return zoeService;
};

export { makeZoe };
