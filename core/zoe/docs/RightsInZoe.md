## Rights in Zoe and Governing Contracts

In addition to the underlying rights that are escrowed in a contract,
Zoe introduces two new rights:
1. An `escrowReceipt` ERTP payment that proves to a governing contract that an offer
   has successfully escrowed
2. A `claimPayoff` ERTP payment that can be unwrapped to get a use
   object that has a `getPayoff` method which returns an array
   representing the winnings and/or the refund.


The quantity of both an `escrowReceipt` and a `claimPayoff` ERTP
payment has the following format, showing that an offer has been made
and escrowed:

```js
{
  id: {},
  offerMade: [rule1, rule2, rule3, ...],
}
```

Various governing contracts may also want to create further rights,
such as the right to enter a particular contract instance (an invite).

An invite quantity has the following format:

```js
{
  id: {},
  offerToBeMade: [rule1, rule2, rule3, ...],
}
```

Both of these can use the `makeSeatMint` utility.

If we have more examples of rights, we may want to expand the
customization possible in the `seatMint` maker.
