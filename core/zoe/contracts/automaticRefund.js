import harden from '@agoric/harden';
/**
 * This is a very trivial contract to explain and test Zoe.
 * AutomaticRefund just gives you back what you put in. It has one
 * method: `makeOffer`, which takes an `escrowReceipt` as a parameter.
 * AutomaticRefund then burns the `escrowReceipt` and then completes the
 * offer. Other governing contracts will use these same steps, but
 * they will have more sophisticated logic and interfaces.
 * @param {governingContractFacet} zoeInstance - the governing
 * contract facet of a zoeInstance
 */
const makeAutomaticRefund = zoeInstance => {
  let count = 0;
  return harden({
    makeOffer: async escrowReceipt => {
      const { id, offerMade } = await zoeInstance.burnEscrowReceipt(
        escrowReceipt,
      );
      count += 1;
      zoeInstance.complete(harden([id]));
      return offerMade;
    },
    getOffersCount: () => count,
  });
};

export { makeAutomaticRefund };
