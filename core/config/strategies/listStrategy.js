import harden from '@agoric/harden';
import { passStyleOf } from '@agoric/marshal';

import { insist } from '../../../util/insist';

const makeListStrategy = (insistElementKind, isEqual) => {
  function includesElement(list, element) {
    for (const e of list) {
      if (isEqual(element, e)) {
        return true;
      }
    }
    return false;
  }
  const listStrategy = harden({
    insistKind: list => {
      insist(passStyleOf(harden(list)) === 'copyArray')`list must be an array`;
      for (const element of list) {
        insistElementKind(element);
      }
      return harden(list);
    },
    empty: _ => harden([]),
    isEmpty: list => list.length === 0,
    includes: (whole, part) => {
      for (const partElement of part) {
        if (!includesElement(whole, partElement)) {
          return false; // return early if false
        }
      }
      return true;
    },
    equals: (left, right) =>
      listStrategy.includes(left, right) && listStrategy.includes(right, left),
    with: (left, right) => {
      const combinedList = Array.from(left);
      for (const rightElement of right) {
        if (!includesElement(left, rightElement)) {
          combinedList.push(rightElement);
        }
      }
      return combinedList;
    },
    without: (whole, part) => {
      insist(listStrategy.includes(whole, part))`part is not in whole`;
      const wholeMinusPart = [];
      for (const wholeElement of whole) {
        if (!includesElement(part, wholeElement)) {
          wholeMinusPart.push(wholeElement);
        }
      }
      return wholeMinusPart;
    },
  });
  return listStrategy;
};

harden(makeListStrategy);

export { makeListStrategy };
