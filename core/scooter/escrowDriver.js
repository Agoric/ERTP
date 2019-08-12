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

    // TODO The peg-to-assay logic here is borrowed from
    // scooter.js. Can we factor some of the common logic into
    // scooterUtils.js? Here, we only need the local assays with the
    // remote labels. Can we easily just get them without making pegs,
    // issuers, and all the rest?
    //
    // Currently, we omit the optional args to makePeg, so currently
    // scooter is only compatible with simple default Nat
    // issuers. However, we try to keep much of the code below
    // general.
    const pegPs = issuerPs.map(issuerP => makePeg(E, issuerP));
    return Promise.all(pegPs).then(pegs => {
      const assays = pegs.map(peg => peg.getLocalIssuer().getAssay());

      // TODO The scooter API pushes us into this columnar
      // representation. Should we instead have a row-oriented
      // representation? Should the scooter API be more row oriented?
      let offerIds = harden([]);
      let descriptions = harden([]);
      let statuses = harden([]);
      let isShutdown = false;

      function shutdown(lastState) {
        statuses = statuses.map(status => ({
          ...status,
          offerState: lastState,
          isInPool: false,
        }));
        E(scooterP).updateOffers(offerIds, statuses);

        offerIds = harden([]);
        descriptions = harden([]);
        statuses = harden([]);
        isShutdown = true;
      }

      function makeInvite(offeredSide, neededSide) {
        const sentry = harden({
          noticeOfferEntered(offerId, description, status) {
            // TODO Could Jessie safety rules allow us to push onto
            // mutable arrays?
            // TODO This "pushes" in arrival order. Should we instead
            // have fixed positions or something for fixed seats? It
            // would better serve the other contracts.
            offerIds = harden([...offerIds, offerId]);
            descriptions = harden([...descriptions, description]);
            statuses = harden([...statuses, status]);

            if (isShutdown) {
              shutdown('already shut down');
            } else if (offerIds.length === 2) {
              // TODO Only the body of this else-if condition is
              // really specific to the concept of escrow
              // exchange. Can we factor the rest out, perhaps into
              // scooterUtils, into something more easily reusable?

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
