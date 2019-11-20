import harden from '@agoric/harden';
import { sameStructure } from '../../../../util/sameStructure';

export const isExactlyMatchingPayoutRules = (
  zoe,
  assays,
  leftPayoutRules,
  rightPayoutRules,
) => {
  // "exactly matching" means that units are the same, but that the
  // kinds have switched places in the array
  const unitOpsArray = zoe.getUnitOpsForAssays(assays);
  return (
    // Are the units equal according to the unitOps?
    unitOpsArray[0].equals(
      leftPayoutRules[0].units,
      rightPayoutRules[0].units,
    ) &&
    unitOpsArray[1].equals(
      leftPayoutRules[1].units,
      rightPayoutRules[1].units,
    ) &&
    // Are the labels (allegedName + assay) the same?
    sameStructure(
      leftPayoutRules[0].units.label,
      rightPayoutRules[0].units.label,
    ) &&
    sameStructure(
      leftPayoutRules[1].units.label,
      rightPayoutRules[1].units.label,
    ) &&
    // Have the rule kinds switched as we expect?
    leftPayoutRules[0].kind === rightPayoutRules[1].kind &&
    leftPayoutRules[1].kind === rightPayoutRules[0].kind
  );
};

// We can make exactly matching payout rules by switching the kind
export const makeExactlyMatchingPayoutRules = firstPayoutRules =>
  harden([
    {
      kind: firstPayoutRules[1].kind,
      units: firstPayoutRules[0].units,
    },
    {
      kind: firstPayoutRules[0].kind,
      units: firstPayoutRules[1].units,
    },
  ]);

const hasKinds = (kinds, newPayoutRules) =>
  kinds.every((kind, i) => kind === newPayoutRules[i].kind);

const hasAssays = (assays, newPayoutRules) =>
  assays.every((assay, i) => assay === newPayoutRules[i].units.label.assay);

export const hasValidPayoutRules = (kinds, assays, newPayoutRules) =>
  hasKinds(kinds, newPayoutRules) && hasAssays(assays, newPayoutRules);

export const getActivePayoutRuleMatrix = (zoe, inviteHandles, assays) => {
  const { active } = zoe.getOfferStatuses(inviteHandles);
  return harden({
    inviteHandles: active,
    payoutRuleMatrix: zoe.getPayoutRuleMatrix(active, assays),
  });
};

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
