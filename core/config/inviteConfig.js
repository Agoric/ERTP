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

function makeInviteConfig() {
  return harden({
    ...noCustomization,
    makeMintKeeper: makeCoreMintKeeper,
    extentOpsName: 'inviteExtentOps',
    extentOpsArgs: [insistOptDescription],
  });
}

export { makeInviteConfig };
