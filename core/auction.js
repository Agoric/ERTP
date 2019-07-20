/* global E */
// Copyright (C) 2019 Agoric, under Apache License 2.0

import harden from '@agoric/harden';
import { mustBeSameStructure } from '../util/sameStructure';

// A Seller will provide a good to be auctioned and a possibly empty purse to
// show the currency in which bids must be expressed. The Auctioneer will create
// seats which can offer bids. The highest bid will get the Seller's good, and a
// refund of the difference between their bid and the second highest. The lower
// bids will get their money back.
const auction = {
  start: (terms, inviteMaker, minBidCount, minPrice) => {
    const {
      agencyEscrowInstallationP,
      currencyAmount,
      productAmount,
      timerP,
      deadline,
    } = terms;

    E(timerP).tick();
    const escrowTerms = harden({ left: currencyAmount, right: productAmount });
    // Create an escrow for the final exchange. The winning bidder's bid will
    // be submitted to the buyer's side, while the auctioneer will fulfill the
    // seller's role.
    const escrowSeatsP = E(agencyEscrowInstallationP).spawn(escrowTerms);
    // The goods the seller offers will be submitted to the escrow. The proceeds
    // will be directly wired to the seller's role.
    const offerSeatP = E.resolve(escrowSeatsP).then(seats => {
      const { buyer: buyerSeat } = seats;
      return inviteMaker.redeem(buyerSeat);
    });

    // map from bidderSeats to corresponding agencySeats we can close with.
    const bidderSeats = new Map();
    let bidderSeatCount = 0;
    let secondPrice = 0;
    let bestPrice = 0;
    let bestBidder;
    const currencyIssuer = currencyAmount.label.issuer;

    function cancelAll() {
      E(offerSeatP).cancel();
      for (const seat of bidderSeats.keys()) {
        seat.cancel(bidderSeats.get(seat));
      }
    }

    function cancelLosers() {
      for (const seat of bidderSeats.keys()) {
        if (seat !== bestBidder) {
          seat.cancel(bidderSeats.get(seat));
        }
      }
    }

    E(timerP)
      .delayUntil(deadline)
      .then(() => {
        // hold auction:
        if (bidderSeatCount < minBidCount || secondPrice < minPrice) {
          cancelAll();
        } else {
          cancelLosers();
        }
        bidderSeats.get(bestBidder).consummateDeal(secondPrice, offerSeatP);
      });

    function addNewBid(payment, bidderSeatP, agencySeatP) {
      E(timerP).tick();
      return E(currencyIssuer)
        .getExclusiveAll(payment, 'bid')
        .then(currency => {
          const amount = currency.getAmount();
          if (amount > bestPrice) {
            bestBidder = bidderSeatP;
            [bestPrice, secondPrice] = [amount, bestPrice];
          } else if (amount > secondPrice) {
            secondPrice = amount;
          }
          bidderSeats.put(bidderSeatP, agencySeatP);
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
        const agencySeatP = E.resolve(seatsP).then(pair =>
          inviteMaker.redeem(pair.agency),
        );
        const bidderSeatP = E.resolve(seatsP).then(pair =>
          inviteMaker.redeem(pair.buyer),
        );

        bidderSeatCount += 1;
        const bidderSeat = harden({
          offer(payment) {
            E(timerP).tick();
            return addNewBid(payment, bidderSeatP, agencySeatP);
          },
          getWinnings() {
            return E(bidderSeatP).getWinnings();
          },
          getRefund() {
            return E(bidderSeatP).getRefund();
          },
        });
        E(timerP).tick();
        return inviteMaker.make(`bidder${bidderSeatCount}`, bidderSeat);
      },
    });

    // Peter is the seller. If the second-best price is above the reserve, and
    // the minimum number of bidders was met, then the highest bidder will get the
    // goods, and the seller will be paid the second price. The seller gets the
    // ability to hand out auction seats in response to the offer().
    const peterSeat = harden({
      offer(productPayment) {
        const pIssuer = productAmount.label.issuer;
        return E(pIssuer)
          .getExclusive(productAmount, productPayment, 'consignment')
          .then(prePayment => {
            E(offerSeatP).offer(prePayment);
            E(timerP).tick();
            return bidderMaker;
          });
      },
      getWinnings() {
        return E(offerSeatP).getWinnings();
      },
      getRefund() {
        return E(offerSeatP).getRefund();
      },
    });

    return inviteMaker.make('writer', peterSeat);
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
};
const auctionSrcs = {
  start: `${auction.start}`,
  checkAmount: `${auction.checkAmount}`,
};

export { auction, auctionSrcs };
