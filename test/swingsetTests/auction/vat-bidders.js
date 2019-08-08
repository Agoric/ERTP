// Copyright (C) 2019 Agoric, under Apache License 2.0

import harden from '@agoric/harden';
import { makeCollect } from '../../../core/contractHost';

function makeBidderMaker(E, host, log) {
  const collect = makeCollect(E, log);

  return harden({
    makeBidder(
      agencyEscrowInstallationP,
      auctionInstallationP,
      timerP,
      myMoneyPurseP,
      myArtPurseP,
    ) {
      const bidder = harden({
        offerSeat(bidderSeatInviteP, terms) {
          log('++ bidder.offerSeat starting');
          E(timerP).tick();
          const inviteIssuerP = E(host).getInviteIssuer();
          const bidderSeatPaymentP = E(inviteIssuerP).getExclusiveAll(
            bidderSeatInviteP,
            'offer',
          );
          const bidderSeatP = E(host).redeem(bidderSeatPaymentP);
          const bidPaymentP = E(myMoneyPurseP).withdrawAll('a bid payment');
          E(bidderSeatP).offer(bidPaymentP);

          // TODO: validate terms.

          E(timerP).tick();
          return collect(
            bidderSeatP,
            myMoneyPurseP,
            myArtPurseP,
            'auction earnings',
          );
        },
      });
      return bidder;
    },
  });
}

function setup(syscall, state, helpers) {
  function log(...args) {
    helpers.log(...args);
    console.log(...args);
  }

  return helpers.makeLiveSlots(syscall, state, E =>
    harden({
      makeBidderMaker(host) {
        return harden(makeBidderMaker(E, host, log));
      },
    }),
  );
}

export default harden(setup);
