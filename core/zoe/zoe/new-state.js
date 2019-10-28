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

  const createOfferRecord = (offerRules, extents, result) => {
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
    getInstallationHandleForInstanceHandle: instanceHandle =>
      instanceHandleToInstanceRecord.get(instanceHandle).installationHandle,
    getInstanceHandleForOfferHandle: offerHandleToInstanceHandle.get,
  });

  // holds mutable escrow pool
  const assayToPurse = makePrivateName();

  const recordAssayLater = assayP => {
    const extentOpsDescP = E(assayP).getExtentOps();
    const labelP = E(assayP).getLabel();
    const purseP = E(assayP).makeEmptyPurse();
    return Promise.all([assayP, extentOpsDescP, labelP, purseP]).then(
      ([assay, extentOpsDesc, label, purse]) => {
        if (assayToAssayRecord.has(assay)) {
          return assayToAssayRecord.get(assay);
        }
        const { name, extentOpsArgs = [] } = extentOpsDesc;
        const extentOps = extentOpsLib[name](...extentOpsArgs);
        assayToPurse.init(assay, purse);
        return makeAssayRecord(assay, extentOps, label);
      },
    );
  };

  // The adminState should never leave Zoe and should be closely held
  const adminState = harden({
    createOfferRecord,
    recordAssayLater,
    makeInstanceRecord,
    addInstallation,

    setOfferExtents: offerHandleToExtents.set,
    getOfferResult: offerHandleToResult.get,
    setOfferResult: offerHandleToResult.set,
    setOfferInstance: offerHandleToInstanceHandle.set,
    dropOffer: offerHandle => activeOffers.delete(offerHandle),

    getPurses: assays => assays.map(assay => assayToPurse.get(assay)),

    setExtentsFor: (offerHandles, reallocation) =>
      offerHandles.map((offerHandle, i) =>
        offerHandleToExtents.set(offerHandle, reallocation[i]),
      ),

    // compat
    addInstance: (
      instanceHandle,
      instance,
      installationHandle,
      terms,
      assays,
    ) =>
      // TODO BUG: instanceHandle inside or outside
      Promise.all(assays.map(recordAssayLater)).then(_ =>
        makeInstanceRecord(installationHandle, instance, terms, assays),
      ),
    recordAssay: recordAssayLater,
    recordOffer: (offerHandle, offerRules, extents, assays, result) =>
      // TODO BUG offerHandle inside or outside?
      createOfferRecord(offerRules, extents, result),
    replaceResult: offerHandleToResult.set,
    recordUsedInInstance: (instanceHandle, offerHandle) =>
      offerHandleToInstanceHandle.set(offerHandle, instanceHandle),
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
