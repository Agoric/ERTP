import harden from '@agoric/harden';
import {
  isMatchingOfferDesc,
  isValidFirstOfferDesc,
} from '../utils/publicSwap';

export const makeContract = harden((zoe, terms) => {
  let firstOfferId;

  const publicSwap = harden({
    makeOffer: async escrowReceipt => {
      const { id, conditions } = await zoe.burnEscrowReceipt(escrowReceipt);
      const { offerDesc: offerMadeDesc } = conditions;

      const acceptanceMsg = `The offer has been accepted. Once the contract has been completed, please check your winnings`;

      if (isValidFirstOfferDesc(offerMadeDesc)) {
        firstOfferId = id;
        return acceptanceMsg;
      }

      const { inactive } = zoe.getStatusFor(harden([firstOfferId]));
      if (inactive.length > 0) {
        zoe.complete(harden([id]));
        return Promise.reject(new Error(`The first offer was withdrawn.`));
      }

      const [firstOfferDesc] = zoe.getOfferDescsFor(harden([firstOfferId]));
      const extentOpsArray = zoe.getExtentOpsArray();

      if (isMatchingOfferDesc(extentOpsArray, firstOfferDesc, offerMadeDesc)) {
        const offerIds = harden([firstOfferId, id]);
        const [firstOfferExtents, matchingOfferExtents] = zoe.getExtentsFor(
          offerIds,
        );
        // reallocate by switching the extents of the firstOffer and matchingOffer
        zoe.reallocate(
          offerIds,
          harden([matchingOfferExtents, firstOfferExtents]),
        );
        zoe.complete(offerIds);
        return acceptanceMsg;
      }

      // Eject because the offer must be invalid
      zoe.complete(harden([id]));
      return Promise.reject(
        new Error(`The offer was invalid. Please check your refund.`),
      );
    },
  });
  return harden({
    instance: publicSwap,
    assays: terms.assays,
  });
});
