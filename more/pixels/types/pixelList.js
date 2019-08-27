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

export { makeWholePixelList };
