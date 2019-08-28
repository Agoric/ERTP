import harden from '@agoric/harden';

import { makeInsistPixel, isEqual } from './types/pixel';
import { makeListStrategy } from '../../core/config/strategies/listStrategy';

// A pixelList is a naive collection of pixels in the form:
// [ { x: 0, y: 0 }, { x: 1, y: 1} ...]
// This is less than ideal for efficiency and expressiveness but will
// do for now
const makePixelStrategy = (canvasSize = 10) => {
  return makeListStrategy(makeInsistPixel(canvasSize), isEqual);
};

harden(makePixelStrategy);

export { makePixelStrategy };
