import harden from '@agoric/harden';

import { insist } from '../../../util/insist';
import makePromise from '../../../util/makePromise';
import { makeEmptyQuantities } from '../contractUtils';

// These utilities are used within Zoe itself. Importantly, there is
// no ambient authority for these utilities. Any authority must be
// passed in, making it easy to see which functions can affect what.

const mintEscrowReceiptPayment = (escrowReceiptMint, offerId, offerDesc) => {
  const escrowReceiptQuantity = harden({
    id: offerId,
    offerMade: offerDesc,
  });
  const escrowReceiptPurse = escrowReceiptMint.mint(escrowReceiptQuantity);
  const escrowReceiptPaymentP = escrowReceiptPurse.withdrawAll();
  return escrowReceiptPaymentP;
};

const mintClaimWinningsPayment = (seatMint, addUseObj, offerDesc, result) => {
  const claimWinningsQuantity = harden({
    id: harden({}),
    offerMade: offerDesc,
  });
  const claimWinningsPurseP = seatMint.mint(claimWinningsQuantity);
  const seat = harden({
    getWinnings: () => result.p,
  });
  addUseObj(claimWinningsQuantity.id, seat);
  const claimWinningsPaymentP = claimWinningsPurseP.withdrawAll();
  return claimWinningsPaymentP;
};

const depositAll = async (purses, strategies, offerDesc, offerPayments) => {
  const quantitiesArrayPromises = purses.map(async (purse, i) => {
    // if the user's contractual understanding includes
    // "haveExactly" or "haveAtMost", make sure that they have supplied a
    // payment with that exact balance
    if (
      offerDesc[i].rule === 'haveExactly' ||
      offerDesc[i].rule === 'haveAtMost'
    ) {
      const amount = await purse.depositExactly(
        offerDesc[i].amount,
        offerPayments[i],
      );
      return amount.quantity;
    }
    return strategies[i].empty();
  });
  const quantitiesArray = Promise.all(quantitiesArrayPromises);
  return quantitiesArray;
};

const escrowOffer = async (
  adminState,
  strategies,
  offerDesc,
  offerPayments,
) => {
  const result = makePromise();

  const quantitiesArray = await depositAll(
    adminState.getPurses(),
    strategies,
    offerDesc,
    offerPayments,
  );

  const offerId = harden({});

  // has side effects
  adminState.recordOffer(offerId, offerDesc, quantitiesArray, result);

  return harden({
    offerId,
    result,
  });
};

const makePayments = (purses, amountsMatrix) =>
  amountsMatrix.map(row =>
    row.map((amount, i) => {
      const payment = purses[i].withdraw(amount, 'payout');
      return payment;
    }),
  );

const escrowEmptyOffer = (adminState, assays) => {
  const result = makePromise();
  const offerDesc = assays.map(assay =>
    harden({
      rule: 'wantAtLeast',
      amount: assay.empty(),
    }),
  );
  const offerId = harden({});

  // has side effects
  adminState.recordOffer(offerId, offerDesc, makeEmptyQuantities(), result);
  return offerId;
};

export {
  makePayments,
  escrowEmptyOffer,
  escrowOffer,
  mintEscrowReceiptPayment,
  mintClaimWinningsPayment,
};
