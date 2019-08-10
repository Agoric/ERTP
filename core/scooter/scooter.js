/* global E */

// Copyright (C) 2019 Agoric, under Apache License 2.0

// For external documentation, see scooter.chainmail

import harden from '@agoric/harden';
import { insist } from '../../util/insist';
import makePromise from '../../util/makePromise';
import { makePeg } from '../issuers';
import { mustBeComparable } from '../../util/sameStructure';
import { isOfferSafe, areAmountsConserved } from './scooterUtils';

const scooterContract = harden({
  start: (terms, inviteMaker) => {
    const {
      issuers: [...issuerPs],
    } = terms;

    insist(issuerPs.length >= 2)`\
Must be at least two issuers: ${terms.issuers}`;
    const sides = Object.keys(issuerPs);

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
        insist(areAmountsConserved(localAssays, statuses, statusUpdates))`\
Proposed rearrangement would not conserve erights: ${statusUpdates}`;
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
        for (const side of sides) {
          insist(localAssays[side].isEmpty(potOfPurses[side]))`\
Internal: pot of purses not fully drained: ${side}`;
        }
      }

      const scooter = harden({
        // Create an invite for obtaining an offer seat for placing an
        // offer.
        inviteToPlaceOffer(sentryP, offeredSide, neededSide) {
          const offerId = harden({});
          let offerSeatEnabled = true;

          const offerSeat = harden({
            getOfferedSide() {
              return offeredSide;
            },

            getNeededSide() {
              return neededSide;
            },

            placeOneOffer(offeredPaymentP, neededAmount) {
              insist(offerSeatEnabled)`\
This offer seat is used up`;
              offerSeatEnabled = false;

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

                const offeredAmount = localPurses[offeredSide].depositAll(
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
                // within scooter. The must not be exposed to either
                // the driver nor the players.
                const internalOffer = harden({
                  describe,
                  getCurrentStatus,

                  validateUpdate(statusUpdate) {
                    insist(
                      isOfferSafe(localAssays, offerDescription, statusUpdate),
                    )`\
Offer safety would be violated: ${offerDescription} vs ${statusUpdate}`;
                  },

                  drainERights() {
                    for (const side of sides) {
                      const payment = localPurses[side].withdrawAll();
                      potOfPurses[side].depositAll(payment);
                    }
                  },

                  // Return whether this one remains
                  updateStatus(statusUpdate) {
                    for (const side of sides) {
                      const amount = statusUpdate.balances[side];
                      const payment = potOfPurses[side].withdraw(amount);
                      localPurses[side].depositAll(payment);
                    }
                    offerState = statusUpdate.offerState;

                    if (statusUpdate.isInPool) {
                      return true;
                    }
                    const exitPaymentPs = sides.map(side =>
                      pegs[side].redeemAll(localPurses[side].withdrawAll()),
                    );
                    exitPaymentsPR.res(exitPaymentPs);
                    offerPool.delete(offerId);
                    exitBalances = statusUpdate.balances;
                    return false;
                  },
                });

                // This is returned to the player, for operating the
                // offer.
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
                E(sentryP).noticeOfferEntered(
                  offerId,
                  offerDescription,
                  getCurrentStatus(),
                );
                return offerHandle;
              });
            },
          });

          // By wrapping it in an invite, the player knows that, if
          // redeemed, no one else has access to this offerSeat Thus,
          // it can trade erights using the offerSeat without giving
          // the driver access to those erights, relying only on
          // scooter to enforce offer safety.
          return inviteMaker.make(['offer seat', offeredSide], offerSeat);
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
          for (const [k, id] of Object.entries(offerIds)) {
            offerPool.get(id).validateUpdate(statusUpdates[k]);
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
          for (const [k, id] of Object.entries(offerIds)) {
            if (offerPool.get(id).updateStatus(statusUpdates[k])) {
              remainingIds.push(id);
            }
          }

          // phase 5 validate the common pot is empty again
          validatePotEmpty();

          // phase 6 the driver should also remember who remains
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
