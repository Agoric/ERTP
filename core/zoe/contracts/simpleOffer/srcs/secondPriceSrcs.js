import harden from '@agoric/harden';

import { makeHasOkRules } from '../../../contractUtils';

const hasOkRulesInitialOffer = makeHasOkRules([
  ['haveExactly', 'wantAtLeast'], // The initial offer
]);

const hasOkRulesBids = makeHasOkRules([
  ['wantExactly', 'haveAtMost'], // Subsequent bids
]);

const isValidInitialOfferDesc = newOfferDesc =>
  hasOkRulesInitialOffer(newOfferDesc);

const isValidBid = (assays, initialOffer, newBid) =>
  hasOkRulesBids(newBid) &&
  assays[1].includes(newBid[1].amount, initialOffer[1].amount);

const isValidOffer = (
  assays,
  offerIds,
  offerIdsToOfferDescs,
  offerMadeDesc,
) => {
  const isInitialOffer = offerIds.length === 0;
  return (
    (isInitialOffer && isValidInitialOfferDesc(offerMadeDesc)) ||
    (!isInitialOffer &&
      isValidBid(assays, offerIdsToOfferDescs.get(offerIds[0]), offerMadeDesc))
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
    winner: offerIdHighestBid,
    price: secondHighestBid,
  };
};

const reallocate = (
  strategies,
  offerIds,
  offerIdsToOfferDescs,
  getQuantitiesFor,
) => {
  const bids = offerIds
    .map(offerId => offerIdsToOfferDescs.get(offerId)[1].amount.quantity)
    .slice(1);
  const { winner, price } = findWinnerAndPrice(
    strategies[1],
    offerIds.slice(1),
    bids,
  );

  const creator = offerIds[0];
  const creatorQuantities = getQuantitiesFor(harden([creator]))[0];
  const winnerQuantities = getQuantitiesFor(harden([winner]))[0];

  // The winner gets the assets put up for auction.
  // eslint-disable-next-line prefer-destructuring
  winnerQuantities[0] = creatorQuantities[0];
  creatorQuantities[0] = strategies[1].empty();

  // The person who created the auction gets the price paid.
  creatorQuantities[1] = price;

  // The winner gets to keep the difference between the their bid and
  // the price paid.
  winnerQuantities[1] = strategies[1].without(winnerQuantities[1], price);

  // Everyone else gets a refund so their quantities remain the same.
  return harden({
    reallocOfferIds: [creator, winner],
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
