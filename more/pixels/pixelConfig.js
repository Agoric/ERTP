import harden from '@agoric/harden';

import { makePixelMintKeeper } from './pixelMintKeeper';
import { makePixelExtentOps } from './pixelStrategy';
import { makeMint } from '../../core/issuers';

/**
 * `makePixelConfigMaker` exists in order to pass in more parameters
 * than makePixelConfig allows.
 * @param  {function} makeUseObj creates a "use object", which has all
 * of the non-ERTP methods for assets that are designed to be used.
 * For instance, a pixel can be colored. The use object is associated
 * with an underlying asset that provides the authority to use it.
 * @param  {number} canvasSize=10 the size of the gallery in pixel
 * squares across and down
 * @param  {assay} parentAssay (optional) the `parentAssay` is used when
 * creating a revocable childPayment or childPurse, as in the
 * landowner/tenant/subtenant pattern. In that pattern, the owner
 * holds assets associated with the parent assay, the tenant holds
 * assets associated with the child assay, the subtenant holds assets
 * associated with the grandchild assay, and so forth.
 */
function makePixelConfigMaker(
  makeUseObj,
  canvasSize = 10,
  parentAssay = undefined,
) {
  function makePixelConfig() {
    // The childAssay/childMint are lazily created to avoid going
    // infinitely far down the chain of assays on creation. The
    // childAssay assets are revocable by the current assay (the
    // child's parent).
    let childAssay;
    let childMint;

    // Lazily creates the childMint if it doesn't already
    // exist
    function prepareChildMint(assay) {
      if (childMint === undefined) {
        const makePixelConfigChild = makePixelConfigMaker(
          makeUseObj,
          canvasSize,
          assay,
        );
        const { description } = assay.getLabel();
        childMint = makeMint(description, makePixelConfigChild);
        childAssay = childMint.getAssay();
      }
    }

    // This method is used in the creation of childPayments and
    // childPurses where we want the assetDesc to be the same as in the
    // original asset apart from the difference in assays.
    function getChildAssetDesc(assay, assetDesc) {
      // extent is the same, but assetDescs are different for
      // different assays
      const { extent } = assetDesc;
      return childAssay.makeAssetDesc(extent);
    }

    return harden({
      makePaymentTrait(superPayment, assay) {
        return harden({
          // This creates a new use object on every call. Please see
          // the gallery for the definition of the use object that is
          // created here by calling `makeUseObj`
          getUse() {
            return makeUseObj(assay, superPayment);
          },
          // Revoke all descendants of this payment and mint a new
          // payment from the child mint with the same extent as the
          // original payment
          claimChild() {
            prepareChildMint(assay);
            const childAssetDesc = getChildAssetDesc(
              assay,
              superPayment.getBalance(),
            );
            // Remove the assetDesc of this payment from the purses and
            // payments of the childMint. Removes recursively down the
            // chain until it fails to find a childMint.
            childMint.revoke(childAssetDesc);
            const childPurse = childMint.mint(childAssetDesc);
            return childPurse.withdrawAll();
          },
        });
      },
      makePurseTrait(superPurse, assay) {
        return harden({
          // This creates a new use object on every call. Please see
          // the gallery for the definition of the use object that is
          // created here by calling `makeUseObj`
          getUse() {
            return makeUseObj(assay, superPurse);
          },
          // Revoke all descendants of this purse and mint a new purse
          // from the child mint with the same extent as the
          // original purse
          claimChild() {
            prepareChildMint(assay);
            const childAssetDesc = getChildAssetDesc(
              assay,
              superPurse.getBalance(),
            );
            // Remove the assetDesc of this payment from the purses and
            // payments of the childMint. Removes recursively down the
            // chain until it fails to find a childMint.
            childMint.revoke(childAssetDesc);
            return childMint.mint(childAssetDesc);
          },
        });
      },
      makeMintTrait(_superMint, assay, descOps, mintKeeper) {
        return harden({
          // revoke destroys the assetDesc from this mint and calls
          // revoke on the childMint with an assetDesc of the same
          // extent. Destroying the assetDesc depends on the fact that
          // pixels are uniquely identifiable by their `x` and `y`
          // coordinates. Therefore, destroy can look for purses and
          // payments that include those particular pixels and remove
          // the particular pixels from those purses or payments
          revoke(assetDesc) {
            assetDesc = descOps.coerce(assetDesc);

            mintKeeper.destroy(assetDesc);
            if (childMint !== undefined) {
              childMint.revoke(getChildAssetDesc(assay, assetDesc)); // recursively revoke child assets
            }
          },
        });
      },
      makeAssayTrait(superAssay) {
        return harden({
          // The parent assay is one level up in the chain of
          // assays.
          getParentAssay() {
            return parentAssay;
          },
          // The child assay is one level down in the chain of assays.
          getChildAssay() {
            prepareChildMint(superAssay);
            return childAssay;
          },
          // Returns true if the alleged descendant assay is either a
          // child, grandchild, or any other kind of descendant
          isDescendantAssay(allegedDescendant) {
            if (childAssay === undefined) {
              return false;
            }
            if (childAssay === allegedDescendant) {
              return true;
            }
            return childAssay.isDescendantAssay(allegedDescendant);
          },
        });
      },
      makeMintKeeper: makePixelMintKeeper,
      extentOps: makePixelExtentOps(canvasSize),
    });
  }
  return makePixelConfig;
}

export { makePixelConfigMaker };
