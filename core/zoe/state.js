import harden from '@agoric/harden';
import { E } from '@agoric/eventual-send';

import { makePrivateName } from '../../util/PrivateName';
import { insist } from '../../util/insist';

import { extentOpsLib } from '../config/extentOpsLib';

// Installation Table
// Columns: installationHandle | installation
const makeInstallationTable = () => {
  // The WeakMap that stores the records
  const handleToRecord = makePrivateName();

  const installationTable = harden({
    // TODO validate installation record
    validate: allegedInstallationRecord => allegedInstallationRecord,
    create: (installationHandle, allegedInstallationRecord) => {
      const installationRecord = installationTable.validate(
        allegedInstallationRecord,
      );
      const newInstallationRecord = harden({
        ...installationRecord,
        installationHandle,
      });
      handleToRecord.init(installationHandle, newInstallationRecord);
      return handleToRecord.get(installationHandle);
    },
    get: handleToRecord.get,
  });

  return installationTable;
};

// Instance Table
// Columns: instanceHandle | installationHandle | instance | terms | assays
const makeInstanceTable = () => {
  // The WeakMap that stores the records
  const handleToRecord = makePrivateName();

  const instanceTable = harden({
    // TODO validate instance record
    validate: allegedInstanceRecord => allegedInstanceRecord,
    create: (instanceHandle, allegedInstanceRecord) => {
      const instanceRecord = instanceTable.validate(allegedInstanceRecord);
      const newInstanceRecord = harden({
        ...instanceRecord,
        instanceHandle,
      });
      handleToRecord.init(instanceHandle, newInstanceRecord);
      return handleToRecord.get(instanceHandle);
    },
    getInstanceRecord: handleToRecord.get,
  });

  return instanceTable;
};

// Offer Table
// Columns: offerHandle | instanceHandle | assays | exitRule | payoutPromise
const makeOfferTable = () => {
  // The WeakMap that stores the records
  const handleToRecord = makePrivateName();

  const insistValidPayoutRuleKinds = payoutRules => {
    const acceptedKinds = ['offer', 'want'];
    for (const payoutRule of payoutRules) {
      insist(
        acceptedKinds.includes(payoutRule.kind),
      )`${payoutRule.kind} must be 'offer' or 'want'`;
    }
  };
  const insistValidExitRule = exitRule => {
    const acceptedExitRuleKinds = [
      'noExit',
      'onDemand',
      'afterDeadline',
      // 'onDemandAfterDeadline', // not yet supported
    ];
    insist(
      acceptedExitRuleKinds.includes(exitRule.kind),
    )`exitRule.kind ${exitRule.kind} is not one of the accepted options`;
  };

  const offerTable = harden({
    // TODO validate offer record
    validate: allegedOfferRecord => {
      insistValidPayoutRuleKinds(allegedOfferRecord.payoutRules);
      insistValidExitRule(allegedOfferRecord.exitRule);
      return allegedOfferRecord;
    },
    create: (offerHandle, allegedOfferRecord) => {
      const offerRecord = offerTable.validate(allegedOfferRecord);
      const newOfferRecord = harden({
        ...offerRecord,
        offerHandle,
      });
      handleToRecord.init(offerHandle, newOfferRecord);
      return handleToRecord.get(offerHandle);
    },
    get: handleToRecord.get,
    delete: handleToRecord.delete,

    // Custom methods below. //
    createUnits: (offerHandle, units) => {
      const offerRecord = handleToRecord.get(offerHandle);
      insist(
        offerRecord.units === undefined,
      )`units must be undefined to be created`;
      offerRecord.units = units;
    },
    updateUnits: (offerHandle, units) => {
      const offerRecord = handleToRecord.get(offerHandle);
      offerRecord.units = units;
    },
    getPayoutRuleMatrix: (offerHandles, _assays) => {
      // Currently, we assume that all of the payoutRules for these
      // offerHandles are in the same order as the `assays` array. In
      // the future, we want to be able to use the offerHandle and assay
      // to select the payoutRule. Note that there may be more than one
      // payoutRule per offerHandle and assay, so (offerHandle, assay)
      // is not unique and cannot be used as a key.
      return offerHandles.map(
        offerHandle => offerTable.get(offerHandle).payoutRules,
      );
    },
    getUnitMatrix: (offerHandles, _assays) =>
      // Currently, we assume that all of the units for these
      // offerHandles are in the same order as the `assays` array. In
      // the future, we want to be able to use the offerHandle and assay
      // to select the unit. Note that there may be more than one
      // payoutRule per offerHandle and assay, so (offerHandle, assay)
      // is not unique and cannot be used as a key.
      offerHandles.map(offerHandle => offerTable.get(offerHandle).units),
    updateUnitMatrix: (offerHandles, _assays, newUnitMatrix) =>
      // Currently, we assume that all of the units for these
      // offerHandles are in the same order as the `assays` array. In
      // the future, we want to be able to use the offerHandle and assay
      // to select the unit. Note that there may be more than one
      // unit per offerHandle and assay, so (offerHandle, assay)
      // is not unique and cannot be used as a key.
      offerHandles.map((offerHandle, i) =>
        offerTable.updateUnits(offerHandle, newUnitMatrix[i]),
      ),
    getOfferStatuses: offerHandles => {
      const active = [];
      const inactive = [];
      for (const offerHandle of offerHandles) {
        if (handleToRecord.has(offerHandle)) {
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
    deleteOffers: offerHandles =>
      offerHandles.map(offerHandle => offerTable.delete(offerHandle)),
  });

  return offerTable;
};

// Assay Table
// Columns: assay | purse | unitOps | label
const makeAssayTable = () => {
  // The WeakMap that stores the records
  const handleToRecord = makePrivateName();

  const assayTable = harden({
    // TODO validate assay record
    validate: allegedAssayRecord => allegedAssayRecord,
    create: (assay, allegedAssayRecord) => {
      const assayRecord = assayTable.validate(allegedAssayRecord);
      const newAssayRecord = harden({
        ...assayRecord,
        assay,
      });
      handleToRecord.init(assay, newAssayRecord);
      return handleToRecord.get(assay);
    },
    get: handleToRecord.get,

    // custom
    getUnitOpsForAssays: assays =>
      assays.map(assay => assayTable.get(assay).unitOps),

    getLabelsForAssays: assays =>
      assays.map(assay => assayTable.get(assay).label),

    getPursesForAssays: assays =>
      assays.map(assay => assayTable.get(assay).purse),

    getOrCreateAssay: assay => {
      const makeExtentOps = (library, extentOpsName, extentOpsArgs) =>
        library[extentOpsName](...extentOpsArgs);

      if (!assayTable.has(assay)) {
        const extentOpsDescP = E(assay).getExtentOps();
        const assayRecord = {
          assay,
          purseP: E(assay).makeEmptyPurse(),
          extentOpsDescP,
          unitOpsP: E(assay).getUnitOps(),
          labelP: E(assay).getLabel(),
          extentOpsP: extentOpsDescP.then(({ name, extentOpArgs = [] }) =>
            makeExtentOps(extentOpsLib, name, extentOpArgs),
          ),
        };
        return assayTable.create(assay, assayRecord);
      }
      return assayTable.get(assay);
    },
  });

  return assayTable;
};

const makeTables = () =>
  harden({
    installationTable: makeInstallationTable(),
    instanceTable: makeInstanceTable(),
    offerTable: makeOfferTable(),
    assayTable: makeAssayTable(),
  });

export { makeTables };
