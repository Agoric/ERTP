import harden from '@agoric/harden';
import { E } from '@agoric/eventual-send';

import { extentOpsLib } from '../../config/extentOpsLib';

const makeState = () => {
  const offerIdToExtents = new WeakMap();
  const offerIdToAssays = new WeakMap();
  const offerIdToOfferDesc = new WeakMap();
  const offerIdToExitCondition = new WeakMap();
  const offerIdToResults = new WeakMap();
  const offerIdToInstanceId = new WeakMap();

  const instanceIdToInstallationId = new WeakMap();
  const instanceIdToInstance = new WeakMap();
  const instanceIdToArgs = new WeakMap();
  const instanceIdToAssays = new WeakMap();

  const assayToPurse = new WeakMap();
  const assayToExtentOps = new WeakMap();
  const assayToDescOps = new WeakMap();
  const assayToLabel = new WeakMap();

  const installationIdToInstallation = new WeakMap();
  const installationToInstallationId = new WeakMap();

  const readOnlyState = harden({
    // per instance id
    getArgs: instanceId => instanceIdToArgs.get(instanceId),
    getAssays: instanceId => instanceIdToAssays.get(instanceId),

    // per instanceId
    getDescOpsArrayForInstanceId: instanceId =>
      readOnlyState
        .getAssays(instanceId)
        .map(assay => assayToDescOps.get(assay)),
    getExtentOpsArrayForInstanceId: instanceId =>
      readOnlyState
        .getAssays(instanceId)
        .map(assay => assayToExtentOps.get(assay)),
    getLabelsForInstanceId: instanceId =>
      readOnlyState.getAssays(instanceId).map(assay => assayToLabel.get(assay)),

    // per assays array (this can be used before an offer is
    // associated with an instance)
    getDescOpsArrayForAssays: assays =>
      assays.map(assay => assayToDescOps.get(assay)),
    getExtentOpsArrayForAssays: assays =>
      assays.map(assay => assayToExtentOps.get(assay)),
    getLabelsForAssays: assays => assays.map(assay => assayToLabel.get(assay)),

    // per offerIds array
    getAssaysFor: offerIds =>
      offerIds.map(offerId => offerIdToAssays.get(offerId)),
    getExtentsFor: offerIds =>
      offerIds.map(offerId => offerIdToExtents.get(offerId)),
    getOfferDescsFor: offerIds =>
      offerIds.map(offerId => offerIdToOfferDesc.get(offerId)),

    // per offerId
    isOfferIdActive: offerId => offerIdToInstanceId.has(offerId),
  });

  // The adminState should never leave Zoe and should be closely held
  const adminState = harden({
    addInstallation: installation => {
      const installationId = harden({});
      installationToInstallationId.set(installation, installationId);
      installationIdToInstallation.set(installationId, installation);
      return installationId;
    },
    getInstallation: installationId =>
      installationIdToInstallation.get(installationId),
    addInstance: async (instanceId, instance, installationId, assays, args) => {
      instanceIdToInstance.set(instanceId, instance);
      instanceIdToInstallationId.set(instanceId, installationId);
      instanceIdToAssays.set(instanceId, assays);
      instanceIdToArgs.set(instanceId, args);
      await Promise.all(
        assays.map(async assay => adminState.recordAssay(assay)),
      );
    },
    getInstance: instanceId => instanceIdToInstance.get(instanceId),
    getInstallationIdForInstanceId: instanceId =>
      instanceIdToInstallationId.get(instanceId),
    getPurses: assays => assays.map(assay => assayToPurse.get(assay)),
    recordAssay: async assay => {
      if (!assayToPurse.has(assay)) {
        assayToDescOps.set(assay, await E(assay).getDescOps());
        assayToLabel.set(assay, await E(assay).getLabel());
        assayToPurse.set(assay, await E(assay).makeEmptyPurse());
        const { name, extentOpArgs = [] } = await E(assay).getExtentOps();
        assayToExtentOps.set(assay, extentOpsLib[name](...extentOpArgs));
      }

      return harden({
        descOps: assayToDescOps.get(assay),
        label: assayToLabel.get(assay),
        purse: assayToPurse.get(assay),
        extentOps: assayToExtentOps.get(assay),
      });
    },
    recordOffer: (offerId, conditions, extents, assays, result) => {
      const { offerDesc, exit } = conditions;
      offerIdToExtents.set(offerId, extents);
      offerIdToAssays.set(offerId, assays);
      offerIdToOfferDesc.set(offerId, offerDesc);
      offerIdToExitCondition.set(offerId, exit);
      offerIdToResults.set(offerId, result);
    },
    replaceResult: (offerId, newResult) => {
      // check exists first before replacing
      if (!offerIdToResults.has(offerId)) {
        throw new Error('offerId not found. Offer may have completed');
      }
      offerIdToResults.set(offerId, newResult);
    },
    recordUsedInInstance: (instanceId, offerId) => {
      if (offerIdToInstanceId.has(offerId)) {
        throw new Error('offer id was already used');
      }
      offerIdToInstanceId.set(offerId, instanceId);
    },
    getInstanceIdForOfferId: offerId => offerIdToInstanceId.get(offerId),
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
        offerIdToOfferDesc.delete(objId);
        offerIdToExitCondition.delete(objId);
        offerIdToResults.delete(objId);
        offerIdToInstanceId.delete(objId);
      });
    },
  });
  return {
    adminState,
    readOnlyState,
  };
};

export { makeState };
