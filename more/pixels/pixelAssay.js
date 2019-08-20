import harden from '@agoric/harden';

import { makePixelLogic } from './pixelLogic';
import { makeAssayMaker } from '../../core/assay';

// A pixelList is a naive collection of pixels in the form:
// [ { x: 0, y: 0 }, { x: 1, y: 1} ...]
// This is less than ideal for efficiency and expressiveness but will
// do for now

function makePixelAssayMaker(canvasSize) {
  const pixelLogic = makePixelLogic(canvasSize);
  return makeAssayMaker(pixelLogic);
}
harden(makePixelAssayMaker);

export { makePixelAssayMaker };
