/* eslint-disable no-use-before-define */
import harden from '@agoric/harden';

import { defaultAcceptanceMsg, makeHelpers } from './helpers/userFlow';

export const makeContract = harden((zoe, terms) => {
  const { assays } = terms;
  const {
    completeOffers,
    rejectOffer,
    canTradeWith,
    hasValidPayoutRules,
  } = makeHelpers(zoe, assays);
  let firstInviteHandle;

  const makeFirstOfferInvite = () => {
    const seat = harden({
      makeFirstOffer: () => {
        if (!hasValidPayoutRules(['offer', 'want'], inviteHandle)) {
          throw rejectOffer(inviteHandle);
        }
        firstInviteHandle = inviteHandle;
        return defaultAcceptanceMsg;
      },
    });
    const { invite, inviteHandle } = zoe.makeInvite(seat, {
      seatDesc: 'firstOffer',
    });
    return invite;
  };

  const makeMatchingInvite = () => {
    const seat = harden({
      matchOffer: () => {
        if (!zoe.isOfferActive(firstInviteHandle)) {
          throw rejectOffer(inviteHandle, `The first offer was unavailable.`);
        }
        const handles = harden([firstInviteHandle, inviteHandle]);
        if (!canTradeWith(handles)) {
          throw rejectOffer(inviteHandle);
        }
        const [firstOfferUnits, matchingOfferUnits] = zoe.getUnitMatrix(
          handles,
          assays,
        );
        // reallocate by switching the extents of the firstOffer and matchingOffer
        zoe.reallocate(
          handles,
          assays,
          harden([matchingOfferUnits, firstOfferUnits]),
        );
        completeOffers(handles);
        return defaultAcceptanceMsg;
      },
    });
    const { invite, inviteHandle } = zoe.makeInvite(seat, {
      offerMadeRules: zoe.getPayoutRules(firstInviteHandle),
      seatDesc: 'matchOffer',
    });
    return invite;
  };

  return harden({
    invite: makeFirstOfferInvite(),
    publicAPI: {
      makeMatchingInvite,
    },
    terms,
  });
});
