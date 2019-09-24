// These utilities are likely to be helpful to developers writing
// governing contracts.

import harden from '@agoric/harden';
import Nat from '@agoric/nat';

import makePromise from '../../util/makePromise';

// used to reduce boolean arrays
const allTrue = (prev, curr) => prev && curr;
const anyTrue = (prev, curr) => prev || curr;

// https://stackoverflow.com/questions/17428587/transposing-a-2d-array-in-javascript/41772644#41772644
const transpose = matrix =>
  matrix.reduce(
    (acc, row) => row.map((_, i) => [...(acc[i] || []), row[i]]),
    [],
  );

/**
 * @param  {matrix} matrix - array of arrays
 * @param  {function} arrayF - the array of functions to apply
 */
const mapArrayOnMatrix = (matrix, arrayF) =>
  matrix.map(row => row.map((x, i) => arrayF[i](x, i)));

/**
 * @param  {array} array - array to be acted upon
 * @param  {array} arrayF - the array of functions to apply
 */
const mapArrayOnArray = (array, arrayF) => array.map((x, i) => arrayF[i](x));

const ruleEqual = (leftRule, rightRule) => leftRule.rule === rightRule.rule;

const amountEqual = (assay, leftRule, rightRule) =>
  assay.equals(leftRule.amount, rightRule.amount);

// Check that two offers are equal in both their rules and their amounts
const offerEqual = (assays, leftOffer, rightOffer) => {
  const isLengthEqual = leftOffer.length === rightOffer.length;
  if (!isLengthEqual) {
    return false;
  }
  return leftOffer
    .map(
      (leftRule, i) =>
        ruleEqual(leftRule, rightOffer[i]) &&
        amountEqual(assays[i], leftRule, rightOffer[i]),
    )
    .reduce(allTrue);
};

// Transform a quantitiesMatrix to a matrix of amounts given an array
// of the associated assays.
const toAmountMatrix = (assays, quantitiesMatrix) => {
  const assayMakes = assays.map(assay => assay.make);
  return mapArrayOnMatrix(quantitiesMatrix, assayMakes);
};

const amountsToQuantitiesArray = (assays, amountsArray) =>
  assays.map((assay, i) => {
    if (amountsArray[i] !== undefined) {
      return assay.quantity(amountsArray[i]);
    }
    return assay.quantity(assay.empty());
  });

// an array of empty quantities per strategy
const makeEmptyQuantities = strategies =>
  strategies.map(strategy => strategy.empty());

// validRules is an array of arrays where each row is the rules of a valid offer:
// e.g. validRules =
//     [['haveExactly', 'wantExactly'], ['wantExactly', 'haveExactly']]
const makeHasOkRules = validRules => offer =>
  validRules.map((rules, i) => rules[i] === offer[i].rule).reduce(anyTrue);

// Vector addition of two quantity arrays
const vectorWith = (strategies, leftQuantities, rightQuantities) =>
  leftQuantities.map((leftQ, i) =>
    strategies[i].with(leftQ, rightQuantities[i]),
  );

// Vector subtraction of two quantity arrays
const vectorWithout = (strategies, leftQuantities, rightQuantities) =>
  leftQuantities.map((leftQ, i) =>
    strategies[i].without(leftQ, rightQuantities[i]),
  );

/**
 * `makeAPIMethod` allows contract developers to follow a very common
 * pattern without having to copy and paste.
 * 1) Take an `escrowReceipt` as input.
 * 2) Validate it
 * 3) Check that the offer gotten from the `escrowReceipt` is valid
 *    for this particular contract
 * 4) Fail-fast if the offer isn't valid
 * 5) Handle the valid offer
 * 6) Reallocate and eject the player.
 * @param  {} {zoeInstance - a zoeInstance
 * @param  {} isValidOfferF - a predicate that takes in an offerDesc
 * and returns whether it is a valid offer or not
 * @param  {} successMessage - the message that the promise should
 * resolve to if the offer is successful
 * @param  {} rejectMessage - the message that the promise should
 * reject with if the offer is not valid
 * @param  {} handleOfferF - the function to do custom logic before
 * reallocating and ejecting the user. The function takes in the
 * `offerId` and should return an object with `offerIds` and
 * `newQuantities` as properties
 * @param  {} }
 */
const makeAPIMethod = ({
  zoeInstance,
  isValidOfferF,
  successMessage,
  rejectMessage,
  handleOfferF,
}) => async escrowReceipt => {
  const result = makePromise();
  const { id, offerMade: offerMadeDesc } = await zoeInstance.burnEscrowReceipt(
    escrowReceipt,
  );
  // fail-fast if the offerDesc isn't valid
  if (!isValidOfferF(offerMadeDesc)) {
    zoeInstance.eject(harden([id]));
    result.rej(`${rejectMessage}`);
    return result.p;
  }
  const { offerIds, newQuantities, burnQuantities } = await handleOfferF(id);
  if (burnQuantities !== undefined) {
    await zoeInstance.reallocateAndBurn(
      offerIds,
      newQuantities,
      burnQuantities,
    );
  } else {
    zoeInstance.reallocate(offerIds, newQuantities);
  }
  zoeInstance.eject(harden([id]));
  result.res(`${successMessage}`);
  return result.p;
};

/**
 * These operations should be used for calculations with the
 * quantities of basic fungible tokens.
 */
const basicFungibleTokenOperations = harden({
  add: (x, y) => Nat(x + y),
  subtract: (x, y) => Nat(x - y),
  mult: (x, y) => Nat(x * y),
  divide: (x, y) => Nat(Math.floor(x / y)),
});

export {
  allTrue,
  anyTrue,
  transpose,
  mapArrayOnMatrix,
  mapArrayOnArray,
  amountsToQuantitiesArray,
  offerEqual,
  toAmountMatrix,
  makeEmptyQuantities,
  makeHasOkRules,
  vectorWith,
  vectorWithout,
  makeAPIMethod,
  basicFungibleTokenOperations,
};
