import { importManager } from '../../more/imports/importManager';

import { natStrategy } from './strategies/natStrategy';
import { makeUniStrategy } from './strategies/uniStrategy';
import { makePixelStrategy } from '../../more/pixels/pixelStrategy';

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
  uniStrategy: makeUniStrategy(customInsistKind),
  pixelStrategy10: makePixelStrategy(10),
});

export { strategyLib };
