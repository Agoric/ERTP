/* global E */

// Copyright (C) 2019 Agoric, under Apache License 2.0

// For external documentation, see scooter.chainmail

import harden from '@agoric/harden';
import { insist } from '../../util/insist';
import makePromise from '../../util/makePromise';
import { makePeg } from '../issuers';
import { mustBeComparable } from '../../util/sameStructure';

const scooterContract = harden({
  start: (terms, inviteMaker) => {
    const {
      issuers: [...issuerPs],
      sentry: sentryP,
    } = terms;

    insist(issuerPs.length === 2)`\
Must be exactly two issuers: ${terms.issuers}`;
    const indexes = Object.keys(issuerPs);

    function otherSide(side) {
      insist(side === 0 || side === 1)`\
side must be 0 or 1: ${side}`;
      return 1 - side;
    }

    // Compare amounts this way, rather than sameStructure, since
    // amounts are not necessarily in a canonical representation.
    function sameAmount(assay, amount1, amount2) {
      return (
        assay.includes(amount1, amount2) && assay.includes(amount2, amount1)
      );
    }

    // Currently, we omit the optional args to makePeg, so currently
    // scooter is only compatible with simple default Nat
    // issuers. However, we try to keep much of the code below
    // general.
    const pegPs = issuerPs.map(issuerP => makePeg(E, issuerP));
    return Promise.all(pegPs).then(pegs => {
      const localIssuers = pegs.map(peg => peg.getLocalIssuer());
      const localAssays = localIssuers.map(issuer => issuer.getAssay());

      // Validate that each slice adds up to the same total erights.
      function validateConserved(statuses, statusUpdates) {
        for (const i of indexes) {
          const localAssay = localAssays[i];
          function totalAmount(offerStatuses) {
            function reduceAmount(amountSoFar, offerStatus) {
              return localAssay.with(amountSoFar, offerStatus.balances[i]);
            }
            return offerStatuses.reduce(reduceAmount, localAssay.empty());
          }
          const oldTotal = totalAmount(i, statuses);
          const newTotal = totalAmount(i, statusUpdates);
          insist(sameAmount(localAssay, oldTotal, newTotal))`\
Total amount[${i}] not conserved:, ${oldTotal} vs ${newTotal}`;
        }
      }

      // ********** The mutable state of a scooter instance ************

      // To rearrange erights, we first drain all local purses into
      // this pot, and then refill them all from this pot.  This
      // should only be non-empty in the midst of a call to
      // scooter.updateOffers.
      const potOfPurses = localIssuers.map(issuer => issuer.makeEmptyPurse());

      // From OfferId to InternalOffer. See below for the mutable
      // state of each placed offer.
      const offerPool = new WeakMap();

      // ****** End of the mutable state of a scooter instance ********

      function validatePotEmpty() {
        for (const i of indexes) {
          insist(localAssays[i].isEmpty(potOfPurses[i]))`\
Internal: pot of purses not fully drained: ${i}`;
        }
      }

      const scooter = harden({
        inviteToPlaceOffer(offeredSide) {
          const neededSide = otherSide(offeredSide);

          const offerId = harden({});
          let offerPlacerEnabled = true;

          const offerPlacer = harden({
            getOfferedSide() {
              return offeredSide;
            },

            getNeededSide() {
              return neededSide;
            },

            placeOneOffer(offeredPaymentP, neededAmount) {
              insist(offerPlacerEnabled)`\
This offer placer is used up`;
              offerPlacerEnabled = false;

              const escrowedPaymentP = pegs[offeredSide].retainAll(
                offeredPaymentP,
              );
              return Promise.resolve(escrowedPaymentP).then(escrowedPayment => {
                neededAmount = localAssays[neededSide].coerce(neededAmount);

                // ********** The mutable state of a placed offer ************

                const localPurses = localIssuers.map(issuer =>
                  issuer.makeEmptyPurse(),
                );

                let offerState = 'placed';

                let exitBalances;
                const exitPaymentsPR = makePromise();

                // ******* End of the mutable state of a placed offer *********

                const offeredAmount = localPurses[offeredSide].depositAllNow(
                  escrowedPayment,
                );

                const offerDescription = harden({
                  offeredSide,
                  offeredAmount,
                  neededSide,
                  neededAmount,
                });
                const describe = harden(() => offerDescription);

                function getCurrentStatus() {
                  const isInPool = offerPool.has(offerId);
                  let balances;
                  if (isInPool) {
                    insist(exitBalances === undefined)`\
Internal: There should not be exit balances until exiting`;
                    balances = localPurses.map(localPurse =>
                      localPurse.getBalance(),
                    );
                  } else {
                    balances = exitBalances;
                  }
                  return harden({
                    balances,
                    offerState,
                    isInPool,
                  });
                }

                // These InternalOffers must remain fully encapsulated
                // within scooter. The must not be exposed to either the
                // governing contract nor the players.
                const internalOffer = harden({
                  describe,
                  getCurrentStatus,

                  validateUpdate(statusUpdate) {
                    const offeredAssay = localAssays[offeredSide];
                    const offeredBalance = statusUpdate.balances[offeredSide];
                    const refundOk = offeredAssay.includes(
                      offeredBalance,
                      offeredAmount,
                    );
                    const neededAssay = localAssays[neededSide];
                    const neededBalance = statusUpdate.balances[neededSide];
                    const winningsOk = neededAssay.includes(
                      neededBalance,
                      neededAmount,
                    );
                    insist(refundOk || winningsOk)`\
Offer safety would be violated: ${offerDescription} vs ${statusUpdate}`;
                  },

                  drainERights() {
                    for (const i of indexes) {
                      const payment = localPurses[i].withdrawAll();
                      potOfPurses[i].depositAll(payment);
                    }
                  },

                  // Return whether this one remains
                  updateStatus(statusUpdate) {
                    for (const i of indexes) {
                      const amount = statusUpdate.balances[i];
                      const payment = potOfPurses[i].withdraw(amount);
                      potOfPurses[i].depositAll(payment);
                    }
                    offerState = statusUpdate.offerState;

                    if (statusUpdate.isInPool) {
                      return true;
                    }
                    const exitPaymentPs = indexes.map(i =>
                      pegs[i].redeemAll(localPurses[i].withdrawAll()),
                    );
                    exitPaymentsPR.res(exitPaymentPs);
                    offerPool.delete(offerId);
                    exitBalances = statusUpdate.balances;
                    return false;
                  },
                });

                // This is returned to the player. The player should
                // talk to the governing contract about this offer
                // using only offerHandle.getStatus().offerId
                const offerHandle = harden({
                  describe,
                  getCurrentStatus,

                  getExitPayments() {
                    return exitPaymentsPR.p;
                  },

                  requestExit() {
                    return E(sentryP).noticeOfferExitRequested(offerId);
                  },
                });

                offerPool.set(offerId, internalOffer);
                E(sentryP).noticeOfferEntered(offerId);
                return offerHandle;
              });
            },
          });

          // By wrapping it in an invite, the player knows that, if
          // redeemed, no one else has access to this offerPlacer
          // other than the player and scooter itself. Thus, it can
          // transfer rights using the offerPlacer without giving the
          // governining contract access to those rights, relying only
          // on scooter to enforce offer safety.
          return [
            inviteMaker.make(['offer sealer', offeredSide], offerPlacer),
            offerId,
          ];
        },

        // ************ other scooter methods *********

        describeOffers([...offerIds]) {
          return offerIds.map(id => offerPool.get(id).describe());
        },

        getOfferStatuses([...offerIds]) {
          return offerIds.map(id => offerPool.get(id).getCurrentStatus());
        },

        updateOffers([...offerIds], [...statusUpdates]) {
          const remainingIds = [];
          mustBeComparable(statusUpdates);
          const statuses = scooter.getOfferStatuses(offerIds);

          // phase 0 validate the common pot is empty
          validatePotEmpty();

          // phase 1 validate erights totals remain the same
          validateConserved(statuses, statusUpdates);

          // phase 2 validate each update individually
          //    * the update must satisfy offer safety
          for (const k of Object.keys(offerIds)) {
            offerPool.get(offerIds[k]).validateUpdate(statusUpdates[k]);
          }

          // phase 3 drain all erights into a common pot
          for (const id of offerIds) {
            offerPool.get(id).drainERights();
          }

          // phase 4 update each to match its statusUpdate
          //    * refill from the common pot
          //    * set the state
          //    * if exiting, process removal
          //    * remember who remains
          for (const k of Object.keys(offerIds)) {
            const id = offerIds[k];
            if (offerPool.get(id).updateStatus(statusUpdates[k])) {
              remainingIds.push(id);
            }
          }

          // phase 5 validate the common pot is empty again
          validatePotEmpty();

          // phase 6 governing contract should also remember who remains
          return harden(remainingIds);
        },
      });
      return scooter;
    });
  },
});

const scooterSrcs = harden({
  start: `${scooterContract.start}`,
});

export { scooterSrcs };
