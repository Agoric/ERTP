import { makePrivateName } from '../util/PrivateName';

export function makeBasicMintController() {
  // Map from purse or payment to the rights it currently
  // holds. Rights can move via payments

  function makeAssetController() {
    // asset to amount
    let assets = makePrivateName();
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
      destroyAll() {
        assets = makePrivateName(); // reset completely
      },
    };
  }

  function destroy(_amount) {
    throw new Error('destroy is not implemented');
  }

  const purseController = makeAssetController();
  const paymentController = makeAssetController();

  const mintController = {
    destroy,
    purseController,
    paymentController,
  };
  return mintController;
}
