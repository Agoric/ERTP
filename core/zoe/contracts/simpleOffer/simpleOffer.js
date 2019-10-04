import harden from '@agoric/harden';

import makePromise from '../../../../util/makePromise';

const makeSimpleOfferMaker = srcs => (zoe, instanceId) => {
  const offerIdsToOfferDescs = new WeakMap();
  const offerIds = [];

  return harden({
    makeOffer: async escrowReceipt => {
      const status = makePromise();
      const { id, offerMade: offerMadeDesc } = await zoe.burnEscrowReceipt(
        instanceId,
        escrowReceipt,
      );

      // Eject if the offer is invalid
      if (
        !srcs.isValidOffer(
          zoe.getStrategies(instanceId),
          offerIds,
          offerIdsToOfferDescs,
          offerMadeDesc,
        )
      ) {
        zoe.complete(instanceId, harden([id]));
        status.rej('The offer was invalid. Please check your refund.');
        return status.p;
      }

      // Save the offer.
      offerIdsToOfferDescs.set(id, offerMadeDesc);
      offerIds.push(id);

      // Check if we can reallocate and reallocate.
      if (srcs.canReallocate(offerIds, offerIdsToOfferDescs)) {
        const { reallocOfferIds, reallocQuantities } = srcs.reallocate(
          zoe.getStrategies(instanceId),
          offerIds,
          offerIdsToOfferDescs,
          zoe.getQuantitiesFor,
        );
        zoe.reallocate(instanceId, reallocOfferIds, reallocQuantities);
        zoe.complete(instanceId, offerIds);
      }

      status.res(
        'The offer has been accepted. Once the contract has been completed, please check your winnings',
      );
      return status.p;
    },
  });
};
export { makeSimpleOfferMaker };
