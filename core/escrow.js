/* global E makePromise */
// Copyright (C) 2019 Agoric, under Apache License 2.0

import harden from '@agoric/harden';
import { mustBeSameStructure } from '../util/sameStructure';
import { insist } from '../util/insist';

const escrowExchange = harden({
  // config is used for two customizations: 1) customization the names
  // of the left and right seat, and 2) customizing the methods on the
  // seats. For instance, in the case of an escrowed payment that has
  // an associated use object, `makeCustomLeftSeatSrc` could be a
  // stringified function that adds a `getUse` method to the seat to
  // retrieve the use object for the escrowed payment.
  start: (
    terms,
    inviteMaker,
    evaluate,
    config = harden({
      makeCustomLeftSeatSrc: `coreSeat => coreSeat`,
      makeCustomRightSeatSrc: `coreSeat => coreSeat`,
    }),
  ) => {
    const { makeCustomLeftSeatSrc, makeCustomRightSeatSrc } = config;

    function evalStrToFn(source) {
      insist(
        typeof source === 'string',
      )`"${source}" must be a string, but was ${typeof source}`;
      const fn = evaluate(source, { harden, E });
      insist(
        typeof fn === 'function',
      )`"${source}" must be a string for a function, but produced ${typeof fn}`;
      return fn;
    }

    const makeCustomLeftSeat = evalStrToFn(makeCustomLeftSeatSrc);
    const makeCustomRightSeat = evalStrToFn(makeCustomRightSeatSrc);

    const { left: leftOfferAmount, right: rightOfferAmount } = terms;

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

    const leftOfferPayment = makePromise();
    const leftEscrow = makeTransfer(leftOfferAmount, leftOfferPayment.p);

    const rightOfferPayment = makePromise();
    const rightEscrow = makeTransfer(rightOfferAmount, rightOfferPayment.p);

    // TODO Use cancellation tokens instead.
    const leftCancel = makePromise();
    const rightCancel = makePromise();

    // Set it all in motion optimistically.

    const decisionP = Promise.race([
      Promise.all([leftEscrow.phase1(), rightEscrow.phase1()]),
      leftCancel.p,
      rightCancel.p,
    ]);
    decisionP.then(
      _ => {
        leftEscrow.phase2();
        rightEscrow.phase2();
      },
      reason => {
        leftEscrow.abort(reason);
        rightEscrow.abort(reason);
      },
    );

    // Seats

    const coreLeftSeat = harden({
      offer: leftOfferPayment.res,
      cancel: leftCancel.reject,
      getWinnings: rightEscrow.getWinnings,
      getRefund: leftEscrow.getRefund,
    });

    const coreRightSeat = harden({
      offer: rightOfferPayment.res,
      cancel: rightCancel.reject,
      getWinnings: leftEscrow.getWinnings,
      getRefund: rightEscrow.getRefund,
    });

    const leftSeat = makeCustomLeftSeat(coreLeftSeat, leftEscrow, rightEscrow);
    const rightSeat = makeCustomRightSeat(
      coreRightSeat,
      leftEscrow,
      rightEscrow,
    );

    return harden({
      left: inviteMaker.make('left', leftSeat),
      right: inviteMaker.make('right', rightSeat),
    });
  },

  checkAmount: (installation, allegedInviteAmount, expectedTerms, seat) => {
    mustBeSameStructure(allegedInviteAmount.quantity.seatDesc, seat);
    const allegedTerms = allegedInviteAmount.quantity.terms;
    mustBeSameStructure(allegedTerms, expectedTerms, 'Escrow checkAmount');
    mustBeSameStructure(
      allegedInviteAmount.quantity.installation,
      installation,
      'escrow checkAmount installation',
    );
    return true;
  },

  // Check the left or right side, and return the other. Useful when this is a
  // trade of goods for an invite, for example.
  checkPartialAmount: (installation, allegedInvite, expectedTerms, seat) => {
    const allegedSeats = allegedInvite.quantity.terms;
    mustBeSameStructure(
      allegedSeats[seat],
      expectedTerms,
      'Escrow checkPartialAmount seat',
    );

    mustBeSameStructure(
      allegedInvite.quantity.installation,
      installation,
      'escrow checkPartialAmount installation',
    );

    return seat === 'left' ? allegedSeats.right : allegedSeats.left;
  },
});

const escrowExchangeSrcs = harden({
  start: `${escrowExchange.start}`,
  checkAmount: `${escrowExchange.checkAmount}`,
  checkPartialAmount: `${escrowExchange.checkPartialAmount}`,
});

export { escrowExchangeSrcs };
