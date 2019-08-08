// Copyright (C) 2013 Google Inc, under Apache License 2.0
// Copyright (C) 2018 Agoric, under Apache License 2.0

import harden from '@agoric/harden';
import { makeCollect } from '../../../core/contractHost';

function makeAliceMaker(E, host, log) {
  const collect = makeCollect(E, log);

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
      const inviteIssuerP = E(host).getInviteIssuer();

      const alice = harden({
        acceptInvite(allegedInvitePaymentP) {
          log('++ alice.acceptInvite starting');
          showPaymentBalance('alice invite', allegedInvitePaymentP);
          const cash10P = E(E(myCashPurseP).getIssuer()).makeAmount(10);
          const stock1And2P = E(E(myStockPurseP).getIssuer()).makeAmount([
            1,
            2,
          ]);
          const verifiedInvitePaymentP = E(allegedInvitePaymentP)
            .getBalance()
            .then(allegedInviteAmount => {
              return E.resolve(Promise.all([cash10P, stock1And2P])).then(
                terms => {
                  const [left, right] = terms;
                  return E(escrowExchangeInstallationP)
                    .checkAmount(allegedInviteAmount, { left, right }, 'left')
                    .then(() => {
                      return E(inviteIssuerP).getExclusive(
                        allegedInviteAmount,
                        allegedInvitePaymentP,
                        'verified invite',
                      );
                    });
                },
              );
            });

          return E.resolve(
            showPaymentBalance('verified invite', verifiedInvitePaymentP),
          ).then(_ => {
            const seatP = E(host).redeem(verifiedInvitePaymentP);
            const cashPaymentP = E(myCashPurseP).withdraw(10);
            E(seatP).offer(cashPaymentP);
            const useObj = E(seatP).getUse();
            return collect(seatP, myStockPurseP, myCashPurseP, 'alice escrow');
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
