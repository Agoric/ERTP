// Copyright (C) 2013 Google Inc, under Apache License 2.0
// Copyright (C) 2019 Agoric, under Apache License 2.0

import harden from '@agoric/harden';
import { makeCollect } from '../../core/contractHost';
import { allComparable } from '../../util/sameStructure';

function makeAliceMaker(E, host, log) {
  const collect = makeCollect(E, log);

  return harden({
    make(
      agencyEscrowInstallationP,
      auctionInstallationP,
      timerP,
      myMoneyPurseP,
      myArtPurseP,
    ) {
      const alice = harden({
        createAuctionAndInviteBidders(...biddersP) {
          log('++ alice.createAuctionAndInviteBidders starting');
          const termsP = {
            agencyEscrowInstallationP,
            currencyAmount: E(myMoneyPurseP).getBalance(),
            productAmount: E(myArtPurseP).getBalance(),
            timerP,
            deadline: 10,
          };
          const offerInvitePaymentP = E(auctionInstallationP).spawn(termsP);
          const inviteIssuerP = E(host).getInviteIssuer();
          const offerSeatPaymentP = E(inviteIssuerP).getExclusiveAll(
            offerInvitePaymentP,
            'offer',
          );
          const offerSeatP = E(host).redeem(offerSeatPaymentP);
          const bidderMakerP = E(offerSeatP).offer(myArtPurseP);
          E(timerP).tick();
          const doneP = collect(
            offerSeatP,
            myMoneyPurseP,
            myArtPurseP,
            'auction earnings',
          );
          E(doneP).then(
            () => log('*** Alice sold her painting. **'),
            () => log("**** Alice's painting didn't sell. **"),
          );
          E(timerP).tick();

          biddersP.forEach(bidder => {
            E(timerP).tick();
            return E(bidder).offerSeat(E(bidderMakerP).newBidderSeat(), termsP);
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
