import harden from '@agoric/harden';
import { amountsToQuantitiesArray, makeAmount } from '../../../contractUtils';
import { calculateSwap, getTokenIndices } from '../calculateSwap';
/**
 * `getPrice` calculates the result of a trade, given a certain amount
 * of tokens in.
 * @param  {object} zoeInstance - the zoeInstance for the governing contract.
 * @param  {object} poolOfferId  - the unique offer id object for the
 * liquidity pool.
 */
const makeGetPrice = (zoeInstance, poolOfferId) => amountsIn => {
  const poolQuantities = zoeInstance.getQuantitiesFor(harden([poolOfferId]))[0];
  const strategies = zoeInstance.getStrategies();
  const labels = zoeInstance.getLabels();
  const quantitiesIn = amountsToQuantitiesArray(strategies, amountsIn);
  const { tokenOutIndex } = getTokenIndices(quantitiesIn);
  const { tokenOutQ } = calculateSwap(poolQuantities, quantitiesIn);
  return makeAmount(
    strategies[tokenOutIndex],
    labels[tokenOutIndex],
    tokenOutQ,
  );
};
harden(makeGetPrice);

export { makeGetPrice };
