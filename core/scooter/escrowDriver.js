/* global E */

import harden from '@agoric/harden';
import {
  isOfferSafe,
  areOffersSafe,
  offerTotals,
  areAmountsConserved,
} from './scooterUtils';


const escrowExchange = harden({
  start: (terms, inviteMaker) => {
    const {
      neededAmounts: [...neededAmounts],
      scooterInstallation: scooterInstallationP,
    } = terms;

    const issuerPs = neededAmounts.map(amount => amount.label.issuer);
    const scooterP = E(scooterInstallationP).spawn(harden({ issuerPs }));

    const offerIds = [];
    const descriptions = [];
    let statuses = [];
    let isShutdown = false;

    function shutdown() {
      statuses = statuses.map(status => ({ ...status, isInPool: false }));
      E(scooterP).updateOffers(offerIds, statuses);
      offerIds.length = descriptions.length = statuses.length = 0;
      isShutdown = true;
    }

    function makeInvite(offeredSide, neededSide) {
      const sentry = harden({
        noticeOfferEntered(offerId, description, status) {
          offerIds.push(offerId);
          descriptions.push(description);
          statuses.push(status);

          if (isShutdown) {
            shutdown();
          } else if (offerIds.length === 2) {
            const newStatuses = [
              { ...statuses[0], balances: statuses[1].balances },
              { ...statuses[1], balances: statuses[0].balances },
            ];
            shutdown();
          }
        },
        noticeOfferExitRequested(offerId) {
          shutdown();
        },
      });
      return E(scooterP).inviteToPlaceOffer(sentry, offeredSide, neededSide);
    }
    return harden([makeInvite(0, 1), makeInvite(1, 0)]);
  },
});
