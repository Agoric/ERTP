import harden from '@agoric/harden';

import {
  makeHasOkRules,
  makeAPIMethod,
  basicFungibleTokenOperations as operations,
  vectorWithout,
} from '../../../contractUtils';

const { mult, divide } = operations;

const makeHandleOffer = (
  zoeInstance,
  liquidityMint,
  poolOfferId,
) => offerId => {
  const offerIds = harden([poolOfferId, offerId]);
  const [poolQuantities, playerQuantities] = zoeInstance.getQuantitiesFor(
    offerIds,
  );
  const liquidityTokenIn = playerQuantities[2];
  const liqTokenSupply = liquidityMint.getTotalSupply().quantity;

  const newPlayerQuantities = poolQuantities.map(poolQ =>
    divide(mult(liquidityTokenIn, poolQ), liqTokenSupply),
  );

  const newPoolQuantities = vectorWithout(
    zoeInstance.getStrategies(),
    poolQuantities,
    newPlayerQuantities,
  );

  const burnQuantities = zoeInstance.makeEmptyQuantities();
  burnQuantities[2] = liquidityTokenIn;

  return harden({
    offerIds,
    newQuantities: [newPoolQuantities, newPlayerQuantities],
    burnQuantities,
  });
};

const isValidOfferRemoveLiquidity = makeHasOkRules([
  ['wantAtLeast', 'wantAtLeast', 'offerExactly'],
]);

const makeRemoveLiquidityMethod = (zoeInstance, liquidityMint, poolOfferId) =>
  makeAPIMethod({
    zoeInstance,
    isValidOfferFn: isValidOfferRemoveLiquidity,
    successMessage: 'Liquidity successfully removed.',
    rejectMessage: 'The offer to remove liquidity was invalid',
    handleOfferFn: makeHandleOffer(zoeInstance, liquidityMint, poolOfferId),
  });

harden(makeRemoveLiquidityMethod);

export { makeRemoveLiquidityMethod };
