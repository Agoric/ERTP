import harden from '@agoric/harden';

import { noCustomization } from './noCustomization';
import { makeTotalSupplyMintKeeper } from './totalSupplyMintKeeper';
import { natStrategy } from './strategies/natStrategy';

// This fungible token configuration uses a custom mintKeeper to keep
// track of the total supply of tokens. Note that it is possible for
// references to purses and payments to be dropped and garbage
// collected without the total supply decreasing. Thus, the total
// supply is an upper bound. This configuration uses the "Nat" strategy,
// in which amounts are natural numbers and use subtraction and
// addition.

// This configuration and others like it are passed into `makeMint` in
// `issuers.js`.
const makeTotalSupplyConfig = () => {
  function* makeMintTrait(_superMint, _issuer, _assay, mintKeeper) {
    return yield harden({
      getTotalSupply: () => mintKeeper.getTotalSupply(),
    });
  }

  return harden({
    ...noCustomization,
    makeMintKeeper: makeTotalSupplyMintKeeper,
    strategy: natStrategy,
    makeMintTrait,
  });
};

export { makeTotalSupplyConfig };
