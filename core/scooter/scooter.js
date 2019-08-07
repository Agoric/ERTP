/* global E */

// Copyright (C) 2019 Agoric, under Apache License 2.0

import harden from '@agoric/harden';
import { insist } from '../../util/insist';
import makePromise from '../../util/makePromise';
import { makePeg } from '../issuers';
import { defaultSentry } from './sentries';

const scooterContract = harden({
  start: (terms, inviteMaker) => {
    const {
      issuers: [...issuerPs],
      sentry: sentryP = Promise.resolve(defaultSentry),
    } = terms;

    const indexes = [0, 1];
    insist(issuerPs.length === indexes.length)`\
Must be exactly two issuers: ${terms.issuers}`;

    function otherSide(side) {
      insist(side === 0 || side === 1)`\
side must be 0 or 1: ${side}`;
      return 1 - side;
    }

    // Currently, we omit the optional args to makePeg, so currently
    // scooter is only compatible with simple default Nat
    // issuers. However, we try to keep much of the code below
    // general.
    const pegPs = issuerPs.map(issuerP => makePeg(E, issuerP));
    return Promise.all(pegPs).then(pegs => {
      const localIssuers = pegs.map(peg => peg.getLocalIssuer());
      const localAssays = localIssuers.map(issuer => issuer.getAssay());

      // Maps from an offerId to an internalOffer.
      // Note: offerPool is an iterable map that holds everything strongly. It
      // is specific to this scooter.
      const offerPool = new Map();

      // scooter is held by the governing contract, and so must not
      // reveal anything the governing contract shouldn't get.
      const scooter = harden({
        // Makes an invitation that the governing contract can give to
        // a player, that the player can use to place one offer into
        // the offerPool, to offer at most some amount of the
        // offeredSide's erights in exchange for at least some amount
        // of the (opposite) neededSide's erights. Returns a pair of
        // this invite and the offerId for identifying this offer,
        // should it ever be placed.
        inviteToPlaceOffer(offeredSide) {
          const neededSide = otherSide(offeredSide);

          // The offerId is a token initially shared only by scooter,
          // the governing contract inviting a player to place an
          // offer, and the player who places that offer.
          //
          // Why don't we use seatIdentity as the offerId? Although
          // the invite's seatIdentity is unique to an invite, it is
          // also exposed to all that have held that invitation right.
          const offerId = harden({});
          let enabled = true;

          // The seat obtained by redeeming an invitation to place an
          // offer.
          const offerPlacer = harden({
            placeOneOffer(offeredPaymentP, neededAmount) {
              insist(enabled)`\
This offer placer is used up`;
              enabled = false;

              const escrowedPaymentP = pegs[offeredSide].retainAll(
                offeredPaymentP,
              );
              return Promise.resolve(escrowedPaymentP).then(escrowedPayment => {
                neededAmount = localAssays[neededSide].coerce(neededAmount);

                let offerState = 'initializing';

                const localPurses = localIssuers.map(issuer =>
                  issuer.makeEmptyPurse(),
                );
                const offeredAmount = localPurses[offeredSide].depositAllNow(
                  escrowedPayment,
                );
                const exitPaymentsPR = makePromise();

                const offerDescription = harden({
                  offerId,
                  offeredSide,
                  offeredAmount,
                  neededSide,
                  neededAmount,
                });

                const getStatus = harden(() =>
                  harden({
                    ...offerDescription,
                    offerState,
                    balances: localPurses.map(localPurse =>
                      localPurse.getBalance(),
                    ),
                  }),
                );

                // These objects must remain fully encapsulated with
                // scooter. The must not be exposed to either the
                // governing contract nor the players.
                const internalOffer = harden({
                  getStatus,

                  leave(leftState) {
                    offerState = leftState;
                    const exitPayments = indexes.map(i =>
                      pegs[i].redeemAll(localPurses[i].withdrawAll()),
                    );
                    exitPaymentsPR.res(exitPayments);
                    offerPool.delete(offerId);
                  },
                });

                // This is returned to the player. The player should
                // talk to the governing contract about this offer
                // using only offerHandle.getStatus().offerId
                const offerHandle = harden({
                  getStatus,

                  checkout() {
                    offerState = 'checking out';
                    return E(sentryP)
                      .checkoutPolicy(offerId)
                      .then(_ => internalOffer.leave('checked out'));
                  },
                  getExitPayments() {
                    return exitPaymentsPR.p;
                  },
                });

                offerPool.set(offerId, internalOffer);
                offerState = 'checking in';
                E(sentryP)
                  .checkinPolicy(offerId)
                  .then(
                    _ => {
                      offerState = 'checked in';
                    },
                    reason => {
                      internalOffer.leave(`refused: ${reason.message}`);
                    },
                  );
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

        // ************ other governing contract methods *********

        liveOfferIds() {
          // Arrays are pass-by-copy. Sets do not yet support pass-by-copy
          return Array.from(offerPool.keys());
        },

        getOfferStatus(offerId) {
          return offerPool.get(offerId).getStatus();
        },

        getAllOfferStati() {
          // Arrays are pass-by-copy. Maps do not yet support pass-by-copy
          return harden(scooter.liveOfferIds().map(scooter.getOfferStatus));
        },

        // The governing contract can always evict any offer at
        // will. The sentry's policies constrain what players can do.
        evictOffer(offerId, leftState = 'evicted') {
          offerPool.get(offerId).leave(leftState);
        },

        rearrangeRights() {},
      });

      // There's little reason to wrap scooter in an invite. We could
      // just return it directly to the governing contract.
      return inviteMaker.make('scooter', scooter);
    });
  },
});

const scooterSrcs = harden({
  start: `${scooterContract.start}`,
});

export { scooterSrcs };
