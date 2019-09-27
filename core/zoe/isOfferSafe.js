import { bothTrue } from './utils';
import { insist } from '../../util/insist';

/**
 * `isOfferSafeForPlayer` checks offer-safety for a single player.
 *
 * Note: This implementation checks whether we refund for all rules or
 * return winnings for all rules. It does not allow some refunds and
 * some winnings, which is what would happen if you checked the rules
 * independently.
 *
 * @param  {array} assaysPerIssuer - an array of assays ordered in the
 * same order as the corresponding issuers
 * @param  {array} rulesPerIssuer - an array of "rules" ordered in the
 * same order as the corresponding issuers. Rules are a player's
 * understanding of the contract that they are entering when they make
 * an offer. Rules are structured in the form `{ rule:
 * descriptionString, amount}`
 * @param  {array} amountsPerIssuer - an array of amounts ordered in
 * the same order as the corresponding issuers. This array of amounts
 * is the reallocation to be given to a player.
 */
function isOfferSafeForPlayer(
  assaysPerIssuer,
  rulesPerIssuer,
  amountsPerIssuer,
) {
  insist(
    assaysPerIssuer.length === rulesPerIssuer.length &&
      assaysPerIssuer.length === amountsPerIssuer.length,
  )`assays, rules, and amounts must be arrays of the same length`;

  const allowedRules = [
    'haveExactly',
    'haveAtMost',
    'wantExactly',
    'wantAtLeast',
  ];

  // If we are refunding the player, are their allocated amounts
  // greater than or equal to what they said they had at the beginning?
  const refundOk = rulesPerIssuer
    .map((rule, i) => {
      insist(
        allowedRules.includes(rule.rule),
      )`The rule ${rule.rule} was not recognized`;
      // If the rule was 'haveExactly', we should make sure that the
      // user gets it back exactly in a refund. If the rule is
      // 'haveAtMost' we need to ensure that the user gets back the
      // amount or greater. If the rule is something else, anything
      // we give back is fine.
      if (rule.rule === 'haveExactly') {
        return assaysPerIssuer[i].equals(amountsPerIssuer[i], rule.amount);
      }
      if (rule.rule === 'haveAtMost') {
        return assaysPerIssuer[i].includes(amountsPerIssuer[i], rule.amount);
      }
      return true;
    })
    .reduce(bothTrue);

  // If we are not refunding the player, are their allocated amounts
  // greater than or equal to what they said they wanted at the beginning?
  const winningsOk = rulesPerIssuer
    .map((rule, i) => {
      insist(
        allowedRules.includes(rule.rule),
      )`The rule ${rule.rule} was not recognized`;
      // If the rule was 'wantExactly', we should make sure that the
      // user gets exactly the amount specified in their winnings. If
      // the rule is 'wantAtLeast', we need to ensure that the user
      // gets back winnings that are equal or greater to the amount.
      // If the rule is something else, anything we give back is fine.
      if (rule.rule === 'wantExactly') {
        return assaysPerIssuer[i].equals(amountsPerIssuer[i], rule.amount);
      }
      if (rule.rule === 'wantAtLeast') {
        return assaysPerIssuer[i].includes(amountsPerIssuer[i], rule.amount);
      }
      return true;
    })
    .reduce(bothTrue);

  return refundOk || winningsOk;
}
/**
 * @param  {array} assays - An array of assays in the same order as
 * their corresponding issuers
 * @param  {matrix} offerMatrix - an array of arrays. Each of the
 * element arrays is the offer (array of rules) that a single player
 * made, in the same order as the corresponding issuers.
 * @param  {matrix} amountMatrix - an array of arrays. Each of the
 * element arrays is the array of amounts that a single player will
 * get, in the same order as the corresponding issuers.
 */
function isOfferSafeForAll(assays, offerMatrix, amountMatrix) {
  return offerMatrix
    .map((rulesForPlayer, i) => {
      const amountsPerPlayer = amountMatrix[i];
      return isOfferSafeForPlayer(assays, rulesForPlayer, amountsPerPlayer);
    })
    .reduce(bothTrue);
}

export { isOfferSafeForPlayer, isOfferSafeForAll };
