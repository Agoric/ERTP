import harden from '@agoric/harden';

import { makeHasOkRules, makeAPIMethod } from '../../../contractUtils';
import {
  calculateSwapMath,
  calculateSwap,
  getTokenIndices,
} from '../calculateSwap';

/**
 * To create the method `makeOffer`, we will use the `makeAPIMethod`
 * helper from `contractUtils.js`. That means we need to define a
 * function to decide whether the offer is valid, a function to handle
 * the offer, and success and failure messages.
 */

const hasOkRules = makeHasOkRules([
  ['offerExactly', 'wantAtLeast', 'wantAtLeast'],
  ['wantAtLeast', 'offerExactly', 'wantAtLeast'],
]);

// Make sure that the amount that would be returned if we performed
// the swap is greater than or equal to the 'wantAtLeast' amount
const fulfillsWantAtLeast = (poolQuantities, newOffer) => {
  const tokenInIndex = newOffer[0].rule === 'offerExactly' ? 0 : 1;
  const tokenOutIndex = 1 - tokenInIndex;

  const tokenInQ = newOffer[tokenInIndex].amount.quantity;
  const wantAtLeastQ = newOffer[tokenOutIndex].amount.quantity;

  const { tokenOutQ } = calculateSwapMath(
    poolQuantities[tokenInIndex],
    poolQuantities[tokenOutIndex],
    tokenInQ,
  );
  return tokenOutQ >= wantAtLeastQ;
};

/**
 * `quantities` is a matrix in which the first row represents the pool
 * quantities and the second row is the quantity added by the player
 */
const reallocate = quantities => {
  const poolQuantities = quantities[0];
  const playerQuantities = quantities[1];

  const { tokenInIndex, tokenOutIndex } = getTokenIndices(playerQuantities);

  const { tokenOutQ, newTokenInPoolQ, newTokenOutPoolQ } = calculateSwap(
    poolQuantities,
    playerQuantities,
  );

  const newPoolQuantities = [];
  newPoolQuantities[tokenInIndex] = newTokenInPoolQ;
  newPoolQuantities[tokenOutIndex] = newTokenOutPoolQ;
  newPoolQuantities[2] = 0;

  const newPlayerQuantities = [];
  newPlayerQuantities[tokenInIndex] = 0;
  newPlayerQuantities[tokenOutIndex] = tokenOutQ;
  newPlayerQuantities[2] = 0;

  return harden([newPoolQuantities, newPlayerQuantities]);
};

const makeHandleOfferF = (zoeInstance, poolOfferId) => id => {
  const offerIds = harden([poolOfferId, id]);
  // reallocate and eject immediately
  const oldQuantities = zoeInstance.getQuantitiesFor(offerIds);
  const newQuantities = reallocate(oldQuantities);
  return harden({
    offerIds,
    newQuantities,
  });
};

const makeIsValidOffer = (zoeInstance, poolOfferId) => newOffer => {
  const poolQuantities = zoeInstance.getQuantitiesFor(harden([poolOfferId]))[0];
  return hasOkRules(newOffer) && fulfillsWantAtLeast(poolQuantities, newOffer);
};

const makeMakeOfferMethod = (zoeInstance, poolOfferId) =>
  makeAPIMethod({
    zoeInstance,
    isValidOfferFn: makeIsValidOffer(zoeInstance, poolOfferId),
    successMessage: 'Swap successfully completed.',
    rejectMessage: 'The offer to swap was invalid.',
    handleOfferFn: makeHandleOfferF(zoeInstance, poolOfferId),
  });

harden(makeMakeOfferMethod);

export { makeMakeOfferMethod };
