import harden from '@agoric/harden';

import { makeMint } from '../../../core/issuers';

const setupBasicMints = () => {
  const moolaMint = makeMint('moola');
  const simoleanMint = makeMint('simoleans');
  const bucksMint = makeMint('bucks');

  const moolaIssuer = moolaMint.getIssuer();
  const simoleanIssuer = simoleanMint.getIssuer();
  const bucksIssuer = bucksMint.getIssuer();

  const moolaAssay = moolaIssuer.getAssay();
  const simoleanAssay = simoleanIssuer.getAssay();
  const bucksAssay = bucksIssuer.getAssay();

  return harden({
    mints: [moolaMint, simoleanMint, bucksMint],
    issuers: [moolaIssuer, simoleanIssuer, bucksIssuer],
    assays: [moolaAssay, simoleanAssay, bucksAssay],
  });
};

function build(E, log) {
  const obj0 = {
    async bootstrap(argv, vats) {
      async function automaticRefundOk() {
        log(`=> automaticRefundOk called`);
        const zoe = await E(vats.zoe).getZoe();
        const aliceMaker = await E(vats.alice).makeAliceMaker(zoe);
        const bobMaker = await E(vats.bob).makeBobMaker(zoe);
        const { mints, issuers } = setupBasicMints();

        // Setup Alice
        const aliceMoolaPurse = mints[0].mint(issuers[0].makeAmount(3));
        const aliceSimoleanPurse = mints[1].mint(issuers[1].makeAmount(0));
        const aliceP = E(aliceMaker).make(aliceMoolaPurse, aliceSimoleanPurse);

        // Setup Bob
        const bobMoolaPurse = mints[0].mint(issuers[0].makeAmount(0));
        const bobSimoleanPurse = mints[1].mint(issuers[1].makeAmount(17));
        const bobP = E(bobMaker).make(bobMoolaPurse, bobSimoleanPurse);

        log(`=> alice and bob are setup`);
        await E(aliceP).doCreateAutomaticRefund(bobP);
      }

      switch (argv[0]) {
        case 'automaticRefundOk': {
          return automaticRefundOk();
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
