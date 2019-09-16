import harden from '@agoric/harden';

import { insist } from '../../../util/insist';
import {
  sameStructure,
  mustBeSameStructure,
  mustBeComparable,
} from '../../../util/sameStructure';

// The uniStrategy represents quantities that can never be combined.
// For example, usually there is only one invite in an invite purse or
// payment. (Using a listStrategy is an alternative, but when there is
// usually a quantity of one, it's bothersome to always have to grab
// the first item in the list rather than just represent the item
// itself.)

// The uni quantities are either empty (null) or unique. (The unique
// quantities will often include an empty object for identity).
// Combining two non-null uni quantities fails because they represent
// non-combinable rights.

// `customInsistKind` enforces the particular kind of thing represented. For
// example, the quantity in an invitation to join a contract might look like:
// {
//   id: harden({}),
//   offerToBeMade: [rule1, rule2],
// }

const makeUniStrategy = customInsistKind => {
  const uniStrategy = harden({
    insistKind: quantity => {
      if (quantity === null) {
        return null;
      }
      mustBeComparable(quantity);
      return customInsistKind(quantity);
    },
    empty: _ => null,
    isEmpty: uni => uni === null,
    includes: (whole, part) => {
      // the part is only included in the whole if the part is null or
      // if the part equals the whole
      return uniStrategy.isEmpty(part) || uniStrategy.equals(whole, part);
    },
    equals: sameStructure,
    with: (left, right) => {
      // left and right can only be added together if one of them is null
      if (uniStrategy.isEmpty(left)) {
        return right;
      }
      if (uniStrategy.isEmpty(right)) {
        return left;
      }
      throw insist(false)`Cannot combine uni quantities ${left} and ${right}`;
    },
    without: (whole, part) => {
      // we can only subtract the part from the whole if either part
      // is null or the part equals the whole
      if (uniStrategy.isEmpty(part)) {
        return whole;
      }
      mustBeSameStructure(
        whole,
        part,
        'Cannot subtract different uni descriptions',
      );
      return uniStrategy.empty();
    },
  });
  return uniStrategy;
};

harden(makeUniStrategy);

export { makeUniStrategy };
