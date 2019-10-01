import { bothTrue, transpose } from './utils';

/**
 * The columns in a `quantities` matrix are per issuer, and the rows
 * are per player. We want to transpose the matrix such that each
 * row is per issuer so we can do 'with' on the array to get a total
 * per issuer and make sure the rights are conserved.
 * @param  {strategy[]} strategies - an array of strategies per issuer
 * @param  {quantity[]} quantities - an array of arrays with a row per
 * player indexed by issuer
 */
const sumByIssuer = (strategies, quantities) =>
  transpose(quantities).map((quantitiesPerIssuer, i) => {
    return quantitiesPerIssuer.reduce(strategies[i].with);
  });

/**
 * Does the left array of summed quantities equal the right array of
 * summed quantities?
 * @param  {strategy[]} strategies - an array of strategies per issuer
 * @param  {quantity[]} leftQuantities - an array of total quantities per issuer
 * @param  {quantity[]} rightQuantities - an array of total quantities per issuer
 * indexed by issuer
 */
const isEqualPerIssuer = (strategies, leftQuantities, rightQuantities) =>
  leftQuantities
    .map((leftQ, i) => strategies[i].equals(leftQ, rightQuantities[i]))
    .reduce(bothTrue, true);

/**
 * `areRightsConserved` checks that the total quantity per issuer stays
 * the same regardless of the reallocation.
 * @param  {strategy[]} strategies - an array of strategies per issuer
 * @param  {quantity[][]} previousQuantities - array of arrays where a row
 * is the array of quantities for a particular player, per
 * issuer
 * @param  {quantity[][]} newQuantities - array of arrays where a row
 * is the array of reallocated quantities for a particular player, per
 * issuer
 */
function areRightsConserved(strategies, prevQuantities, newQuantities) {
  const sumsPrevQuantities = sumByIssuer(strategies, prevQuantities);
  const sumsNewQuantities = sumByIssuer(strategies, newQuantities);
  return isEqualPerIssuer(strategies, sumsPrevQuantities, sumsNewQuantities);
}

export { areRightsConserved };
