/* global E makePromise */
// Copyright (C) 2019 Agoric, under Apache License 2.0

import harden from '@agoric/harden';
import { sameStructure } from '../util/sameStructure';

// For clarity, the code below internally speaks of a scenario is which Alice is
// trading some of her money for some of Bob's stock. However, for generality,
// the API does not expose names like "alice", "bob", "money", or "stock".
// Rather, Alice and Bob are left and right respectively. Money are the rights
// transferred from left to right, and Stock is the rights transferred from
// right to left.
const escrowExchange = {
  start: (terms, inviteMaker) => {
    const { left: moneyNeeded, right: stockNeeded } = terms;

    function makeTransfer(amount, srcPaymentP) {
      const { issuer } = amount.label;
      const escrowP = E(issuer).getExclusive(amount, srcPaymentP, 'escrow');
      const winnings = makePromise();
      const refund = makePromise();
      return harden({
        phase1() {
          return escrowP;
        },
        phase2() {
          winnings.res(escrowP);
          refund.res(null);
        },
        abort(reason) {
          winnings.reject(reason);
          refund.res(escrowP);
        },
        getWinnings() {
          return winnings.p;
        },
        getRefund() {
          return refund.p;
        },
      });
    }

    // Promise wiring

    const moneyPayment = makePromise();
    const moneyTransfer = makeTransfer(moneyNeeded, moneyPayment.p);

    const stockPayment = makePromise();
    const stockTransfer = makeTransfer(stockNeeded, stockPayment.p);

    // TODO Use cancellation tokens instead.
    const aliceCancel = makePromise();
    const bobCancel = makePromise();

    // Set it all in motion optimistically.

    const decisionP = Promise.race([
      Promise.all([moneyTransfer.phase1(), stockTransfer.phase1()]),
      aliceCancel.p,
      bobCancel.p,
    ]);
    decisionP.then(
      _ => {
        moneyTransfer.phase2();
        stockTransfer.phase2();
      },
      reason => {
        moneyTransfer.abort(reason);
        stockTransfer.abort(reason);
      },
    );

    // Seats

    const aliceSeat = harden({
      offer: moneyPayment.res,
      cancel: aliceCancel.reject,
      getWinnings: stockTransfer.getWinnings,
      getRefund: moneyTransfer.getRefund,
    });

    const bobSeat = harden({
      offer: stockPayment.res,
      cancel: bobCancel.reject,
      getWinnings: moneyTransfer.getWinnings,
      getRefund: stockTransfer.getRefund,
    });

    return harden({
      left: inviteMaker.make('left', aliceSeat),
      right: inviteMaker.make('right', bobSeat),
    });
  },

  checkAmount: (amount, payment) => {
    const termsFromAmount = amount.quantity.terms;
    if (!sameStructure(termsFromAmount, payment)) {
      throw new Error(`Wrong amount: ${payment}, expected ${termsFromAmount}`);
    }
    if (termsFromAmount.left.quantity !== payment.left.quantity) {
      throw new Error(
        `Wrong left quantity: ${payment.left.quantity}, expected ${
          termsFromAmount.left.quantity
          }`,
      );
    }
    if (termsFromAmount.right.quantity !== payment.right.quantity) {
      throw new Error(
        `Wrong right quantity: ${payment.right.quantity}, expected ${
          termsFromAmount.right.quantity
          }`,
      );
    }
    return true;
  },

  // Check the left or right side, and return the other. Useful when it's a
  // trade of goods for an invite, for example.
  checkPartialAmount: (amount, payment) => {
    const seat = amount.quantity.seatDesc;
    const terms = amount.quantity.terms[seat];
    if (terms.quantity !== payment.quantity) {
      throw new Error(
        `Wrong ${seat} quantity: ${payment.quantity}, expected ${
          terms.quantity
          }`,
      );
    }
    if (!sameStructure(terms, payment)) {
      throw new Error(`Wrong ${seat} amount: ${payment}, expected ${terms}`);
    }
    if (seat === 'left') {
      return amount.quantity.terms.right;
    }
    return amount.quantity.terms.left;
  },
};

const escrowExchangeSrc = {
  start: `${escrowExchange.start}`,
  checkAmount: `${escrowExchange.checkAmount}`,
  checkPartialAmount: `${escrowExchange.checkPartialAmount}`,
};

export { escrowExchangeSrc };
