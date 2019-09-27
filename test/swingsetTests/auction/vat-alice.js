// Copyright (C) 2013 Google Inc, under Apache License 2.0
// Copyright (C) 2019 Agoric, under Apache License 2.0

import harden from '@agoric/harden';
import { makeCollect } from '../../../core/contractHost';

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
          const termsP = harden({
            agencyEscrowInstallationP,
            currencyAmount: E(myMoneyPurseP).getBalance(),
            productAmount: E(myArtPurseP).getBalance(),
            timerP,
            deadline: 10,
            minBidCount: 2,
            minPrice: 0,
          });
          const offerInvitePaymentP = E(auctionInstallationP).spawn(termsP);
          const inviteIssuerP = E(host).getInviteIssuer();
          const offerSeatPaymentP = E(inviteIssuerP).claimAll(
            offerInvitePaymentP,
            'offer',
          );
          const offerSeatP = E(host).redeem(offerSeatPaymentP);
          const artPaymentP = E(myArtPurseP).withdrawAll();
          const bidderMakerP = E(offerSeatP).offer(artPaymentP);
          E(timerP).tick('art deposit');
          const doneP = collect(
            offerSeatP,
            myMoneyPurseP,
            myArtPurseP,
            'auction earnings',
          );
          E.resolve(doneP).then(
            ([wins, _refunds]) =>
              log(`*** Alice sold her painting for ${wins.quantity}. **`),
            rej => log(`**** Alice's painting didn't sell. ** ${rej}`),
          );

          biddersP.map(bidder => {
            E(timerP).tick('bidder offer');
            return E(bidder).offerSeat(E(bidderMakerP).newBidderSeat(), termsP);
          });
          return E(offerSeatP).getCompletion();
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
