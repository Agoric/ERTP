import harden from '@agoric/harden';
import { E } from '@agoric/eventual-send';

import { insist } from '../../util/insist';
import makePromise from '../../util/makePromise';

import { isOfferSafeForAll } from './invariantChecks/isOfferSafe';
import { areRightsConserved } from './invariantChecks/areRightsConserved';
import { evalContractCode } from './evalContractCode';

import { makeTables } from './state';
import { makeSeatMint } from '../seatMint';

const getAssaysFromPayoutRules = payoutRules =>
  payoutRules.map(payoutRule => payoutRule.units.label.assay);

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
    setSeat: setInviteSeat,
    redeem: redeemInvite,
  } = makeSeatMint('zoeInvite');

  const {
    installationTable,
    instanceTable,
    offerTable,
    assayTable,
  } = makeTables();

  const completeOffers = (offerHandles, assays) => {
    const { inactive } = offerTable.getOfferStatuses(offerHandles);
    if (inactive.length > 0) {
      throw new Error(`offer has already completed`);
    }
    const unitMatrix = offerTable.getUnitMatrix(offerHandles, assays);
    const payoutPromises = offerTable.getPayoutPromises(offerHandles);
    offerTable.deleteOffers(offerHandles);
    const pursesP = assayTable.getPursesForAssays(assays);
    Promise.all(pursesP).then(purses => {
      for (let i = 0; i < offerHandles.length; i += 1) {
        const unitsForOffer = unitMatrix[i];
        const payout = unitsForOffer.map((units, j) =>
          E(purses[j]).withdraw(units, 'payout'),
        );
        payoutPromises[i].res(payout);
      }
    });
  };

  const makeEmptyPayoutRules = unitOpsArray =>
    unitOpsArray.map(unitOps =>
      harden({
        kind: 'want',
        units: unitOps.empty(),
      }),
    );

  const makeInvite = (
    instanceHandle,
    seat,
    contractDefinedExtent = harden({}),
  ) => {
    const inviteHandle = harden({});
    const inviteUnits = inviteAssay.makeUnits(
      harden({
        ...contractDefinedExtent,
        handle: inviteHandle,
        instanceHandle,
      }),
    );
    const invitePurse = inviteMint.mint(inviteUnits);
    setInviteSeat(inviteHandle, seat);
    const invitePayment = invitePurse.withdrawAll();
    return harden({ invite: invitePayment, inviteHandle });
  };

  // Zoe has two different facets: the public Zoe service and the
  // contract facet. The contract facet is what is accessible to the
  // smart contract instance and is remade for each instance. The
  // contract at no time has access to the users' payments or the Zoe
  // purses. The contract can only do a few things through the Zoe
  // contract facet. It can propose a reallocation of units,
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
        const currentUnitMatrix = offerTable.getUnitMatrix(
          offerHandles,
          assays,
        );
        const unitOpsArray = assayTable.getUnitOpsForAssays(assays);

        // 1) ensure that rights are conserved
        insist(
          areRightsConserved(unitOpsArray, currentUnitMatrix, newUnitMatrix),
        )`Rights are not conserved in the proposed reallocation`;

        // 2) ensure 'offer safety' for each player
        insist(
          isOfferSafeForAll(unitOpsArray, payoutRuleMatrix, newUnitMatrix),
        )`The proposed reallocation was not offer safe`;

        // 3) save the reallocation
        offerTable.updateUnitMatrix(offerHandles, assays, newUnitMatrix);
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
      complete: completeOffers,

      makeEmptyOffer: assays => {
        const offerHandle = harden({});
        const unitOpsArray = assayTable.getUnitOpsForAssays(assays);
        const offerImmutableRecord = {
          offerHandle,
          instanceHandle,
          payoutRules: makeEmptyPayoutRules(unitOpsArray),
          exitRule: { kind: 'onDemand' },
          assays,
          units: unitOpsArray.map(unitOps => unitOps.empty()),
          payoutPromise: makePromise(),
        };
        offerTable.create(offerHandle, offerImmutableRecord);
        return offerHandle;
      },

      makeWantNothingOffer: (assays, offerPayments) => {
        const offerHandle = harden({});
        const unitOpsArray = assayTable.getUnitOpsForAssays(assays);
        const offerImmutableRecord = {
          offerHandle,
          instanceHandle,
          payoutRules: makeEmptyPayoutRules(unitOpsArray),
          exitRule: { kind: 'onDemand' },
          assays,
          payoutPromise: makePromise(),
        };

        // units should only be gotten after the payments are deposited
        offerTable.create(offerHandle, offerImmutableRecord);

        // Promise flow = assay -> purse -> deposit payment -> record units
        const paymentBalancesP = assays.map((assay, i) => {
          const { purseP, unitOpsP } = assayTable.getOrCreateAssay(assay);
          const offerPayment = offerPayments[i];

          return Promise.all([purseP, unitOpsP]).then(([purse, unitOps]) => {
            if (offerPayment !== undefined) {
              // We cannot trust these units since they come directly
              // from the remote assay and must coerce them.
              return E(purse)
                .depositAll(offerPayment)
                .then(units => unitOps.coerce(units));
            }
            return Promise.resolve(unitOps.empty());
          });
        });
        const allDepositedP = Promise.all(paymentBalancesP);
        return allDepositedP
          .then(unitsArray => offerTable.createUnits(offerHandle, unitsArray))
          .then(_ => offerHandle);
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
       * `instanceHandle` and is omitted even though it is useful.
       * @param  {object} contractDefinedExtent - an object of
       * information to include in the extent, as defined by the smart
       * contract
       * @param  {object} useObj - an object defined by the smart
       * contract that is the use right associated with the invite. In
       * other words, buying the invite is buying the right to call
       * methods on this object.
       */
      makeInvite: (seat, inviteExtent = {}) =>
        makeInvite(instanceHandle, seat, inviteExtent),
      getInviteAssay: () => inviteAssay,
      getPayoutRuleMatrix: offerTable.getPayoutRuleMatrix,
      getUnitOpsForAssays: assayTable.getUnitOpsForAssays,
      getOfferStatuses: offerTable.getOfferStatuses,
      getUnitMatrix: offerTable.getUnitMatrix,

      // for a particular offer
      getPayoutRules: offerTable.getPayoutRules,
      getExitRule: offerTable.getExitRule,
      isOfferActive: offerTable.isOfferActive,
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
      const { invite, publicAPI, terms } = installation.makeContract(
        contractFacet,
        userDefinedTerms,
      );
      const instanceRecord = harden({
        instanceHandle,
        installationHandle,
        terms,
        publicAPI,
        assays: terms.assays,
      });

      instanceTable.create(instanceHandle, instanceRecord);
      return {
        invite,
        instance: instanceRecord,
      };
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
     * the offer rules. A payment may be `undefined` in the case
     * of specifying a `want`.
     */
    redeem: async (invite, offerRules, offerPayments) => {
      // the invite handle is also the offer handle
      const { seat, handle: offerHandle, instanceHandle } = await redeemInvite(
        invite,
      );

      const assays = getAssaysFromPayoutRules(offerRules.payoutRules);

      const offerImmutableRecord = {
        offerHandle,
        instanceHandle,
        payoutRules: offerRules.payoutRules,
        exitRule: offerRules.exitRule,
        assays,
        payoutPromise: makePromise(),
      };

      // units should only be gotten after the payments are deposited
      offerTable.create(offerHandle, offerImmutableRecord);

      // Promise flow = assay -> purse -> deposit payment -> escrow receipt
      const paymentBalancesP = assays.map((assay, i) => {
        const { purseP, unitOpsP } = assayTable.getOrCreateAssay(assay);
        const payoutRule = offerRules.payoutRules[i];
        const offerPayment = offerPayments[i];

        return Promise.all([purseP, unitOpsP]).then(([purse, unitOps]) => {
          if (payoutRule.kind === 'offer') {
            // We cannot trust these units since they come directly
            // from the remote assay and must coerce them.
            return E(purse)
              .depositExactly(payoutRule.units, offerPayment)
              .then(units => unitOps.coerce(units));
          }
          insist(
            offerPayments[i] === undefined,
          )`payment was included, but the rule kind was ${payoutRule.kind}`;
          return Promise.resolve(unitOps.empty());
        });
      });

      const giveSeat = unitsArray => {
        // Record units for offer.
        offerTable.createUnits(offerHandle, unitsArray);

        // Create escrow result to be returned. Depends on exitRules.
        const escrowResult = {
          seat,
          payout: offerImmutableRecord.payoutPromise.p,
        };
        const { exitRule } = offerRules;

        // Automatically cancel on deadline.
        if (exitRule.kind === 'afterDeadline') {
          exitRule.timer.setWakeup(
            exitRule.deadline,
            harden({
              wake: () => completeOffers(harden([offerHandle]), assays),
            }),
          );
        }

        // Add an object with a cancel method to escrow result in
        // order to cancel on demand.
        if (exitRule.kind === 'onDemand') {
          escrowResult.cancelObj = {
            cancel: () => completeOffers(harden([offerHandle]), assays),
          };
        }
        return harden(escrowResult);
      };

      const allDepositedP = Promise.all(paymentBalancesP);
      return allDepositedP.then(giveSeat);
    },
  });
  return zoeService;
};

export { makeZoe };
