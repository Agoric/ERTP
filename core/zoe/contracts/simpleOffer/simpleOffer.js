import harden from '@agoric/harden';

import makePromise from '../../../../util/makePromise';

const makeSimpleOfferMaker = srcs => zoeInstance => {
  const offerIdsToOfferDescs = new WeakMap();
  const offerIds = [];

  return harden({
    makeOffer: async escrowReceipt => {
      const status = makePromise();
      const {
        id,
        offerMade: offerMadeDesc,
      } = await zoeInstance.burnEscrowReceipt(escrowReceipt);

      // Eject if the offer is invalid
      if (
        !srcs.isValidOffer(
          zoeInstance.getStrategies(),
          offerIds,
          offerIdsToOfferDescs,
          offerMadeDesc,
        )
      ) {
        zoeInstance.complete(harden([id]));
        status.rej('The offer was invalid. Please check your refund.');
        return status.p;
      }

      // Save the offer.
      offerIdsToOfferDescs.set(id, offerMadeDesc);
      offerIds.push(id);

      // Check if we can reallocate and reallocate.
      if (srcs.canReallocate(offerIds, offerIdsToOfferDescs)) {
        const { reallocOfferIds, reallocQuantities } = srcs.reallocate(
          zoeInstance.getStrategies(),
          offerIds,
          offerIdsToOfferDescs,
          zoeInstance.getQuantitiesFor,
        );
        zoeInstance.reallocate(reallocOfferIds, reallocQuantities);
        zoeInstance.complete(offerIds);
      }

      status.res(
        'The offer has been accepted. Once the contract has been completed, please check your winnings',
      );
      return status.p;
    },
  });
};
export { makeSimpleOfferMaker };
