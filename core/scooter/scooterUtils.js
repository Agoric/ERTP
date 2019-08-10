function isOfferSafe([...assays], description, status) {
  const { offeredSide, offeredAmount, neededSide, neededAmount } = description;

  const { balances } = status;

  const offeredAssay = assays[offeredSide];
  const offeredBalance = balances[offeredSide];
  const refundOk = offeredAssay.includes(offeredBalance, offeredAmount);

  const neededAssay = assays[neededSide];
  const neededBalance = balances[neededSide];
  const winningsOk = neededAssay.includes(neededBalance, neededAmount);

  return refundOk || winningsOk;
}

function areOffersSafe([...assays], [...descriptions], [...statuses]) {
  return Object.entries(descriptions).every(([k, description]) =>
    isOfferSafe(assays, description, statuses[k]),
  );
}

function offerTotals([...assays], [...statuses]) {
  return Object.entries(assays).map(([side, assay]) =>
    statuses.reduce(
      (soFar, status) => assay.with(soFar, status.balances[side]),
      assay.empty(),
    ),
  );
}

function areAmountsConserved([...assays], [...oldStatuses], [...newStatuses]) {
  const oldTotals = offerTotals(assays, oldStatuses);
  const newTotals = offerTotals(assays, newStatuses);
  return Object.entries(assays).every(([side, assay]) =>
    assay.equals(oldTotals[side], newTotals[side]),
  );
}

export { isOfferSafe, areOffersSafe, offerTotals, areAmountsConserved };
