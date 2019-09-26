import harden from '@agoric/harden';

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

const mintClaimPayoffPayment = (seatMint, addUseObj, offerDesc, result) => {
  const claimPayoffQuantity = harden({
    id: harden({}),
    offerMade: offerDesc,
  });
  const claimPayoffPurseP = seatMint.mint(claimPayoffQuantity);
  const seat = harden({
    getPayoff: () => result.p,
  });
  addUseObj(claimPayoffQuantity.id, seat);
  const claimPayoffPaymentP = claimPayoffPurseP.withdrawAll();
  return claimPayoffPaymentP;
};

const escrowAllPayments = async (
  purses,
  strategies,
  offerDesc,
  offerPayments,
) => {
  const quantitiesArrayPromises = purses.map(async (purse, i) => {
    // if the user's contractual understanding includes
    // "offerExactly" or "offerAtMost", make sure that they have supplied a
    // payment with that exact balance
    if (['offerExactly', 'offerAtMost'].includes(offerDesc[i].rule)) {
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

  const quantitiesArray = await escrowAllPayments(
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

const escrowEmptyOffer = (adminState, assays, strategies) => {
  const result = makePromise();
  const offerDesc = assays.map(assay =>
    harden({
      rule: 'wantAtLeast',
      amount: assay.empty(),
    }),
  );
  const offerId = harden({});

  // has side effects
  adminState.recordOffer(
    offerId,
    offerDesc,
    makeEmptyQuantities(strategies),
    result,
  );
  return offerId;
};

export {
  makePayments,
  escrowEmptyOffer,
  escrowOffer,
  mintEscrowReceiptPayment,
  mintClaimPayoffPayment,
};
