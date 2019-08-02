import harden from '@agoric/harden';

import { makeBasicMintController } from './basicMintController';
import { makeNatAssay } from './assays';

const emptyConfig = harden({
  makeCustomPayment(_issuer, _payment) {
    return harden({});
  },
  makeCustomPurse(_issuer, _purse) {
    return harden({});
  },
  makeCustomMint() {
    return harden({});
  },
  makeCustomIssuer(_issuer) {
    return harden({});
  },
});

function makeBasicConfig() {
  return harden({
    ...emptyConfig,
    makeMintController: makeBasicMintController,
    makeAssay: makeNatAssay,
  });
}

export { makeBasicConfig, emptyConfig };
