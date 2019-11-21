/* eslint-disable no-use-before-define */
import harden from '@agoric/harden';

import { rejectOffer, defaultAcceptanceMsg } from './helpers/userFlow';
import {
  hasValidPayoutRules,
  getActivePayoutRuleMatrix,
} from './helpers/offerRules';
import {
  isMatchingLimitOrder,
  reallocateSurplusToSeller as reallocate,
} from './helpers/exchanges';

// This exchange only accepts limit orders. A limit order is defined
// as either a sell order with payoutRules: [ { kind: 'offer',
// units1 }, {kind: 'want', units2 }] or a buy order:
// [ { kind: 'want', units1 }, { kind: 'offer',
// units2 }]. Note that the asset in the first slot of the
// payoutRules will always be bought or sold in exact amounts, whereas
// the amount of the second asset received in a sell order may be
// greater than expected, and the amount of the second asset paid in a
// buy order may be less than expected. This simple exchange does not
// support partial fills of orders.

export const makeContract = harden((zoe, terms) => {
  const sellInviteHandles = [];
  const buyInviteHandles = [];
  const { assays } = terms;

  const makeSeatInvite = () => {
    const seat = harden({
      addOrder: () => {
        const payoutRules = zoe.getPayoutRules(inviteHandle);

        // Is it a valid sell offer?
        const sellOfferKinds = ['offer', 'want'];
        if (hasValidPayoutRules(sellOfferKinds, assays, payoutRules)) {
          // Save the valid offer
          sellInviteHandles.push(inviteHandle);

          // Try to match
          const {
            inviteHandles: activeBuyHandles,
            payoutRuleMatrix: activeBuyPayoutRules,
          } = getActivePayoutRuleMatrix(zoe, buyInviteHandles);
          for (let i = 0; i < activeBuyHandles.length; i += 1) {
            if (
              isMatchingLimitOrder(
                zoe,
                assays,
                payoutRules,
                activeBuyPayoutRules[i],
              )
            ) {
              return reallocate(zoe, assays, inviteHandle, activeBuyHandles[i]);
            }
          }
          return defaultAcceptanceMsg;
        }

        // Is it a valid buy offer?
        const buyOfferFormat = ['want', 'offer'];
        if (hasValidPayoutRules(buyOfferFormat, assays, payoutRules)) {
          // Save the valid offer
          buyInviteHandles.push(inviteHandle);

          // Try to match
          const {
            inviteHandles: activeSellHandles,
            payoutRuleMatrix: activeSellPayoutRules,
          } = getActivePayoutRuleMatrix(zoe, sellInviteHandles);
          for (let i = 0; i < activeSellHandles.length; i += 1) {
            if (
              isMatchingLimitOrder(
                zoe,
                assays,
                activeSellPayoutRules[i],
                payoutRules,
              )
            ) {
              reallocate(zoe, assays, activeSellHandles[i], inviteHandle);
            }
          }
          return defaultAcceptanceMsg;
        }

        // Eject because the offer must be invalid
        throw rejectOffer(zoe, assays, inviteHandle);
      },
      makeInvite: makeSeatInvite,
    });
    const { invite, inviteHandle } = zoe.makeInvite(seat);
    return invite;
  };

  return harden({
    invite: makeSeatInvite(),
    terms,
  });
});
