import harden from '@agoric/harden';
import { E } from '@agoric/eventual-send';

import makePromise from '../../../util/makePromise';
import { insist } from '../../../util/insist';

// These utilities are used within Zoe itself. Importantly, there is
// no ambient authority for these utilities. Any authority must be
// passed in, making it easy to see which functions can affect what.

const escrowEmptyOffer = (recordOffer, assays, labels, extentOpsArray) => {
  const offerHandle = harden({});
  const payoutRules = labels.map((label, i) =>
    harden({
      kind: 'wantAtLeast',
      units: {
        label,
        extent: extentOpsArray[i].empty(),
      },
    }),
  );
  const offerRules = harden({
    payoutRules,
    exitRule: {
      kind: 'onDemand',
    },
  });
  const extents = extentOpsArray.map(extentOps => extentOps.empty());
  const payoutPromise = makePromise();

  // has side effects
  recordOffer(offerHandle, offerRules, extents, assays, payoutPromise);

  return harden({
    offerHandle,
    payout: payoutPromise.p,
  });
};

const makePayments = (purses, unitsMatrix) => {
  const paymentPromisesMatrix = unitsMatrix.map(row => {
    const paymentPromises = row.map((units, i) =>
      E(purses[i]).withdraw(units, 'payout'),
    );
    return paymentPromises;
  });
  return paymentPromisesMatrix;
};

// an array of empty extents per extentOps
const makeEmptyExtents = extentOpsArray =>
  extentOpsArray.map(extentOps => extentOps.empty());

const makeUnits = (extentOps, label, allegedExtent) => {
  extentOps.insistKind(allegedExtent);
  return harden({
    label,
    extent: allegedExtent,
  });
};

// Transform a extentsMatrix to a matrix of units given an array
// of the associated unitOps.
const toUnitsMatrix = (extentOps, labels, extentsMatrix) =>
  extentsMatrix.map(extents =>
    extents.map((extent, i) => makeUnits(extentOps[i], labels[i], extent)),
  );

// Note: offerHandles must be for the same assays.
const completeOffers = (adminState, readOnlyState, offerHandles) => {
  const { inactive } = readOnlyState.getStatusFor(offerHandles);
  if (inactive.length > 0) {
    throw new Error('offer has already completed');
  }
  adminState.setOffersAsInactive(offerHandles);
  const [assays] = readOnlyState.getAssaysFor(offerHandles);
  const extents = readOnlyState.getExtentsFor(offerHandles);
  const extentOps = readOnlyState.getExtentOpsArrayForAssays(assays);
  const labels = readOnlyState.getLabelsForAssays(assays);
  const units = toUnitsMatrix(extentOps, labels, extents);
  const purses = adminState.getPurses(assays);
  const paymentPromisesMatrix = makePayments(purses, units);
  const payoutPromisesMatrix = adminState.getPayoutPromisesFor(offerHandles);
  payoutPromisesMatrix.map((payoutPromisesArray, i) =>
    payoutPromisesArray.map((payoutPromise, j) =>
      payoutPromise.resolve(paymentPromisesMatrix[i][j]),
    ),
  );
  adminState.removeOffers(offerHandles);
};

const getAssaysFromPayoutRules = payoutRules =>
  payoutRules.map(payoutRule => payoutRule.units.label.assay);

export {
  escrowEmptyOffer,
  completeOffers,
  makeEmptyExtents,
  toUnitsMatrix,
  getAssaysFromPayoutRules,
};
