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
  start: (terms, inviteMaker, minBidCount = 0, minPrice = 0) => {
    const {
      agencyEscrowInstallationP,
      currencyAmount,
      productAmount,
      timerP,
      deadline,
    } = terms;

    E(timerP).tick();
    const escrowTerms = harden({ left: currencyAmount, right: productAmount });
    const escrowedGoods = makePromise();
    const sellerWinnings = makePromise();
    const sellerRefund = makePromise();

    // map from bidderSeats to corresponding agencySeats we can close with.
    const agencySeatsP = new Map();
    let bidderSeatCount = 0;
    let bidsReceived = 0;
    let secondPrice = 0;
    let bestPrice = 0;
    let bestBidder;
    const currencyIssuer = currencyAmount.label.issuer;

    const auctionComplete = makePromise();

    // If bidder is undefined, cancel all Bids, otherwise cancel all but bidder.
    function cancelExcept(bidder) {
      for (const [key] of agencySeatsP) {
        if (bidder === undefined || key !== bidder) {
          E(timerP).tick(`Loser: ${key}`);
          E(agencySeatsP.get(key)).cancel('not a winner');
        }
      }
    }

    E(timerP)
      .delayUntil(deadline)
      .then(() => {
        // hold auction:
        if (bidderSeatCount < minBidCount || secondPrice < minPrice) {
          E(timerP).tick(`Cancelling: not enough bids`);
          cancelExcept();
          sellerRefund.res(escrowedGoods.p);
          auctionComplete.reject('too few bids');
          return;
        }
        cancelExcept(bestBidder);
        const bestBidAgencySeatP = agencySeatsP.get(bestBidder);
        E(timerP).tick(
          `bestBids ${bestPrice}, ${secondPrice}, ${bidderSeatCount}, ${bidsReceived}`,
        );
        const paidAmountP = E(bestBidAgencySeatP).consummateDeal(
          bestPrice,
          secondPrice,
          escrowedGoods.p,
          timerP,
        );
        sellerWinnings.res(E(bestBidAgencySeatP).getWinnings());
        sellerRefund.res(null);
        E.resolve(paidAmountP).then(paidAmount => {
          auctionComplete.res(paidAmount.quantity);
          return E(timerP).tick(`closed Auction at ${paidAmount.quantity}`);
        });
      });

    function addNewBid(paymentP, buyerSeatP, agencySeatP) {
      E(timerP).tick('AUCTION: add bid');
      return E(currencyIssuer)
        .getExclusiveAll(paymentP)
        .then(currencyPaymentP => {
          E(timerP).tick(`AddNewBid`);
          E(currencyPaymentP)
            .getBalance()
            .then(amount => {
              const { quantity } = amount;
              E(buyerSeatP).offer(currencyPaymentP);
              bidsReceived += 1;
              E(timerP).tick(`amount bid ${quantity}`);
              if (quantity > bestPrice) {
                bestBidder = buyerSeatP;
                [bestPrice, secondPrice] = [quantity, bestPrice];
              } else if (quantity > secondPrice) {
                secondPrice = quantity;
              }
              agencySeatsP.set(buyerSeatP, agencySeatP);
              E(timerP).tick('added bidder');
            });
        });
    }

    const bidderMaker = harden({
      // Each call on newBidderSeat() will return a bidderSeat invite, which
      // allows the holder to make offers and ensures that the money won't be
      // taken unless they get the goods.
      newBidderSeat() {
        const seatsP = E(agencyEscrowInstallationP).spawn(escrowTerms);
        E(timerP).tick('newBidderSeat');
        const agencySeatP = seatsP.then(pair =>
          inviteMaker.redeem(pair.agency),
        );
        const buyerSeatP = seatsP.then(pair => inviteMaker.redeem(pair.buyer));

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
        });
        const bidderId = `bidder${bidderSeatCount}`;
        E(timerP).tick('returning new Bidder Invite');
        return inviteMaker.make(bidderId, bidderSeat, `invite for ${bidderId}`);
      },
    });

    // If the second-best price is above the reserve, and the minimum number of
    // bidders was met, then the highest bidder will get the goods, and the
    // seller will be paid the second price. The seller gets the ability to hand
    // out auction seats in response to the offer().
    const sellerSeat = harden({
      offer(productPayment) {
        E(timerP).tick('seller`s offer');
        const pIssuer = productAmount.label.issuer;
        return E(pIssuer)
          .getExclusive(productAmount, productPayment, 'consignment')
          .then(consignment => {
            escrowedGoods.res(consignment);
            E(timerP).tick('consignment');
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
    // TODO assert seat is known.
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
