// Copyright (C) 2019 Agoric, under Apache License 2.0

import harden from '@agoric/harden';

import { agencyEscrowSrcs } from '../../../core/agencyEscrow';
import { makeUniAssayMaker } from '../../../core/assays';
import { auctionSrcs } from '../../../core/auction';
import { makeMint } from '../../../core/issuers';
import { makeBasicMintController } from '../../../core/mintController';
import makePromise from '../../../util/makePromise';

function build(E, log) {
  function buildManualTimer(startValue = 0) {
    let ticks = startValue;
    const schedule = new Map();
    return harden({
      delayUntil(deadline, resolution = undefined) {
        if (deadline <= ticks) {
          resolution.res(ticks);
        }
        log(`@@schedule task for:${deadline}, currently: ${ticks} @@`);
        const result = makePromise();
        if (!schedule.get(deadline)) {
          schedule.set(deadline, []);
        }
        schedule.get(deadline).push(result.res);
        return result.p;
      },
      tick(msg) {
        log(`@@ tick:${ticks} @@`);
        if (msg) {
          log(`TICK: ${msg}`);
        }
        ticks += 1;
        if (schedule.get(ticks)) {
          for (const p of schedule.get(ticks)) {
            p(ticks);
          }
        }
      },
      ticks() {
        return ticks;
      },
    });
  }

  // Alice will offer something and two bidders will compete for it.
  function auctionTestTwoBidders(host, aliceMakerP, bidderMakerP) {
    const fakeTimer = buildManualTimer();

    const agencyEscrowInstallationP = E(host).install(agencyEscrowSrcs);
    const auctionInstallationP = E(host).install(auctionSrcs);

    const moneyMint = makeMint('doubloons');
    const aliceMoneyPurse = moneyMint.mint(0, 'alice money');
    const bobMoneyPurse = moneyMint.mint(1000, 'bob funds');
    const barbMoneyPurse = moneyMint.mint(900, 'barb funds');

    const artMint = makeMint(
      'Christies Art Auctions',
      makeBasicMintController,
      makeUniAssayMaker(),
    );
    const aliceArtPurse = artMint.mint(
      artMint.getIssuer().makeAmount('Salvator Mundi'),
      'alice portfolio',
    );
    const emptyPurse = artMint.getIssuer().makeEmptyPurse();
    const zeroBalance = emptyPurse.getBalance();
    const bobArtPurse = artMint.mint(zeroBalance, 'bob portfolio');
    const barbArtPurse = artMint.mint(zeroBalance, 'barb portfolio');

    const aliceP = E(aliceMakerP).make(
      agencyEscrowInstallationP,
      auctionInstallationP,
      fakeTimer,
      aliceMoneyPurse,
      aliceArtPurse,
    );
    const bobP = E(bidderMakerP).makeBidder(
      agencyEscrowInstallationP,
      auctionInstallationP,
      fakeTimer,
      bobMoneyPurse,
      bobArtPurse,
    );
    const barbP = E(bidderMakerP).makeBidder(
      agencyEscrowInstallationP,
      auctionInstallationP,
      fakeTimer,
      barbMoneyPurse,
      barbArtPurse,
    );
    return Promise.all([aliceP, bobP]).then(_ => {
      const auctionP = E(aliceP).createAuctionAndInviteBidders(bobP, barbP);
      E.resolve(auctionP).then(
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
          const aliceMakerP = await E(vats.alice).makeAliceMaker(host);
          const bidderMakerP = await E(vats.bidders).makeBidderMaker(host);
          return auctionTestTwoBidders(host, aliceMakerP, bidderMakerP);
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
    makePromise,
    helpers.vatID,
  );
}

export default harden(setup);
