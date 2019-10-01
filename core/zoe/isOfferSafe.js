import { bothTrue } from './utils';
import { insist } from '../../util/insist';

/**
 * `isOfferSafeForPlayer` checks offer-safety for a single player.
 *
 * Note: This implementation checks whether we refund for all rules or
 * return winnings for all rules. It does not allow some refunds and
 * some winnings, which is what would happen if you checked the rules
 * independently. It *does* allow for returning a full refund plus
 * full winnings.
 *
 * @param  {strategy[]} strategies - an array of strategies ordered in
 * the same order as the corresponding issuers
 * @param  {offerDescElem[]} offerDesc - the offer description, an
 * array of objects that have a rule and amount, in the same order as
 * the corresponding issuers. The offer description is a player's
 * understanding of the contract that they are entering when they make
 * an offer. OfferDescElements are structured in the form `{ rule:
 * descriptionString, amount}`
 * @param  {quantity[]} quantities - an array of quantities ordered in
 * the same order as the corresponding issuers. This array of quantities
 * is the reallocation to be given to a player.
 */
function isOfferSafeForPlayer(strategies, offerDesc, quantities) {
  insist(
    strategies.length === offerDesc.length &&
      strategies.length === quantities.length,
  )`strategies, the offer description, and quantities must be arrays of the same length`;

  const allowedRules = [
    'offerExactly',
    'offerAtMost',
    'wantExactly',
    'wantAtLeast',
  ];

  // If we are refunding the player, are their allocated amounts
  // greater than or equal to what they said they had at the beginning?
  const refundOk = offerDesc
    .map((offerDescElem, i) => {
      if (offerDescElem === null || offerDescElem === undefined) {
        return true;
      }
      insist(
        allowedRules.includes(offerDescElem.rule),
      )`The rule ${offerDescElem.rule} was not recognized`;
      // If the rule was 'offerExactly', we should make sure that the
      // user gets it back exactly in a refund. If the rule is
      // 'offerAtMost' we need to ensure that the user gets back the
      // amount or greater. If the rule is something else, anything
      // we give back is fine.
      if (offerDescElem.rule === 'offerExactly') {
        return strategies[i].equals(
          quantities[i],
          offerDescElem.amount.quantity,
        );
      }
      if (offerDesc.rule === 'offerAtMost') {
        return strategies[i].includes(
          quantities[i],
          offerDescElem.amount.quantity,
        );
      }
      return true;
    })
    .reduce(bothTrue, true);

  // If we are not refunding the player, are their allocated amounts
  // greater than or equal to what they said they wanted at the beginning?
  const winningsOk = offerDesc
    .map((offerDescElem, i) => {
      if (offerDescElem === null || offerDescElem === undefined) {
        return true;
      }
      insist(
        allowedRules.includes(offerDescElem.rule),
      )`The rule ${offerDescElem.rule} was not recognized`;
      // If the rule was 'wantExactly', we should make sure that the
      // user gets exactly the amount specified in their winnings. If
      // the rule is 'wantAtLeast', we need to ensure that the user
      // gets back winnings that are equal or greater to the amount.
      // If the rule is something else, anything we give back is fine.
      if (offerDescElem.rule === 'wantExactly') {
        return strategies[i].equals(
          quantities[i],
          offerDescElem.amount.quantity,
        );
      }
      if (offerDescElem.rule === 'wantAtLeast') {
        return strategies[i].includes(
          quantities[i],
          offerDescElem.amount.quantity,
        );
      }
      return true;
    })
    .reduce(bothTrue, true);

  return refundOk || winningsOk;
}
/**
 * @param  {strategy[]} strategies - an array of strategies ordered in
 * the same order as the corresponding issuers
 * @param  {offerDesc[][]} offerDescMatrix - an array of arrays. Each of the
 * element arrays is the offer description that a single player
 * made, in the same order as the corresponding issuers.
 * @param  {quantity[][]} quantityMatrix - an array of arrays. Each of the
 * element arrays is the array of quantities that a single player will
 * get, in the same order as the corresponding issuers.
 */
const isOfferSafeForAll = (strategies, offerDescMatrix, quantitiesMatrix) =>
  offerDescMatrix
    .map((offerDesc, i) =>
      isOfferSafeForPlayer(strategies, offerDesc, quantitiesMatrix[i]),
    )
    .reduce(bothTrue, true);

export { isOfferSafeForPlayer, isOfferSafeForAll };
