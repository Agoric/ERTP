/* eslint-disable no-use-before-define */
import harden from '@agoric/harden';

import { rejectOffer, defaultAcceptanceMsg } from './helpers/userFlow';
import {
  isExactlyMatchingPayoutRules,
  hasValidPayoutRules,
} from './helpers/offerRules';

export const makeContract = harden((zoe, terms) => {
  const { assays } = terms;

  const makeFirstOfferInvite = () => {
    const seat = harden({
      makeFirstOffer: () => {
        const ruleKinds = ['offer', 'want'];
        const firstOfferPayoutRules = zoe.getPayoutRules(firstInviteHandle);
        if (!hasValidPayoutRules(ruleKinds, assays, firstOfferPayoutRules)) {
          return rejectOffer(zoe, assays, firstInviteHandle);
        }

        const matchingOfferSeat = harden({
          matchOffer: () => {
            if (!zoe.isOfferActive(firstInviteHandle)) {
              throw rejectOffer(
                zoe,
                assays,
                matchingInviteHandle,
                `The first offer was withdrawn or completed.`,
              );
            }
            const matchingPayoutRules = zoe.getPayoutRules(
              matchingInviteHandle,
            );
            if (
              !isExactlyMatchingPayoutRules(
                zoe,
                assays,
                firstOfferPayoutRules,
                matchingPayoutRules,
              )
            ) {
              throw rejectOffer(zoe, terms.assays, matchingInviteHandle);
            }
            const [firstOfferUnits, matchingOfferUnits] = zoe.getUnitMatrix(
              harden([firstInviteHandle, matchingInviteHandle]),
              assays,
            );
            // reallocate by switching the extents of the firstOffer and matchingOffer
            zoe.reallocate(
              harden([firstInviteHandle, matchingInviteHandle]),
              assays,
              harden([matchingOfferUnits, firstOfferUnits]),
            );
            zoe.complete(
              harden([firstInviteHandle, matchingInviteHandle]),
              assays,
            );
            return defaultAcceptanceMsg;
          },
        });

        const {
          invite: inviteToMatch,
          inviteHandle: matchingInviteHandle,
        } = zoe.makeInvite(matchingOfferSeat, {
          offerMadeRules: firstOfferPayoutRules,
          seat: 'matchOffer',
        });

        return harden({
          outcome: defaultAcceptanceMsg,
          invite: inviteToMatch,
        });
      },
    });
    const { invite, inviteHandle: firstInviteHandle } = zoe.makeInvite(seat);
    return invite;
  };

  return harden({
    invite: makeFirstOfferInvite(),
    terms,
  });
});
