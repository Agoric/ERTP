import harden from '@agoric/harden';

import {
  makeHasOkRules,
  makeAPIMethod,
  basicFungibleTokenOperations as operations,
  vectorWith,
} from '../../../contractUtils';

const { divide, mult } = operations;

const isValidOfferAddingLiquidity = makeHasOkRules([
  ['haveExactly', 'haveExactly', 'wantAtLeast'],
]);

const makeHandleOfferF = (
  zoeInstance,
  liquidityMint,
  poolOfferId,
) => async offerId => {
  const [oldPoolQuantities, playerQuantities] = zoeInstance.getQuantitiesFor(
    harden([poolOfferId, offerId]),
  );
  const strategies = zoeInstance.getStrategies();
  const liqTokenSupply = liquidityMint.getTotalSupply().quantity;

  // Calculate how many liquidity tokens we should be minting.
  // Calculations are based on the quantities represented by index 0.
  // If the current supply is zero, start off by just taking the
  // quantity at index 0 and using it as the quantity for the
  // liquidity token.
  const liquidityQOut =
    liqTokenSupply > 0
      ? divide(mult(playerQuantities[0], liqTokenSupply), oldPoolQuantities[0])
      : playerQuantities[0];

  // Calculate the new pool quantities by adding together the old
  // quantities plus the liquidity that was just added
  const newPoolQuantities = vectorWith(
    strategies,
    oldPoolQuantities,
    playerQuantities,
  );

  // Set the liquidity token quantity in the array of quantities that
  // be turned into payments sent back to the user.
  const newPlayerQuantities = zoeInstance.makeEmptyQuantities();
  newPlayerQuantities[2] = liquidityQOut;

  // Now we need to mint the liquidity tokens and make sure that the
  // `zoeInstance` knows about them. We will need to create an offer
  // that escrows the liquidity tokens, and then drop the result.
  const newPurse = liquidityMint.mint(liquidityQOut);
  const newPayment = newPurse.withdrawAll();
  const assays = zoeInstance.getAssays();

  const liquidityOfferDesc = [
    {
      rule: 'wantAtLeast',
      amount: assays[0].empty(),
    },
    {
      rule: 'wantAtLeast',
      amount: assays[1].empty(),
    },
    {
      rule: 'haveExactly',
      amount: assays[2].make(liquidityQOut),
    },
  ];

  const liquidityOfferId = await zoeInstance.escrowOffer(
    liquidityOfferDesc,
    harden([undefined, undefined, newPayment]),
  );

  // The newly created liquidityOffer is temporary and can be dropped
  zoeInstance.reallocate(
    harden([offerId, poolOfferId, liquidityOfferId]),
    harden([
      newPlayerQuantities,
      newPoolQuantities,
      zoeInstance.makeEmptyQuantities(),
    ]),
  );
  zoeInstance.eject(harden([liquidityOfferId]));

  // Reallocate, giving the liquidity tokens to the user, adding the
  // user's liquidity to the pool, and setting the liquidity offer
  // quantities to empty
  return harden({
    offerIds: harden([offerId, poolOfferId]),
    newQuantities: harden([newPlayerQuantities, newPoolQuantities]),
  });
};

const makeAddLiquidityMethod = (zoeInstance, liquidityMint, poolOfferId) =>
  makeAPIMethod({
    zoeInstance,
    isValidOfferF: isValidOfferAddingLiquidity,
    successMessage: 'Added liquidity.',
    rejectMessage: 'The offer to add liquidity was invalid.',
    handleOfferF: makeHandleOfferF(zoeInstance, liquidityMint, poolOfferId),
  });

harden(makeAddLiquidityMethod);

export { makeAddLiquidityMethod };
