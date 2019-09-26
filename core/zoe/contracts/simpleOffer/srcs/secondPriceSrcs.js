import harden from '@agoric/harden';

import { makeHasOkRules } from '../../../contractUtils';

// The issuer array is ordered such that the item issuer is first
// and the price issuer is second. All of the related arrays
// (assays, strategies, etc.) also use this same ordering.
const ITEM_INDEX = 0;
const PRICE_INDEX = 1;

// We expect the first offer to be the creator of the auction
const CREATOR_OFFER_ID_INDEX = 0;

const hasOkRulesInitialOffer = makeHasOkRules([
  ['offerExactly', 'wantAtLeast'], // The initial offer
]);

const hasOkRulesBids = makeHasOkRules([
  ['wantExactly', 'offerAtMost'], // Subsequent bids
]);

const isValidInitialOfferDesc = newOfferDesc =>
  hasOkRulesInitialOffer(newOfferDesc);

const isValidBid = (strategies, initialOffer, newBid) =>
  hasOkRulesBids(newBid) &&
  strategies[PRICE_INDEX].includes(
    newBid[PRICE_INDEX].amount.quantity,
    initialOffer[PRICE_INDEX].amount.quantity,
  );

const isValidOffer = (
  strategies,
  offerIds,
  offerIdsToOfferDescs,
  offerMadeDesc,
) => {
  const isInitialOffer = offerIds.length === 0;
  return (
    (isInitialOffer && isValidInitialOfferDesc(offerMadeDesc)) ||
    (!isInitialOffer &&
      isValidBid(
        strategies,
        offerIdsToOfferDescs.get(offerIds[CREATOR_OFFER_ID_INDEX]),
        offerMadeDesc,
      ))
  );
};

// Iterate over all of the bids keeping the highest and second highest bid.
const findWinnerAndPrice = (strategy, offerIds, bids) => {
  let highestBid = strategy.empty();
  let secondHighestBid = strategy.empty();
  let offerIdHighestBid;
  // If the bid is greater than the highest bid, it is the new highest
  // bid.
  // Has side effects
  // eslint-disable-next-line array-callback-return
  offerIds.map((offerId, i) => {
    const bid = bids[i];
    if (strategy.includes(bid, highestBid)) {
      secondHighestBid = highestBid;
      highestBid = bid;
      offerIdHighestBid = offerId;
    } else if (strategy.includes(bid, secondHighestBid)) {
      // If the bid is not greater than the highest bid, but is greater
      // than the second highest bid, it is the new second highest bid.
      secondHighestBid = bid;
    }
  });
  return {
    winnerOfferId: offerIdHighestBid,
    price: secondHighestBid,
  };
};

const reallocate = (
  strategies,
  offerIds,
  _offerIdsToOfferDescs,
  getQuantitiesFor,
) => {
  // We can expect that the first offer created the auction, and
  // subsequent offers are bids.
  const creatorOfferId = offerIds[CREATOR_OFFER_ID_INDEX];
  const bidOfferIds = harden(offerIds.slice(1));

  const [creatorQuantities] = getQuantitiesFor(harden([creatorOfferId]));
  const bids = getQuantitiesFor(bidOfferIds).map(
    bidArray => bidArray[PRICE_INDEX],
  );

  const itemStrategy = strategies[ITEM_INDEX];
  const priceStrategy = strategies[PRICE_INDEX];

  const { winnerOfferId, price } = findWinnerAndPrice(
    priceStrategy,
    bidOfferIds,
    bids,
  );

  const [winnerQuantities] = getQuantitiesFor(harden([winnerOfferId]));

  // The winner gets the assets put up for auction.
  // eslint-disable-next-line prefer-destructuring
  winnerQuantities[ITEM_INDEX] = creatorQuantities[ITEM_INDEX];
  creatorQuantities[ITEM_INDEX] = itemStrategy.empty();

  // The person who created the auction gets the price paid.
  creatorQuantities[PRICE_INDEX] = price;

  // The winner gets to keep the difference between their bid and the
  // price paid.
  winnerQuantities[PRICE_INDEX] = priceStrategy.without(
    winnerQuantities[PRICE_INDEX],
    price,
  );

  // Everyone else gets a refund so their quantities remain the same.
  return harden({
    reallocOfferIds: [creatorOfferId, winnerOfferId],
    reallocQuantities: [creatorQuantities, winnerQuantities],
  });
};

const makeSecondPriceSrcs = numBids =>
  harden({
    isValidOffer,
    canReallocate: (offerIds, _offerIdsToOfferDescs) =>
      offerIds.length >= numBids + 1,
    reallocate,
  });

export { makeSecondPriceSrcs };
