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

    function cancelLosers() {
      for (const bidderSeat of agencySeatsP.keys()) {
        if (bidderSeat !== bestBidder) {
          E(agencySeatsP[bidderSeat]).cancel();
        }
      }
    }

    E(timerP)
      .delayUntil(deadline)
      .then(() => {
        // hold auction:
        if (bidderSeatCount < minBidCount || secondPrice < minPrice) {
          for (const bidderSeat of agencySeatsP.keys()) {
            E(agencySeatsP[bidderSeat]).cancel();
          }
          sellerRefund.res(escrowedGoods.p);
        } else {
          cancelLosers();
          const bestBidAgencySeatP = agencySeatsP.get(bestBidder);
          E(timerP).tick(
            `bestBids ${bestPrice}, ${secondPrice}, ${bidderSeatCount}, ${bidsReceived}`,
          );
          E(timerP).tick(bestBidAgencySeatP);
          E(timerP).tick(bestPrice);
          E(bestBidAgencySeatP).consummateDeal(
            bestPrice,
            secondPrice,
            escrowedGoods.p,
          );
          sellerWinnings.res(E(bestBidAgencySeatP).getWinnings());
          sellerRefund.res(E(bestBidAgencySeatP).getRefund());
        }
      });

    function addNewBid(payment, buyerSeatP, agencySeatP) {
      E(timerP).tick();
      return E(currencyIssuer)
        .getExclusiveAll(payment, 'bid')
        .then(currencyPayment => {
          const amount = currencyPayment.getBalance();
          // E(buyerSeatP).offer(currencyPayment);
          bidsReceived += 1;
          E(timerP).tick(`amount bid ${amount}`);
          if (amount > bestPrice) {
            bestBidder = buyerSeatP;
            [bestPrice, secondPrice] = [amount, bestPrice];
          } else if (amount > secondPrice) {
            secondPrice = amount;
          }
          agencySeatsP.put(buyerSeatP, agencySeatP);
          E(timerP).tick();
        });
    }

    const bidderMaker = harden({
      // Each call on newBidderSeat() will return a bidderSeat invite, which
      // allows the holder to make offers and ensures that the money won't be
      // taken unless they get the goods.
      newBidderSeat() {
        const seatsP = E(agencyEscrowInstallationP).spawn(escrowTerms);
        E(timerP).tick();
        const agencySeatP = seatsP.then(pair =>
          inviteMaker.redeem(pair.agency),
        );
        const buyerSeatP = seatsP.then(pair => inviteMaker.redeem(pair.buyer));

        bidderSeatCount += 1;
        const bidderSeat = harden({
          offer(payment) {
            return addNewBid(payment, buyerSeatP, agencySeatP);
          },
          getWinnings() {
            return E(buyerSeatP).getWinnings();
          },
          getRefund() {
            return E(buyerSeatP).getRefund();
          },
        });
        const bidderId = `bidder${bidderSeatCount}`;
        return inviteMaker.make(bidderId, bidderSeat, `invite for ${bidderId}`);
      },
    });

    // If the second-best price is above the reserve, and the minimum number of
    // bidders was met, then the highest bidder will get the goods, and the
    // seller will be paid the second price. The seller gets the ability to hand
    // out auction seats in response to the offer().
    const sellerSeat = harden({
      offer(productPayment) {
        E(timerP).tick();
        const pIssuer = productAmount.label.issuer;
        return E(pIssuer)
          .getExclusive(productAmount, productPayment, 'consignment')
          .then(prePayment => {
            escrowedGoods.res(prePayment);
            E(timerP).tick();
            return bidderMaker;
          });
      },
      getWinnings() {
        return sellerWinnings.p;
      },
      getRefund() {
        return sellerRefund.p;
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
