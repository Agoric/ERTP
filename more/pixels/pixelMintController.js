import { makePrivateName } from '../../util/PrivateName';
import { insist } from '../../util/insist';

import { getString } from './types/pixel';

export function makeMintController(assay) {
  // Map from purse or payment to the rights it currently
  // holds. Rights can move via payments

  // purse to amount
  let purses = makePrivateName();
  // payment to amount
  let payments = makePrivateName();

  // pixel to purse/payment
  const pixelToAsset = new Map();

  function recordPixelsAsAsset(amount, purseOrPayment) {
    // purse or payment is the key of rights
    amount = assay.coerce(amount);
    const pixelList = assay.quantity(amount);
    for (const pixel of pixelList) {
      pixelToAsset.set(getString(pixel), purseOrPayment);
    }
  }

  // This amount (must be nonfungible) will be forcibly taken out of
  // all purses and payments that it is currently in
  function destroy(amount) {
    // amount must only contain one pixel
    const pixelList = assay.quantity(amount);
    insist(pixelList.length === 1)`amount must contain exactly one pixel`;

    const pixel = pixelList[0];
    const strPixel = getString(pixel);
    insist(pixelToAsset.has(strPixel))`\
      pixel ${strPixel} could not be found to be destroyed`;
    const purseOrPayment = pixelToAsset.get(strPixel);
    // amount is guaranteed to be there
    amount = assay.coerce(amount);

    // ///////////////// commit point //////////////////
    // All queries above passed with no side effects.
    // During side effects below, any early exits should be made into
    // fatal turn aborts.

    // we don't know if this is a purse or payment, so handle both cases
    if (purses.has(purseOrPayment)) {
      const originalAmount = purses.get(purseOrPayment);
      const newAmount = assay.without(originalAmount, amount);
      purses.set(purseOrPayment, newAmount);
      // Reset the mappings from everything in the amount to the purse
      // or payment that holds them.
      recordPixelsAsAsset(newAmount, purseOrPayment);
    }

    if (payments.has(purseOrPayment)) {
      const originalAmount = payments.get(purseOrPayment);
      const newAmount = assay.without(originalAmount, amount);
      payments.set(purseOrPayment, newAmount);
      // Reset the mappings from everything in the amount to the purse
      // or payment that holds them.
      recordPixelsAsAsset(newAmount, purseOrPayment);
    }

    // delete pixel from pixelToAsset
    pixelToAsset.delete(pixel);
  }

  function destroyAll() {
    purses = makePrivateName(); // reset rights
    payments = makePrivateName();
  }

  function updateAmount(purseOrPayment, isPurse, newAmount) {
    if (isPurse) {
      purses.set(purseOrPayment, newAmount);
    } else {
      payments.set(purseOrPayment, newAmount);
    }
    recordPixelsAsAsset(newAmount, purseOrPayment);
  }

  function recordNewAsset(purseOrPayment, isPurse, initialAmount) {
    if (isPurse) {
      purses.init(purseOrPayment, initialAmount);
    } else {
      payments.init(purseOrPayment, initialAmount);
    }

    recordPixelsAsAsset(initialAmount, purseOrPayment);
  }

  function getAmount(purseOrPayment, isPurse) {
    if (isPurse) {
      return purses.get(purseOrPayment);
    }
    return payments.get(purseOrPayment);
  }

  const mintController = {
    destroy,
    destroyAll,
    updateAmount,
    recordNewAsset,
    getAmount,
  };
  return mintController;
}
