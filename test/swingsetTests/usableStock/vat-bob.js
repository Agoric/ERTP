// Copyright (C) 2013 Google Inc, under Apache License 2.0
// Copyright (C) 2018 Agoric, under Apache License 2.0

import harden from '@agoric/harden';

import { makeCollect } from '../../../core/contractHost';

function makeBobMaker(E, host, log) {
  const collect = makeCollect(E, log);

  return harden({
    make(escrowExchangeInstallationP, myCashPurseP, myStockPurseP) {
      const cashIssuerP = E(myCashPurseP).getIssuer();
      const cashNeededP = E(E(cashIssuerP).getAssay()).make(10);

      const stockIssuerP = E(myStockPurseP).getIssuer();
      const stockNeededP = E(E(stockIssuerP).getAssay()).make([1, 2]);

      const bob = harden({
        useEscrowedStock(alice) {
          log('++ bob.useEscrowedStock starting');
          const terms = harden({ left: cashNeededP, right: stockNeededP });
          const invitesP = E(escrowExchangeInstallationP).spawn(terms);
          const aliceInvitePaymentP = invitesP.then(invites => invites.left);
          const bobInvitePaymentP = invitesP.then(invites => invites.right);
          const doneP = Promise.all([
            E(alice).acceptInvite(aliceInvitePaymentP),
            E(bob).acceptInvite(bobInvitePaymentP),
          ]);
          doneP.then(
            _res => log('++ bob.useEscrowedStock done'),
            rej => log('++ bob.useEscrowedStock reject: ', rej),
          );
          return doneP;
        },

        acceptInvite(inviteP) {
          const seatP = E(host).redeem(inviteP);
          const amount = E(stockIssuerP).makeAmount([1, 2]);
          const stockPaymentP = E(myStockPurseP).withdraw(amount);
          E(seatP).offer(stockPaymentP);
          const stocks = E(seatP).getUse();
          E(stocks).vote('yea');
          const cashDividend = E(stocks).claimCashDividend();
          E(myCashPurseP).depositAll(cashDividend);
          return collect(seatP, myCashPurseP, myStockPurseP, 'bob escrow');
        },
      });
      return bob;
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
      makeBobMaker(host) {
        return harden(makeBobMaker(E, host, log));
      },
    }),
  );
}
export default harden(setup);
