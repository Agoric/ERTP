import harden from '@agoric/harden';

import { makeMint } from '../../../../core/issuers';
import { strategyLib } from '../../../../core/config/strategyLib';

const setup = () => {
  const moolaMint = makeMint('moola');
  const simoleanMint = makeMint('simoleans');
  const bucksMint = makeMint('bucks');

  const mints = [moolaMint, simoleanMint, bucksMint];
  const issuers = mints.map(mint => mint.getIssuer());
  const assays = issuers.map(issuer => issuer.getAssay());
  const strategies = issuers.map(
    issuer => strategyLib[issuer.getStrategyName()],
  );
  const labels = issuers.map(issuer => issuer.getLabel());

  return harden({
    mints,
    issuers,
    assays,
    strategies,
    labels,
  });
};
harden(setup);
export { setup };
