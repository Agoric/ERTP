import { makePrivateName } from '../util/PrivateName';

export function makeBasicMintController() {
  // Map from purse or payment to the rights it currently
  // holds. Rights can move via payments

  // purse to amount
  let purses = makePrivateName();
  // payment to amount
  let payments = makePrivateName();

  function destroy(_amount) {
    throw new Error('destroy is not implemented');
  }

  function destroyAll() {
    purses = makePrivateName(); // reset rights
    payments = makePrivateName(); // reset rights
  }

  function updateAmount(purseOrPayment, isPurse, newAmount) {
    if (isPurse) {
      purses.set(purseOrPayment, newAmount);
    } else {
      payments.set(purseOrPayment, newAmount);
    }
  }

  function recordNewAsset(purseOrPayment, isPurse, initialAmount) {
    if (isPurse) {
      purses.init(purseOrPayment, initialAmount);
    } else {
      payments.init(purseOrPayment, initialAmount);
    }
  }

  // getAmount just returns the amount associated with the purse or payment.
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
