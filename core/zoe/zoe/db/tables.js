import harden from '@agoric/harden';
import { makePrivateName } from '../../../../util/PrivateName';
import { insist } from '../../../../util/insist';

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
    createExtent: (payoutRuleHandle, extent) => {
      const payoutRuleRecord = handleToRecord.get(payoutRuleHandle);
      insist(
        payoutRuleRecord.extent === undefined,
      )`extents must be undefined to be created`;
      payoutRuleRecord.extent = extent;
    },
    updateExtent: (payoutRuleHandle, extent) => {
      // TODO: check offer safety
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
    getExtentMatrix: (offerHandles, _assays) =>
      // Currently, we assume that all of the extents for these
      // offerHandles are in the same order as the `assays` array. In
      // the future, we want to be able to use the offerHandle and assay
      // to select the extent. Note that there may be more than one
      // extent per offerHandle and assay, so (offerHandle, assay)
      // is not unique and cannot be used as a key.
      offerHandles.map(offerHandle => offerTable.get(offerHandle).extents),
      
    setExtentMatrix: (offerHandles, assays, newUnitMatrix) => {

    },
  });

  return offerTable;
};

// Assay Table
// Columns: assay | purse | extentOps | unitOps | label
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
    getUnitOpsArray: assays =>
      assays.map(assay => assayTable.get(assay).unitOps),
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
