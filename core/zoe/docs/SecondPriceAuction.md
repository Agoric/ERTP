# Second-price auction

In a second-price auction, the winner is the participant with the
highest bid, but the winner only pays the price corresponding to the
second highest bid. Second-price auctions must be sealed to have the
right economic incentives, so this should not be used in production
for high-value items with unsealed-bids.

## "SimpleOffer" Second-price auction

In this particular second-price auction, we use the "SimpleOffer"
framework on top of Zoe to create the interface exposed to the user.
All of the logic particular to the second-price auction is within the
"secondPriceSrcs" passed into the SimpleOffer framework. The
secondPriceSrcs are parameterized on the number of bids that are
allowed before the auction is closed.

Alice can create an auction by doing:

```js
const secondPriceSrcs = makeSecondPriceSrcs(3); // numBids = 3
const makeSecondPriceAuction = makeSimpleOfferMaker(secondPriceSrcs);
const { zoeInstance, governingContract: auction } = zoe.makeInstance(
  makeSecondPriceAuction,
  issuers,
);
```

She can put up something at auction by escrowing it with zoe and
calling `makeOffer` on the auction instance.

```js
const aliceOfferDesc = harden([
  {
    rule: 'haveExactly',
    amount: moolaIssuer.makeAmount(1),
  },
  {
    rule: 'wantAtLeast',
    amount: simoleanIssuer.makeAmount(3),
  },
]);
const alicePayments = [aliceMoolaPayment, aliceSimoleanPayment];
const {
  escrowReceipt: allegedAliceEscrowReceipt,
  claimPayoff: aliceClaimPayoff,
} = await zoeInstance.escrow(aliceOfferDesc, alicePayments);
```

Note that in this implementation, the item that will be auctioned is
described at index 0, and Alice's minimum bid amount is at index 1 in
the offer description. 

Now Alice can spread her auction instance far and wide and see if
there are any bidders. Let's say that Bob decides to bid:

```js
const bobOfferDesc = harden([
  {
    rule: 'wantExactly',
    amount: moolaIssuer.makeAmount(1),
  },
  {
    rule: 'haveAtMost',
    amount: simoleanIssuer.makeAmount(11),
  },
]);
const bobPayments = [bobMoolaPayment, bobSimoleanPayment];
const {
  escrowReceipt: allegedBobEscrowReceipt,
  claimPayoff: bobClaimPayoff,
} = await zoeInstance.escrow(bobOfferDesc, bobPayments);
```

And let's say that Carol and Dave also decide to bid in the same way
as Bob, Carol bidding 7 simoleans, and Dave bidding 5 simoleans.

Bob wins, and pays the second-highest price, which is Carol's bid of 7
simoleans. Thus, when Alice claims her winnings, she gets 7 simoleans.
Bob gets the 1 moola that was up for auction as well as a refund of 4
moola (11-7), and Carol and Dave get a full refund.
