import harden from '@agoric/harden';

import { basicFungibleTokenOperations as operations } from '../../contractUtils';

const { divide, multiply, add, subtract } = operations;

/**
 * `calculateSwapMath` contains the logic for calculating how many tokens
 * should be given back to the user in exchange for what they sent in.
 * It also calculates the fee as well as the new quantities of the
 * assets in the pool. `calculateSwapMath` is reused in several different
 * places, including to check whether an offer is valid, getting the
 * current price for an asset on user request, and to do the actual
 * reallocation after an offer has been made. The `Q` in variable
 * names stands for quantity. The names Token A and Token B are
 * internal names to make this function more understandable.
 * @param  {number} tokenAPoolQ - the quantity in the liquidity pool
 * of the kind of token (A) that was sent in.
 * @param  {number} tokenBPoolQ - the quantity in the liquidity pool
 * of the other kind of token (B, the kind that will be sent out).
 * @param  {number} tokenAQ - the quantity that was sent in to be
 * exchanged (A)
 * @param  {number} feeInTenthOfPercent=3 - the fee taken in tenths of
 * a percent. The default is 0.3%. The fee is taken in terms of token
 * A, which is the kind that was sent in.
 */
const calculateSwapMath = (
  tokenAPoolQ,
  tokenBPoolQ,
  tokenAQ,
  feeInTenthOfPercent = 3,
) => {
  const feeTokenAQ = multiply(divide(tokenAQ, 1000), feeInTenthOfPercent);
  const invariant = multiply(tokenAPoolQ, tokenBPoolQ);
  const newTokenAPoolQ = add(tokenAPoolQ, tokenAQ);
  const newTokenBPoolQ = divide(
    invariant,
    subtract(newTokenAPoolQ, feeTokenAQ),
  );
  const tokenBQ = subtract(tokenBPoolQ, newTokenBPoolQ);

  // Note: We add the fee to the pool quantity, but could do something
  // different.
  return {
    tokenOutQ: tokenBQ,
    // Since the fee is already added to the pool, this property
    // should only be used to report on fees and test.
    feeQ: feeTokenAQ,
    newTokenInPoolQ: add(newTokenAPoolQ, feeTokenAQ),
    newTokenOutPoolQ: newTokenBPoolQ,
  };
};

const getTokenIndices = playerQuantities => {
  const index0Positive = playerQuantities[0] > 0;
  const index1Positive = playerQuantities[1] > 0;

  if (index0Positive && index1Positive) {
    throw new Error('Both index 0 and index 1 have quantities greater than 0');
  }

  if (!index0Positive && !index1Positive) {
    throw new Error(
      'Neither index 0 and index 1 have quantities greater than 0',
    );
  }

  const tokenInIndex = index0Positive ? 0 : 1;
  const tokenOutIndex = 1 - tokenInIndex;

  return harden({
    tokenInIndex,
    tokenOutIndex,
  });
};

/**
 * `calculateSwap` is a wrapper for `calculateSwapMath` that turns
 * `poolQuantities` and `playerQuantities` into the correct parameters for
 * `calculateSwapMath`
 * @param  {array} poolQuantities - the array of quantities per issuer
 * for the liquidity pool
 * @param  {array} playerQuantities - the array of quantities per
 * issuer that the user has escrowed with Zoe and made an offer with
 */
const calculateSwap = (poolQuantities, playerQuantities) => {
  const { tokenInIndex, tokenOutIndex } = getTokenIndices(playerQuantities);

  const tokenInQ = playerQuantities[tokenInIndex];
  return calculateSwapMath(
    poolQuantities[tokenInIndex],
    poolQuantities[tokenOutIndex],
    tokenInQ,
  );
};

export { calculateSwapMath, calculateSwap, getTokenIndices };
