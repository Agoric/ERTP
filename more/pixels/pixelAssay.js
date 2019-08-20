import harden from '@agoric/harden';

import { makePixelStrategy } from './pixelStrategy';
import { makeAssayMaker } from '../../core/assay';

// A pixelList is a naive collection of pixels in the form:
// [ { x: 0, y: 0 }, { x: 1, y: 1} ...]
// This is less than ideal for efficiency and expressiveness but will
// do for now

function makePixelAssayMaker(canvasSize) {
  const pixelStrategy = makePixelStrategy(canvasSize);
  return makeAssayMaker(pixelStrategy);
}
harden(makePixelAssayMaker);

export { makePixelAssayMaker };
