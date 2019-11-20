import harden from '@agoric/harden';

import { rejectOffer, defaultAcceptanceMsg } from './helpers/userFlow';
import { hasValidPayoutRules } from './helpers/offerRules';
import {
  isOverMinimumBid,
  secondPriceLogic,
  closeAuction,
} from './helpers/auctions';

export const makeContract = harden((zoe, terms) => {
  const numBidsAllowed = terms.numBidsAllowed || 3;

  const creatorInviteHandle = harden({});
  let minimumBid;
  let auctionedAssets;
  const allBidHandles = [];

  // The item up for auction is described first in the payoutRules array
  const ITEM_INDEX = 0;
  const BID_INDEX = 1;

  const makeBidderSeat = inviteHandle =>
    harden({
      bid: () => {
        // Check that the item is still up for auction
        const { inactive } = zoe.getOfferStatuses(
          harden([creatorInviteHandle]),
        );
        if (inactive.length > 0) {
          return rejectOffer(
            zoe,
            terms.assays,
            inviteHandle,
            'The item up for auction has been withdrawn or the auction has completed',
          );
        }

        if (allBidHandles.length >= numBidsAllowed) {
          return rejectOffer(
            zoe,
            terms.assays,
            inviteHandle,
            `No further bids allowed.`,
          );
        }

        const [payoutRules] = zoe.getPayoutRuleMatrix(
          harden([inviteHandle]),
          terms.assays,
        );

        const ruleKinds = ['want', 'offer'];
        if (!hasValidPayoutRules(ruleKinds, terms.assays, payoutRules)) {
          return rejectOffer(zoe, terms.assays, inviteHandle);
        }

        if (
          !isOverMinimumBid(
            zoe,
            terms.assays,
            BID_INDEX,
            creatorInviteHandle,
            inviteHandle,
          )
        ) {
          return rejectOffer(
            zoe,
            terms.assays,
            inviteHandle,
            `Bid was under minimum bid`,
          );
        }

        // Save valid bid and try to close.
        allBidHandles.push(inviteHandle);
        if (allBidHandles.length >= numBidsAllowed) {
          closeAuction(zoe, terms.assays, {
            auctionLogicFn: secondPriceLogic,
            itemIndex: ITEM_INDEX,
            bidIndex: BID_INDEX,
            creatorInviteHandle,
            allBidHandles,
          });
        }
        return defaultAcceptanceMsg;
      },
    });

  const creatorSeat = harden({
    startAuction: () => {
      const ruleKinds = ['offer', 'want'];
      const [payoutRules] = zoe.getPayoutRuleMatrix(
        harden([creatorInviteHandle]),
        terms.assays,
      );
      if (
        auctionedAssets ||
        !hasValidPayoutRules(ruleKinds, terms.assays, payoutRules)
      ) {
        return rejectOffer(creatorInviteHandle);
      }

      // Save the valid offer
      auctionedAssets = payoutRules[0].units;
      minimumBid = payoutRules[1].units;
      return defaultAcceptanceMsg;
    },
    makeInvites: numInvites => {
      const invites = [];
      for (let i = 0; i < numInvites; i += 1) {
        const newInviteHandle = harden({});
        const seat = makeBidderSeat(newInviteHandle);
        invites.push(
          zoe.makeInvite(seat, newInviteHandle, {
            auctionedAssets,
            minimumBid,
          }),
        );
      }
      return invites;
    },
  });

  return harden({
    initialSeat: creatorSeat,
    initialInviteHandle: creatorInviteHandle,
    assays: terms.assays,
  });
});
