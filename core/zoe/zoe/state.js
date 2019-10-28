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
    getTerms: instanceHandle => instanceHandleToTerms.get(instanceHandle),
    getAssays: instanceHandle => instanceHandleToAssays.get(instanceHandle),
    getExtentOpsArrayForInstanceHandle: instanceHandle =>
      readOnlyState.getExtentOpsArrayForAssays(
        readOnlyState.getAssays(instanceHandle),
      ),
    getLabelsForInstanceHandle: instanceHandle =>
      readOnlyState.getLabelsForAssays(readOnlyState.getAssays(instanceHandle)),

    // per assays array (this can be used before an offer is
    // associated with an instance)
    getExtentOpsArrayForAssays: assays =>
      assays.map(assay => assayToExtentOps.get(assay)),
    getLabelsForAssays: assays => assays.map(assay => assayToLabel.get(assay)),

    // per offerHandles array
    getAssaysFor: offerHandles =>
      offerHandles.map(offerHandle => offerHandleToAssays.get(offerHandle)),
    getExtentsFor: offerHandles =>
      offerHandles.map(offerHandle => offerHandleToExtents.get(offerHandle)),
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
      await Promise.all(assays.map(assay => adminState.recordAssay(assay)));
    },
    getInstance: instanceHandle => instanceHandleToInstance.get(instanceHandle),
    getInstallationHandleForInstanceHandle: instanceHandle =>
      instanceHandleToInstallationHandle.get(instanceHandle),
    getPurses: assays => assays.map(assay => assayToPurse.get(assay)),
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
    replaceResult: (offerHandle, newResult) => {
      offerHandleToResult.set(offerHandle, newResult);
    },
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
    getResultsFor: offerHandles =>
      offerHandles.map(offerHandle => offerHandleToResult.get(offerHandle)),
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
