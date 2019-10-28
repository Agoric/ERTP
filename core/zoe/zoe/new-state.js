import harden from '@agoric/harden';
import { E } from '@agoric/eventual-send';

import { extentOpsLib } from '../../config/extentOpsLib';
import { makePrivateName } from '../../../util/PrivateName';

const makeState = () => {
  const offerHandleToOfferRecord = makePrivateName();
  const makeOfferRecord = offerRules => {
    const offerHandle = harden({});
    const { payoutRules, exitRule } = offerRules;
    const offerRecord = harden({
      offerHandle,
      payoutRules,
      exitRule,
    });
    offerHandleToOfferRecord.init(offerHandle, offerRecord);
    return offerRecord;
  };
  // mutable collections holding only descriptive info
  const offerHandleToExtents = makePrivateName();
  const offerHandleToResult = makePrivateName();
  const offerHandleToInstanceHandle = makePrivateName();
  const activeOffers = new WeakSet();

  const recordOffer = (offerRules, extents, result) => {
    const offerRecord = makeOfferRecord(offerRules);
    const { offerHandle } = offerRecord;
    offerHandleToExtents.init(offerHandle, extents);
    offerHandleToResult.init(offerHandle, result);
    offerHandleToInstanceHandle.init(offerHandle, undefined);
    activeOffers.add(offerHandle);
    return offerRecord;
  };

  const assayToAssayRecord = makePrivateName();
  const makeAssayRecord = (assay, extentOps, label) => {
    const assayRecord = harden({
      assay,
      extentOps,
      label,
    });
    assayToAssayRecord.init(assay, assayRecord);
    return assayRecord;
  };

  const instanceHandleToInstanceRecord = makePrivateName();
  const makeInstanceRecord = (installationHandle, instance, terms, assays) => {
    const instanceHandle = harden({});
    const instanceRecord = harden({
      instanceHandle,
      installationHandle,
      instance,
      terms,
      assays,
      assayRecords: assays.map(assayToAssayRecord.get),
    });
    instanceHandleToInstanceRecord.init(instanceHandle, instanceRecord);
    return instanceRecord;
  };

  const installationHandleToInstallation = makePrivateName();
  const addInstallation = installation => {
    const installationHandle = harden({});
    installationHandleToInstallation.init(installationHandle, installation);
    return installationHandle;
  };

  const readOnlyState = harden({
    // stable
    getOfferRecord: offerHandleToOfferRecord.get,
    getAssayRecord: assayToAssayRecord.get,
    getInstanceRecord: instanceHandleToInstanceRecord.get,
    getInstallation: installationHandleToInstallation.get,

    // readonly view
    getOfferExtents: offerHandleToExtents.get,
    getOfferResult: offerHandleToResult.get,
    getOfferInstance: offerHandleToInstanceHandle.get,
    isOfferActive: offerHandle => activeOffers.has(offerHandle),

    // compat
    getTerms: instanceHandle =>
      instanceHandleToInstanceRecord.get(instanceHandle).terms,
    getAssays: instanceHandle =>
      instanceHandleToInstanceRecord.get(instanceHandle).assays,
    getExtentOpsArrayForInstanceHandle: instanceHandle =>
      readOnlyState
        .getAssays(instanceHandle)
        .map(assay => assayToAssayRecord.get(assay).extentOps),
    getLabelsForInstanceHandle: instanceHandle =>
      readOnlyState
        .getAssays(instanceHandle)
        .map(assay => assayToAssayRecord.get(assay).label),
    getExtentOpsArrayForAssays: assays =>
      assays.map(assay => assayToAssayRecord.get(assay).extentOps),
    getLabelsForAssays: assays =>
      assays.map(assay => assayToAssayRecord.get(assay).extentOps.label),

    getAssaysFor: offerHandles =>
      offerHandles.map(offerHandle =>
        instanceHandleToInstanceRecord.get(
          offerHandleToInstanceHandle.get(offerHandle).assays,
        ),
      ),
    getExtentsFor: offerHandles => offerHandles.map(offerHandleToExtents.get),
    getPayoutRulesFor: offerHandles =>
      offerHandles.map(
        offerHandle => offerHandleToOfferRecord.get(offerHandle).payoutRules,
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

  // holds mutable escrow pool
  const assayToPurse = makePrivateName();

  const recordAssayLater = assayP => {
    const extentOpsDescP = E(assayP).getExtentOps();
    const labelP = E(assayP).getLabel();
    const purseP = E(assayP).makeEmptyPurse();
    return Promise.all([assayP, extentOpsDescP, labelP, purseP]).then(
      ([assay, extentOpsDesc, label, purse]) => {
        const { name, extentOpsArgs = [] } = extentOpsDesc;
        const extentOps = extentOpsLib[name](...extentOpsArgs);
        assayToPurse.init(assay, purse);
        return makeAssayRecord(assay, extentOps, label);
      },
    );
  };

  // The adminState should never leave Zoe and should be closely held
  const adminState = harden({
    readOnly: readOnlyState,
    recordOffer,
    recordAssayLater,
    makeInstanceRecord,
    addInstallation,

    setOfferExtents: offerHandleToExtents.set,
    setOfferResult: offerHandleToResult.set,
    setOfferInstance: offerHandleToInstanceHandle.set,
    dropOffer: offerHandle => activeOffers.delete(offerHandle),

    getPurses: assays => assays.map(assay => assayToPurse.get(assay)),

    setExtentsFor: (offerHandles, reallocation) =>
      offerHandles.map((offerHandle, i) =>
        offerHandleToExtents.set(offerHandle, reallocation[i]),
      ),

    // compat
    getInstallation: installationHandleToInstallation.get,
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
    setOffersAsInactive: offerHandles => {
      offerHandles.map(offerHandle => activeOffers.delete(offerHandle));
    },
  });

  return harden({
    adminState,
    readOnlyState,
  });
};

export { makeState };
