import harden from '@agoric/harden';
import { E } from '@agoric/eventual-send';

import { extentOpsLib } from '../../config/extentOpsLib';
import { makePrivateName } from '../../../util/PrivateName';

const makeState = () => {
  const offerHandleToExtents = makePrivateName();
  const offerHandleToAssays = makePrivateName();
  const offerHandleToPayoutRules = makePrivateName();
  const offerHandleToExitRule = makePrivateName();
  const offerHandleToResult = makePrivateName();
  const offerHandleToInstanceHandle = makePrivateName();

  const activeOffers = new WeakSet();

  const instanceHandleToInstallationHandle = makePrivateName();
  const instanceHandleToInstance = makePrivateName();
  const instanceHandleToTerms = makePrivateName();
  const instanceHandleToAssays = makePrivateName();

  const assayToPurse = makePrivateName();
  const assayToExtentOps = makePrivateName();
  const assayToLabel = makePrivateName();

  const installationHandleToInstallation = makePrivateName();

  const readOnlyState = harden({
    // per instanceHandle
    getTerms: instanceHandleToTerms.get,
    getAssays: instanceHandleToAssays.get,
    getExtentOpsArrayForInstanceHandle: instanceHandle =>
      readOnlyState.getExtentOpsArrayForAssays(
        readOnlyState.getAssays(instanceHandle),
      ),
    getLabelsForInstanceHandle: instanceHandle =>
      readOnlyState.getLabelsForAssays(readOnlyState.getAssays(instanceHandle)),

    // per assays array (this can be used before an offer is
    // associated with an instance)
    getExtentOpsArrayForAssays: assays => assays.map(assayToExtentOps.get),
    getLabelsForAssays: assays => assays.map(assayToLabel.get),

    // per offerHandles array
    getAssaysFor: offerHandles => offerHandles.map(offerHandleToAssays.get),
    getExtentsFor: offerHandles => offerHandles.map(offerHandleToExtents.get),
    getPayoutRulesFor: offerHandles =>
      offerHandles.map(offerHandle =>
        offerHandleToPayoutRules.get(offerHandle),
      ),
    getStatusFor: offerHandles => {
      const active = [];
      const inactive = [];
      for (const offerHandle of offerHandles) {
        if (activeOffers.has(offerHandle)) {
          active.push(offerHandle);
        } else {
          inactive.push(offerHandle);
        }
      }
      return harden({
        active,
        inactive,
      });
    },
  });

  // The adminState should never leave Zoe and should be closely held
  const adminState = harden({
    addInstallation: installation => {
      const installationHandle = harden({});
      installationHandleToInstallation.init(installationHandle, installation);
      return installationHandle;
    },
    getInstallation: installationHandle =>
      installationHandleToInstallation.get(installationHandle),
    addInstance: async (
      instanceHandle,
      instance,
      installationHandle,
      terms,
      assays,
    ) => {
      instanceHandleToInstance.init(instanceHandle, instance);
      instanceHandleToInstallationHandle.init(
        instanceHandle,
        installationHandle,
      );
      instanceHandleToTerms.init(instanceHandle, terms);
      instanceHandleToAssays.init(instanceHandle, assays);
      await Promise.all(assays.map(adminState.recordAssay));
    },
    getInstance: instanceHandleToInstance.get,
    getInstallationHandleForInstanceHandle:
      instanceHandleToInstallationHandle.get,
    getPurses: assays => assays.map(assayToPurse.get),
    recordAssay: async assay => {
      if (!assayToPurse.has(assay)) {
        const labelP = E(assay).getLabel();
        const purseP = E(assay).makeEmptyPurse();
        const extentOpsDescP = E(assay).getExtentOps();

        const [label, purse, extentOpsDesc] = await Promise.all([
          labelP,
          purseP,
          extentOpsDescP,
        ]);

        assayToLabel.init(assay, label);
        assayToPurse.init(assay, purse);
        const { name, extentOpArgs = [] } = extentOpsDesc;
        assayToExtentOps.init(assay, extentOpsLib[name](...extentOpArgs));
      }
      return harden({
        label: assayToLabel.get(assay),
        purse: assayToPurse.get(assay),
        extentOps: assayToExtentOps.get(assay),
      });
    },
    recordOffer: (offerHandle, offerRules, extents, assays, result) => {
      const { payoutRules, exit } = offerRules;
      offerHandleToExtents.init(offerHandle, extents);
      offerHandleToAssays.init(offerHandle, assays);
      offerHandleToPayoutRules.init(offerHandle, payoutRules);
      offerHandleToExitRule.init(offerHandle, exit);
      offerHandleToResult.init(offerHandle, result);
      activeOffers.add(offerHandle);
    },
    replaceResult: offerHandleToResult.set,
    recordUsedInInstance: (instanceHandle, offerHandle) =>
      offerHandleToInstanceHandle.init(offerHandle, instanceHandle),
    getInstanceHandleForOfferHandle: offerHandle => {
      if (offerHandleToInstanceHandle.has(offerHandle)) {
        return offerHandleToInstanceHandle.get(offerHandle);
      }
      return undefined;
    },
    setExtentsFor: (offerHandles, reallocation) =>
      offerHandles.map((offerHandle, i) =>
        offerHandleToExtents.set(offerHandle, reallocation[i]),
      ),
    getResultsFor: offerHandles => offerHandles.map(offerHandleToResult.get),
    removeOffers: offerHandles => {
      // has-side-effects
      // eslint-disable-next-line array-callback-return
      offerHandles.map(offerHandle => {
        offerHandleToExtents.delete(offerHandle);
        offerHandleToAssays.delete(offerHandle);
        offerHandleToPayoutRules.delete(offerHandle);
        offerHandleToExitRule.delete(offerHandle);
        offerHandleToResult.delete(offerHandle);
        if (offerHandleToInstanceHandle.has(offerHandle)) {
          offerHandleToInstanceHandle.delete(offerHandle);
        }
      });
    },
    setOffersAsInactive: offerHandles => {
      offerHandles.map(offerHandle => activeOffers.delete(offerHandle));
    },
  });
  return {
    adminState,
    readOnlyState,
  };
};

export { makeState };
