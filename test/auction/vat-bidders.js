// Copyright (C) 2019 Agoric, under Apache License 2.0

import harden from '@agoric/harden';
import { makeCollect } from '../../core/contractHost';
import { allComparable } from '../../util/sameStructure';

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
        offerSeat(bidderSeat, terms) {
          log('++ bidder.offerSeat starting');
          E(timerP).tick();
          //TODO  What gets passed in for bidder seat?
          E(bidderSeat).offer(myMoneyPurseP);

          // TODO: validate terms.

          E(timerP).tick();
          return collect(
            bidderSeat,
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
