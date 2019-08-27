import harden from '@agoric/harden';

import { passStyleOf } from '@agoric/marshal';

import { insistPixel, isEqual } from './types/pixel';
import { insist } from '../../util/insist';

function includesPixel(pixelList, pixel) {
  let result = false;
  for (const p of pixelList) {
    if (isEqual(pixel, p)) {
      result = true;
    }
  }
  return result;
}

// A pixelList is a naive collection of pixels in the form:
// [ { x: 0, y: 0 }, { x: 1, y: 1} ...]
// This is less than ideal for efficiency and expressiveness but will
// do for now
const makePixelStrategy = (canvasSize = 10) => {
  const pixelStrategy = harden({
    insistKind: pixelList => {
      insist(
        passStyleOf(harden(pixelList)) === 'copyArray',
      )`pixelList must be an array`;
      for (const pixel of pixelList) {
        insistPixel(pixel, canvasSize);
      }
      return harden(pixelList);
    },
    empty: _ => harden([]),
    isEmpty: pixelList => pixelList.length === 0,
    includes: (whole, part) => {
      for (const partPixel of part) {
        const result = includesPixel(whole, partPixel);
        if (!result) {
          return false; // return early if false
        }
      }
      return true;
    },
    equals: (left, right) =>
      pixelStrategy.includes(left, right) &&
      pixelStrategy.includes(right, left),
    with: (left, right) => {
      const combinedList = Array.from(left);
      for (const rightPixel of right) {
        if (!includesPixel(left, rightPixel)) {
          combinedList.push(rightPixel);
        }
      }
      return combinedList;
    },
    without: (whole, part) => {
      insist(
        pixelStrategy.includes(whole, part),
      )`leftPixelList is not in rightPixelList`;
      const wholeMinusPart = [];
      for (const wholePixel of whole) {
        if (!includesPixel(part, wholePixel)) {
          wholeMinusPart.push(wholePixel);
        }
      }
      return wholeMinusPart;
    },
  });
  return pixelStrategy;
};

harden(makePixelStrategy);

export { makePixelStrategy, includesPixel };
