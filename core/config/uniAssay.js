import harden from '@agoric/harden';

import { makeUniLogic } from './uniLogic';
import { makeAssayMaker } from './assay';

// A uniAssay makes uni amounts, which are either empty or have unique
// descriptions. The quantity must either be null, in which case it is
// empty, or be some truthy comparable value, in which case it
// represents a single unique unit described by that truthy
// quantity. Combining two uni amounts with different truthy
// quantities fails, as they represent non-combinable rights.
function makeUniAssayMaker(descriptionCoercer = d => d) {
  const uniLogic = makeUniLogic(descriptionCoercer);
  return makeAssayMaker(uniLogic);
}
harden(makeUniAssayMaker);

export { makeUniAssayMaker };
