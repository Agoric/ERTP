import { makePrivateName } from '../../util/PrivateName';

export function makeCoreMintKeeper() {
  // An asset can either be a purse or payment. An asset keeper
  // keeps track of either all of the purses (purseKeeper) or all
  // of the payments (paymentKeeper) and their respective amounts.
  function makeAssetKeeper() {
    // asset to amount
    const assets = makePrivateName();
    return {
      updateAmount(asset, newAmount) {
        assets.set(asset, newAmount);
      },
      recordNew(asset, initialAmount) {
        assets.init(asset, initialAmount);
      },
      getAmount(asset) {
        return assets.get(asset);
      },
      has(asset) {
        return assets.has(asset);
      },
    };
  }

  const purseKeeper = makeAssetKeeper();
  const paymentKeeper = makeAssetKeeper();

  const mintKeeper = {
    purseKeeper,
    paymentKeeper,
    isPurse(asset) {
      return purseKeeper.has(asset);
    },
    isPayment(asset) {
      return paymentKeeper.has(asset);
    },
  };
  return mintKeeper;
}
