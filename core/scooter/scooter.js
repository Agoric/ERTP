/* global E */

// Copyright (C) 2019 Agoric, under Apache License 2.0

import harden from '@agoric/harden';
import { insist } from '../../util/insist';
import makePromise from '../../util/makePromise';
import { makePeg } from '../issuers';

const scooterContract = harden({
  start: (terms, inviteMaker) => {
    const {
      issuers: [...issuerPs],
      sentry: sentryP,
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
        // Makes an invite that the governing contract can give to a
        // player, that the player can use to place one sealed offer
        // directly into the offerPool, to offer at most some amount
        // of the offeredSide's erights in exchange for at least some
        // amount of the (opposite) neededSide's erights. Returns a
        // pair of this invite and the offerId for identifying this
        // offer, should it ever arive.
        makeSealerInvite(offeredSide) {
          const neededSide = otherSide(offeredSide);

          // The offerId is a token initially shared only by scooter,
          // the governing contract inviting a player to place an
          // offer, and the player who places that offer. Although the
          // invite's seatIdentity is unique to an invite, it is also
          // exposed to all that have held that invitation right.
          const offerId = harden({});
          let enabled = true;

          // The seat obtained by redeeming an offer sealer invite.
          const offerSealer = harden({
            sealOneOffer(offeredPaymentP, neededAmount) {
              insist(enabled)`\
This offer sealer is used up`;
              enabled = false;

              const escrowedPaymentP = pegs[offeredSide].retainAll(
                offeredPaymentP,
              );
              return Promise.resolve(escrowedPaymentP).then(escrowedPayment => {
                neededAmount = localAssays[neededSide].coerce(neededAmount);

                const localPurses = localIssuers.map(issuer =>
                  issuer.makeEmptyPurse(),
                );
                const offeredAmount = localPurses[offeredSide].depositAllNow(
                  escrowedPayment,
                );

                const offerDescription = harden({
                  offerId,
                  offeredSide,
                  neededSide,
                  offeredAmount,
                  neededAmount,
                });

                const offerStatus = harden({
                  getBalances() {
                    return localPurses.map(localPurse =>
                      localPurse.getBalance(),
                    );
                  },
                });

                const exitPaymentsPR = makePromise();

                // These objects must remain fully encapsulated with
                // scooter. The must not be exposed to either the
                // governing contract nor the players.
                const internalOffer = harden({
                  getOfferDescription() {
                    return offerDescription;
                  },
                  getOfferStatus() {
                    return offerStatus;
                  },
                  cancel() {
                    const exitPayments = indexes.map(i =>
                      pegs[i].redeemAll(localPurses[i].withdrawAll()),
                    );
                    exitPaymentsPR.res(exitPayments);
                    offerPool.delete(offerId);
                  },
                });
                offerPool.set(offerId, internalOffer);

                // This is returned to the player. The so-called
                // sealed offer is the offerId obtained by
                // offerHandle.describe().offerId
                // Perpetual TODO: bikeshed names
                const offerHandle = harden({
                  describe() {
                    return offerDescription;
                  },
                  getOfferStatus() {
                    return offerStatus;
                  },
                  getExitPayments() {
                    return exitPaymentsPR.p;
                  },
                });
                return offerHandle;
              });
            },
          });

          // By wrapping it in an invite, the player knows that, if
          // redeemed, no one else has access to this offerSealer.
          return [
            inviteMaker.make(['offer sealer', offeredSide], offerSealer),
            offerId,
          ];
        },

        rejectOffer(offerId) {},

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
