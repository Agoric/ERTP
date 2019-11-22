import harden from '@agoric/harden';

export const defaultRejectMsg = `The offer was invalid. Please check your refund.`;
export const defaultAcceptanceMsg = `The offer has been accepted. Once the contract has been completed, please check your payout`;

const hasKinds = (kinds, newPayoutRules) =>
  kinds.every((kind, i) => kind === newPayoutRules[i].kind);

const hasAssays = (assays, newPayoutRules) =>
  assays.every((assay, i) => assay === newPayoutRules[i].units.label.assay);

export const makeHelpers = (zoe, assays) =>
  harden({
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
      const satisfied = (leftArray, rightArray) =>
        leftArray.every((leftRule, i) => {
          if (leftRule.kind === 'want') {
            return (
              rightArray[i].kind === 'offer' &&
              unitOpsArray[i].includes(rightArray[i].units, leftRule.units)
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
  });
