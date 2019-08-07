/* global E */

// Copyright (C) 2019 Agoric, under Apache License 2.0

import harden from '@agoric/harden';
import { insist } from '../util/insist';
import makePromise from '../util/makePromise';
import { makePeg } from './issuers';

const scooterContract = harden({
  start: (terms, inviteMaker) => {
    const {
      issuers: [...issuerPs],
      cancellationPolicy: cancellationPolicyP,
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
    // issuers. However, we try to keep the code below as general as
    // we can.
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

        // Makes an invite that the governing contract can
        // give to each player, that the player can use to place one
        // sealed offer directly into the offerPool. Returns a pair of
        // this invite and the offerId for identifying this offer,
        // should it ever arive.
        makeSealerInvite() {
          let offerIdFlag = harden({});

          // The seat obtained by redeeming an offer sealer invite.
          const offerSealer = harden({
            sealOneOffer(offeredSide, offeredPaymentP, [...allegedAmounts]) {
              insist(offerIdFlag)`\
This offer sealer is used up`;
              const offerId = offerIdFlag;
              offerIdFlag = null;

              const neededSide = otherSide(offeredSide);
              const amounts = indexes.map(i =>
                localAssays[i].coerce(allegedAmounts[i]),
              );

              const escrowedPaymentP = pegs[offeredSide].retainAll(
                offeredPaymentP,
              );
              return Promise.resolve(escrowedPaymentP).then(escrowedPayment => {
                const localPurses = localIssuers.map(issuer =>
                  issuer.makeEmptyPurse(),
                );
                const providedAmount = localPurses[offeredSide].depositAllNow(
                  escrowedPayment,
                );

                const internalOffer = harden({
                  getOfferId() { return offerId; },
                });
                offerPool.set(offerId, internalOffer);
                const offerHandle = harden({
                  getOfferId() { return offerId; },
                });
                return offerHandle;
              });
            },
          });

          return [inviteMaker.make('offer sealer', offerSealer), offerIdFlag];
        },
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
