/* global E */
// Copyright (C) 2019 Agoric, under Apache License 2.0

import harden from '@agoric/harden';

// A Seller will provide a good to be auctioned and a possibly empty purse to
// show the currency in which bids must be expressed. The Auctioneer will create
// seats which can offer bids. The highest bid will get the Seller's good, and a
// refund of the difference between their bid and the second highest. The lower
// bids will get their money back.

// Caveats:
// The buyers want to know that there isn't a shill for the seller.
// The buyers want assurances that their bids are secret. Hard on public chains.
// The Auctioneer might want a cut before returning the proceeds to the seller.
// Notice that the auctioneer doesn't reveal the winner's bid.
function auction(terms, inviteMaker, minBidCount, minPrice) {
  const [
    escrowExchangeInstallationP,
    agencyEscrowInstallationP,
    currencyAmount,
    productAmount,
    timerP,
    deadline,
  ] = terms;

  const escrowTerms = harden({ left: currencyAmount, right: productAmount });
  // Create an escrow for the final exchange. The winner bidder's bid will
  // be submitted to the buyer's side, while the auctioneer will fulfill the
  // seller's role.
  const escrowSeatsP = E(escrowExchangeInstallationP).spawn(escrowTerms);
  // The goods the seller offers will be submitted to the escrow. The proceeds
  // will be directly wired to the seller's role.
  const offerSeatP = E.resolve(escrowSeatsP).then(pair =>
    inviteMaker.redeem(pair.right),
  );

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
      }
      cancelLosers();
      bidderSeats.get(bestBidder).consummateDeal(secondPrice, offerSeatP);
    });

  function addNewBid(payment, bidderSeatP, agencySeatP) {
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
      });
  }

  const bidderMaker = harden({
    // Each call on newBidderSeat() will return a bidderSeat invite, which
    // allows the holder to make offers and ensures that the money won't be
    // taken unless they get the goods.
    newBidderSeat() {
      const seatsP = E(agencyEscrowInstallationP).spawn(escrowTerms);
      const agencySeatP = E.resolve(seatsP).then(pair =>
        inviteMaker.redeem(pair.agency),
      );
      const bidderSeatP = E.resolve(seatsP).then(pair =>
        inviteMaker.redeem(pair.buyer),
      );

      bidderSeatCount += 1;
      const bidderSeat = harden({
        offer(payment) {
          return addNewBid(payment, bidderSeatP, agencySeatP);
        },
        getWinnings() {
          return E(bidderSeatP).getWinnings();
        },
        getRefund() {
          return E(bidderSeatP).getRefund();
        },
      });
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
}

const auctionSrc = `(${auction})`;

export { auction, auctionSrc };
