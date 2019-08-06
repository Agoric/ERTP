import { makePrivateName } from '../../util/PrivateName';
import { insist } from '../../util/insist';
import { getString } from './types/pixel';

export function makePixelMintKeeper(assay) {
  // Map from purse or payment to the rights it currently
  // holds. Rights can move via payments

  // pixel to purse/payment
  const pixelToAsset = new Map();

  function recordPixelsAsAsset(amount, asset) {
    // purse or payment is the key of rights
    amount = assay.coerce(amount);
    const pixelList = assay.quantity(amount);
    for (const pixel of pixelList) {
      pixelToAsset.set(getString(pixel), asset);
    }
  }

  function makeAssetKeeper() {
    // asset to amount
    const assets = makePrivateName();
    return {
      updateAmount(asset, newAmount) {
        assets.set(asset, newAmount);
        recordPixelsAsAsset(newAmount, asset);
      },
      recordNew(asset, initialAmount) {
        assets.init(asset, initialAmount);
        recordPixelsAsAsset(initialAmount, asset);
      },
      getAmount(asset) {
        return assets.get(asset);
      },
      has(asset) {
        return assets.has(asset);
      },
    };
  }

  const purseKeeper = makeAssetKeeper('purse');
  const paymentKeeper = makeAssetKeeper('payment');

  function getKeeper(asset) {
    if (purseKeeper.has(asset)) {
      return purseKeeper;
    }
    if (paymentKeeper.has(asset)) {
      return paymentKeeper;
    }
    throw new Error(
      `asset ${asset.getName()} was not recognized as a purse or a payment`,
    );
  }

  const pixelMintKeeper = {
    purseKeeper,
    paymentKeeper,

    // This amount (must be nonfungible) will be forcibly taken out of
    // all purses and payments that it is currently in. Destroy is
    // outside of an assetKeeper because it could affect purses or
    // payments
    destroy(amount) {
      // amount must only contain one pixel
      const pixelList = assay.quantity(amount);
      insist(pixelList.length === 1)`amount must contain exactly one pixel`;

      const pixel = pixelList[0];
      const strPixel = getString(pixel);
      insist(
        pixelToAsset.has(strPixel),
      )`pixel ${strPixel} could not be found to be destroyed`;
      const asset = pixelToAsset.get(strPixel);
      // amount is guaranteed to be there
      amount = assay.coerce(amount);

      const keeper = getKeeper(asset);
      const originalAmount = keeper.getAmount(asset);
      const newAmount = assay.without(originalAmount, amount);

      // ///////////////// commit point //////////////////
      // All queries above passed with no side effects.
      // During side effects below, any early exits should be made into
      // fatal turn aborts.
      keeper.updateAmount(asset, newAmount);
      // Reset the mappings from everything in the amount to the purse
      // or payment that holds them.
      recordPixelsAsAsset(newAmount, asset);

      // delete pixel from pixelToAsset
      pixelToAsset.delete(pixel);
    },
    isPurse(asset) {
      return purseKeeper.has(asset);
    },
    isPayment(asset) {
      return paymentKeeper.has(asset);
    },
  };
  return pixelMintKeeper;
}
