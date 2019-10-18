import harden from '@agoric/harden';

import { makeMint } from '../../../core/mint';
import { automaticRefundSrcs } from '../../../core/zoe/contracts/automaticRefund';

const setupBasicMints = () => {
  const moolaMint = makeMint('moola');
  const simoleanMint = makeMint('simoleans');
  const bucksMint = makeMint('bucks');

  const moolaAssay = moolaMint.getAssay();
  const simoleanAssay = simoleanMint.getAssay();
  const bucksAssay = bucksMint.getAssay();

  const moolaDescOps = moolaAssay.getDescOps();
  const simoleanDescOps = simoleanAssay.getDescOps();
  const bucksDescOps = bucksAssay.getDescOps();

  return harden({
    mints: [moolaMint, simoleanMint, bucksMint],
    assays: [moolaAssay, simoleanAssay, bucksAssay],
    descOps: [moolaDescOps, simoleanDescOps, bucksDescOps],
  });
};

const makeVats = (
  E,
  log,
  vats,
  zoe,
  aliceExtents,
  bobExtents,
  installationId,
) => {
  const { mints, assays } = setupBasicMints();
  // Setup Alice
  const aliceMoolaPurse = mints[0].mint(
    assays[0].makeAssetDesc(aliceExtents[0]),
  );
  const aliceSimoleanPurse = mints[1].mint(
    assays[1].makeAssetDesc(aliceExtents[1]),
  );
  const aliceP = E(vats.alice).build(
    zoe,
    aliceMoolaPurse,
    aliceSimoleanPurse,
    installationId,
  );

  // Setup Bob
  const bobMoolaPurse = mints[0].mint(assays[0].makeAssetDesc(bobExtents[0]));
  const bobSimoleanPurse = mints[1].mint(
    assays[1].makeAssetDesc(bobExtents[1]),
  );
  const bobP = E(vats.bob).build(
    zoe,
    bobMoolaPurse,
    bobSimoleanPurse,
    installationId,
  );
  log(`=> alice and bob are setup`);
  return harden({
    aliceP,
    bobP,
  });
};

function build(E, log) {
  const obj0 = {
    async bootstrap(argv, vats) {
      const zoe = await E(vats.zoe).getZoe();
      const automaticRefundInstallId = E(zoe).install(automaticRefundSrcs);
      const makeAliceAndBob = (aliceExtents, bobExtents, installId) =>
        makeVats(E, log, vats, zoe, aliceExtents, bobExtents, installId);

      async function automaticRefundOk() {
        const { aliceP, bobP } = makeAliceAndBob(
          [3, 0],
          [0, 17],
          automaticRefundInstallId,
        );
        await E(aliceP).doCreateAutomaticRefund(bobP);
      }

      log(`=> case ${argv[0]}`);

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
