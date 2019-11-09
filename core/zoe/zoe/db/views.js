import harden from '@agoric/harden';
import { E } from '@agoric/eventual-send';

import { extentOpsLib } from '../../../config/extentOpsLib';
import { makeTables } from './tables';

const makeState = () => {

  const {
    installationTable,
    instanceTable,
    offerTable,
    assayTable,
  } = makeTables();


    
    getExtentOpsArrayForInstanceHandle: instanceHandle => {
      const { assays } = instanceHandleToImmutableInstanceRecord.get(instanceHandle);
      return assays.map(assay => assayToImmutableAssayRecord.get(assay).extentOps);
    },
    getLabelsForInstanceHandle: instanceHandle => {
      const { assays } = instanceHandleToImmutableInstanceRecord.get(instanceHandle);
      return assays.map(assay => assayToImmutableAssayRecord.get(assay).label);
    },
    
    // These methods take in an offerHandle so they can be used in
    // `complete` even for offers that haven't been associated with a
    // smart contract instance
    getExtentOpsArrayForOffer: offerHandle => {
      const { assays } = offerHandleToImmutableOfferRecord.get(offerHandle);
      return assays.map(assay => assayToImmutableAssayRecord.get(assay).extentOps);
    },
    getLabelsForOffer: offerHandle => {
      const { assays } = offerHandleToImmutableOfferRecord.get(offerHandle);
      return assays.map(assay => assayToImmutableAssayRecord.get(assay).extentOps);
    },

    // per offerHandles array
    getAssaysFor: offerHandles =>
      offerHandles.map(
        offerHandle =>
          offerHandleToImmutableOfferRecord.get(offerHandle).assays,
      ),
    getExtentsFor: offerHandles =>
      offerHandles.map(offerHandle => offerHandleToMutableOfferRecord.get(offerHandle).extents,
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
    getPurses: assays => assays.map(assay => assayToPurse.get(assay)),

    // Information that is only created after an escrow receipt has been used
    // up in a smart contract
    recordOfferUsedUp: (offerHandle, instanceHandle) => {
      const mutableOfferRecord = offerHandleToMutableOfferRecord.get(offerHandle);
      mutableOfferRecord.instanceHandle = instanceHandle;
    },
    setExtentsFor: (offerHandles, reallocation) =>
      offerHandles.map((offerHandle, i) =>
        offerHandleToExtents.set(offerHandle, reallocation[i]),
      ),
    getPayoutFor: offerHandles =>
      offerHandles.map(offerHandle => offerHandleToPayout.get(offerHandle)),
   
  });


  return {
    installationTable,
    instanceTable,
    offerTable,
    assayTable,
    getPayoutRulesMatrix,
  };
};

export { makeState };
