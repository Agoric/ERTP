import harden from '@agoric/harden';

import { emptyConfig } from './basicConfig';
import { makeBasicMintController } from './basicMintController';
import { makeUniAssayMaker } from './assays';

function makeInviteConfigMaker(descriptionCoercer) {
  return harden({
    makeInviteConfig() {
      const makeUniAssay = makeUniAssayMaker(descriptionCoercer);
      return {
        ...emptyConfig,
        makeMintController: makeBasicMintController,
        makeAssay: makeUniAssay,
      };
    },
  });
}

export { makeInviteConfigMaker };
