# AutoSwap

An AutoSwap is like a swap, except instead of having to find a
matching offer, an offer is always matched against the existing
liquidity pool. The AutoSwap contract checks whether your offer will
keep the constant product invariant before accepting. 

Based on UniSwap.

## Initialization

First, we initialize the `autoSwapMaker` so that we have access to the
liquidity issuer for this particular autoswap. We then pass the
liquidity issuer in as part of the issuers array. 

```js
const { liquidityIssuer, makeAutoSwap } = makeAutoSwapMaker();
const allIssuers = [moolaIssuer, simoleanIssuer, liquidityIssuer];

const { zoeInstance, governingContract: autoswap } = zoe.makeInstance(
  makeAutoSwap,
  allIssuers,
);
```

## Adding liquidity to the pool

The moola<->simolean autoswap that we just created has a number of
methods in the API available to the user:
1. addLiquidity
2. removeLiquidity
3. getPrice
4. makeOffer

We can call `addLiquidity` with an escrow receipt from Zoe that proves
that we've escrowed moola and simoleans appropriately. For instance,
let's say that Alice decides to add liquidity. She creates an offer
description with the associated payments of moola and simoleans and
escrows them:

```js
const aliceOffer = harden([
  {
    rule: 'haveExactly',
    amount: allIssuers[0].makeAmount(10),
  },
  {
    rule: 'haveExactly',
    amount: allIssuers[1].makeAmount(5),
  },
  {
    rule: 'wantAtLeast',
    amount: allIssuers[2].makeAmount(10),
  },
]);
const alicePayments = [aliceMoolaPayment, aliceSimoleanPayment, undefined];

const {
  escrowReceipt: allegedAliceEscrowReceipt,
  claimWinnings: aliceClaimWinnings,
} = await zoeInstance.escrow(aliceOffer, alicePayments);

```
She is able to ensure that she will get a minimum number of liquidity
tokens back by specifying a rule for the liquidity token slot with
`wantAtLeast`. In this case, Alice is stating that she wants at least
10 liquidity tokens back. 

## Making a swap offer

Let's say that Bob wants to actually use the moola<->simolean autoswap
to exchange 2 moola for 1 simolean. He escrows this with Zoe and
receives an escrow receipt.

```js
 const bobMoolaForSimOfferDesc = harden([
  {
    rule: 'haveExactly',
    amount: allIssuers[0].makeAmount(2),
  },
  {
    rule: 'wantAtLeast',
    amount: allIssuers[1].makeAmount(1),
  },
  {
    rule: 'wantAtLeast',
    amount: allIssuers[2].makeAmount(0),
  },
]);
const bobMoolaForSimPayments = [bobMoolaPayment, undefined, undefined];

const {
  escrowReceipt: allegedBobEscrowReceipt,
  claimWinnings: bobClaimWinnings,
} = await zoeInstance.escrow(
  bobMoolaForSimOfferDesc,
  bobMoolaForSimPayments,
);
```

Then Bob uses this escrow receipt to make an offer.

```js
const offerOk = await autoswap.makeOffer(bobEscrowReceipt);
```

Now Bob can claim his winnings:

```js
const bobClaimWinningsSeat = await bobClaimWinnings.unwrap();
const [bobMoolaWinnings, bobSimoleanWinnings, ...] = await bobClaimWinningsSeat.getWinnings();
```
