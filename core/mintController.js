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

  function updateAmount(asset, isPurse, newAmount) {
    if (isPurse) {
      purses.set(asset, newAmount);
    } else {
      payments.set(asset, newAmount);
    }
  }

  function recordNewAsset(asset, isPurse, initialAmount) {
    if (isPurse) {
      purses.init(asset, initialAmount);
    } else {
      payments.init(asset, initialAmount);
    }
  }

  // getAmount just returns the amount associated with the purse or payment.
  function getAmount(asset, isPurse) {
    if (isPurse) {
      return purses.get(asset);
    }
    return payments.get(asset);
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
