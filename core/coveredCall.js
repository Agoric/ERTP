/* global E */
// Copyright (C) 2019 Agoric, under Apache License 2.0
// @flow

import harden from '@agoric/harden';

/* ::
import type { Amount, Payment } from './issuers.chainmail';
import type { InviteMaker, Timer } from './issuers.chainmail';

import { E } from '@agoric/swingset-vat';

import type { EscrowSeat } from './escrow';

export interface CoveredCallSeat<Money, Stock> {
  offer(Payment<Stock>): Promise<Payment<mixed>>;
  getWinnings(): Promise<Payment<Money>>;
  getRefund(): Promise<Payment<Stock> | null>;
};

*/

function coveredCall /* :: <Money, Stock> */(
  terms /* : [any, Amount<Money>, Amount<Stock>, Promise<Timer>, number] */,
  inviteMaker /* : InviteMaker */,
) {
  const [
    escrowExchangeInstallationP,
    moneyNeeded,
    stockNeeded,
    timerP,
    deadline,
  ] = terms;

  /* ::
  type PairInv = [Payment<any>, Payment<any>];
  */

  // eslint-disable-next-line prettier/prettier
  const pairP = E /* :: <any, PairInv> */(
    escrowExchangeInstallationP,
  ).spawn(harden([moneyNeeded, stockNeeded]));

  // ISSUE: type of redeem() is by inspection of contract source; we use any.
  // eslint-disable-next-line prettier/prettier
  const aliceEscrowSeatP /* : Promise<EscrowSeat<Money, Stock>> */ = E.resolve /* :: <PairInv> */(
    pairP,
  ).then(([am, _as]) => inviteMaker.redeem(am));
  // eslint-disable-next-line prettier/prettier
  const bobEscrowSeatP /* : Promise<EscrowSeat<Stock, Money>> */ = E.resolve /* :: <PairInv> */(
    pairP,
  ).then(([_am, as]) => inviteMaker.redeem(as));

  // Seats

  E(timerP)
    .delayUntil(deadline)
    .then(_ => E(bobEscrowSeatP).cancel('expired'));

  function ep /* :: <T> */(x /* : T */) /* : Promise<T> */ {
    return Promise.resolve(x);
  }

  const bobSeat /* : CoveredCallSeat<Money, Stock> */ = harden({
    offer(stockPayment /* : Payment<Stock> */) {
      const sIssuer = stockNeeded.label.issuer;
      return E(ep(sIssuer))
        .getExclusive(stockNeeded, ep(stockPayment), 'prePay')
        .then(prePayment => {
          E(bobEscrowSeatP).offer(prePayment);
          return inviteMaker.make('holder', aliceEscrowSeatP);
        });
    },
    getWinnings() {
      return E(bobEscrowSeatP).getWinnings();
    },
    getRefund() {
      return E(bobEscrowSeatP).getRefund();
    },
  });

  return inviteMaker.make('writer', bobSeat);
}

// $FlowFixMe flow thinks "function [1] should not be coerced"
const coveredCallSrc = `(${coveredCall})`;

export { coveredCall, coveredCallSrc };
