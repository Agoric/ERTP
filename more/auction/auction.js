/* global E makePromise */
// Copyright (C) 2019 Agoric, under Apache License 2.0

import harden from '@agoric/harden';
import { mustBeSameStructure } from '../../util/sameStructure';
import { natExtentOps } from '../../core/config/extentOps/natExtentOps';

// A Seller will provide a good to be auctioned and a possibly empty purse to
// show the currency in which bids must be expressed. The Auctioneer will create
// seats which can offer bids. The highest bid will get the Seller's good, and a
// refund of the difference between their bid and the second highest. The lower
// bids will get their money back.
const auction = {
  start: (terms, inviteMaker) => {
    const {
      agencyEscrowInstallationP,
      currencyAssetDesc,
      goodsAssetDesc,
      timerP,
      deadline,
      minBidCount,
      minPrice,
    } = terms;

    const escrowTerms = harden({ currencyAssetDesc, goodsAssetDesc });
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
    const currencyAssay = currencyAssetDesc.label.assay;
    const auctionComplete = makePromise();

    // If bidder is undefined, cancel all Bids, otherwise cancel all but bidder.
    function cancelExcept(bidder) {
      // Cancel entries unless the key matches the argument
      for (const [bidderSeatKey] of agencySeatsP) {
        if (bidder === undefined || bidderSeatKey !== bidder) {
          E(bidderSeatKey).cancel();
        }
      }
    }

    // By analogy with 'strictly greater than': x includes y and is not equal
    function strictlyIncludes(leftAssetDesc, rightAssetDesc) {
      // TODO(hibbert) look up strategy from assay with extentOpsLib
      return (
        natExtentOps.includes(leftAssetDesc, rightAssetDesc) &&
        !natExtentOps.equals(leftAssetDesc, rightAssetDesc)
      );
    }

    E(timerP)
      .delayUntil(deadline)
      .then(() => {
        // hold auction unless too few Bids or minPrice not met
        if (
          bidsReceived < minBidCount ||
          strictlyIncludes(minPrice, secondPrice)
        ) {
          cancelExcept();
          sellerRefund.res(escrowedGoods.p);
          auctionComplete.reject(
            bidsReceived < minBidCount
              ? 'too few bids'
              : 'minimum price not met.',
          );
          return;
        }
        cancelExcept(bestBidderP);
        const bestBidAgencySeatP = agencySeatsP.get(bestBidderP);
        const paidAssetDescP = E(bestBidAgencySeatP).consummateDeal(
          bestPrice,
          secondPrice,
          escrowedGoods.p,
        );
        sellerWinnings.res(E(bestBidAgencySeatP).getWinnings());
        sellerRefund.res();
        paidAssetDescP.then(paidAssetDesc => {
          auctionComplete.res(paidAssetDesc.extent);
        });
      });

    function addNewBid(paymentP, buyerSeatP, agencySeatP) {
      return E(currencyAssay)
        .claimAll(paymentP)
        .then(currencyPaymentP => {
          return E(currencyPaymentP)
            .getBalance()
            .then(assetDesc => {
              const { extent } = assetDesc;
              E(buyerSeatP).offer(currencyPaymentP, escrowTerms);
              bidsReceived += 1;
              if (strictlyIncludes(extent, bestPrice)) {
                bestBidderP = buyerSeatP;
                [bestPrice, secondPrice] = [extent, bestPrice];
              } else if (strictlyIncludes(extent, secondPrice)) {
                secondPrice = extent;
              }
              agencySeatsP.set(buyerSeatP, agencySeatP);
              return extent;
            });
        });
    }

    const bidderMaker = harden({
      // Each call on makeBidderSeat() will return a bidderSeat invite, which
      // allows the holder to make offers and ensures that the money will be
      // returned unless they get the goods.
      makeBidderSeat() {
        const seats = E(agencyEscrowInstallationP).spawn(escrowTerms);
        const agencySeatP = seats.then(pair => pair.agency);
        const buyerSeatP = seats.then(pair => pair.buyer);

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
        return E(goodsAssetDesc.label.assay)
          .claimExactly(goodsAssetDesc, productPayment, 'consignment')
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
  checkInstallation: (
    installation,
    allegedInviteAssetDesc,
    expectedTerms,
    seat,
  ) => {
    mustBeSameStructure(allegedInviteAssetDesc.extent.seatDesc, seat);
    const allegedTerms = allegedInviteAssetDesc.extent.terms;
    mustBeSameStructure(
      allegedTerms,
      expectedTerms,
      'Escrow checkInstallation',
    );
    mustBeSameStructure(
      allegedInviteAssetDesc.extent.installation,
      installation,
      'escrow checkInstallation installation',
    );
    return true;
  },
};
const auctionSrcs = {
  start: `${auction.start}`,
  checkInstallation: `${auction.checkInstallation}`,
};

export { auction, auctionSrcs };
