import harden from '@agoric/harden';
/**
 * This is a very trivial contract to explain and test Zoe.
 * AutomaticRefund just gives you back what you put in. It has one
 * method: `makeOffer`, which takes an `escrowReceipt` as a parameter.
 * AutomaticRefund then burns the `escrowReceipt` and then completes the
 * offer. Other governing contracts will use these same steps, but
 * they will have more sophisticated logic and interfaces.
 * @param {governingContractFacet} zoe - the governing
 * contract facet of zoe
 */
const makeContract = (zoe, terms) => {
  let count = 0;
  const automaticRefund = harden({
    makeOffer: async escrowReceipt => {
      const { id, conditions } = await zoe.burnEscrowReceipt(escrowReceipt);
      count += 1;
      zoe.complete(harden([id]));
      return conditions;
    },
    getOffersCount: () => count,
  });
  return harden({
    instance: automaticRefund,
    assays: terms.assays,
  });
};

const automaticRefundSrcs = harden({
  makeContract: `${makeContract}`,
});

export { automaticRefundSrcs };
