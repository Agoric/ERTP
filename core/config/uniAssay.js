import harden from '@agoric/harden';

import { insist } from '../../util/insist';
import {
  sameStructure,
  mustBeSameStructure,
  mustBeComparable,
} from '../../util/sameStructure';

// A uniAssay makes uni amounts, which are either empty or have unique
// descriptions. The quantity must either be null, in which case it is
// empty, or be some truthy comparable value, in which case it
// represents a single unique unit described by that truthy
// quantity. Combining two uni amounts with different truthy
// quantities fails, as they represent non-combinable rights.
function makeUniAssayMaker(descriptionCoercer = d => d) {
  function makeUniAssay(label) {
    mustBeComparable(label);

    const brand = new WeakSet();

    const emptyAmount = harden({ label, quantity: null });
    brand.add(emptyAmount);

    const assay = harden({
      getLabel() {
        return label;
      },

      make(optDescription) {
        if (optDescription === null) {
          return emptyAmount;
        }
        insist(!!optDescription)`\
Uni optDescription must be either null or truthy ${optDescription}`;
        mustBeComparable(optDescription);

        const description = descriptionCoercer(optDescription);
        insist(!!description)`\
Uni description must be truthy ${description}`;
        mustBeComparable(description);

        const amount = harden({ label, quantity: description });
        brand.add(amount);
        return amount;
      },

      vouch(amount) {
        insist(brand.has(amount))`\
Unrecognized amount: ${amount}`;
        return amount;
      },

      coerce(allegedAmount) {
        if (brand.has(allegedAmount)) {
          return allegedAmount;
        }
        const { label: allegedLabel, quantity } = allegedAmount;
        mustBeSameStructure(label, allegedLabel, 'Unrecognized label');
        return assay.make(quantity);
      },

      quantity(amount) {
        return assay.vouch(amount).quantity;
      },

      empty() {
        return emptyAmount;
      },

      isEmpty(amount) {
        return assay.quantity(amount) === null;
      },

      includes(leftAmount, rightAmount) {
        const leftQuant = assay.quantity(leftAmount);
        const rightQuant = assay.quantity(rightAmount);
        if (rightQuant === null) {
          return true;
        }
        return sameStructure(leftQuant, rightQuant);
      },

      equals(leftAmount, rightAmount) {
        return (
          assay.includes(leftAmount, rightAmount) &&
          assay.includes(rightAmount, leftAmount)
        );
      },

      with(leftAmount, rightAmount) {
        const leftQuant = assay.quantity(leftAmount);
        const rightQuant = assay.quantity(rightAmount);
        if (leftQuant === null) {
          return rightAmount;
        }
        if (rightQuant === null) {
          return leftAmount;
        }
        if (sameStructure(leftQuant, rightQuant)) {
          // The "throw" is useless since insist(false) will unconditionally
          // throw anyway. Rather, it informs IDEs of this control flow.
          throw insist(false)`\
Even identical non-empty uni amounts cannot be added together ${leftAmount}`;
        } else {
          // The "throw" is useless since insist(false) will unconditionally
          // throw anyway. Rather, it informs IDEs of this control flow.
          throw insist(false)`\
Cannot combine different uni descriptions ${leftAmount} vs ${rightAmount}`;
        }
      },

      without(leftAmount, rightAmount) {
        const leftQuant = assay.quantity(leftAmount);
        const rightQuant = assay.quantity(rightAmount);
        if (rightQuant === null) {
          return leftAmount;
        }
        insist(leftQuant !== null)`\
Empty left does not include ${rightAmount}`;

        mustBeSameStructure(
          leftQuant,
          rightQuant,
          'Cannot subtract different uni descriptions',
        );
        return emptyAmount;
      },
    });
    return assay;
  }
  return harden(makeUniAssay);
}
harden(makeUniAssayMaker);

export { makeUniAssayMaker };
