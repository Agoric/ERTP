import harden from '@agoric/harden';

// In a covered call, the owner of a digital asset sells a call
// option. A call option is the right to buy the digital asset at a
// certain price, called the strike price. The call option has an expiry
// date, at which point the contract is cancelled.

// In this contract, the expiry date is represented by the deadline at
// which the owner of the digital asset's offer is cancelled.
// Therefore, the owner of the digital asset's offer exitRules must be
// of the kind "atDeadline".

// The invite that the creator of the covered call receives is the
// call option and has the following additional information in the
// extent of the invite:
// { expirationDate, timerAuthority, underlyingAsset, strikePrice }

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
          `The covered call option is expired.`,
        );
      }

      const payoutRules = zoe.getPayoutRules(firstOfferInviteHandle);

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
    makeCoveredCall: () => {
      const ruleKinds = ['offer', 'want'];
      const payoutRules = zoe.getPayoutRules(firstOfferInviteHandle);
      const exitRule = zoe.getExitRule(firstOfferInviteHandle);
      if (
        !hasValidPayoutRules(ruleKinds, terms.assays, payoutRules) ||
        exitRule.kind !== 'atDeadline'
      ) {
        return rejectOffer(zoe, terms.assays, firstOfferInviteHandle);
      }

      // The offer is valid, so save information about the first offer
      firstOfferPayoutRules = payoutRules;

      const customInviteExtent = {
        expirationDate: exitRule.deadline,
        timerAuthority: exitRule.timer,
        underlyingAsset: payoutRules[0].units,
        strikePrice: payoutRules[1].units,
      };

      const inviteP = zoe.makeInvite(
        matchingOfferSeat,
        matchingOfferInviteHandle,
        customInviteExtent,
      );

      return harden({
        outcome: defaultAcceptanceMsg,
        option: inviteP,
      });
    },
  });

  return harden({
    initialSeat: firstOfferSeat,
    initialInviteHandle: firstOfferInviteHandle,
    assays: terms.assays,
  });
});
