// Copyright (C) 2018 Agoric, under Apache License 2.0

import harden from '@agoric/harden';
import evaluate from '@agoric/evaluate';

import { makeContractHost } from '../../../core/contractHost';

function setup(syscall, state, helpers) {
  return helpers.makeLiveSlots(
    syscall,
    state,
    E =>
      harden({
        makeHost() {
          return harden(makeContractHost(E, evaluate));
        },
      }),
    helpers.vatID,
  );
}
export default harden(setup);
