import harden from '@agoric/harden';

import { rejectOffer, defaultAcceptanceMsg } from './helpers/userFlow';
import {
  isExactlyMatchingPayoutRules,
  hasValidPayoutRules,
} from './helpers/offerRules';

export const makeContract = harden((zoe, terms) => {
  const firstOfferInviteHandle = harden({});
  const matchingOfferInviteHandle = harden({});
  let firstOfferPayoutRules;

  const matchingOfferSeat = harden({
    matchOffer: () => {
      const { inactive } = zoe.getOfferStatuses(
        harden([firstOfferInviteHandle]),
      );
      if (inactive.length > 0) {
        return rejectOffer(
          zoe,
          terms.assays,
          matchingOfferInviteHandle,
          `The first offer was withdrawn or completed.`,
        );
      }

      const [payoutRules] = zoe.getPayoutRuleMatrix(
        harden([matchingOfferInviteHandle]),
        terms.assays,
      );

      if (
        !isExactlyMatchingPayoutRules(
          zoe,
          terms.assays,
          firstOfferPayoutRules,
          payoutRules,
        )
      ) {
        return rejectOffer(zoe, terms.assays, matchingOfferInviteHandle);
      }
      const [firstOfferUnits, matchingOfferUnits] = zoe.getUnitMatrix(
        harden([firstOfferInviteHandle, matchingOfferInviteHandle]),
        terms.assays,
      );
      // reallocate by switching the extents of the firstOffer and matchingOffer
      zoe.reallocate(
        harden([firstOfferInviteHandle, matchingOfferInviteHandle]),
        terms.assays,
        harden([matchingOfferUnits, firstOfferUnits]),
      );
      zoe.complete(
        harden([firstOfferInviteHandle, matchingOfferInviteHandle]),
        terms.assays,
      );
      return defaultAcceptanceMsg;
    },
  });

  const firstOfferSeat = harden({
    makeFirstOffer: () => {
      const ruleKinds = ['offer', 'want'];
      const [payoutRules] = zoe.getPayoutRuleMatrix(
        harden([firstOfferInviteHandle]),
        terms.assays,
      );
      if (!hasValidPayoutRules(ruleKinds, terms.assays, payoutRules)) {
        return rejectOffer(zoe, firstOfferInviteHandle);
      }

      // The offer is valid, so save information about the first offer
      firstOfferPayoutRules = payoutRules;
      return zoe.makeInvite(matchingOfferSeat, matchingOfferInviteHandle, {
        firstOfferPayoutRules,
      });
    },
  });

  return harden({
    initialSeat: firstOfferSeat,
    initialInviteHandle: firstOfferInviteHandle,
    assays: terms.assays,
  });
});
