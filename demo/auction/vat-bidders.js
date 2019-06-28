// Copyright (C) 2013 Google Inc, under Apache License 2.0
// Copyright (C) 2018 Agoric, under Apache License 2.0

import harden from '@agoric/harden';
import { makeCollect } from '../../core/contractHost';

function makeBidderMaker(E, host, log) {
  const collect = makeCollect(E, log);

  return harden({
    make(
      escrowExchangeInstallationP,
      auctionInstallationP,
      timerP,
      myMoneyPurseP,
    ) {
      const inviteIssuerP = E(host).getInviteIssuer();
      const inviteIssuerLabel = harden({
        issuer: inviteIssuerP,
        description: 'contract host',
      });
      const moneyIssuerP = E(myMoneyPurseP).getIssuer();

      const bidder = harden({
        offerSeat(bidderSeat, terms) {
          log('++ bidder.offerSeat starting');

          const myWinningsP = E(bidderSeat).getWinnings();
          const myRefundP = E(bidderSeat).getRefund();
          collect(bidderSeat, myMoneyPurseP, myArtPurseP, 'auction earnings');

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
