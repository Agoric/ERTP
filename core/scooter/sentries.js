import harden from '@agoric/harden';
import { insist } from '../../util/insist';

// *********************
// Checkin policies

export const enterAtWill = harden((offerId, enter) => enter(offerId));

export const enterNever = harden((offerId, _enter) => {
  insist(false)`\
Cannot enter ${offerId}`;
});

export const makeEnterSelective = harden(map =>
  harden((offerId, enter) => (map.get(offerId) || enterNever)(offerId, enter)),
);

// TODO async remote timeOracleP, after E becomes safely ambient
export const makeEnterUntil = harden((timeOracle, deadline) =>
  timeOracle.before(deadline) ? enterAtWill : enterNever,
);

// *********************
// Checkout policies

export const leaveAtWill = harden((offerId, leave) => leave(offerId));

export const leaveNever = harden((offerId, _leave) => {
  insist(false)`\
Cannot leave ${offerId}`;
});

export const makeLeaveSelective = harden(map =>
  harden((offerId, leave) => (map.get(offerId) || leaveNever)(offerId, leave)),
);

// TODO async remote timeOracleP, after E becomes safely ambient
export const makeLeaveAfter = (timeOracle, deadline) =>
  timeOracle.after(deadline) ? leaveAtWill : leaveNever;

// *********************
// A sentry has a checkinPolicy and a checkoutPolicy

export const makeSentry = harden(
  (checkinPolicy = enterAtWill, checkoutPolicy = leaveAtWill) =>
    harden({ checkinPolicy, checkoutPolicy }),
);

export const defaultSentry = makeSentry();

export const hotelCalifornia = makeSentry(enterAtWill, leaveNever);
