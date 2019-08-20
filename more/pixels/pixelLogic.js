import harden from '@agoric/harden';

import {
  insistPixelList,
  includesPixelList,
  withPixelList,
  withoutPixelList,
} from './types/pixelList';

const makePixelLogic = canvasSize => {
  const pixelLogic = harden({
    insistType: pixelList => {
      insistPixelList(pixelList, canvasSize);
      return harden(pixelList);
    },
    empty: _ => harden([]),
    isEmpty: pixelList => pixelList.length === 0,
    includes: (whole, part) => includesPixelList(whole, part),
    equals: (left, right) =>
      pixelLogic.includes(left, right) && pixelLogic.includes(right, left),
    with: (left, right) => harden(withPixelList(left, right)),
    without: (whole, part) => harden(withoutPixelList(whole, part)),
  });
  return pixelLogic;
};

harden(makePixelLogic);

export { makePixelLogic };
