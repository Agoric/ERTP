# Second-price auction

In a second-price auction, the winner is the participant with the
highest bid, but the winner only pays the price corresponding to the
second highest bid. Second-price auctions must have sealed (i.e.
private) bids to have the right economic incentives, so this version
which is entirely public should not be used in production for real
items.

## "SimpleOffer" Second-price auction

In this particular second-price auction, we use the "SimpleOffer"
framework on top of Zoe to create the interface exposed to the user.
All of the logic particular to the second-price auction is within the
"secondPriceSrcs" passed into the SimpleOffer framework. The
secondPriceSrcs are parameterized on the number of bids that are
allowed before the auction is closed.

Alice can create an auction by doing:

```js
const { instance: aliceAuction, instanceId } = await zoe.makeInstance(
  'secondPriceAuction3Bids',
  issuers,
);
```

She can put up something at auction by escrowing it with Zoe and
calling `makeOffer` on the auction instance with her escrow receipt.

```js
const aliceOfferDesc = harden([
  {
    rule: 'offerExactly',
    amount: moolaIssuer.makeAmount(1),
  },
  {
    rule: 'wantAtLeast',
    amount: simoleanIssuer.makeAmount(3),
  },
]);
const alicePayments = [aliceMoolaPayment, undefined];
const {
  escrowReceipt: allegedAliceEscrowReceipt,
  claimPayoff: aliceClaimPayoff,
} = await zoe.escrow(aliceOfferDesc, alicePayments);

const aliceOfferResult = await aliceAuction.makeOffer(aliceEscrowReceipt);
```

Note that in this implementation, the item that will be auctioned is
described at index 0, and Alice's minimum bid amount is at index 1 in
the offer description. 

Now Alice can spread her auction `instanceId` far and wide and see if
there are any bidders. Let's say that Bob gets the instanceId and
wants to see if it is the kind of contract that he wants to join. He
can check that the libraryName installed is the auction he is expecting.

```js
const { instance: bobAuction, libraryName } = zoe.getInstance(instanceId);
t.equals(libraryName, 'secondPriceAuction3Bids');
```
He can also check that the item up for sale is the kind that he wants,
as well as checking what Alice wants in return. (In this
implementation, Alice will have to tell Bob out of band what the
minimum bid in simoleans is.)

```js
const bobIssuers = zoe.getIssuersForInstance(instanceId);
t.deepEquals(bobIssuers, issuers);
```

Bob decides to join the contract and
makes an offer:

```js
const bobOfferDesc = harden([
  {
    rule: 'wantExactly',
    amount: moolaIssuer.makeAmount(1),
  },
  {
    rule: 'offerAtMost',
    amount: simoleanIssuer.makeAmount(11),
  },
]);
const bobPayments = [undefined, bobSimoleanPayment];
const {
  escrowReceipt: allegedBobEscrowReceipt,
  claimPayoff: bobClaimPayoff,
} = await zoe.escrow(bobOfferDesc, bobPayments);

const bobOfferResult = await bobAuction.makeOffer(bobEscrowReceipt);
```

And let's say that Carol and Dave also decide to bid in the same way
as Bob, Carol bidding 7 simoleans, and Dave bidding 5 simoleans.

Bob wins, and pays the second-highest price, which is Carol's bid of 7
simoleans. Thus, when Alice claims her winnings, she gets 7 simoleans.
Bob gets the 1 moola that was up for auction as well as a refund of 4
moola (11-7), and Carol and Dave get a full refund.
