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
    const [m, s, t, d] = terms;
    const leftTerms = amount.quantity.terms[1];
    if (m.quantity !== leftTerms.quantity) {
      throw new Error(
        `Wrong money quantity: ${m.quantity}, expected ${leftTerms.quantity}`,
      );
    }
    if (!sameStructure(leftTerms, m)) {
      throw new Error(`left terms incorrect: ${leftTerms}, expected ${m}`);
    }
    if (leftTerms.label.issuer !== m.label.issuer) {
      const iss = leftTerms.label.issuer;
      throw new Error(
        `Wrong money issuer: ${m.label.description}, expected ${iss}`,
      );
    }
    const rightTerms = amount.quantity.terms[2];
    if (!sameStructure(rightTerms, s)) {
      throw new Error(`right terms incorrect: ${rightTerms}, expected ${s}`);
    }
    if (rightTerms.quantity !== s.quantity) {
      throw new Error(`Wrong right amount: ${s}, expected ${leftTerms}`);
    }
    if (amount.quantity.terms[4] !== d) {
      throw new Error(
        `Wrong deadline: ${amount.quantity.terms[4]}, expected ${d}`,
      );
    }
    if (amount.quantity.terms[3] !== t) {
      throw new Error(
        `Wrong timer: ${amount.quantity.terms[3]}, expected ${t}`,
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
