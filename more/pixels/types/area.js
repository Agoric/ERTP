import {
  insistPixel,
  isLessThanOrEqual,
  isEqual as isEqualPixel,
} from './pixel';

import { insist } from '../../../util/insist';

function insistLessThanOrEqual(start, end) {
  insist(isLessThanOrEqual(start, end))`/
  the starting pixel must be "less than or equal" to the ending pixel`;
}

function insistIsEqualPixel(left, right) {
  insist(isEqualPixel(left, right))`/
  the left pixel must be equal to the right pixel`;
}

function insistArea(area, canvasSize) {
  const properties = Object.getOwnPropertyNames(area);
  insist(properties.length === 2)`\
  areas must have start, end properties only`;

  insistPixel(area.start, canvasSize);
  insistPixel(area.end, canvasSize);

  insistLessThanOrEqual(area.start, area.end);

  return area;
}

// should only be used with valid pixels - no checks
function isEqual(leftArea, rightArea) {
  return leftArea.start === rightArea.start && leftArea.end === rightArea.end;
}

// should only be used with valid pixels - no checks
// Does the area include the pixel?
function includes(area, pixel) {
  const pixelAfterStartX = pixel.x >= area.start.x;
  const pixelAfterStartY = pixel.y >= area.start.y;
  const pixelBeforeEndX = pixel.x <= area.end.x;
  const pixelBeforeEndY = pixel.y <= area.end.y;
  return (
    pixelAfterStartX && pixelAfterStartY && pixelBeforeEndX && pixelBeforeEndY
  );
}

// actually this isn't enough, we need to confirm that all the pixels
// are there, and then burn them to create the area.
function makeArea(allegedArea, pixelList, canvasSize) {
  const { start, end } = allegedArea;
  const area = insistArea(allegedArea, canvasSize);
  let count = 0;

  for (let { x } = start; x <= end.x; x += 1) {
    for (let { y } = start; y <= end.y; y += 1) {
      // check that all of the pixels within the area are included in
      // the pixelList
      const pixel = { x, y };

      // assume pixelList is ordered and compare with next entry
      const pixelListPixel = pixelList[count];
      insistIsEqualPixel(pixelListPixel, pixel);
      count += 1;
    }
  }
  return area;
}

// example
// 2 x 2 area, from 2, 2 to 4, 4
// 2 3
// 3 4

export { insistArea, isEqual, makeArea, includes };
