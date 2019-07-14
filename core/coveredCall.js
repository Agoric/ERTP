/* global E */
// Copyright (C) 2019 Agoric, under Apache License 2.0

import harden from '@agoric/harden';
import { sameStructure } from '../util/sameStructure';

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
const coveredCall = {
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

    const aliceEscrowSeatP = E.resolve(pairP).then(pair =>
      inviteMaker.redeem(pair.left),
    );
    const bobEscrowSeatP = E.resolve(pairP).then(pair =>
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
          .getExclusive(stockNeeded, stockPayment, 'prePay')
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
  checkAmount: (allegedInviteAmount, expectedTerms) => {
    const [termsMoney, termsStock, termsTimer, termsDeadline] = expectedTerms;
    const allegedInviteMoney = allegedInviteAmount.quantity.terms.money;
    if (allegedInviteMoney.quantity !== termsMoney.quantity) {
      throw new Error(
        `Wrong money quantity: ${allegedInviteMoney.quantity}, expected ${
          termsMoney.quantity
        }`,
      );
    }
    if (!sameStructure(allegedInviteMoney, termsMoney)) {
      throw new Error(
        `money terms incorrect: ${allegedInviteMoney}, expected ${termsMoney}`,
      );
    }
    const allegedIssuer = allegedInviteMoney.label.issuer;
    if (allegedIssuer !== termsMoney.label.issuer) {
      throw new Error(
        `Wrong money issuer: ${allegedIssuer}, expected ${
          termsMoney.label.issuer
        }`,
      );
    }
    const allegedInviteStock = allegedInviteAmount.quantity.terms.stock;
    if (!sameStructure(allegedInviteStock, termsStock)) {
      throw new Error(
        `right terms incorrect: ${allegedInviteStock}, expected ${termsStock}`,
      );
    }
    if (allegedInviteStock.quantity !== termsStock.quantity) {
      throw new Error(
        `Wrong stock quantity: ${allegedInviteStock.quantity}, expected ${
          termsStock.quantity
        }`,
      );
    }
    if (allegedInviteAmount.quantity.terms.deadline !== termsDeadline) {
      throw new Error(
        `Wrong deadline: ${
          allegedInviteAmount.quantity.terms.deadline
        }, expected ${termsDeadline}`,
      );
    }
    if (termsTimer !== allegedInviteAmount.quantity.terms.timer) {
      throw new Error(
        `Wrong timer: ${
          allegedInviteAmount.quantity.terms.timer
        }, expected ${termsTimer}`,
      );
    }
    return true;
  },
};

const coveredCallSrcs = {
  start: `${coveredCall.start}`,
  checkAmount: `${coveredCall.checkAmount}`,
};

export { coveredCallSrcs };
