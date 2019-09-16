// used to reduce boolean arrays
const allTrue = (prev, curr) => prev && curr;
const anyTrue = (prev, curr) => prev || curr;

// https://stackoverflow.com/questions/17428587/transposing-a-2d-array-in-javascript/41772644#41772644
const transpose = matrix =>
  matrix.reduce(
    (acc, row) => row.map((_, i) => [...(acc[i] || []), row[i]]),
    [],
  );

const ruleEqual = (leftRule, rightRule) => leftRule.rule === rightRule.rule;

const amountEqual = (assay, leftRule, rightRule) =>
  assay.equals(leftRule.amount, rightRule.amount);

const offerEqual = (assays, leftOffer, rightOffer) => {
  const isLengthEqual = leftOffer.length === rightOffer.length;
  if (!isLengthEqual) {
    return false;
  }
  return leftOffer
    .map((leftRule, i) => {
      return (
        ruleEqual(leftRule, rightOffer[i]) &&
        amountEqual(assays[i], leftRule, rightOffer[i])
      );
    })
    .reduce(allTrue);
};

export { allTrue, anyTrue, transpose, offerEqual };
