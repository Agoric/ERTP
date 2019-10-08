/* global E makePromise */
// Copyright (C) 2019 Agoric, under Apache License 2.0

import harden from '@agoric/harden';
import { natExtentOps } from '../../core/config/extentOps/natExtentOps';

// There are two parties to this transaction. The buyer is offering some amount
// of currency (any fungible good) for a valuable item. The buyer will either
// get the item, and possibly a return of some currency, or will get all their
// offer back. The agency needs to see the offer before deciding whether to
// transact. Only the extent is visible to the agency before an escrow seat is
// received for the transaction.
const agencyEscrow = {
  start: terms => {
    const { currencyAssetDesc, goodsAssetDesc } = terms;
    const { assay: goodsAssay } = goodsAssetDesc.label;

    // We want to give the buyer a promise for the good and for a refund. The
    // refund will resolve either to all the buyer's deposit, or the portion of
    // the deposit that wasn't required. The agency will get a seat that can ask
    // for the extent deposited, and then either cancel or provide an escrow
    // seat with a specific price up to that extent.

    // Buyer's winnings and refund will be resolved if the offer is consummated.
    // If it is cancelled, only refund will be resolved. Winnings will contain
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
      consummateDeal(originalOffer, finalPrice, goodsPayment) {
        const wonGoodsPayment = E(goodsAssay).claimAll(goodsPayment, 'wins');
        const { assay: currencyAssayP } = currencyAssetDesc.label;
        // TODO(hibbert) look up extentOps from assay with extentOpsLib
        const overbid = natExtentOps.without(originalOffer, finalPrice);
        const overbidAssetDescP = E(currencyAssayP).makeAssetDesc(overbid);
        const finalPriceAssetDescP = E(currencyAssayP).makeAssetDesc(
          finalPrice,
        );
        return Promise.all([
          deposit.p,
          overbidAssetDescP,
          finalPriceAssetDescP,
        ]).then(splitDetails => {
          const [dep, overbidAssetDesc, finalPriceAssetDesc] = splitDetails;
          return E(currencyAssayP)
            .split(dep, [finalPriceAssetDesc, overbidAssetDesc])
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
        const { assay } = currencyAssetDesc.label;
        const escrowedBidP = E(assay).claimAll(currencyOffer);
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
        winnings.res(E(E(goodsAssay).makeEmptyPurse()).withdrawAll('empty'));
        refund.res(deposit.p);
      },
    });

    return harden({
      agency: agencySeat,
      buyer: buyerSeat,
    });
  },
};

const agencyEscrowSrcs = { start: `${agencyEscrow.start}` };

export { agencyEscrowSrcs };
