/* global E */

import harden from '@agoric/harden';

import { insist } from '../../util/insist';
import { makePeg } from '../issuers';
import { areOffersSafe } from './scooterUtils';

const escrowDriver = harden({
  start: (terms, _inviteMaker) => {
    const {
      scooterInstallation: scooterInstallationP,
      issuers: [...issuerPs],
    } = terms;

    insist(issuerPs.length === 2)`\
Must be exactly two issuers: ${terms.issuers}`;

    const scooterP = E(scooterInstallationP).spawn(harden({ issuerPs }));

    // Currently, we omit the optional args to makePeg, so currently
    // scooter is only compatible with simple default Nat
    // issuers. However, we try to keep much of the code below
    // general.
    const pegPs = issuerPs.map(issuerP => makePeg(E, issuerP));
    return Promise.all(pegPs).then(pegs => {
      const assays = pegs.map(peg => peg.getLocalIssuer().getAssay());

      // TODO Do these mutable arrays pass Jessie safety rules?
      const offerIds = [];
      const descriptions = [];
      let statuses = [];
      let isShutdown = false;

      function shutdown(lastState) {
        statuses = statuses.map(status => ({
          ...status,
          offerState: lastState,
          isInPool: false,
        }));
        E(scooterP).updateOffers(offerIds, statuses);

        offerIds.length = 0;
        descriptions.length = 0;
        statuses.length = 0;
        isShutdown = true;
      }

      function makeInvite(offeredSide, neededSide) {
        const sentry = harden({
          noticeOfferEntered(offerId, description, status) {
            offerIds.push(offerId);
            descriptions.push(description);
            statuses.push(status);

            if (isShutdown) {
              shutdown('already shut down');
            } else if (offerIds.length === 2) {
              const newStatuses = [
                { ...statuses[0], balances: statuses[1].balances },
                { ...statuses[1], balances: statuses[0].balances },
              ];
              if (areOffersSafe(assays, descriptions, newStatuses)) {
                statuses = newStatuses;
                shutdown('traded');
              } else {
                shutdown('trade aborted');
              }
            }
          },
          noticeOfferExitRequested(_offerId) {
            shutdown('trade cancelled');
          },
        });
        return E(scooterP).inviteToPlaceOffer(sentry, offeredSide, neededSide);
      }
      return harden([makeInvite(0, 1), makeInvite(1, 0)]);
    });
  },
});

const escrowDriverSrcs = harden({
  start: `${escrowDriver.start}`,
});

export { escrowDriverSrcs };
