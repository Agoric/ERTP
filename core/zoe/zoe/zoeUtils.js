import harden from '@agoric/harden';
import { E } from '@agoric/eventual-send';

import makePromise from '../../../util/makePromise';
import { insist } from '../../../util/insist';

// These utilities are used within Zoe itself. Importantly, there is
// no ambient authority for these utilities. Any authority must be
// passed in, making it easy to see which functions can affect what.

const mintEscrowReceiptPayment = (escrowReceiptMint, offerId, offerDesc) => {
  const escrowReceiptExtent = harden({
    id: offerId,
    offerMade: offerDesc,
  });
  const escrowReceiptPurse = escrowReceiptMint.mint(escrowReceiptExtent);
  const escrowReceiptPaymentP = escrowReceiptPurse.withdrawAll();
  return escrowReceiptPaymentP;
};

const mintClaimPayoffPayment = (seatMint, addUseObj, offerDesc, result) => {
  const claimPayoffExtent = harden({
    id: harden({}),
    offerMade: offerDesc,
  });
  const claimPayoffPurseP = seatMint.mint(claimPayoffExtent);
  const seat = harden({
    getPayoff: () => result.p,
  });
  addUseObj(claimPayoffExtent.id, seat);
  const claimPayoffPaymentP = claimPayoffPurseP.withdrawAll();
  return claimPayoffPaymentP;
};

const escrowAllPayments = async (
  getOrMakePurseForAssay,
  offerDesc,
  offerPayments,
) => {
  const extentsArrayPromises = offerDesc.map(async (offerDescElement, i) => {
    // if the user's contractual understanding includes
    // "offerExactly" or "offerAtMost", make sure that they have supplied a
    // payment with that exact balance
    if (['offerExactly', 'offerAtMost'].includes(offerDescElement.rule)) {
      const { assay } = offerDescElement.assetDesc.label;
      const purse = await getOrMakePurseForAssay(assay);
      const assetDesc = await E(purse).depositExactly(
        offerDesc[i].assetDesc,
        offerPayments[i],
      );
      return assetDesc.extent;
    }
    insist(
      offerPayments[i] === undefined,
    )`payment was included, but the rule was ${offerDesc[i].rule}`;
    return undefined;
  });
  return Promise.all(extentsArrayPromises);
};

const escrowOffer = async (
  recordOffer,
  getOrMakePurseForAssay,
  offerDesc,
  offerPayments,
) => {
  const result = makePromise();

  const extentsArray = await escrowAllPayments(
    getOrMakePurseForAssay,
    offerDesc,
    offerPayments,
  );

  const offerId = harden({});

  // has side effects
  recordOffer(offerId, offerDesc, extentsArray, result);

  return harden({
    offerId,
    result,
  });
};

const escrowEmptyOffer = (recordOffer, length) => {
  const offerId = harden({});
  const offerDesc = Array(length).fill(undefined);
  const extentsArray = Array(length).fill(undefined);
  const result = makePromise();

  // has side effects
  recordOffer(offerId, offerDesc, extentsArray, result);

  return harden({
    offerId,
    result,
  });
};

const makePayments = (purses, assetDescsMatrix) => {
  const paymentsMatrix = assetDescsMatrix.map(row => {
    const payments = Promise.all(
      row.map((assetDesc, i) => E(purses[i]).withdraw(assetDesc, 'payout')),
    );
    return payments;
  });
  return Promise.all(paymentsMatrix);
};

const fillInUndefinedExtents = async (
  adminState,
  readOnlyState,
  offerIds,
  instanceId,
) => {
  const [extents] = readOnlyState.getExtentsFor(offerIds);
  const extentOps = await Promise.all(readOnlyState.getExtentOps(instanceId));
  const filledInExtents = extents.map((extent, i) =>
    extent === undefined ? extentOps[i].empty() : extent,
  );
  adminState.setExtentsFor(offerIds, harden([filledInExtents]));
};

export {
  makePayments,
  escrowEmptyOffer,
  escrowOffer,
  mintEscrowReceiptPayment,
  mintClaimPayoffPayment,
  fillInUndefinedExtents,
};
