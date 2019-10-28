import harden from '@agoric/harden';
import { E } from '@agoric/eventual-send';

import { extentOpsLib } from '../../config/extentOpsLib';
import { makePrivateName } from '../../../util/PrivateName';

const makeState = () => {
  const offerHandleToOfferRecord = makePrivateName();
  const makeOfferRecord = (offerRules, instanceHandle) => {
    const offerHandle = harden({});
    const offerRecord = harden({
      offerHandle,
      offerRules,
      instanceHandle,
    });
    offerHandleToOfferRecord.init(offerHandle, offerRecord);
    return offerRecord;
  };

  const assayToAssayRecord = makePrivateName();
  const makeAssayRecord = (assay, extentOps, assetDescOps, label) => {
    const assayRecord = harden({
      assay,
      extentOps,
      assetDescOps,
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
  }

  const readOnlyState = harden({
    getOfferRecord: offerHandleToOfferRecord.get,
    getAssayRecord: assayToAssayRecord.get,
    getInstanceRecord: instanceHandleToInstanceRecord.get,
    getInstallation: installationHandleToInstallation.get,
  });

  // has mutable state
  const activeOffers = new WeakSet();
  const assayToPurse = makePrivateName();

  // The adminState should never leave Zoe and should be closely held
  const adminState = harden({
    readOnly: readOnlyState,
    makeOfferRecord,
    makeAssayRecord,
    makeInstanceRecord,
    registerInstallation,

    registerAssayPurse: assayToPurse.init,
    getPurses: assays => assays.map(assay => assayToPurse.get(assay)),

    recordAssay: async assay => {
      if (!assayToPurse.has(assay)) {
        const assetDescOpsP = E(assay).getAssetDescOps();
        const labelP = E(assay).getLabel();
        const purseP = E(assay).makeEmptyPurse();
        const extentOpsDescP = E(assay).getExtentOps();

        const [assetDescOps, label, purse, extentOpsDesc] = await Promise.all([
          assetDescOpsP,
          labelP,
          purseP,
          extentOpsDescP,
        ]);

        assayToDescOps.init(assay, assetDescOps);
        assayToLabel.init(assay, label);
        assayToPurse.init(assay, purse);
        const { name, extentOpArgs = [] } = extentOpsDesc;
        assayToExtentOps.init(assay, extentOpsLib[name](...extentOpArgs));
      }
      return harden({
        assetDescOps: assayToDescOps.get(assay),
        label: assayToLabel.get(assay),
        purse: assayToPurse.get(assay),
        extentOps: assayToExtentOps.get(assay),
      });
    },
    recordOffer: (offerHandle, offerRules, extents, assays, result) => {
      const { payoutRules, exitRule } = offerRules;
      offerHandleToExtents.init(offerHandle, extents);
      offerHandleToAssays.init(offerHandle, assays);
      offerHandleToPayoutRules.init(offerHandle, payoutRules);
      offerHandleToExitRule.init(offerHandle, exitRule);
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
