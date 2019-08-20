import harden from '@agoric/harden';

import { makeUniStrategy } from './uniStrategy';
import { makeAssayMaker } from '../assay';

// A uniAssay makes uni amounts, which are either empty or have unique
// descriptions. The quantity must either be null, in which case it is
// empty, or be some truthy comparable value, in which case it
// represents a single unique unit described by that truthy
// quantity. Combining two uni amounts with different truthy
// quantities fails, as they represent non-combinable rights.
function makeUniAssayMaker(descriptionCoercer = d => d) {
  const uniStrategy = makeUniStrategy(descriptionCoercer);
  return makeAssayMaker(uniStrategy);
}
harden(makeUniAssayMaker);

export { makeUniAssayMaker };
