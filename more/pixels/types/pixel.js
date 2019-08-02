import Nat from '@agoric/nat';

import { insist } from '../../../util/insist';

function insistWithinBounds(num, canvasSize) {
  Nat(num);
  Nat(canvasSize);
  // 0 to canvasSize - 1
  insist(num >= 0 && num < canvasSize)`\
  pixel position must be within bounds`;
}

function insistPixel(pixel, canvasSize) {
  const properties = Object.getOwnPropertyNames(pixel);
  insist(properties.length === 2)`\
  pixels must have x, y properties only`;

  insistWithinBounds(pixel.x, canvasSize);
  insistWithinBounds(pixel.y, canvasSize);
}

// upper left is 0, 0
// lower right is NUM_PIXEL, NUM_PIXEL
// upper left is "less than" lower right

function compare(a, b) {
  if (!a || !b) {
    return undefined;
  }
  const xLess = a.x < b.x;
  const yLess = a.y < b.y;
  const xEqual = a.x === b.x;
  const yEqual = a.y === b.y;

  if (xEqual && yEqual) {
    return 0;
  }

  // 1, 2 before 2, 1
  if (xLess) {
    return -1;
  }

  // 1, 2 before 1, 3
  if (xEqual && yLess) {
    return -1;
  }

  // must be greater
  return 1;
}

// should only be used with valid pixels
function isLessThanOrEqual(leftPixel, rightPixel) {
  return compare(leftPixel, rightPixel) <= 0;
}

// should only be used with valid pixels - no checks
function isEqual(leftPixel, rightPixel) {
  return compare(leftPixel, rightPixel) === 0;
}

function getString(pixel) {
  return `x${pixel.x}y${pixel.y}`;
}

export {
  insistWithinBounds,
  insistPixel,
  isEqual,
  isLessThanOrEqual,
  compare,
  getString,
};
