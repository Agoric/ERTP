import harden from '@agoric/harden';
import { E } from '@agoric/eventual-send';

import { extentOpsLib } from '../../config/extentOpsLib';

const makeState = () => {
  const offerIdToExtents = new WeakMap();
  const offerIdToOfferDescs = new WeakMap();
  const offerIdToResults = new WeakMap();
  const instanceIdToInstance = new WeakMap();
  const instanceIdToLibraryName = new WeakMap();
  const assayToPurse = new WeakMap();
  const instanceIdToDescOps = new WeakMap();
  const instanceIdToExtentOps = new WeakMap();
  const instanceIdToLabels = new WeakMap();
  const instanceIdToAssays = new WeakMap();
  const instanceIdToPurses = new WeakMap();

  const readOnlyState = harden({
    // per instance id
    getAssays: instanceId => instanceIdToAssays.get(instanceId),
    getDescOps: instanceId => instanceIdToDescOps.get(instanceId),
    getExtentOps: instanceId => instanceIdToExtentOps.get(instanceId),
    getLabels: instanceId => instanceIdToLabels.get(instanceId),

    // per offerIds array
    getExtentsFor: offerIds =>
      offerIds.map(offerId => offerIdToExtents.get(offerId)),
    getOfferDescsFor: offerIds =>
      offerIds.map(offerId => offerIdToOfferDescs.get(offerId)),
  });

  // The adminState should never leave Zoe and should be closely held
  const adminState = harden({
    addInstance: async (instanceId, instance, libraryName, assays) => {
      instanceIdToInstance.set(instanceId, instance);
      instanceIdToLibraryName.set(instanceId, libraryName);
      instanceIdToAssays.set(instanceId, assays);

      const descOps = await Promise.all(
        assays.map(assay => E(assay).getDescOps()),
      );
      instanceIdToDescOps.set(instanceId, descOps);

      const extentOps = await Promise.all(
        assays.map(async assay => {
          const { name, args } = await E(assay).getExtentOps();
          return extentOpsLib[name](...args);
        }),
      );
      instanceIdToExtentOps.set(instanceId, extentOps);

      const labels = await Promise.all(
        assays.map(assay => E(assay).getLabel()),
      );
      instanceIdToLabels.set(instanceId, labels);

      const purses = await Promise.all(
        assays.map(assay => adminState.getOrMakePurseForAssay(assay)),
      );
      instanceIdToPurses.set(instanceId, purses);
    },
    getInstance: instanceId => instanceIdToInstance.get(instanceId),
    getLibraryName: instanceId => instanceIdToLibraryName.get(instanceId),
    getPurses: instanceId => instanceIdToPurses.get(instanceId),
    getOrMakePurseForAssay: async assay => {
      if (!assayToPurse.has(assay)) {
        const purse = await E(assay).makeEmptyPurse();
        assayToPurse.set(assay, purse);
      }
      return assayToPurse.get(assay);
    },
    recordOffer: (offerId, offerDesc, extentsForPlayer, result) => {
      offerIdToExtents.set(offerId, extentsForPlayer);
      offerIdToOfferDescs.set(offerId, offerDesc);
      offerIdToResults.set(offerId, result);
    },
    setExtentsFor: (offerIds, reallocation) =>
      offerIds.map((offerId, i) =>
        offerIdToExtents.set(offerId, reallocation[i]),
      ),
    getResultsFor: offerIds =>
      offerIds.map(objId => offerIdToResults.get(objId)),
    removeOffers: offerIds => {
      // has-side-effects
      // eslint-disable-next-line array-callback-return
      offerIds.map(objId => {
        offerIdToExtents.delete(objId);
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
