import { passStyleOf } from '@agoric/marshal';

import { insistPixel, isEqual, compare } from './pixel';
import { insist } from '../../../util/insist';

// pixelList is the most naive bundling of pixels
// it is just an array of pixels
function insistPixelList(pixelList, canvasSize) {
  insist(passStyleOf(pixelList) === 'copyArray')`pixelList must be an array`;
  for (let i = 0; i < pixelList.length; i += 1) {
    insistPixel(pixelList[i], canvasSize);
  }
}

function binarySearch(pixels, pixel, start = 0) {
  let stop = pixels.length - 1;
  let middle = Math.floor((start + stop) / 2);

  while (start < stop && !isEqual(pixels[middle], pixel)) {
    // adjust search area
    if (compare(pixel, pixels[middle]) < 0) {
      stop = middle - 1;
    } else if (compare(pixel, pixels[middle] > 0)) {
      start = middle + 1;
    }

    // recalculate middle
    middle = Math.floor((stop + start) / 2);
  }

  // make sure it's the right value
  return !isEqual(pixels[middle], pixel) ? -1 : middle;
}

// does not check validity of the pixel or pixelList
function includesPixel(pixelList, pixel) {
  // assumes pixelList is ordered
  const result = binarySearch(pixelList, pixel);
  return result >= 0;
}

// does not check validity of the pixel or pixelList
// does pixelList include pixel
function insistIncludesPixel(pixelList, pixel) {
  insist(includesPixel(pixelList, pixel))`pixel is not in pixelList`;
}

// does left include right?
function includesPixelList(leftPixelList, rightPixelList) {
  // iterate through the pixels in the rightPixelList, see if left
  // includes it

  // assumes both lists are ordered

  let leftStart = 0;

  // if rightPixelList is empty, this just returns true
  for (let i = 0; i < rightPixelList.length; i += 1) {
    const rightPixel = rightPixelList[i];
    const result = binarySearch(leftPixelList, rightPixel, leftStart);
    if (result < 0) {
      return false; // return early
    }
    leftStart = result + 1; // don't revisit left
  }
  return true;
}

function insistIncludesPixelList(leftPixelList, rightPixelList) {
  insist(includesPixelList(leftPixelList, rightPixelList))`\
  leftPixelList is not in rightPixelList`;
}

function withPixelList(leftPixelList, rightPixelList) {
  const combinedList = [];
  let index = 0;

  while (index < leftPixelList.length && index < rightPixelList.length) {
    const leftPixel = leftPixelList[index];
    const rightPixel = rightPixelList[index];
    const result = compare(leftPixel, rightPixel);
    // left is before right
    if (result < 0) {
      combinedList.push(leftPixel, rightPixel);
    }
    if (result === 0) {
      combinedList.push(leftPixel); // they are equal, only use one
    }
    index += 1;
  }

  while (index < leftPixelList.length) {
    // ensure that we are not duplicating
    if (!isEqual(rightPixelList[index - 1], leftPixelList[index])) {
      combinedList.push(leftPixelList[index]);
    }
    index += 1;
  }

  while (index < rightPixelList.length) {
    // ensure that we are not duplicating
    if (!isEqual(leftPixelList[index - 1], rightPixelList[index])) {
      combinedList.push(rightPixelList[index]);
    }
    index += 1;
  }
  return combinedList;
}

// Covering set subtraction of erights.
// If leftAmount does not include rightAmount, error.
// Describe the erights described by `leftAmount` and not described
// by `rightAmount`.
function withoutPixelList(leftPixelList, rightPixelList) {
  const leftMinusRight = [];

  let index = 0;

  while (index < leftPixelList.length && index < rightPixelList.length) {
    const leftPixel = leftPixelList[index];
    const rightPixel = rightPixelList[index];
    const result = compare(leftPixel, rightPixel);
    // left is before right
    if (result !== 0) {
      leftMinusRight.push(leftPixel);
    }
    index += 1;
  }

  while (index < leftPixelList.length) {
    leftMinusRight.push(leftPixelList[index]);
    index += 1;
  }

  while (index < rightPixelList.length) {
    throw new Error(
      'right is longer than left, and therefore left cannot contain right',
    );
  }
  return leftMinusRight;
}

function makeWholePixelList(canvasSize) {
  const pixelList = [];
  for (let x = 0; x < canvasSize; x += 1) {
    for (let y = 0; y < canvasSize; y += 1) {
      pixelList.push({
        x,
        y,
      });
    }
  }
  return pixelList;
}

function insistPixelListEqual(leftPixelList, rightPixelList) {
  // includes both ways, super inefficient
  // if pixelLists were ordered, this would be must more efficient
  insistIncludesPixelList(leftPixelList, rightPixelList);
  insistIncludesPixelList(rightPixelList, leftPixelList);
}

export {
  insistPixelList,
  includesPixel,
  insistIncludesPixel,
  includesPixelList,
  withPixelList,
  withoutPixelList,
  makeWholePixelList,
  insistPixelListEqual,
};
