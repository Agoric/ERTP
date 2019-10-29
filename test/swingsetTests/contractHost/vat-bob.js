// Copyright (C) 2013 Google Inc, under Apache License 2.0
// Copyright (C) 2018 Agoric, under Apache License 2.0

import harden from '@agoric/harden';

import { makeCollect } from '../../../core/contractHost';

function makeBobMaker(E, host, log) {
  const collect = makeCollect(E, log);

  return harden({
    make(
      escrowExchangeInstallationP,
      coveredCallInstallationP,
      timerP,
      myMoneyPurseP,
      myStockPurseP,
    ) {
      const moneyAssayP = E(myMoneyPurseP).getAssay();
      const moneyNeededP = E(E(moneyAssayP).getUnitOps()).make(10);

      const stockAssayP = E(myStockPurseP).getAssay();
      const stockNeededP = E(E(stockAssayP).getUnitOps()).make(7);

      const bob = harden({
        /**
         * This is not an imperative to Bob to buy something but rather
         * the opposite. It is a request by a client to buy something from
         * Bob, and therefore a request that Bob sell something. OO naming
         * is a bit confusing here.
         */
        buy(desc, paymentP) {
          /* eslint-disable-next-line no-unused-vars */
          let units;
          let good;
          desc = `${desc}`;
          switch (desc) {
            case 'shoe': {
              units = 10;
              good = 'If it fits, ware it.';
              break;
            }
            default: {
              throw new Error(`unknown desc: ${desc}`);
            }
          }

          return E(myMoneyPurseP)
            .depositExactly(units, paymentP)
            .then(_ => good);
        },

        tradeWell(alice) {
          log('++ bob.tradeWell starting');
          const terms = harden({ left: moneyNeededP, right: stockNeededP });
          const invitesP = E(escrowExchangeInstallationP).spawn(terms);
          const aliceInvitePaymentP = invitesP.then(invites => invites.left);
          const bobInvitePaymentP = invitesP.then(invites => invites.right);
          const doneP = Promise.all([
            E(alice).acceptInvite(aliceInvitePaymentP),
            E(bob).acceptInvite(bobInvitePaymentP),
          ]);
          doneP.then(
            _res => log('++ bob.tradeWell done'),
            rej => log('++ bob.tradeWell reject: ', rej),
          );
          return doneP;
        },

        acceptInvite(inviteP) {
          const seatP = E(host).redeem(inviteP);
          const stockPaymentP = E(myStockPurseP).withdraw(7);
          E(seatP).offer(stockPaymentP);
          return collect(seatP, myMoneyPurseP, myStockPurseP, 'bob escrow');
        },

        offerAliceOption(alice) {
          log('++ bob.offerAliceOption starting');
          const terms = harden({
            escrowExchangeInstallation: escrowExchangeInstallationP,
            money: moneyNeededP,
            stock: stockNeededP,
            timer: timerP,
            deadline: 'singularity',
          });
          const bobInviteP = E(coveredCallInstallationP).spawn(terms);
          const bobSeatP = E(host).redeem(bobInviteP);
          const stockPaymentP = E(myStockPurseP).withdraw(7);
          const aliceInviteP = E(bobSeatP).offer(stockPaymentP);
          const doneP = Promise.all([
            E(alice).acceptOption(aliceInviteP),
            collect(bobSeatP, myMoneyPurseP, myStockPurseP, 'bob option'),
          ]);
          doneP.then(
            _res => log('++ bob.offerAliceOption done'),
            rej => log('++ bob.offerAliceOption reject: ', rej),
          );
          return doneP;
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
