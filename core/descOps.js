import harden from '@agoric/harden';

import { insist } from '../util/insist';
import { mustBeSameStructure, mustBeComparable } from '../util/sameStructure';

/**
 * `descOps` is short for asset description operations. These are the
 * set operations over asset descriptions. For instance, `descOps` is
 * what allows us to to add 3 moola to 5 moola and get 8 moola. It's
 * also what ensures that we can never add 5 moola to 6 bucks. We call
 * the scalar in "3 moola" (the 3) the `extent`. We use the general
 * term `extent` to be able to represent a wide variety of
 * measurements, such as identifiers in the case of non-fungible
 * tokens, not just scalar quantities.
 *
 * This module treats labels as black boxes. It is not aware of
 * assays, and so can handle labels whose assays are merely presences
 * of remote assays.
 *
 * Return a `descOps`, which makes `assetDescs`, validates `assetDescs`, and
 * provides set operations over `assetDescs`. An `assetDesc` is a pass-by-copy
 * description of some set of erights. An `assetDesc` has a `label` and a
 * `extent`. All `assetDescs` made by the same `descOps` have the same `label`
 * but differ in `extent`.
 *
 * A `descOps` is pass-by-presence, but is not designed to be usefully
 * passed. Rather, we expect each vat that needs to operate on `assetDescs`
 * will have its own local `descOps` to do so.
 *
 * @param {} label - a pass-by-copy description with an assay
 * @param {*} extentOps - a bundle of operations that act on the
 * `extent`. In a basic fungible mint, the `extentOps` include the
 * subtraction and addition of natural numbers. In other types of
 * mints, these will be different.
 */

function makeDescOps(label, extentOps) {
  mustBeComparable(label);

  // The brand represents recognition of the assetDesc as authorized.
  const brand = new WeakSet();

  const descOps = harden({
    getLabel() {
      return label;
    },

    getExtentOps() {
      return extentOps;
    },

    // Given the raw extent that this kind of assetDesc would label, return
    // an assetDesc so labeling that extent.
    make(allegedExtent) {
      extentOps.insistKind(allegedExtent);
      const assetDesc = harden({
        label,
        extent: allegedExtent,
      });
      brand.add(assetDesc);
      return assetDesc;
    },

    // Is this an assetDesc object made by this descOps? If so, return
    // it. Otherwise error.
    vouch(assetDesc) {
      insist(brand.has(assetDesc))`\
  Unrecognized assetDesc: ${assetDesc}`;
      return assetDesc;
    },

    // Is this like an assetDesc object made by this descOps, such as one
    // received by pass-by-copy from an otherwise-identical remote
    // assetDesc? On success, return an assetDesc object made by this
    // descOps. Otherwise error.
    //
    coerce(allegedAssetDesc) {
      if (brand.has(allegedAssetDesc)) {
        return allegedAssetDesc;
      }
      if (!Object.prototype.hasOwnProperty.call(allegedAssetDesc, 'extent')) {
        // This is not an assetDesc. Let's see if it's a extent. Will
        // throw on inappropriate extent.
        return descOps.make(allegedAssetDesc);
      }
      const { label: allegedLabel, extent } = allegedAssetDesc;
      mustBeSameStructure(label, allegedLabel, 'Unrecognized label');
      // Will throw on inappropriate extent
      return descOps.make(extent);
    },

    // Return the raw extent that this assetDesc labels.
    extent(assetDesc) {
      return descOps.vouch(assetDesc).extent;
    },

    // Represents the empty set of erights, i.e., no erights
    empty() {
      return descOps.make(extentOps.empty());
    },

    isEmpty(assetDesc) {
      return extentOps.isEmpty(descOps.extent(assetDesc));
    },

    // Set inclusion of erights.
    // Does the set of erights described by `leftAssetDesc` include all
    // the erights described by `rightAssetDesc`?
    includes(leftAssetDesc, rightAssetDesc) {
      const leftExtent = descOps.extent(leftAssetDesc);
      const rightExtent = descOps.extent(rightAssetDesc);
      return extentOps.includes(leftExtent, rightExtent);
    },

    equals(leftAssetDesc, rightAssetDesc) {
      const leftExtent = descOps.extent(leftAssetDesc);
      const rightExtent = descOps.extent(rightAssetDesc);
      return extentOps.equals(leftExtent, rightExtent);
    },

    // Set union of erights.
    // Combine the assetDescs described by 'leftAssetDesc' and 'rightAssetDesc'.
    with(leftAssetDesc, rightAssetDesc) {
      const leftExtent = descOps.extent(leftAssetDesc);
      const rightExtent = descOps.extent(rightAssetDesc);
      return descOps.make(extentOps.with(leftExtent, rightExtent));
    },

    // Covering set subtraction of erights.
    // If leftAssetDesc does not include rightAssetDesc, error.
    // Return the assetDesc included in 'leftAssetDesc' but not included in 'rightAssetDesc'.
    without(leftAssetDesc, rightAssetDesc) {
      const leftExtent = descOps.extent(leftAssetDesc);
      const rightExtent = descOps.extent(rightAssetDesc);
      return descOps.make(extentOps.without(leftExtent, rightExtent));
    },
  });
  return descOps;
}
harden(makeDescOps);

export { makeDescOps };
