import harden from '@agoric/harden';

export const defaultRejectMsg = `The offer was invalid. Please check your refund.`;
export const defaultAcceptanceMsg = `The offer has been accepted. Once the contract has been completed, please check your payout`;

const hasKinds = (kinds, newPayoutRules) =>
  kinds.every((kind, i) => kind === newPayoutRules[i].kind);

const hasAssays = (assays, newPayoutRules) =>
  assays.every((assay, i) => assay === newPayoutRules[i].units.label.assay);

export const makeHelpers = (zoe, assays) => {
  const unitOpsArray = zoe.getUnitOpsForAssays(assays);
  const helpers = harden({
    completeOffers: handles => zoe.complete(harden([...handles]), assays),
    rejectOffer: (inviteHandle, msg = defaultRejectMsg) => {
      zoe.complete(harden([inviteHandle]), assays);
      throw new Error(msg);
    },
    canTradeWith: inviteHandles => {
      const unitOpsArray = zoe.getUnitOpsForAssays(assays);
      const [leftPayoutRules, rightPayoutRules] = zoe.getPayoutRuleMatrix(
        inviteHandles,
        assays,
      );
      const satisfied = (wants, offers) =>
        wants.every((want, i) => {
          if (want.kind === 'want') {
            return (
              offers[i].kind === 'offer' &&
              unitOpsArray[i].includes(offers[i].units, want.units)
            );
          }
          return true;
        });
      return (
        satisfied(leftPayoutRules, rightPayoutRules) &&
        satisfied(rightPayoutRules, leftPayoutRules)
      );
    },
    hasValidPayoutRules: (kinds, inviteHandle) => {
      const payoutRules = zoe.getPayoutRules(inviteHandle);
      return hasKinds(kinds, payoutRules) && hasAssays(assays, payoutRules);
    },
    getActivePayoutRuleMatrix: inviteHandles => {
      const { active } = zoe.getOfferStatuses(inviteHandles);
      return harden({
        inviteHandles: active,
        payoutRuleMatrix: zoe.getPayoutRuleMatrix(active, assays),
      });
    },
    swap: (
      keepHandle,
      tryHandle,
      keepHandleInactiveMsg = 'prior offer is unavailable',
    ) => {
      if (!zoe.isOfferActive(keepHandle)) {
        throw helpers.rejectOffer(tryHandle, keepHandleInactiveMsg);
      }
      const handles = [keepHandle, tryHandle];
      if (!helpers.canTradeWith(handles)) {
        throw helpers.rejectOffer(tryHandle);
      }
      const [keepUnits, tryUnits] = zoe.getUnitMatrix(handles, assays);
      // reallocate by switching the units
      zoe.reallocate(handles, assays, harden([tryUnits, keepUnits]));
      zoe.complete(handles, assays);
      return defaultAcceptanceMsg;
    },
    // Vector addition of two units arrays
    vectorWith: (leftUnitsArray, rightUnitsArray) =>
      leftUnitsArray.map((leftUnits, i) =>
        unitOpsArray[i].with(leftUnits, rightUnitsArray[i]),
      ),

    // Vector subtraction of two extent arrays
    vectorWithout: (leftUnitsArray, rightUnitsArray) =>
      leftUnitsArray.map((leftUnits, i) =>
        unitOpsArray[i].without(leftUnits, rightUnitsArray[i]),
      ),
    makeEmptyUnits: unitOpsArray.map(unitOps => unitOps.empty()),
  });
  return helpers;
};
