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
          zoeInstance.getAssays(),
          offerIds,
          offerIdsToOfferDescs,
          offerMadeDesc,
        )
      ) {
        zoeInstance.eject(harden([id]));
        status.rej('The offer was invalid. Please check your refund.');
        return status.p;
      }

      // Save the offer.
      offerIdsToOfferDescs.set(id, offerMadeDesc);
      offerIds.push(id);

      // Check if we can reallocate and reallocate.
      if (srcs.canReallocate(offerIds, offerIdsToOfferDescs)) {
        const reallocation = srcs.reallocate(
          zoeInstance.getQuantitiesFor(offerIds),
        );
        zoeInstance.reallocate(offerIds, reallocation);
        zoeInstance.eject(offerIds);
      }

      status.res(
        'The offer has been accepted. Once another offer has been accepted, please check your winnings',
      );
      return status.p;
    },
  });
};
export { makeSimpleOfferMaker };
