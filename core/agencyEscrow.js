/* global E makePromise */
// Copyright (C) 2019 Agoric, under Apache License 2.0

import harden from '@agoric/harden';
import { mustBeSameStructure } from '../util/sameStructure';

// There are two parties to this transaction. The buyer is offering some amount
// of currency for a valuable item. The buyer will either get the item, and
// possibly a return of some currency, or will get all their offer back. The
// agency needs to see the offer before making their determination. Only the
// amount is visible to the agency before an escrow seat is received for the
// transaction.
const agencyEscrow = {
  start: (terms, inviteMaker) => {
    const { left: currencyAmount, right: goodsAmount } = terms;

    // We want to give the buyer a promise for the good, and for a refund. The
    // refund will resolve either to all the buyer's deposit, or the portion of
    // the deposit that wasn't required. The agency will get an invite for a
    // seat that can ask the amount deposited, and then either cancel or provide
    // an escrow seat with a specific price up to the amount.

    // Buyer's winnings and refund will be resolved if the offer is consummated.
    // If it's cancelled, only refund will be resolved. Winnings will contain
    // the item or nothing. Refund contains currency or nothing.
    const winnings = makePromise();
    const buyerRefund = makePromise();

    // Deposit contains buyer's payment, which goes to seller or is returned.
    const deposit = makePromise();

    // Seats

    // This promise will hold the seller's proceeds. It is ignored when this is
    // not the winner's agency. When it is for the winner, the promise is
    // resolved for the seller.
    const earnings = makePromise();
    const sellerRefund = makePromise();

    const agencySeat = harden({
      // The agency cancels losing offers to return the funds
      cancel(label = '') {
        winnings.reject(`no deal W:${label}`);
        earnings.reject(`no deal E:${label}`);
        buyerRefund.res(deposit.p);
      },
      // The agency can accept one offer and collect the buyer's price or less.
      // The buyer will receive their winnings through a trusted escrow.
      consummateDeal(bestPrice, secondPrice, goodsPayment, timerP) {
        const { issuer: goodsIssuer } = goodsAmount.label;
        E(timerP).tick('consummate');

        const wonGoodsPayment = E(goodsIssuer).getExclusiveAll(
          goodsPayment,
          'wins',
        );
        const { issuer: currencyIssuer } = currencyAmount.label;
        const overbidP = E(currencyIssuer)
          .makeAmount(bestPrice - secondPrice)
          .then(overbidAmount =>
            E(currencyIssuer).getExclusive(overbidAmount, deposit.p, 'overbid'),
          );
        const proceedsP = E(currencyIssuer)
          .makeAmount(secondPrice)
          .then(secondPriceAmount =>
            E(currencyIssuer).getExclusive(
              secondPriceAmount,
              deposit.p,
              'seller gains',
            ),
          );
        return E.resolve(
          Promise.all([wonGoodsPayment, proceedsP, overbidP]),
        ).then(
          outPurses => {
            const [
              wonGoodsPaymentP,
              proceedsPaymentP,
              overbidPaymentP,
            ] = outPurses;
            E(timerP).tick('assigning purses');
            earnings.res(proceedsPaymentP);
            winnings.res(wonGoodsPaymentP);
            buyerRefund.res(overbidPaymentP);
            E(timerP).tick(
              `goods: ${wonGoodsPaymentP.getBalance()}, proceeds: ${proceedsPaymentP.getBalance()}, overbid: ${overbidPaymentP.getBalance()}`,
            );
            return E(earnings.p).getBalance();
          },
          rej => {
            E(timerP).tick(`cancel agency: unable to get goods: ${rej}`);
            return agencySeat.cancel("couldn't get goods");
          },
        );
      },
      getWinnings() {
        return earnings.p;
      },
      getRefund() {
        return sellerRefund.p;
      },
    });

    const buyerSeat = harden({
      // The buyer provides an offer that will be escrowed, then either returned
      // or traded for the desired goods.
      offer(currencyOffer) {
        const { issuer } = currencyAmount.label;
        const escrowedBidP = E(issuer).getExclusiveAll(currencyOffer);
        deposit.res(escrowedBidP);
      },
      // a promise for a purse for the goods.
      getWinnings() {
        return winnings.p;
      },
      // a promise for a purse for any returned funds.
      getRefund() {
        return buyerRefund.p;
      },
    });

    return harden({
      agency: inviteMaker.make('agency', agencySeat),
      buyer: inviteMaker.make('buyer', buyerSeat),
    });
  },

  checkAmount: (installation, allegedInviteAmount, expectedTerms, seat) => {
    mustBeSameStructure(allegedInviteAmount.quantity.seatDesc, seat);
    const allegedTerms = allegedInviteAmount.quantity.terms;
    mustBeSameStructure(
      allegedTerms,
      expectedTerms,
      'AgencyEscrow checkAmount',
    );
    mustBeSameStructure(
      allegedInviteAmount.quantity.installation,
      installation,
      'escrow checkAmount installation',
    );
    return true;
  },
};

const agencyEscrowSrcs = {
  start: `${agencyEscrow.start}`,
  checkAmount: `${agencyEscrow.checkAmount}`,
};

export { agencyEscrowSrcs };
