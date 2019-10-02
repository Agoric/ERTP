import harden from '@agoric/harden';
import { E } from '@agoric/eventual-send';

import makePromise from '../../../util/makePromise';
import { insist } from '../../../util/insist';

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
  getOrMakePurseForIssuer,
  offerDesc,
  offerPayments,
) => {
  const quantitiesArrayPromises = offerDesc.map(async (offerDescElement, i) => {
    // if the user's contractual understanding includes
    // "offerExactly" or "offerAtMost", make sure that they have supplied a
    // payment with that exact balance
    if (['offerExactly', 'offerAtMost'].includes(offerDescElement.rule)) {
      const { issuer } = offerDescElement.amount.label;
      const purse = await getOrMakePurseForIssuer(issuer);
      const amount = await E(purse).depositExactly(
        offerDesc[i].amount,
        offerPayments[i],
      );
      return amount.quantity;
    }
    insist(
      offerPayments[i] === undefined,
    )`payment was included, but the rule was ${offerDesc[i].rule}`;
    return undefined;
  });
  return Promise.all(quantitiesArrayPromises);
};

const escrowOffer = async (
  recordOffer,
  getOrMakePurseForIssuer,
  offerDesc,
  offerPayments,
) => {
  const result = makePromise();

  const quantitiesArray = await escrowAllPayments(
    getOrMakePurseForIssuer,
    offerDesc,
    offerPayments,
  );

  const offerId = harden({});

  // has side effects
  recordOffer(offerId, offerDesc, quantitiesArray, result);

  return harden({
    offerId,
    result,
  });
};

const escrowEmptyOffer = (recordOffer, length) => {
  const offerId = harden({});
  const offerDesc = Array(length).fill(undefined);
  const quantitiesArray = Array(length).fill(undefined);
  const result = makePromise();

  // has side effects
  recordOffer(offerId, offerDesc, quantitiesArray, result);

  return harden({
    offerId,
    result,
  });
};

const makePayments = (purses, amountsMatrix) =>
  amountsMatrix.map(row =>
    row.map((amount, i) => E(purses[i]).withdraw(amount, 'payout')),
  );

const fillInUndefinedQuantities = async (
  adminState,
  readOnlyState,
  offerIds,
  instanceId,
) => {
  const [quantities] = readOnlyState.getQuantitiesFor(offerIds);
  const strategies = await Promise.all(readOnlyState.getStrategies(instanceId));
  const filledInQuantities = quantities.map((quantity, i) =>
    quantity === undefined ? strategies[i].empty() : quantity,
  );
  adminState.setQuantitiesFor(offerIds, harden([filledInQuantities]));
};

export {
  makePayments,
  escrowEmptyOffer,
  escrowOffer,
  mintEscrowReceiptPayment,
  mintClaimPayoffPayment,
  fillInUndefinedQuantities,
};
