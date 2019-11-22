import harden from '@agoric/harden';
/**
 * This is a very trivial contract to explain and test Zoe.
 * AutomaticRefund just gives you back what you put in. It has one
 * method: `makeOffer`, which takes an `escrowReceipt` (proof of
 * escrow with Zoe) as a parameter. AutomaticRefund then burns the
 * `escrowReceipt` and then tells Zoe to complete the offer, which
 * gives the user their payout through Zoe. Other contracts will use
 * these same steps, but they will have more sophisticated logic and
 * interfaces.
 * @param {contractFacet} zoe - the contract facet of zoe
 */
export const makeContract = harden((zoe, terms) => {
  let offersCount = 0;
  const makeSeatInvite = () => {
    const seat = harden({
      makeOffer: () => {
        offersCount += 1;
        // eslint-disable-next-line no-use-before-define
        zoe.complete(harden([inviteHandle]), terms.assays);
        return `The offer was accepted`;
      },
    });
    const { invite, inviteHandle } = zoe.makeInvite(seat, {
      seatDesc: 'getRefund',
    });
    return invite;
  };
  return harden({
    invite: makeSeatInvite(),
    publicAPI: {
      getOffersCount: () => offersCount,
      makeInvite: makeSeatInvite,
    },
    terms,
  });
});
