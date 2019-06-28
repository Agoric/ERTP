// Copyright (C) 2013 Google Inc, under Apache License 2.0
// Copyright (C) 2018 Agoric, under Apache License 2.0

import harden from '@agoric/harden';
import { makeCollect } from '../../core/contractHost';

function makeAliceMaker(E, host, log) {
  const collect = makeCollect(E, log);

  return harden({
    make(
      escrowExchangeInstallationP,
      auctionInstallationP,
      timerP,
      myMoneyPurseP,
      myArtPurseP,
    ) {
      const inviteIssuerP = E(host).getInviteIssuer();
      const inviteIssuerLabel = harden({
        issuer: inviteIssuerP,
        description: 'contract host',
      });
      const moneyIssuerP = E(myMoneyPurseP).getIssuer();
      const artIssuerP = E(myArtPurseP).getIssuer();

      function makeTerms(myMoneyPurseP, myArtPurseP) {

        return { left: };
      }

      const alice = harden({
        createAuctionAndInviteBidders(...bidders) {
          log('++ alice.createAuctionAndInviteBidders starting');
          const terms = makeTerms(myMoneyPurseP, myArtPurseP);
          const auctionSeatP = makeAuction(terms, myArtPurseP);
          const bidderMakerP = E(auctionSeatP).offer(myArtPurseP);
          const myWinningsP = E(auctionSeatP).getWinnings();
          const myRefundP = E(auctionSeatP).getRefund();
          collect(auctionSeatP, myMoneyPurseP, myArtPurseP, 'auction earnings');

          bidders.forEach(bidder => {
            bidder.offerSeat(E(bidderMakerP).newBidderSeat(), terms);
          });
        },
      });
      return alice;
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
      makeAliceMaker(host) {
        return harden(makeAliceMaker(E, host, log));
      },
    }),
  );
}

export default harden(setup);
