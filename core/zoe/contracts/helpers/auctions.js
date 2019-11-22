import harden from '@agoric/harden';

export const secondPriceLogic = (bidExtentOps, bidOfferHandles, bids) => {
  let highestBid = bidExtentOps.empty();
  let secondHighestBid = bidExtentOps.empty();
  let highestBidOfferHandle;
  // eslint-disable-next-line array-callback-return
  bidOfferHandles.map((offerHandle, i) => {
    const bid = bids[i];
    // If the bid is greater than the highestBid, it's the new highestBid
    if (bidExtentOps.includes(bid, highestBid)) {
      secondHighestBid = highestBid;
      highestBid = bid;
      highestBidOfferHandle = offerHandle;
    } else if (bidExtentOps.includes(bid, secondHighestBid)) {
      // If the bid is not greater than the highest bid, but is greater
      // than the second highest bid, it is the new second highest bid.
      secondHighestBid = bid;
    }
  });
  return harden({
    winnerOfferHandle: highestBidOfferHandle,
    winnerBid: highestBid,
    price: secondHighestBid,
  });
};

export const firstPriceLogic = (bidExtentOps, bidOfferHandles, bids) => {
  let highestBid = bidExtentOps.empty();
  let highestBidOfferHandle;
  // eslint-disable-next-line array-callback-return
  bidOfferHandles.map((offerHandle, i) => {
    const bid = bids[i];
    // If the bid is greater than the highestBid, it's the new highestBid
    if (bidExtentOps.includes(bid, highestBid)) {
      highestBid = bid;
      highestBidOfferHandle = offerHandle;
    }
  });
  return harden({
    winnerOfferHandle: highestBidOfferHandle,
    winnerBid: highestBid,
    price: highestBid,
  });
};

export const isOverMinimumBid = (
  zoe,
  assays,
  BID_INDEX,
  creatorOfferHandle,
  bidOfferHandle,
) => {
  const [creatorUnits, bidUnits] = zoe.getUnitMatrix(
    harden([creatorOfferHandle, bidOfferHandle]),
    assays,
  );
  const bidUnitOps = zoe.getUnitOpsForAssays(assays)[BID_INDEX];
  const minimumBid = creatorUnits[BID_INDEX];
  const bidMade = bidUnits[BID_INDEX];
  return bidUnitOps.includes(bidMade, minimumBid);
};

export const closeAuction = (
  zoe,
  assays,
  { auctionLogicFn, itemIndex, bidIndex, sellerInviteHandle, allBidHandles },
) => {
  const unitOpsArray = zoe.getUnitOpsForAssays(assays);
  const bidUnitOps = unitOpsArray[bidIndex];
  const itemUnitOps = unitOpsArray[itemIndex];

  // Filter out any inactive bids
  const { active: activeBidHandles } = zoe.getOfferStatuses(
    harden(allBidHandles),
  );

  const bids = zoe
    .getUnitMatrix(activeBidHandles, assays)
    .map(units => units[bidIndex]);
  const itemUnitsUpForAuction = zoe.getUnitMatrix(
    harden([sellerInviteHandle]),
    assays,
  )[0][itemIndex];

  const {
    winnerOfferHandle: winnerInviteHandle,
    winnerBid,
    price,
  } = auctionLogicFn(bidUnitOps, activeBidHandles, bids);

  // The winner gets to keep the difference between their bid and the
  // price paid.
  const winnerRefund = bidUnitOps.without(winnerBid, price);

  const newCreatorUnits = [itemUnitOps.empty(), price];
  const newWinnerUnits = [itemUnitsUpForAuction, winnerRefund];

  // Everyone else gets a refund so their extents remain the
  // same.
  zoe.reallocate(
    harden([sellerInviteHandle, winnerInviteHandle]),
    assays,
    harden([newCreatorUnits, newWinnerUnits]),
  );
  const allOfferHandles = harden([sellerInviteHandle, ...activeBidHandles]);
  zoe.complete(allOfferHandles, assays);
};
