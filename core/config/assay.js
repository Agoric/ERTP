import harden from '@agoric/harden';

import { insist } from '../../util/insist';
import {
  mustBeSameStructure,
  mustBeComparable,
} from '../../util/sameStructure';

function makeAssay(label, logic) {
  mustBeComparable(label);

  // memoize well formedness check of amounts
  const brand = new WeakSet();

  const assay = harden({
    getLabel() {
      return label;
    },

    // Given the raw quantity that this kind of amount would label, return
    // an amount so labeling that quantity.
    make(allegedQuantity) {
      const amount = harden({ label, quantity: logic.insistType(allegedQuantity) });
      brand.add(amount);
      return amount;
    },

    // Is this an amount object made by this assay? If so, return
    // it. Otherwise error.
    vouch(amount) {
      insist(brand.has(amount))`\
Unrecognized amount: ${amount}`;
      return amount;
    },

    // Is this like an amount object made by this assay, such as one
    // received by pass-by-copy from an otherwise-identical remote
    // amount? On success, return an amount object made by this
    // assay. Otherwise error.
    //
    // Until we have good support for pass-by-construction, the full
    // assay style is too awkward to use remotely. See
    // mintTestAssay. So coerce also accepts a bare number which it
    // will coerce to a labeled number via assay.make.
    coerce(allegedAmount) {
      if (typeof allegedAmount === 'number') {
        // Will throw on inappropriate number
        return assay.make(allegedAmount);
      }
      if (brand.has(allegedAmount)) {
        return allegedAmount;
      }
      const { label: allegedLabel, quantity } = allegedAmount;
      mustBeSameStructure(label, allegedLabel, 'Unrecognized label');
      // Will throw on inappropriate quantity
      return assay.make(quantity);
    },

    // Return the raw quantity that this amount labels.
    quantity(amount) {
      return assay.vouch(amount).quantity;
    },

    // Represents the empty set of erights, i.e., no erights
    empty() {
      return assay.make(logic.empty());
    },

    isEmpty(amount) {
      return logic.isEmpty(assay.quantity(amount) === 0);
    },

    // Set inclusion of erights.
    // Does the set of erights described by `leftAmount` include all
    // the erights described by `rightAmount`?
    includes(leftAmount, rightAmount) {
      const leftQuantity = assay.quantity(leftAmount);
      const rightQuantity = assay.quantity(rightAmount);
      return logic.includes(leftQuantity, rightQuantity);
    },

    equals(leftAmount, rightAmount) {
      const leftQuantity = assay.quantity(leftAmount);
      const rightQuantity = assay.quantity(rightAmount);
      return logic.equals(leftQuantity, rightQuantity);
    },

    // Set union of erights.
    // Describe all the erights described by `leftAmount` and those
    // described by `rightAmount`.
    with(leftAmount, rightAmount) {
      const leftQuantity = assay.quantity(leftAmount);
      const rightQuantity = assay.quantity(rightAmount);
      return assay.make(
        logic.with(leftQuantity, rightQuantity)
      );
    },

    // Covering set subtraction of erights.
    // If leftAmount does not include rightAmount, error.
    // Describe the erights described by `leftAmount` and not described
    // by `rightAmount`.
    without(leftAmount, rightAmount) {
      const leftQuantity = assay.quantity(leftAmount);
      const rightQuantity = assay.quantity(rightAmount);
      return assay.make(
        logic.without(leftQuantity, rightQuantity)
      );
    },
  });
  return assay;
}
harden(makeAssay);

export { makeAssay };
