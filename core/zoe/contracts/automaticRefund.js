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
  const initialInviteHandle = harden({});
  let offersCount = 0;

  const makeSeat = inviteHandle =>
    harden({
      makeOffer: () => {
        offersCount += 1;
        zoe.complete(harden([inviteHandle]), terms.assays);
        return `The offer was accepted`;
      },
      makeInvite: () => {
        const newInviteHandle = harden({});
        const seat = makeSeat(newInviteHandle);
        return zoe.makeInvite(seat, newInviteHandle);
      },
      getOffersCount: () => offersCount,
    });
  return harden({
    initialSeat: makeSeat(initialInviteHandle),
    initialInviteHandle,
    assays: terms.assays,
  });
});
