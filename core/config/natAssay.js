import Nat from '@agoric/nat';
import harden from '@agoric/harden';

import { insist } from '../../util/insist';
import {
  mustBeSameStructure,
  mustBeComparable,
} from '../../util/sameStructure';

// This assays.js module treats labels as black boxes. It is not aware
// of issuers, and so can handle labels whose issuers are merely
// presences of remote issuers.

// Return an assay, which makes amounts, validates amounts, and
// provides set operations over amounts. An amount is a pass-by-copy
// description of some set of erights. An amount has a label and a
// quantity. All amounts made by the same assay have the same label
// but differ in quantity.
//
// An assay is pass-by-presence, but is not designed to be usefully
// passed. Rather, we expect each vat that needs to operate on amounts
// will have its own local assay to do so.
//
// The default assay makes the default kind of amount.  The default
// kind of amount is a labeled natural number describing a quantity of
// fungible erights. The label describes what kinds of rights these
// are. This is a form of labeled unit, as in unit typing.
function makeNatAssay(label) {
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
      const amount = harden({ label, quantity: Nat(allegedQuantity) });
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
      return assay.make(0);
    },

    isEmpty(amount) {
      return assay.quantity(amount) === 0;
    },

    // Set inclusion of erights.
    // Does the set of erights described by `leftAmount` include all
    // the erights described by `rightAmount`?
    includes(leftAmount, rightAmount) {
      return assay.quantity(leftAmount) >= assay.quantity(rightAmount);
    },

    equals(leftAmount, rightAmount) {
      return assay.quantity(leftAmount) === assay.quantity(rightAmount);
    },

    // Set union of erights.
    // Describe all the erights described by `leftAmount` and those
    // described by `rightAmount`.
    with(leftAmount, rightAmount) {
      return assay.make(
        assay.quantity(leftAmount) + assay.quantity(rightAmount),
      );
    },

    // Covering set subtraction of erights.
    // If leftAmount does not include rightAmount, error.
    // Describe the erights described by `leftAmount` and not described
    // by `rightAmount`.
    without(leftAmount, rightAmount) {
      return assay.make(
        assay.quantity(leftAmount) - assay.quantity(rightAmount),
      );
    },
  });
  return assay;
}
harden(makeNatAssay);

export { makeNatAssay };
