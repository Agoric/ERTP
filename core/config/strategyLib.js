import { importManager } from '../../more/imports/importManager';

import { makeListStrategy } from './strategies/listStrategy';
import { natStrategy } from './strategies/natStrategy';
import { seatStrategy } from './strategies/seatStrategy';
import { makeUniStrategy } from './strategies/uniStrategy';

import { insist } from '../../util/insist';
import { mustBeComparable } from '../../util/sameStructure';

const makeCustomInsistKind = (
  descriptionCoercer = () => true,
) => optDescription => {
  insist(
    !!optDescription,
  )`Uni optDescription must be either null or truthy: ${optDescription}`;
  const description = descriptionCoercer(optDescription);
  insist(!!description)`Uni description must be truthy ${description}`;
  mustBeComparable(description);
  return description;
};

const customInsistKind = makeCustomInsistKind();

const manager = importManager();
const strategyLib = manager.addExports({
  natStrategy,
  seatStrategy,
  inviteStrategy: makeUniStrategy(customInsistKind),
});

export { strategyLib };
