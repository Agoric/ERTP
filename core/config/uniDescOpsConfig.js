import harden from '@agoric/harden';

import { noCustomization } from './noCustomization';
import { makeCoreMintKeeper } from './coreMintKeeper';
import { insist } from '../../util/insist';
import { mustBeComparable } from '../../util/sameStructure';

const insistOptDescription = optDescription => {
  insist(
    !!optDescription,
  )`Uni optDescription must be either null or truthy: ${optDescription}`;
  insist(!!optDescription)`Uni description must be truthy ${optDescription}`;
  mustBeComparable(optDescription);
};

// This UniDescOps config is used to create invites and similar assets.
// It does not customize the purses, payments, mints, or assays, and
// it uses the core mintKeeper as well as the uniDescOps (naturally)
function makeUniDescOpsConfigMaker() {
  function makeUniDescOpsConfig() {
    return harden({
      ...noCustomization,
      makeMintKeeper: makeCoreMintKeeper,
      extentOpsName: 'uniExtentOps',
      extentOpsArgs: [insistOptDescription],
    });
  }
  return makeUniDescOpsConfig;
}

export { makeUniDescOpsConfigMaker };
