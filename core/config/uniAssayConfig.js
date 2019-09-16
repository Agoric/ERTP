import harden from '@agoric/harden';

import { noCustomization } from './noCustomization';
import { makeCoreMintKeeper } from './coreMintKeeper';
import { makeUniStrategy } from './strategies/uniStrategy';

import { insist } from '../../util/insist';
import { mustBeComparable } from '../../util/sameStructure';

// This UniAssay config is used to create invites and similar assets.
// It does not customize the purses, payments, mints, or issuers, and
// it uses the core mintKeeper as well as the uniAssay (naturally)
const makeCustomInsistKind = descriptionCoercer => optDescription => {
  insist(
    !!optDescription,
  )`Uni optDescription must be either null or truthy: ${optDescription}`;
  const description = descriptionCoercer(optDescription);
  insist(!!description)`Uni description must be truthy ${description}`;
  mustBeComparable(description);
  return description;
};

function makeUniAssayConfigMaker(descriptionCoercer = () => true) {
  const customInsistKind = makeCustomInsistKind(descriptionCoercer);
  function makeUniAssayConfig() {
    return harden({
      ...noCustomization,
      makeMintKeeper: makeCoreMintKeeper,
      strategy: makeUniStrategy(customInsistKind),
    });
  }
  return makeUniAssayConfig;
}

export { makeUniAssayConfigMaker };
