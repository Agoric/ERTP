// Copyright (C) 2019 Agoric, under Apache License 2.0

import harden from '@agoric/harden';

import { insist } from '../../util/insist';
import {
  mustBeSameStructure,
  mustBeComparable,
} from '../../util/sameStructure';

import { insistIds, includesIds, withIds, withoutIds } from './ids';

// A stock right has an id for tracking voting and the claiming of
// dividends.

function makeUsableStockAssay(label) {
  mustBeComparable(label);

  const brand = new WeakSet();

  // our empty stock is an empty array
  const emptyAmount = harden({
    label,
    quantity: [],
  });
  brand.add(emptyAmount);

  const assay = harden({
    getLabel() {
      return label;
    },

    // ids is an array of Nats
    make(ids) {
      mustBeComparable(ids);
      insistIds(ids);

      if (ids.length === 0) {
        return emptyAmount;
      }

      const amount = harden({ label, quantity: ids });
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
      const { label: allegedLabel, quantity: ids } = allegedAmount;
      mustBeSameStructure(label, allegedLabel, 'Unrecognized label');
      return assay.make(ids);
    },

    quantity(amount) {
      return assay.vouch(amount).quantity;
    },

    empty() {
      return emptyAmount;
    },

    isEmpty(amount) {
      return assay.quantity(amount).length === 0;
    },

    // does left include right?
    includes(leftAmount, rightAmount) {
      const leftIds = assay.quantity(leftAmount);
      const rightIds = assay.quantity(rightAmount);

      return includesIds(leftIds, rightIds);
    },

    // set union
    with(leftAmount, rightAmount) {
      const leftIds = assay.quantity(leftAmount);
      const rightIds = assay.quantity(rightAmount);

      const resultIds = withIds(leftIds, rightIds);

      return assay.make(harden(resultIds));
    },

    // Covering set subtraction of erights.
    // If leftAmount does not include rightAmount, error.
    // Describe the erights described by `leftAmount` and not described
    // by `rightAmount`.
    without(leftAmount, rightAmount) {
      const leftIds = assay.quantity(leftAmount);
      const rightIds = assay.quantity(rightAmount);

      const resultIds = withoutIds(leftIds, rightIds);

      return assay.make(harden(resultIds));
    },
  });
  return harden(assay);
}

harden(makeUsableStockAssay);

export { makeUsableStockAssay };
