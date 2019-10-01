import harden from '@agoric/harden';

import { makeMint } from '../../../../core/issuers';

const setup = () => {
  const moolaMint = makeMint('moola');
  const simoleanMint = makeMint('simoleans');
  const bucksMint = makeMint('bucks');

  const mints = [moolaMint, simoleanMint, bucksMint];
  const issuers = mints.map(mint => mint.getIssuer());
  const assays = issuers.map(issuer => issuer.getAssay());
  const strategies = issuers.map(issuer => issuer.getStrategy());

  return harden({
    mints,
    issuers,
    assays,
    strategies,
  });
};
harden(setup);
export { setup };
