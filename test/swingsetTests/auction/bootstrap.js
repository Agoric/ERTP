// Copyright (C) 2019 Agoric, under Apache License 2.0

import harden from '@agoric/harden';

import { agencyEscrowSrcs } from '../../../core/agencyEscrow';
import { auctionSrcs } from '../../../core/auction';
import { makeMint } from '../../../core/issuers';
import makePromise from '../../../util/makePromise';
import { makeUniAssayConfigMaker } from '../../../core/config/uniAssayConfig';
import buildManualTimer from '../../../tools/manualTimer';

function build(E, log) {
  // Alice will offer something and two bidders will compete for it.
  function auctionTestTwoBidders(host, aliceMakerP, bidderMakerP) {
    const fakeTimer = buildManualTimer(log);

    const agencyEscrowInstallationP = E(host).install(agencyEscrowSrcs);
    const auctionInstallationP = E(host).install(auctionSrcs);

    const moneyMint = makeMint('doubloons');
    const aliceMoneyPurse = moneyMint.mint(0, 'alice money');
    const bobMoneyPurse = moneyMint.mint(1000, 'bob funds');
    const barbMoneyPurse = moneyMint.mint(900, 'barb funds');

    const makeUniAssayConfig = makeUniAssayConfigMaker();
    const artMint = makeMint('Christies Art Auctions', makeUniAssayConfig);
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
      'bidder1',
    );
    const barbP = E(bidderMakerP).makeBidder(
      agencyEscrowInstallationP,
      auctionInstallationP,
      fakeTimer,
      barbMoneyPurse,
      barbArtPurse,
      'bidder2',
    );
    return Promise.all([aliceP, bobP]).then(_ => {
      const doneP = E(aliceP).createAuctionAndInviteBidders(bobP, barbP);
      E.resolve(doneP).then(
        price => log(`++ auction done: ${price}`),
        rej => log('++ auctionP failed', rej),
      );
      return doneP;
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
