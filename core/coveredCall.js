/* global E */
// Copyright (C) 2019 Agoric, under Apache License 2.0

import harden from '@agoric/harden';
import { mustBeSameStructure, sameStructure } from '../util/sameStructure';

/**
 * The coveredCall is an asymmetric contract. One party will put some goods in
 * escrow, and is transferring the right to buy them for a specified amount of
 * some currency. start() specifies the terms, and returns the seat that has the
 * ability to offer() the goods. The counterparty seat is returned from offer(),
 * so the originator can offer it to a someone of their choice. To simplify
 * terminology, the terms refer to 'stock' and 'money', though neither is
 * limited, and the offerer and potential acceptor are 'bob' and 'alice'
 * respectively.
 */
const coveredCall = harden({
  start: (terms, inviteMaker) => {
    const {
      escrowExchangeInstallation: escrowExchangeInstallationP,
      money: moneyNeeded,
      stock: stockNeeded,
      timer: timerP,
      deadline,
    } = terms;

    const pairP = E(escrowExchangeInstallationP).spawn(
      harden({ left: moneyNeeded, right: stockNeeded }),
    );

    const aliceEscrowSeatP = Promise.resolve(pairP).then(pair =>
      inviteMaker.redeem(pair.left),
    );
    const bobEscrowSeatP = Promise.resolve(pairP).then(pair =>
      inviteMaker.redeem(pair.right),
    );

    // Seats

    E(timerP)
      .delayUntil(deadline)
      .then(_ => E(bobEscrowSeatP).cancel('expired'));

    const bobSeat = harden({
      offer(stockPayment) {
        const sIssuer = stockNeeded.label.issuer;
        return E(sIssuer)
          .claimExactly(stockNeeded, stockPayment, 'prePay')
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
  },
  checkAmount: (installation, allegedInviteAmount, expectedTerms) => {
    mustBeSameStructure(
      allegedInviteAmount.quantity.installation,
      installation,
      'coveredCall checkAmount installation',
    );
    const [termsMoney, termsStock, termsTimer, termsDeadline] = expectedTerms;
    const allegedInviteTerms = allegedInviteAmount.quantity.terms;
    const allegedInviteMoney = allegedInviteTerms.money;
    if (allegedInviteMoney.quantity !== termsMoney.quantity) {
      throw new Error(
        `Wrong money quantity: ${allegedInviteMoney.quantity}, expected ${termsMoney.quantity}`,
      );
    }
    if (!sameStructure(allegedInviteMoney, termsMoney)) {
      throw new Error(
        `money terms incorrect: ${allegedInviteMoney}, expected ${termsMoney}`,
      );
    }
    const allegedInviteStock = allegedInviteTerms.stock;
    if (!sameStructure(allegedInviteStock, termsStock)) {
      throw new Error(
        `right terms incorrect: ${allegedInviteStock}, expected ${termsStock}`,
      );
    }
    if (allegedInviteTerms.deadline !== termsDeadline) {
      throw new Error(
        `Wrong deadline: ${allegedInviteTerms.deadline}, expected ${termsDeadline}`,
      );
    }
    if (termsTimer !== allegedInviteTerms.timer) {
      throw new Error(
        `Wrong timer: ${allegedInviteTerms.timer}, expected ${termsTimer}`,
      );
    }
    return true;
  },
});

const coveredCallSrcs = harden({
  start: `${coveredCall.start}`,
  checkAmount: `${coveredCall.checkAmount}`,
});

export { coveredCallSrcs };
