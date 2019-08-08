// Copyright (C) 2013 Google Inc, under Apache License 2.0
// Copyright (C) 2018 Agoric, under Apache License 2.0

import harden from '@agoric/harden';

import { makeCollect } from '../../../core/contractHost';

function makeBobMaker(E, host, log) {
  const collect = makeCollect(E, log);

  let savedStocks;

  // TODO BUG: All callers should wait until settled before doing
  // anything that would change the balance before show*Balance* reads
  // it.
  function showPaymentBalance(name, paymentP) {
    return E(paymentP)
      .getBalance()
      .then(amount => log(name, ' balance ', amount));
  }

  return harden({
    make(escrowExchangeInstallationP, myCashPurseP, myStockPurseP) {
      const cashIssuerP = E(myCashPurseP).getIssuer();
      const cashToOfferP = E(E(cashIssuerP).getAssay()).make(10);

      const stockIssuerP = E(myStockPurseP).getIssuer();
      const stockToOfferP = E(E(stockIssuerP).getAssay()).make([1, 2]);

      const bob = harden({
        async useEscrowedStock(alice) {
          log('++ bob.useEscrowedStock starting');
          const terms = harden({
            putUpCash: cashToOfferP,
            putUpStock: stockToOfferP,
          });

          const escrowConfig = harden({
            leftSeatName: 'putUpCash',
            rightSeatName: 'putUpStock',
            makeCustomLeftSeatSrc: `coreSeat => coreSeat`,
            makeCustomRightSeatSrc: `(coreSeat, _leftEscrow, rightEscrow) => {
              return harden({
                ...coreSeat,
                getUse() {
                  return E(rightEscrow).getUse();
                }
              });
            }`,
          });

          const {
            putUpCash: aliceInvitePaymentP,
            putUpStock: bobInvitePaymentP,
          } = await E(escrowExchangeInstallationP).spawn(terms, escrowConfig);

          const doneP = Promise.all([
            E(alice).acceptInvite(aliceInvitePaymentP),
            E(bob).acceptInvite(bobInvitePaymentP),
          ]);
          doneP.then(
            async _res => {
              log('++ bob.useEscrowedStock done');
              const cashDividendP = E(savedStocks).claimCashDividends();
              showPaymentBalance(
                `bob tried to get cash dividend after transfer complete`,
                cashDividendP,
              );
              await E(savedStocks).vote('yea');
            },
            rej => log('++ bob.useEscrowedStock reject: ', rej),
          );
          return doneP;
        },

        async acceptInvite(inviteP) {
          const seatP = E(host).redeem(inviteP);
          const amount = await E(stockIssuerP).makeAmount([1, 2]);
          const stockPaymentP = E(myStockPurseP).withdraw(amount);
          E(seatP).offer(stockPaymentP);
          const stocks = await E(seatP).getUse();
          await E(stocks).vote('yea');
          const cashDividendP = E(stocks).claimCashDividends();
          showPaymentBalance(`bob's cash dividend`, cashDividendP);
          await E(myCashPurseP).depositAll(cashDividendP);
          showPaymentBalance(`bob's cash purse`, myCashPurseP);
          savedStocks = stocks;
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
