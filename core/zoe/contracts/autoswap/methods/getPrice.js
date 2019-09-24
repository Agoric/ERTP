import harden from '@agoric/harden';
import { amountsToQuantitiesArray } from '../../../contractUtils';
import { calculateSwap, getTokenIndices } from '../calculateSwap';
/**
 * `getPrice` uses `calculateSwap` to calculate the current price
 * (what will be passed back) for the amount passed in.
 * @param  {array} assays - an array of assays per issuer
 * @param  {array} poolQuantities - an array of the quantities in the
 * liquidity pool
 * @param  {array} amountsIn - an array of the quantities that have
 * just been passed in by the user
 */
const makeGetPrice = (zoeInstance, poolOfferId) => amountsIn => {
  const assays = zoeInstance.getAssays();
  const poolQuantities = zoeInstance.getQuantitiesFor(harden([poolOfferId]))[0];
  const quantitiesIn = amountsToQuantitiesArray(assays, amountsIn);
  const { tokenOutIndex } = getTokenIndices(quantitiesIn);
  const { tokenOutQ } = calculateSwap(poolQuantities, quantitiesIn);
  return assays[tokenOutIndex].make(tokenOutQ);
};
harden(makeGetPrice);

export { makeGetPrice };
