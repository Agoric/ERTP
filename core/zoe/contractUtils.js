// These utilities are likely to be helpful to developers writing
// governing contracts.

// https://stackoverflow.com/questions/17428587/transposing-a-2d-array-in-javascript/41772644#41772644
const transpose = matrix =>
  matrix.reduce(
    (acc, row) => row.map((_, i) => [...(acc[i] || []), row[i]]),
    [],
  );

/**
 * @param  {[][]} matrix - array of arrays
 * @param  {function[]} arrayFn - the array of functions to apply
 */
const mapArrayOnMatrix = (matrix, arrayFn) => {
  return matrix.map(row => row.map((x, i) => arrayFn[i](x, i)));
};

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
  return leftOffer.every(
    (leftRule, i) =>
      ruleEqual(leftRule, rightOffer[i]) &&
      issuerEqual(leftRule, rightOffer[i]) &&
      quantityEqual(strategies[i], leftRule, rightOffer[i]),
    true,
  );
};

// Transform a quantitiesMatrix to a matrix of amounts given an array
// of the associated assays.
const toAmountMatrix = (assays, quantitiesMatrix) => {
  const assayMakes = assays.map(assay => assay.make);
  return mapArrayOnMatrix(quantitiesMatrix, assayMakes);
};

// an array of empty quantities per strategy
const makeEmptyQuantities = strategies =>
  strategies.map(strategy => strategy.empty());

// validRules is the rule portion of a offer description in array
// form, such as ['offerExactly', 'wantExactly']
const makeHasOkRules = validRules => offer =>
  validRules.every((rule, i) => rule === offer[i].rule, true);

// Vector addition of two quantity arrays
const vectorWith = (strategies, leftQuantities, rightQuantities) =>
  leftQuantities.map((leftQ, i) =>
    strategies[i].with(leftQ, rightQuantities[i]),
  );

export {
  transpose,
  mapArrayOnMatrix,
  offerEqual,
  toAmountMatrix,
  makeEmptyQuantities,
  makeHasOkRules,
  vectorWith,
};
