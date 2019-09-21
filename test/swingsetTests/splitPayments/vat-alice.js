import harden from '@agoric/harden';

function makeAliceMaker(E, _log) {
  return harden({
    make(myMoneyPurseP) {
      const alice = harden({
        async testSplitPayments() {
          const oldPayment = await E(myMoneyPurseP).withdrawAll();
          const issuer = await E(myMoneyPurseP).getIssuer();
          const goodAmountsArray = [
            await E(issuer).makeAmount(900),
            await E(issuer).makeAmount(100),
          ];
          const splitPayments = E(issuer).split(oldPayment, goodAmountsArray);
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
        return harden(makeAliceMaker(E, log, host));
      },
    }),
  );
}
export default harden(setup);
