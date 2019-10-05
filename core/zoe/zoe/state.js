import harden from '@agoric/harden';
import { E } from '@agoric/eventual-send';

import { strategyLib } from '../../config/strategyLib';

const makeState = () => {
  const offerIdToQuantities = new WeakMap();
  const offerIdToOfferDescs = new WeakMap();
  const offerIdToResults = new WeakMap();
  const instanceIdToInstance = new WeakMap();
  const instanceIdToLibraryName = new WeakMap();
  const issuerToPurse = new WeakMap();
  const instanceIdToAssays = new WeakMap();
  const instanceIdToStrategies = new WeakMap();
  const instanceIdToLabels = new WeakMap();
  const instanceIdToIssuers = new WeakMap();
  const instanceIdToPurses = new WeakMap();

  const readOnlyState = harden({
    // per instance id
    getIssuers: instanceId => instanceIdToIssuers.get(instanceId),
    getAssays: instanceId => instanceIdToAssays.get(instanceId),
    getStrategies: instanceId => instanceIdToStrategies.get(instanceId),
    getLabels: instanceId => instanceIdToLabels.get(instanceId),

    // per offerIds array
    getQuantitiesFor: offerIds =>
      offerIds.map(offerId => offerIdToQuantities.get(offerId)),
    getOfferDescsFor: offerIds =>
      offerIds.map(offerId => offerIdToOfferDescs.get(offerId)),
  });

  // The adminState should never leave Zoe and should be closely held
  const adminState = harden({
    addInstance: async (instanceId, instance, libraryName, issuers) => {
      instanceIdToInstance.set(instanceId, instance);
      instanceIdToLibraryName.set(instanceId, libraryName);
      instanceIdToIssuers.set(instanceId, issuers);

      const assays = await Promise.all(
        issuers.map(issuer => E(issuer).getAssay()),
      );
      instanceIdToAssays.set(instanceId, assays);

      const strategies = await Promise.all(
        issuers.map(async issuer => {
          const strategyName = await E(issuer).getStrategyName();
          return strategyLib[strategyName];
        }),
      );
      instanceIdToStrategies.set(instanceId, strategies);

      const labels = await Promise.all(
        issuers.map(issuer => E(issuer).getLabel()),
      );
      instanceIdToLabels.set(instanceId, labels);

      const purses = await Promise.all(
        issuers.map(issuer => adminState.getOrMakePurseForIssuer(issuer)),
      );
      instanceIdToPurses.set(instanceId, purses);
    },
    getInstance: instanceId => instanceIdToInstance.get(instanceId),
    getLibraryName: instanceId => instanceIdToLibraryName.get(instanceId),
    getPurses: instanceId => instanceIdToPurses.get(instanceId),
    getOrMakePurseForIssuer: async issuer => {
      if (!issuerToPurse.has(issuer)) {
        const purse = await E(issuer).makeEmptyPurse();
        issuerToPurse.set(issuer, purse);
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
