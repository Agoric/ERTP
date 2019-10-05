import harden from '@agoric/harden';
import { passStyleOf } from '@agoric/marshal';

import { insist } from '../../../util/insist';
import { makeUniStrategy } from './uniStrategy';

/*
 * A seat quantity may look like:
 *
 * {
 *   id: {},
 *   offerToBeMade: [rule1, rule2],
 * }
 *
 * or:
 *
 * {
 *   id: {},
 *   offerMade: [rule1, rule2],
 * }
 *
 */

const insistSeat = seat => {
  const properties = Object.getOwnPropertyNames(seat);
  insist(
    properties.length === 2,
  )`must have the properties 'id', and 'offerToBeMade' or 'offerMade'`;
  insist(properties.includes('id'))`must include 'id'`;
  insist(
    properties.includes('offerToBeMade') || properties.includes('offerMade'),
  )`must include 'offerToBeMade' or 'offerMade'`;
  insist(
    passStyleOf(seat.id) === 'presence' &&
      Object.entries(seat.id).length === 0 &&
      seat.id.constructor === Object,
  )`id should be an empty object`;
  insist(
    passStyleOf(seat.offerToBeMade) === 'copyArray' ||
      passStyleOf(seat.offerMade) === 'copyArray',
  )`an offer should be an array`;
  return seat;
};

const seatStrategy = makeUniStrategy(insistSeat);
harden(seatStrategy);

export { seatStrategy };
