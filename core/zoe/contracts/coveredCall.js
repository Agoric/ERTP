/* eslint-disable no-use-before-define */
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

import { makeHelpers } from './helpers/userFlow';

export const makeContract = harden((zoe, terms) => {
  const { rejectOffer, hasValidPayoutRules, swap } = makeHelpers(
    zoe,
    terms.assays,
  );
  let sellerHandle;

  const makeCallOptionInvite = () => {
    const seat = harden({
      useOption: () =>
        swap(sellerHandle, inviteHandle, `The covered call option is expired.`),
    });
    const payoutRules = zoe.getPayoutRules(sellerHandle);
    const exitRule = zoe.getExitRule(sellerHandle);
    const { invite: callOption, inviteHandle } = zoe.makeInvite(seat, {
      seatDesc: 'useOption',
      expirationDate: exitRule.deadline,
      timerAuthority: exitRule.timer,
      underlyingAsset: payoutRules[0].units,
      strikePrice: payoutRules[1].units,
    });
    return callOption;
  };

  const makeCoveredCallInvite = () => {
    const seat = harden({
      makeCallOption: () => {
        const exitRule = zoe.getExitRule(inviteHandle);
        if (
          !hasValidPayoutRules(['offer', 'want'], inviteHandle) ||
          exitRule.kind !== 'afterDeadline'
        ) {
          throw rejectOffer(inviteHandle);
        }
        sellerHandle = inviteHandle;
        return makeCallOptionInvite();
      },
    });
    const { invite, inviteHandle } = zoe.makeInvite(seat, {
      seatDesc: 'makeCallOption',
    });
    return invite;
  };

  return harden({
    invite: makeCoveredCallInvite(),
    terms,
  });
});
