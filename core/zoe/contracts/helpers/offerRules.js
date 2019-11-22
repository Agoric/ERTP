import harden from '@agoric/harden';

/**
 * A helper to make offerRules without having to write out the rules
 * manually, and without using an assay (which we don't want to use
 * because it may be remote).
 * @param  {array} kinds - an array of payoutRule kinds, in the order
 * of the intended payoutRules
 * @param  {array} units - an array of units, in the order of the
 * intended payoutRules
 * @param  {object} exitRule - an exitRule
 */
export const makeOfferRules = (kinds, units, exitRule) => {
  const payoutRules = kinds.map((kind, i) =>
    harden({
      kind,
      units: units[i],
    }),
  );
  return harden({
    payoutRules,
    exitRule,
  });
};
