import harden from '@agoric/harden';

import { makeSeatConfig } from './config/seatConfig';
import { makeMint } from './mint';

/**
 * `makeSeatMint` creates an instance of the seatMint with an
 * associated WeakMap mapping handles (represented by unique,
 * unforgeable empty objects) to use objects
 */
const makeSeatMint = (description = 'seats') => {
  const handleToSeat = new WeakMap();

  const seatMint = makeMint(description, makeSeatConfig);
  const seatAssay = seatMint.getAssay();

  return harden({
    seatMint,
    seatAssay,
    setSeat: (handle, seat) => handleToSeat.set(handle, seat),
    redeem: payment =>
      seatAssay.burnAll(payment).then(units => {
        return harden({
          seat: handleToSeat.get(units.extent.handle),
          handle: units.extent.handle,
          instanceHandle: units.extent.instanceHandle,
        });
      }),
  });
};

harden(makeSeatMint);

export { makeSeatMint };
