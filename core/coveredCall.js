/* global E */
// Copyright (C) 2019 Agoric, under Apache License 2.0

import harden from '@agoric/harden';
import { sameStructure } from '../util/sameStructure';

const coveredCall = {
  start: (terms, inviteMaker) => {
    const [
      escrowExchangeInstallationP,
      moneyNeeded,
      stockNeeded,
      timerP,
      deadline,
    ] = terms;

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
  checkAmount: (amount, terms) => {
    const [termsLeft, termsRight, termsTimer, termsDeadline] = terms;
    const leftAmountTerms = amount.quantity.terms[1];
    if (termsLeft.quantity !== leftAmountTerms.quantity) {
      throw new Error(
        `Wrong money quantity: ${termsLeft.quantity}, expected ${
          leftAmountTerms.quantity
          }`,
      );
    }
    if (!sameStructure(termsLeft, leftAmountTerms)) {
      throw new Error(
        `left terms incorrect: ${termsLeft}, expected ${leftAmountTerms}`,
      );
    }
    const iss = leftAmountTerms.label.issuer;
    if (termsLeft.label.issuer !== iss) {
      throw new Error(
        `Wrong money issuer: ${termsLeft.label.issuer}, expected ${iss}`,
      );
    }
    const rightAmountTerms = amount.quantity.terms[2];
    if (!sameStructure(termsRight, rightAmountTerms)) {
      throw new Error(
        `right terms incorrect: ${termsRight}, expected ${rightAmountTerms}`,
      );
    }
    if (termsRight.quantity !== rightAmountTerms.quantity) {
      throw new Error(
        `Wrong right quantity: ${termsRight.quantity}, expected ${
          rightAmountTerms.quantity
          }`,
      );
    }
    if (termsDeadline !== amount.quantity.terms[4]) {
      throw new Error(
        `Wrong deadline: ${termsDeadline}, expected ${
          amount.quantity.terms[4]
          }`,
      );
    }
    if (termsTimer !== amount.quantity.terms[3]) {
      throw new Error(
        `Wrong timer: ${termsTimer}, expected ${amount.quantity.terms[3]}`,
      );
    }
    return true;
  },
};

const coveredCallSrc = {
  start: `${coveredCall.start}`,
  checkAmount: `${coveredCall.checkAmount}`,
};

export { coveredCallSrc };
