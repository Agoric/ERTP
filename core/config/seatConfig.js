import harden from '@agoric/harden';
import { passStyleOf } from '@agoric/marshal';

import { noCustomization } from './noCustomization';
import { makeCoreMintKeeper } from './coreMintKeeper';
import { insist } from '../../util/insist';

const insistSeat = seat => {
  const properties = Object.getOwnPropertyNames(seat);
  // The `handle` is how the use object will be looked up
  insist(properties.includes('handle'))`must include 'handle'`;
  insist(
    passStyleOf(seat.handle) === 'presence' &&
      Object.entries(seat.handle).length === 0 &&
      seat.handle.constructor === Object,
  )`handle should be an empty object`;
  insist(passStyleOf(seat) === 'copyRecord')`seat should be a record`;
  return seat;
};

function makeSeatConfig() {
  return harden({
    ...noCustomization,
    makeMintKeeper: makeCoreMintKeeper,
    extentOpsName: 'uniExtentOps',
    extentOpsArgs: [insistSeat],
  });
}

export { makeSeatConfig };
