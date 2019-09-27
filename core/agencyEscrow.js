/* global E makePromise */
// Copyright (C) 2019 Agoric, under Apache License 2.0

import harden from '@agoric/harden';
import { mustBeSameStructure } from '../util/sameStructure';

// There are two parties to this transaction. The buyer is offering some amount
// of currency (any fungible good) for a valuable item. The buyer will either
// get the item, and possibly a return of some currency, or will get all their
// offer back. The agency needs to see the offer before deciding whether to
// transact. Only the amount is visible to the agency before an escrow seat is
// received for the transaction.
const agencyEscrow = {
  start: (terms, inviteMaker) => {
    const { left: currencyAmount, right: goodsAmount } = terms;
    const { issuer: goodsIssuer } = goodsAmount.label;

    // We want to give the buyer a promise for the good and for a refund. The
    // refund will resolve either to all the buyer's deposit, or the portion of
    // the deposit that wasn't required. The agency will get an invite for a
    // seat that can ask the amount deposited, and then either cancel or provide
    // an escrow seat with a specific price up to the amount.

    // Buyer's winnings and refund will be resolved if the offer is consummated.
    // If it's cancelled, only refund will be resolved. Winnings will contain
    // the item or nothing. Refund usually contains currency.
    const winnings = makePromise();
    const refund = makePromise();
    // Deposit contains buyer's payment, which is returned via refund if we did
    // not win, or is split between earnings and refund if we did get the goods.
    const deposit = makePromise();

    // This promise will hold the seller's proceeds. It is ignored when this is
    // not the winner's agency. When this seat corresponds to the auction's
    // winner the seller receives funds here.
    const earnings = makePromise();

    const agencySeat = harden({
      // The agency can accept one offer and collect the buyer's price or less.
      // The buyer will receive their winnings through a trusted escrow.
      consummateDeal(bestPrice, secondPrice, goodsPayment) {
        const wonGoodsPayment = E(goodsIssuer).claimAll(goodsPayment, 'wins');
        const { issuer: currencyIssuer } = currencyAmount.label;
        const overbidAmount = E(currencyIssuer).makeAmount(
          bestPrice - secondPrice,
        );
        const secondPriceAmount = E(currencyIssuer).makeAmount(secondPrice);
        return E.resolve(
          Promise.all([deposit.p, overbidAmount, secondPriceAmount]),
        ).then(splitDetails => {
          const [dep, overbidAmt, secondPriceAmt] = splitDetails;
          return E(currencyIssuer)
            .split(dep, [secondPriceAmt, overbidAmt])
            .then(splitPurses => {
              const [proceedsP, overbidP] = splitPurses;
              earnings.res(proceedsP);
              winnings.res(wonGoodsPayment);
              refund.res(overbidP);
              return E(earnings.p).getBalance();
            });
        });
      },
      getWinnings() {
        return earnings.p;
      },
    });

    const buyerSeat = harden({
      // The buyer provides an offer that will be escrowed, then either returned
      // or traded for the desired goods.
      offer(currencyOffer) {
        const { issuer } = currencyAmount.label;
        const escrowedBidP = E(issuer).claimAll(currencyOffer);
        deposit.res(escrowedBidP);
      },
      // a promise for a purse for the goods.
      getWinnings() {
        return winnings.p;
      },
      // a promise for a purse for any returned funds.
      getRefund() {
        return refund.p;
      },
      // The auction cancels losing offers to return the funds
      cancel() {
        winnings.res(E(E(goodsIssuer).makeEmptyPurse()).withdrawAll('empty'));
        refund.res(deposit.p);
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
