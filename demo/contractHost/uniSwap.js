/* global E Nat makePromise harden */

const uniSwap = harden({
  start: ({ issuers: [...issuerPs], product }, inviteMaker) => {
    // We currently rely on the caller of start to obey the following
    // conditions, which we could do some work to check:
    //    * issuerPs must be an array of exactly two elements, each of
    //      which is a promise to a possibly remote issuer.
    //    * Each of those issuers is based on the standard issuer code
    //      parameterized with the standard Nat assay, so we know its
    //      arithmetic properties, and that all balances are Nats.
    //    * Nat(product) >= issuerPs.length
    // Since these are visible in the terms, we can avoid these checks
    // without violating fundamental security rules. The checks our
    // customers will do anyway will be against issuers they rely on,
    // which thereby subsumes these checks.

    const escrowPursePs = issuerPs.map(issuerP => E(issuerP).makeEmptyPurse());
    let balances = issuerPs.map(_ => 0);

    const makerSeat = harden({
      fund([...endowmentPs]) {
        Promise.all(
          escrowPursePs.map((eP, i) => E(eP).depositAll(endowmentPs[i])),
        ).then(bals => {
          if (bals.reduce((x, y) => Nat(Nat(x) * Nat(y))) < product) {
            return [Promise.reject(new Error('not enough')), escrowPursePs];
          }
          balances = bals;
          // At this point the uniSwap is at least as well funded as
          // the terms promise, so we can create the seller seats
          return harden({
            // issuerPs[sellIndex] is what this seller is selling in
            // exchange for the need, in issuerPs[1-sellIndex]
            makeInvite(sellIndex) {
              if (sellIndex !== 0 && sellIndex !== 1) {
                throw new Error(`invalid sell index ${sellIndex}`);
              }
              const needIndex = 1 - sellIndex;
              const needWinnings = makePromise();
              const sellRefund = makePromise();

              const sellerSeat = harden({
                offer(sellPaymentP, needAtLeast) {
                  E(issuerPs[sellIndex])
                    .getExclusiveAll(sellPaymentP)
                    .then(sellEscrowPaymentP => {
                      return E(sellEscrowPaymentP)
                        .getBalance()
                        .then(soldAmount => {
                          // Now we know that if we depositAll, it
                          // will succeed at depositing this
                          // amount. We do not need to wait for it to
                          // pay the seller. Because we message both
                          // purses, message order guarantees we don't
                          // need to wait to update the balances
                          // either. By the time our withdraw arrives,
                          // the need purse will have enough funds.
                          const newSellBalance =
                            balances[sellIndex] + soldAmount;
                          const needAmount = Nat(
                            Math.floor(
                              balances[needIndex] - product / newSellBalance,
                            ),
                          );
                          if (needAmount < Nat(needAtLeast)) {
                            throw new Error(
                              `cannot meet need limit ${needAmount} < ${needAtLeast}`,
                            );
                          }
                          E(escrowPursePs[sellIndex]).depositAll(
                            sellEscrowPaymentP,
                          );
                          sellRefund.res(null);
                          needWinnings.res(
                            E(escrowPursePs).withdraw(needAmount),
                          );
                          balances[sellIndex] = newSellBalance;
                          balances[needIndex] = Nat(
                            balances[needIndex] - needAmount,
                          );
                        })
                        .catch(reason => {
                          sellRefund.res(sellEscrowPaymentP);
                          needWinnings.reject(reason);
                        });
                    })
                    .catch(reason => {
                      sellRefund.res(null);
                      needWinnings.reject(reason);
                    });
                },
                getWinnings() {
                  return needWinnings.p;
                },
                getRefund() {
                  return sellRefund.p;
                },
              });
              return inviteMaker(`selling ${sellIndex}`, sellerSeat);
            },
          });
        });
      },
    });

    return inviteMaker('maker', makerSeat);
  },
});

const uniSwapSrcs = {
  start: `${uniSwap.start}`,
};

export { uniSwapSrcs };
