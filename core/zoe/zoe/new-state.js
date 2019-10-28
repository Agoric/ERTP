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
  const registerInstallation = installation => {
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
    isOfferActive: activeOffers.has,

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
    registerInstallation,

    setOfferExtents: offerHandleToExtents.set,
    setOfferResult: offerHandleToResult.set,
    setOfferInstance: offerHandleToInstanceHandle.set,
    dropOffer: activeOffers.delete,

    getPurses: assays => assays.map(assay => assayToPurse.get(assay)),

    setExtentsFor: (offerHandles, reallocation) =>
      offerHandles.map((offerHandle, i) =>
        offerHandleToExtents.set(offerHandle, reallocation[i]),
      ),
  });
  return {
    adminState,
    readOnlyState,
  };
};

export { makeState };
