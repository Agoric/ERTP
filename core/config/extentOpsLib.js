import { importManager } from '../../more/imports/importManager';

import { natExtentOps } from './extentOps/natExtentOps';
import { seatExtentOps } from './extentOps/seatExtentOps';
import { makeUniExtentOps } from './extentOps/uniExtentOps';
import { makePixelExtentOps } from '../../more/pixels/pixelExtentOps';

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
const extentOpsLib = manager.addExports({
  natExtentOps,
  seatExtentOps,
  inviteExtentOps: makeUniExtentOps(customInsistKind),
  pixelExtentOps10: makePixelExtentOps(10),
});

export { extentOpsLib };
