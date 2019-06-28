/* global makePromise */
// Copyright (C) 2019 Agoric, under Apache License 2.0

import harden from '@agoric/harden';

import { escrowExchangeSrc } from '../../core/escrow';
import { auctionSrc } from '../../core/auction';
import { makeMint } from '../../core/issuers';
import { makeBasicMintController } from '../../core/mintController';

function build(E, log) {
  function buildManualTimer() {
    let ticks;
    const schedule = new Map();
    return harden({
      delayUntil(deadline, resolution = undefined) {
        const result = makePromise(() => resolution());
        if (!schedule.get(deadline)) {
          schedule.set(deadline, []);
        }
        schedule.get(deadline).push(result.res);
        return result.p;
      },
      tick() {
        ticks += 1;
        if (schedule.get(ticks)) {
          for (const p of schedule.get(ticks)) {
            p.res(ticks);
          }
        }
      },
      ticks() {
        return ticks + 0;
      },
    });
  }

  // Alice will offer something and two bidders will compete for it.
  function auctionTestTwoBidders(host, aliceMaker, bidderMaker) {
    const fakeTimer = buildManualTimer();

    const escrowExchangeInstallationP = E(host).install(escrowExchangeSrc);
    const auctionInstallationP = E(host).install(auctionSrc);

    const moneyMintP = makeMint('doubloons');
    const aliceMoneyPurseP = E(moneyMintP).mint(0, 'alice money');
    const bobMoneyPurseP = E(moneyMintP).mint(1000, 'bob funds');
    const barbMoneyPurseP = E(moneyMintP).mint(900, 'barb funds');

    const artMintP = makeMint('Christies Art Auctions', makeBasicMintController, makeUinAssay);
    const aliceArtPurseP = E(artMintP).mint(
      'Salvator Mundi',
      'alice portfolio',
    );
    const bobArtPurseP = E(artMintP).mint(0, 'bob portfolio');
    const barbArtPurseP = E(artMintP).mint(0, 'barb portfolio');

    const aliceP = E(aliceMaker).make(
      escrowExchangeInstallationP,
      auctionInstallationP,
      fakeTimer,
      aliceMoneyPurseP,
      aliceArtPurseP,
    );
    const bobP = E(bidderMaker).makeBidder(
      escrowExchangeInstallationP,
      auctionInstallationP,
      fakeTimer,
      bobMoneyPurseP,
    );
    const barbP = E(bidderMaker).makeBidder(
      escrowExchangeInstallationP,
      auctionInstallationP,
      fakeTimer,
      barbMoneyPurseP,
    );
    return Promise.all([aliceP, bobP]).then(_ => {
      const auctionP = E(aliceP).createAuctionAndInviteBidders(bobP, barbP);
      auctionP.then(
        res => {
          log('++ auctionP done:', res);
          log('++ DONE');
        },
        rej => log('++ auctionP failed', rej),
      );
      return auctionP;
    });
  }

  const obj0 = {
    async bootstrap(argv, vats) {
      switch (argv[0]) {
        case 'simple-auction': {
          const host = await E(vats.host).makeHost();
          const aliceMaker = await E(vats.alice).makeAliceMaker(host);
          const bidderMaker = await E(vats.bidder).makeBidderMaker(host);
          return auctionTestTwoBidders(host, aliceMaker, bidderMaker);
        }
        default: {
          throw new Error(`unrecognized argument value ${argv[0]}`);
        }
      }
    },
  };
  return harden(obj0);
}

harden(build);

function setup(syscall, state, helpers) {
  function log(...args) {
    helpers.log(...args);
    console.log(...args);
  }

  log(`=> setup called`);
  return helpers.makeLiveSlots(
    syscall,
    state,
    E => build(E, log),
    helpers.vatID,
  );
}

export default harden(setup);
