import harden from '@agoric/harden';
import { insist } from '../../util/insist';

// *********************
// Checkin policies

export const enterAtWill = harden(_offerId => undefined);

export const cannotEnter = harden(offerId => {
  insist(false)`\
Cannot enter ${offerId}`;
});

export const makeEnterSelective = harden((map, fallback = cannotEnter) =>
  harden(offerId => (map.get(offerId) || fallback)(offerId)),
);

export const makeEnterUntil = harden((E, timeOracleP, deadline) =>
  harden(offerId =>
    E(timeOracleP)
      .now()
      .then(time => (time < deadline ? enterAtWill : cannotEnter)(offerId)),
  ),
);

// *********************
// Checkout policies

export const leaveAtWill = harden(_offerId => undefined);

export const cannotLeave = harden(offerId => {
  insist(false)`\
Cannot leave ${offerId}`;
});

export const makeLeaveSelective = harden((map, fallback = cannotLeave) =>
  harden(offerId => (map.get(offerId) || fallback)(offerId)),
);

export const makeStayUntil = harden((E, timeOracleP, deadline) =>
  harden(offerId =>
    E(timeOracleP)
      .now()
      .then(time => (time < deadline ? cannotLeave : leaveAtWill)(offerId)),
  ),
);

// *********************
// A sentry has a checkinPolicy and a checkoutPolicy

export const makeSentry = harden(
  (checkinPolicy = enterAtWill, checkoutPolicy = leaveAtWill) =>
    harden({ checkinPolicy, checkoutPolicy }),
);

export const defaultSentry = makeSentry();

export const hotelCalifornia = makeSentry(enterAtWill, cannotLeave);
