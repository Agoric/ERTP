import harden from '@agoric/harden';

export const isMatchingLimitOrder = (zoe, assays, sellOffer, buyOffer) => {
  const unitOpsArray = zoe.getUnitOpsForAssays(assays);
  const assetEqual = unitOpsArray[0].equals(
    sellOffer[0].units,
    buyOffer[0].units,
  );
  // Buy extent must be higher than sell extent
  const buyPriceHigher = unitOpsArray[1].includes(
    buyOffer[1].units,
    sellOffer[1].units,
  );
  return assetEqual && buyPriceHigher;
};

export const reallocateSurplusToSeller = (
  zoe,
  assays,
  sellInviteHandle,
  buyInviteHandle,
) => {
  const unitOpsArray = zoe.getUnitOpsForAssays(assays);
  const inviteHandles = harden([sellInviteHandle, buyInviteHandle]);
  const [sellOfferUnits, buyOfferUnits] = zoe.getUnitMatrix(
    inviteHandles,
    assays,
  );

  // If there is a difference in what the seller will accept at
  // least and what the buyer will pay at most, we will award
  // the difference to the seller for no reason other than
  // simplicity. Note that to split the difference requires the
  // concept of dividing by two, which doesn't make sense for all
  // types of mints.
  const newSellOrderUnits = [unitOpsArray[0].empty(), buyOfferUnits[1]];
  const newBuyOrderUnits = [sellOfferUnits[0], unitOpsArray[1].empty()];

  zoe.reallocate(
    inviteHandles,
    assays,
    harden([newSellOrderUnits, newBuyOrderUnits]),
  );
  zoe.complete(inviteHandles, assays);
};
