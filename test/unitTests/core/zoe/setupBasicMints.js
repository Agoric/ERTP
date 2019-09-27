import harden from '@agoric/harden';

import { makeMint } from '../../../../core/issuers';

const setup = () => {
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
    strategies: [
      moolaIssuer.getStrategy(),
      simoleanIssuer.getStrategy(),
      bucksIssuer.getStrategy(),
    ],
    labels: [
      moolaIssuer.getLabel(),
      simoleanIssuer.getLabel(),
      bucksIssuer.getLabel(),
    ],
  });
};
harden(setup);
export { setup };
