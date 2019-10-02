import harden from '@agoric/harden';

const makeState = () => {
  const offerIdToQuantities = new WeakMap();
  const offerIdToOfferDescs = new WeakMap();
  const offerIdToResults = new WeakMap();
  const instanceIdToInstance = new WeakMap();
  const instanceIdToLibraryName = new WeakMap();
  const issuerToPurse = new WeakMap();
  const instanceIdToAssays = new WeakMap();
  const instanceIdToStrategies = new WeakMap();
  const instanceIdToIssuers = new WeakMap();

  const readOnlyState = harden({
    // per instance id
    getIssuers: instanceId => instanceIdToIssuers.get(instanceId),
    getAssays: instanceId => instanceIdToAssays.get(instanceId),
    getStrategies: instanceId => instanceIdToStrategies.get(instanceId),

    // per offerIds array
    getQuantitiesFor: offerIds =>
      offerIds.map(offerId => offerIdToQuantities.get(offerId)),
    getOfferDescsFor: offerIds =>
      offerIds.map(offerId => offerIdToOfferDescs.get(offerId)),
  });

  // The adminState should never leave Zoe and should be closely held
  const adminState = harden({
    addInstance: (instanceId, instance, libraryName, issuers) => {
      instanceIdToInstance.set(instanceId, instance);
      instanceIdToLibraryName.set(instanceId, libraryName);
      instanceIdToIssuers.set(instanceId, issuers);

      const assays = issuers.map(issuer => issuer.getAssay());
      instanceIdToAssays.set(instanceId, assays);

      const strategies = issuers.map(issuer => issuer.getStrategy());
      instanceIdToStrategies.set(instanceId, strategies);
    },
    getInstance: instanceId => instanceIdToInstance.get(instanceId),
    getLibraryName: instanceId => instanceIdToLibraryName.get(instanceId),
    getPurses: instanceId =>
      readOnlyState
        .getIssuers(instanceId)
        .map(issuer => adminState.getPurseForIssuer(issuer)),
    getPurseForIssuer: issuer => {
      if (!issuerToPurse.has(issuer)) {
        issuerToPurse.set(issuer, issuer.makeEmptyPurse());
      }
      return issuerToPurse.get(issuer);
    },
    recordOffer: (offerId, offerDesc, quantitiesForPlayer, result) => {
      offerIdToQuantities.set(offerId, quantitiesForPlayer);
      offerIdToOfferDescs.set(offerId, offerDesc);
      offerIdToResults.set(offerId, result);
    },
    setQuantitiesFor: (offerIds, reallocation) =>
      offerIds.map((offerId, i) =>
        offerIdToQuantities.set(offerId, reallocation[i]),
      ),
    getResultsFor: offerIds =>
      offerIds.map(objId => offerIdToResults.get(objId)),
    removeOffers: offerIds => {
      // has-side-effects
      // eslint-disable-next-line array-callback-return
      offerIds.map(objId => {
        offerIdToQuantities.delete(objId);
        offerIdToOfferDescs.delete(objId);
        offerIdToResults.delete(objId);
      });
    },
  });
  return {
    adminState,
    readOnlyState,
  };
};

export { makeState };
