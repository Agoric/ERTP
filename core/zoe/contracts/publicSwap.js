import harden from '@agoric/harden';

import { rejectOffer, defaultAcceptanceMsg } from './helpers/userFlow';
import {
  isExactlyMatchingOfferDesc,
  hasRules,
  hasAssays,
} from './helpers/offerDesc';

export const makeContract = harden((zoe, terms) => {
  let firstOfferId;
  let firstOfferDesc;

  const publicSwap = harden({
    makeFirstOffer: async escrowReceipt => {
      const {
        id: offerId,
        conditions: { offerDesc: offerMadeDesc },
      } = await zoe.burnEscrowReceipt(escrowReceipt);

      if (!hasRules(['offerExactly', 'wantExactly'], offerMadeDesc)) {
        return rejectOffer(zoe, offerId);
      }

      if (!hasAssays(terms.assays, offerMadeDesc)) {
        return rejectOffer(zoe, offerId);
      }

      // The offer is valid, so save information about the first offer
      firstOfferId = offerId;
      firstOfferDesc = offerMadeDesc;
      return defaultAcceptanceMsg;
    },
    getFirstOfferDesc: () => firstOfferDesc,
    matchOffer: async escrowReceipt => {
      const {
        id: matchingOfferId,
        conditions: { offerDesc: offerMadeDesc },
      } = await zoe.burnEscrowReceipt(escrowReceipt);

      if (!firstOfferId) {
        return rejectOffer(zoe, matchingOfferId, `no offer to match`);
      }

      const { inactive } = zoe.getStatusFor(harden([firstOfferId]));
      if (inactive.length > 0) {
        return rejectOffer(
          zoe,
          matchingOfferId,
          `The first offer was withdrawn or completed.`,
        );
      }

      if (!isExactlyMatchingOfferDesc(zoe, firstOfferDesc, offerMadeDesc)) {
        return rejectOffer(zoe, matchingOfferId);
      }
      const [firstOfferExtents, matchingOfferExtents] = zoe.getExtentsFor(
        harden([firstOfferId, matchingOfferId]),
      );
      // reallocate by switching the extents of the firstOffer and matchingOffer
      zoe.reallocate(
        harden([firstOfferId, matchingOfferId]),
        harden([matchingOfferExtents, firstOfferExtents]),
      );
      zoe.complete(harden([firstOfferId, matchingOfferId]));
      return defaultAcceptanceMsg;
    },
  });
  return harden({
    instance: publicSwap,
    assays: terms.assays,
  });
});
