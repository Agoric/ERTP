/* global E makePromise */
// Copyright (C) 2019 Agoric, under Apache License 2.0

import harden from '@agoric/harden';
import { mustBeSameStructure } from '../util/sameStructure';

// A Seller will provide a good to be auctioned and a possibly empty purse to
// show the currency in which bids must be expressed. The Auctioneer will create
// seats which can offer bids. The highest bid will get the Seller's good, and a
// refund of the difference between their bid and the second highest. The lower
// bids will get their money back.
const auction = {
  start: (terms, inviteMaker) => {
    const {
      agencyEscrowInstallationP,
      currencyAmount,
      goodsAmount,
      timerP,
      deadline,
      minBidCount,
      minPrice,
    } = terms;

    const escrowTerms = harden({ currencyAmount, goodsAmount });
    const escrowedGoods = makePromise();
    const sellerWinnings = makePromise();
    const sellerRefund = makePromise();

    // map from bidderSeats to corresponding agencySeats we can close with.
    const agencySeatsP = new Map();
    let bestBidderP;
    let bidderSeatCount = 0;
    let bidsReceived = 0;
    let bestPrice = 0;
    let secondPrice = 0;
    const currencyIssuer = currencyAmount.label.issuer;
    const auctionComplete = makePromise();

    // If bidder is undefined, cancel all Bids, otherwise cancel all but bidder.
    function cancelExcept(bidder) {
      for (const [key] of agencySeatsP) {
        if (bidder === undefined || key !== bidder) {
          E(key).cancel();
        }
      }
    }

    E(timerP)
      .delayUntil(deadline)
      .then(() => {
        // hold auction:
        if (bidsReceived < minBidCount || secondPrice < minPrice) {
          cancelExcept();
          sellerRefund.res(escrowedGoods.p);
          auctionComplete.reject('too few bids');
          return;
        }
        cancelExcept(bestBidderP);
        const bestBidAgencySeatP = agencySeatsP.get(bestBidderP);
        const paidAmountP = E(bestBidAgencySeatP).consummateDeal(
          bestPrice,
          secondPrice,
          escrowedGoods.p,
        );
        sellerWinnings.res(E(bestBidAgencySeatP).getWinnings());
        sellerRefund.res();
        E.resolve(paidAmountP).then(paidAmount => {
          auctionComplete.res(paidAmount.quantity);
        });
      });

    function addNewBid(paymentP, buyerSeatP, agencySeatP) {
      return E(currencyIssuer)
        .claimAll(paymentP)
        .then(currencyPaymentP => {
          return E(currencyPaymentP)
            .getBalance()
            .then(amount => {
              const { quantity } = amount;
              E(buyerSeatP).offer(currencyPaymentP, escrowTerms);
              bidsReceived += 1;
              if (quantity > bestPrice) {
                bestBidderP = buyerSeatP;
                [bestPrice, secondPrice] = [quantity, bestPrice];
              } else if (quantity > secondPrice) {
                secondPrice = quantity;
              }
              agencySeatsP.set(buyerSeatP, agencySeatP);
              return quantity;
            });
        });
    }

    const bidderMaker = harden({
      // Each call on newBidderSeat() will return a bidderSeat invite, which
      // allows the holder to make offers and ensures that the money will be
      // returned unless they get the goods.
      newBidderSeat() {
        const seats = E(agencyEscrowInstallationP).spawn(escrowTerms);
        const agencySeatP = seats.then(pair => inviteMaker.redeem(pair.agency));
        const buyerSeatP = seats.then(pair => inviteMaker.redeem(pair.buyer));

        bidderSeatCount += 1;
        const bidderSeat = harden({
          offer(paymentP) {
            return addNewBid(paymentP, buyerSeatP, agencySeatP);
          },
          getWinnings() {
            return E(buyerSeatP).getWinnings();
          },
          getRefund() {
            return E(buyerSeatP).getRefund();
          },
          // Can the bidder cancel? Not currently.
        });
        const bidderId = `bidder${bidderSeatCount}`;
        return inviteMaker.make(bidderId, bidderSeat, `invite for ${bidderId}`);
      },
    });

    // If the second-best price is above the reserve, and the minimum number of
    // bidders was met, then the highest bidder will get the goods, and the
    // seller will be paid the second price. The seller gets the ability to hand
    // out auction seats in response to the offer.
    const sellerSeat = harden({
      offer(productPayment) {
        return E(goodsAmount.label.issuer)
          .claimExactly(goodsAmount, productPayment, 'consignment')
          .then(consignment => {
            escrowedGoods.res(consignment);
            return bidderMaker;
          });
      },
      getWinnings() {
        return sellerWinnings.p;
      },
      getRefund() {
        return sellerRefund.p;
      },
      getCompletion() {
        return auctionComplete.p;
      },
      // Can the seller cancel? Not currently.
    });

    return inviteMaker.make('writer', sellerSeat, 'writer');
  },

  // Only the bidders need to validate.
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
};
const auctionSrcs = {
  start: `${auction.start}`,
  checkAmount: `${auction.checkAmount}`,
};

export { auction, auctionSrcs };
