import { makePrivateName } from '../../util/PrivateName';
import { insist } from '../../util/insist';

import { getString } from './types/pixel';

export function makeMintController(assay) {
  // Map from purse or payment to the rights it currently
  // holds. Rights can move via payments

  // purse/payment to amount
  let rights = makePrivateName();

  // pixel to purse/payment
  const pixelToPursePayment = new Map();

  function setPixelsToAsset(amount, purseOrPayment) {
    // purse or payment is the key of rights
    amount = assay.coerce(amount);
    const pixelList = assay.quantity(amount);
    for (const pixel of pixelList) {
      pixelToPursePayment.set(getString(pixel), purseOrPayment);
    }
  }

  // This amount (must be nonfungible) will be forcibly taken out of
  // all purses and payments that it is currently in
  function destroy(amount) {
    // amount must only contain one pixel
    const pixelList = assay.quantity(amount);
    insist(pixelList.length === 1)`amount must only contain one pixel`;

    const pixel = pixelList[0];
    const strPixel = getString(pixel);
    insist(pixelToPursePayment.has(strPixel))`\
      pixel ${strPixel} could not be found to be destroyed`;
    const purseOrPayment = pixelToPursePayment.get(strPixel);
    // amount is guaranteed to be there
    // eslint-disable-next-line no-use-before-define
    amount = assay.coerce(amount);
    const originalAmount = rights.get(purseOrPayment);

    // esline-disable-next-line no-use-before-define
    const newAmount = assay.without(originalAmount, amount);

    // ///////////////// commit point //////////////////
    // All queries above passed with no side effects.
    // During side effects below, any early exits should be made into
    // fatal turn aborts.

    rights.set(purseOrPayment, newAmount);

    // reset the mappings from everything in the amount to the purses
    // or payments that hold them
    setPixelsToAsset(newAmount, purseOrPayment);

    // delete pixel from pixelToPursePayment
    pixelToPursePayment.delete(pixel);
  }

  function destroyAll() {
    rights = makePrivateName(); // reset rights
  }

  // creating a purse creates a new mapping from the purse to the
  // amount within the purse
  function recordNewPurse(purse, initialAmount) {
    rights.init(purse, initialAmount);
    setPixelsToAsset(initialAmount, purse);
  }

  // creating a payment creates a new mapping from the payment to the
  // amount within the payment
  // It also takes that amount from the source purseOrPayment, so
  // the source must be updated with the new (lesser) newPurseOrPaymentAmount
  function recordNewPayment(
    srcPurseOrPayment,
    payment,
    paymentAmount,
    newSrcAmount,
  ) {
    rights.init(payment, paymentAmount);
    rights.set(srcPurseOrPayment, newSrcAmount);

    setPixelsToAsset(paymentAmount, payment);
    setPixelsToAsset(newSrcAmount, srcPurseOrPayment);
  }

  // a deposit (putting a payment or part of a payment into a purse)
  // changes the amounts of both the purse and the payment
  function recordDeposit(payment, newPaymentAmount, purse, newPurseAmount) {
    rights.set(payment, newPaymentAmount);
    rights.set(purse, newPurseAmount);

    setPixelsToAsset(newPaymentAmount, payment);
    setPixelsToAsset(newPurseAmount, purse);
  }

  function getAmount(pursePayment) {
    return rights.get(pursePayment);
  }

  const mintController = {
    destroy,
    destroyAll,
    recordNewPurse,
    recordNewPayment,
    recordDeposit,
    getAmount,
  };
  return mintController;
}
