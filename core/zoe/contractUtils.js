// These utilities are likely to be helpful to developers writing
// governing contracts.

import harden from '@agoric/harden';
import Nat from '@agoric/nat';

import makePromise from '../../util/makePromise';

// used to reduce boolean arrays
const bothTrue = (prev, curr) => prev && curr;
const eitherTrue = (prev, curr) => prev || curr;

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

const quantityEqual = (strategy, leftRule, rightRule) =>
  strategy.equals(leftRule.amount.quantity, rightRule.amount.quantity);

const issuerEqual = (leftRule, rightRule) =>
  leftRule.amount.label.issuer === rightRule.amount.label.issuer;

// Check that two offers are equal in both their rules and their amounts
const offerEqual = (strategies, leftOffer, rightOffer) => {
  const isLengthEqual = leftOffer.length === rightOffer.length;
  if (!isLengthEqual) {
    return false;
  }
  return leftOffer
    .map(
      (leftRule, i) =>
        ruleEqual(leftRule, rightOffer[i]) &&
        issuerEqual(leftRule, rightOffer[i]) &&
        quantityEqual(strategies[i], leftRule, rightOffer[i]),
    )
    .reduce(bothTrue);
};

const amountsToQuantitiesArray = (strategies, amountsArray) =>
  amountsArray.map((amount, i) =>
    amount !== undefined ? amount.quantity : strategies[i].empty(),
  );

// an array of empty quantities per strategy
const makeEmptyQuantities = strategies =>
  strategies.map(strategy => strategy.empty());

// validRules is an array of arrays where each row is the rules of a valid offer:
// e.g. validRules =
//     [['offerExactly', 'wantExactly'], ['wantExactly', 'offerExactly']]
const makeHasOkRules = validRules => offer =>
  validRules.map((rules, i) => rules[i] === offer[i].rule).reduce(eitherTrue);

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
 * @param  {} isValidOfferFn - a predicate that takes in an offerDesc
 * and returns whether it is a valid offer or not
 * @param  {} successMessage - the message that the promise should
 * resolve to if the offer is successful
 * @param  {} rejectMessage - the message that the promise should
 * reject with if the offer is not valid
 * @param  {} handleOfferFn - the function to do custom logic before
 * reallocating and ejecting the user. The function takes in the
 * `offerId` and should return an object with `offerIds` and
 * `newQuantities` as properties
 * @param  {} }
 */
const makeAPIMethod = ({
  zoeInstance,
  isValidOfferFn,
  successMessage,
  rejectMessage,
  handleOfferFn,
}) => async escrowReceipt => {
  const result = makePromise();
  const { id, offerMade: offerMadeDesc } = await zoeInstance.burnEscrowReceipt(
    escrowReceipt,
  );
  // fail-fast if the offerDesc isn't valid
  if (!isValidOfferFn(offerMadeDesc)) {
    zoeInstance.complete(harden([id]));
    result.rej(`${rejectMessage}`);
    return result.p;
  }
  const { offerIds, newQuantities, burnQuantities } = await handleOfferFn(id);
  if (burnQuantities !== undefined) {
    await zoeInstance.reallocateAndBurn(
      offerIds,
      newQuantities,
      burnQuantities,
    );
  } else {
    zoeInstance.reallocate(offerIds, newQuantities);
  }
  zoeInstance.complete(harden([id]));
  result.res(`${successMessage}`);
  return result.p;
};

const makeAmount = (strategy, label, allegedQuantity) => {
  strategy.insistKind(allegedQuantity);
  return harden({
    label,
    quantity: allegedQuantity,
  });
};

const makeOfferDesc = (strategies, labels, rules, quantities) =>
  strategies.map((strategy, i) =>
    harden({
      rule: rules[i],
      amount: makeAmount(strategy, labels[i], quantities[i]),
    }),
  );

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
  bothTrue,
  eitherTrue,
  transpose,
  mapArrayOnMatrix,
  mapArrayOnArray,
  amountsToQuantitiesArray,
  offerEqual,
  makeEmptyQuantities,
  makeHasOkRules,
  vectorWith,
  vectorWithout,
  makeAPIMethod,
  basicFungibleTokenOperations,
  makeAmount,
  makeOfferDesc,
};
