import harden from '@agoric/harden';

import { makeMint } from '../../../issuers';
import { makeGetPrice } from './methods/getPrice';
import { makeMakeOfferMethod } from './methods/makeOffer';
import { makeAddLiquidityMethod } from './methods/addLiquidity';
import { makeRemoveLiquidityMethod } from './methods/removeLiquidity';

const makeAutoSwapMaker = () => {
  // Liquidity tokens are a basic fungible token. We need to be able
  // to instantiate a new zoeInstance with 3 starting issuers: two for
  // the underlying rights to be swapped, and this liquidityIssuer. So
  // we will make the liquidityIssuer now and return it to the user
  // along with the `makeAutoSwap` function.
  const liquidityMint = makeMint('liquidity');
  const liquidityIssuer = liquidityMint.getIssuer();

  const makeAutoSwap = zoeInstance => {
    // Create an empty offer to represent the quantities of the
    // liquidity pool.
    const poolOfferId = zoeInstance.escrowEmptyOffer();
    const getPoolQuantities = () =>
      zoeInstance.getQuantitiesFor(harden([poolOfferId]))[0];

    // The API exposed to the user
    const autoSwap = harden({
      addLiquidity: makeAddLiquidityMethod(
        zoeInstance,
        liquidityMint,
        poolOfferId,
      ),
      removeLiquidity: makeRemoveLiquidityMethod(
        zoeInstance,
        liquidityMint,
        poolOfferId,
      ),
      makeOffer: makeMakeOfferMethod(zoeInstance, poolOfferId),
      getPrice: makeGetPrice(zoeInstance, poolOfferId),
      getLiquidityIssuer: () => liquidityIssuer,
      getIssuers: zoeInstance.getIssuers,
      getPoolQuantities,
    });
    return autoSwap;
  };

  return harden({
    makeAutoSwap,
    liquidityIssuer,
  });
};
export { makeAutoSwapMaker };
