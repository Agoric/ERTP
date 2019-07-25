import { makePrivateName } from '../util/PrivateName';

export function makeBasicMintController() {
  // Map from purse or payment to the rights it currently
  // holds. Rights can move via payments

  // purse/payment to amount
  let rights = makePrivateName();

  function destroy(_amount) {
    throw new Error('destroy is not implemented');
  }

  function destroyAll() {
    rights = makePrivateName(); // reset rights
  }

  // creating a purse creates a new mapping from the purse to the
  // amount within the purse
  function recordNewPurse(purse, initialAmount) {
    rights.init(purse, initialAmount);
  }

  // creating a payment creates a new mapping from the payment to the
  // amount within the payment
  // It also takes that amount from the source purseOrPayment, so the
  // source must be updated with the new (lesser) newSrcAmount
  function recordNewPayment(
    srcPurseOrPayment,
    payment,
    paymentAmount,
    newSrcAmount,
  ) {
    rights.init(payment, paymentAmount);
    rights.set(srcPurseOrPayment, newSrcAmount);
  }

  // a deposit (putting a payment or part of a payment into a purse)
  // changes the amounts of both the purse and the payment
  function recordDeposit(payment, newPaymentAmount, purse, newPurseAmount) {
    rights.set(payment, newPaymentAmount);
    rights.set(purse, newPurseAmount);
  }

  // getAmount just returns the amount associated with the purse or payment
  function getAmount(purseOrPayment) {
    return rights.get(purseOrPayment);
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
