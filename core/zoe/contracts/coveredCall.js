import harden from '@agoric/harden';

import { insist } from '../../../util/insist';
import makePromise from '../../../util/makePromise';
import { makeStateMachine } from '../utils/stateMachine';
import { makeSeatMint } from '../../seatMint';

const makeCoveredCallMaker = govC => zoeInstance => {
  const makeOfferKeeper = () => {
    const validOfferIdsToDescs = new WeakMap();
    const validOfferIds = [];
    return harden({
      keepOffer: (offerId, offerDesc) => {
        validOfferIdsToDescs.set(offerId, offerDesc);
        validOfferIds.push(offerId);
      },
      getOffer: offerId => validOfferIdsToDescs.get(offerId),
      getValidOfferIds: () => validOfferIds,
    });
  };

  const { keepOffer, getValidOfferIds } = makeOfferKeeper();

  const { seatMint, seatIssuer, addUseObj } = makeSeatMint();
  const escrowReceiptIssuer = zoeInstance.getEscrowReceiptIssuer();

  const allowedTransitions = [
    ['open', ['closed', 'cancelled']],
    ['closed', []],
    ['cancelled', []],
  ];

  const sm = makeStateMachine('open', allowedTransitions);

  const makeOfferMaker = offerToBeMadeDesc => {
    const makeOffer = async escrowReceipt => {
      const offerResult = makePromise();
      // we will either drop this purse or withdraw from it to give a refund
      const escrowReceiptPurse = escrowReceiptIssuer.makeEmptyPurse();
      const amount = await escrowReceiptPurse.depositAll(escrowReceipt);
      const { id, offerMade: offerMadeDesc } = amount.quantity;
      if (sm.getStatus() !== 'open') {
        offerResult.rej('swap was cancelled');
        return offerResult.p;
        // TODO: refund?
      }

      // fail-fast if the offerDesc isn't valid
      if (
        !govC.isValidOfferDesc(
          zoeInstance.getAssays(),
          offerToBeMadeDesc,
          offerMadeDesc,
        )
      ) {
        offerResult.rej('offer was invalid');
        return offerResult.p;
        // TODO: refund?
      }

      // keep valid offer
      keepOffer(id, offerMadeDesc);
      const validIds = getValidOfferIds();

      if (sm.canTransitionTo('closed') && govC.canReallocate(validIds)) {
        sm.transitionTo('closed');
        zoeInstance.reallocate(
          validIds,
          govC.reallocate(zoeInstance.getQuantitiesFor(validIds)),
        );
        zoeInstance.eject(validIds);
      }
      offerResult.res('offer successfully made');
      return offerResult.p;
    };
    return harden(makeOffer);
  };

  const institution = harden({
    async init(escrowReceipt) {
      const { offerMade: offerMadeDesc } = escrowReceipt.getBalance().quantity;
      insist(
        govC.isValidInitialOfferDesc(zoeInstance.getIssuers(), offerMadeDesc),
      )`this offer has an invalid format`;

      const makeOffer = makeOfferMaker(offerMadeDesc);
      const outcome = makeOffer(escrowReceipt);

      const wantedOffers = govC.makeWantedOfferDescs(offerMadeDesc);

      const invites = wantedOffers.map(offer => {
        const quantity = harden({
          src: govC.name,
          id: harden({}),
          offerToBeMade: offer,
        });
        addUseObj(quantity.id, harden({ makeOffer: makeOfferMaker(offer) }));
        const purse = seatMint.mint(harden(quantity));
        return purse.withdrawAll();
      });
      /**
       * Seat: the seat for the initial player
       * Invites: invitations for all of the other seats that can
       * be sent to other players.
       * Both seat and invites are ERTP payments that can be
       * `unwrap`ed to get a use object.
       */
      return harden({
        outcome,
        invites,
      });
    },
    getIssuers: _ => zoeInstance.getIssuers(),
    getStatus: _ => sm.getStatus(),
    getSeatIssuer: _ => seatIssuer,
  });
  return institution;
};
export { makeCoveredCallMaker };
