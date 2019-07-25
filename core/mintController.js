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

  function updateAmount(purseOrPayment, newAmount) {
    rights.set(purseOrPayment, newAmount);
  }

  function recordNewAsset(purseOrPayment, initialAmount) {
    rights.init(purseOrPayment, initialAmount);
  }

  // getAmount just returns the amount associated with the purse or payment.
  function getAmount(purseOrPayment) {
    return rights.get(purseOrPayment);
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
