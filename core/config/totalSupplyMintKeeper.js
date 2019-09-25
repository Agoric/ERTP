import harden from '@agoric/harden';

import { makePrivateName } from '../../util/PrivateName';

export function makeTotalSupplyMintKeeper(assay) {
  let totalSupply = assay.empty();

  // An asset can either be a purse or payment. An asset keeper
  // keeps track of either all of the purses (purseKeeper) or all
  // of the payments (paymentKeeper) and their respective amounts.
  function makeAssetKeeper() {
    // asset to amount
    const amounts = makePrivateName();
    return harden({
      updateAmount(asset, newAmount) {
        const oldAmount = amounts.get(asset);
        amounts.set(asset, newAmount);
        // if old amount includes new, then it's a decrease
        if (assay.includes(oldAmount, newAmount)) {
          const decrease = assay.without(oldAmount, newAmount);
          totalSupply = assay.without(totalSupply, decrease);
        } else {
          // otherwise it's an increase
          const increase = assay.without(newAmount, oldAmount);
          totalSupply = assay.with(totalSupply, increase);
        }
      },
      recordNew(asset, initialAmount) {
        amounts.init(asset, initialAmount);
        totalSupply = assay.with(totalSupply, initialAmount);
      },
      getAmount(asset) {
        return amounts.get(asset);
      },
      has(asset) {
        return amounts.has(asset);
      },
      remove(asset) {
        const amount = amounts.get(asset);
        totalSupply = assay.without(totalSupply, amount);
        amounts.delete(asset);
      },
    });
  }

  const purseKeeper = makeAssetKeeper();
  const paymentKeeper = makeAssetKeeper();

  const mintKeeper = harden({
    purseKeeper,
    paymentKeeper,
    isPurse(asset) {
      return purseKeeper.has(asset);
    },
    isPayment(asset) {
      return paymentKeeper.has(asset);
    },
    getTotalSupply: () => totalSupply,
  });
  return mintKeeper;
}
