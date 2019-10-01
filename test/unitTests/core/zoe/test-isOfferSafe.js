import { test } from 'tape-promise/tape';

import {
  isOfferSafeForPlayer,
  isOfferSafeForAll,
} from '../../../../core/zoe/zoe/isOfferSafe';
import { setup } from './setupBasicMints';

// The player must have offerDesc for each issuer
test('isOfferSafeForPlayer - empty offerDesc', t => {
  try {
    const { strategies } = setup();
    const offerDesc = [];
    const quantities = [8, 6, 7];

    t.throws(
      _ => isOfferSafeForPlayer(strategies, offerDesc, quantities),
      'strategies, offerDesc, and quantities must be arrays of the same length',
    );
  } catch (e) {
    t.assert(false, e);
  } finally {
    t.end();
  }
});

// The quantities array must have an item for each issuer/rule
test('isOfferSafeForPlayer - empty quantities', t => {
  try {
    const { strategies, assays } = setup();
    const offerDesc = [
      { rule: 'wantExactly', amount: assays[0].make(8) },
      { rule: 'wantExactly', amount: assays[1].make(6) },
      { rule: 'wantExactly', amount: assays[2].make(7) },
    ];
    const quantities = [];

    t.throws(
      _ => isOfferSafeForPlayer(strategies, offerDesc, quantities),
      'strategies, offerDesc, and quantities must be arrays of the same length',
    );
  } catch (e) {
    t.assert(false, e);
  } finally {
    t.end();
  }
});

// The player puts in something and gets exactly what they wanted,
// with no refund
test('isOfferSafeForPlayer - gets wantExactly, with offerExactly', t => {
  try {
    const { strategies, assays } = setup();
    const offerDesc = [
      { rule: 'offerExactly', amount: assays[0].make(8) },
      { rule: 'wantExactly', amount: assays[1].make(6) },
      { rule: 'wantExactly', amount: assays[2].make(7) },
    ];
    const quantities = [0, 6, 7];

    t.ok(isOfferSafeForPlayer(strategies, offerDesc, quantities));
  } catch (e) {
    t.assert(false, e);
  } finally {
    t.end();
  }
});

// The player gets exactly what they wanted, with no 'have'
test('isOfferSafeForPlayer - gets wantExactly', t => {
  try {
    const { strategies, assays } = setup();
    const offerDesc = [
      { rule: 'wantExactly', amount: assays[0].make(8) },
      { rule: 'wantExactly', amount: assays[1].make(6) },
      { rule: 'wantExactly', amount: assays[2].make(7) },
    ];
    const quantities = [8, 6, 7];

    t.ok(isOfferSafeForPlayer(strategies, offerDesc, quantities));
  } catch (e) {
    t.assert(false, e);
  } finally {
    t.end();
  }
});

// The player gets more than what they wanted, with no 'have'. Note:
// This returns 'true' counterintuitively because no 'have' amount was
// specified and none were given back, so the refund condition was
// fulfilled.
test('isOfferSafeForPlayer - gets wantExactly', t => {
  try {
    const { strategies, assays } = setup();
    const offerDesc = [
      { rule: 'wantExactly', amount: assays[0].make(8) },
      { rule: 'wantExactly', amount: assays[1].make(6) },
      { rule: 'wantExactly', amount: assays[2].make(7) },
    ];
    const quantities = [9, 6, 7];

    t.ok(isOfferSafeForPlayer(strategies, offerDesc, quantities));
  } catch (e) {
    t.assert(false, e);
  } finally {
    t.end();
  }
});

// The user gets refunded exactly what they put in, with a 'wantExactly'
test(`isOfferSafeForPlayer - gets offerExactly, doesn't get wantExactly`, t => {
  try {
    const { strategies, assays } = setup();
    const offerDesc = [
      { rule: 'offerExactly', amount: assays[0].make(1) },
      { rule: 'wantExactly', amount: assays[1].make(2) },
      { rule: 'offerExactly', amount: assays[2].make(3) },
    ];
    const quantities = [1, 0, 3];

    t.ok(isOfferSafeForPlayer(strategies, offerDesc, quantities));
  } catch (e) {
    t.assert(false, e);
  } finally {
    t.end();
  }
});

// The user gets refunded exactly what they put in, with no 'wantExactly'
test('isOfferSafeForPlayer - gets offerExactly, no wantExactly', t => {
  try {
    const { strategies, assays } = setup();
    const offerDesc = [
      { rule: 'offerExactly', amount: assays[0].make(1) },
      { rule: 'offerExactly', amount: assays[1].make(2) },
      { rule: 'offerExactly', amount: assays[2].make(3) },
    ];
    const quantities = [1, 2, 3];

    t.ok(isOfferSafeForPlayer(strategies, offerDesc, quantities));
  } catch (e) {
    t.assert(false, e);
  } finally {
    t.end();
  }
});

// The user gets a refund *and* winnings. This is 'offer safe'.
test('isOfferSafeForPlayer - refund and winnings', t => {
  try {
    const { strategies, assays } = setup();
    const offerDesc = [
      { rule: 'offerExactly', amount: assays[0].make(2) },
      { rule: 'wantExactly', amount: assays[1].make(3) },
      { rule: 'wantExactly', amount: assays[2].make(3) },
    ];
    const quantities = [2, 3, 3];
    t.ok(isOfferSafeForPlayer(strategies, offerDesc, quantities));
  } catch (e) {
    t.assert(false, e);
  } finally {
    t.end();
  }
});

// The user gets more than they wanted - wantExactly
test('isOfferSafeForPlayer - more than wantExactly', t => {
  try {
    const { strategies, assays } = setup();
    const offerDesc = [
      { rule: 'offerExactly', amount: assays[0].make(2) },
      { rule: 'wantExactly', amount: assays[1].make(3) },
      { rule: 'wantExactly', amount: assays[2].make(4) },
    ];
    const quantities = [0, 3, 5];
    t.notOk(isOfferSafeForPlayer(strategies, offerDesc, quantities));
  } catch (e) {
    t.assert(false, e);
  } finally {
    t.end();
  }
});

// The user gets more than they wanted - wantAtLeast
test('isOfferSafeForPlayer - more than wantAtLeast', t => {
  try {
    const { strategies, assays } = setup();
    const offerDesc = [
      { rule: 'wantAtLeast', amount: assays[0].make(2) },
      { rule: 'wantAtLeast', amount: assays[1].make(3) },
      { rule: 'wantAtLeast', amount: assays[2].make(4) },
    ];
    const quantities = [2, 6, 7];
    t.ok(isOfferSafeForPlayer(strategies, offerDesc, quantities));
  } catch (e) {
    t.assert(false, e);
  } finally {
    t.end();
  }
});

// The user gets refunded more than what they put in
test('isOfferSafeForPlayer - more than offerExactly', t => {
  try {
    const { strategies, assays } = setup();
    const offerDesc = [
      { rule: 'offerExactly', amount: assays[0].make(2) },
      { rule: 'offerExactly', amount: assays[1].make(3) },
      { rule: 'wantExactly', amount: assays[2].make(4) },
    ];
    const quantities = [5, 6, 8];
    t.notOk(isOfferSafeForPlayer(strategies, offerDesc, quantities));
  } catch (e) {
    t.assert(false, e);
  } finally {
    t.end();
  }
});

// The user gets refunded more than what they put in, with no
// wantExactly. Note: This returns 'true' counterintuitively
// because no winnings were specified and none were given back.
test('isOfferSafeForPlayer - more than offerExactly, no wants', t => {
  try {
    const { strategies, assays } = setup();
    const offerDesc = [
      { rule: 'offerExactly', amount: assays[0].make(2) },
      { rule: 'offerExactly', amount: assays[1].make(3) },
      { rule: 'offerExactly', amount: assays[2].make(4) },
    ];
    const quantities = [5, 6, 8];
    t.ok(isOfferSafeForPlayer(strategies, offerDesc, quantities));
  } catch (e) {
    t.assert(false, e);
  } finally {
    t.end();
  }
});

// The user gets refunded more than what they put in, with 'offerAtMost'
test('isOfferSafeForPlayer - more than offerAtMost', t => {
  try {
    const { strategies, assays } = setup();
    const offerDesc = [
      { rule: 'offerAtMost', amount: assays[0].make(2) },
      { rule: 'offerAtMost', amount: assays[1].make(3) },
      { rule: 'wantExactly', amount: assays[2].make(4) },
    ];
    const quantities = [5, 3, 0];
    t.ok(isOfferSafeForPlayer(strategies, offerDesc, quantities));
  } catch (e) {
    t.assert(false, e);
  } finally {
    t.end();
  }
});

// The user gets less than what they wanted - wantExactly
test('isOfferSafeForPlayer - less than wantExactly', t => {
  try {
    const { strategies, assays } = setup();
    const offerDesc = [
      { rule: 'offerExactly', amount: assays[0].make(2) },
      { rule: 'wantExactly', amount: assays[1].make(3) },
      { rule: 'wantExactly', amount: assays[2].make(5) },
    ];
    const quantities = [0, 2, 1];
    t.notOk(isOfferSafeForPlayer(strategies, offerDesc, quantities));
  } catch (e) {
    t.assert(false, e);
  } finally {
    t.end();
  }
});

// The user gets less than what they wanted - wantAtLeast
test('isOfferSafeForPlayer - less than wantExactly', t => {
  try {
    const { strategies, assays } = setup();
    const offerDesc = [
      { rule: 'offerExactly', amount: assays[0].make(2) },
      { rule: 'wantAtLeast', amount: assays[1].make(3) },
      { rule: 'wantAtLeast', amount: assays[2].make(9) },
    ];
    const quantities = [0, 2, 1];
    t.notOk(isOfferSafeForPlayer(strategies, offerDesc, quantities));
  } catch (e) {
    t.assert(false, e);
  } finally {
    t.end();
  }
});

// The user gets refunded less than they put in
test('isOfferSafeForPlayer - less than wantExactly', t => {
  try {
    const { strategies, assays } = setup();
    const offerDesc = [
      { rule: 'offerExactly', amount: assays[0].make(2) },
      { rule: 'wantAtLeast', amount: assays[1].make(3) },
      { rule: 'wantAtLeast', amount: assays[2].make(3) },
    ];
    const quantities = [1, 0, 0];
    t.notOk(isOfferSafeForPlayer(strategies, offerDesc, quantities));
  } catch (e) {
    t.assert(false, e);
  } finally {
    t.end();
  }
});

test('isOfferSafeForPlayer - empty arrays', t => {
  try {
    const { strategies } = setup();
    const offerDesc = [];
    const quantities = [];
    t.throws(
      () => isOfferSafeForPlayer(strategies, offerDesc, quantities),
      /strategies, the offer description, and quantities must be arrays of the same length/,
    );
  } catch (e) {
    t.assert(false, e);
  } finally {
    t.end();
  }
});

test('isOfferSafeForPlayer - null for some issuers', t => {
  try {
    const { strategies, assays } = setup();
    const offerDesc = [
      { rule: 'offerExactly', amount: assays[0].make(2) },
      null,
      { rule: 'offerExactly', amount: assays[2].make(4) },
    ];
    const quantities = [5, 6, 8];
    t.ok(isOfferSafeForPlayer(strategies, offerDesc, quantities));
  } catch (e) {
    t.assert(false, e);
  } finally {
    t.end();
  }
});

// All users get exactly what they wanted
test('isOfferSafeForAll - get wantExactly', t => {
  try {
    const { strategies, assays } = setup();
    const offerDesc = [
      { rule: 'offerExactly', amount: assays[0].make(2) },
      { rule: 'wantExactly', amount: assays[1].make(3) },
      { rule: 'wantExactly', amount: assays[2].make(3) },
    ];

    const offerMatrix = [offerDesc, offerDesc, offerDesc];
    const quantities = [0, 3, 3];
    const quantitiesMatrix = [quantities, quantities, quantities];
    t.ok(isOfferSafeForAll(strategies, offerMatrix, quantitiesMatrix));
  } catch (e) {
    t.assert(false, e);
  } finally {
    t.end();
  }
});

// One user doesn't get what they wanted
test(`isOfferSafeForAll - get wantExactly - one doesn't`, t => {
  try {
    const { strategies, assays } = setup();
    const offerDesc = [
      { rule: 'offerExactly', amount: assays[0].make(2) },
      { rule: 'wantExactly', amount: assays[1].make(3) },
      { rule: 'wantExactly', amount: assays[2].make(3) },
    ];

    const offerMatrix = [offerDesc, offerDesc, offerDesc];
    const quantities = [0, 3, 3];
    const unsatisfiedUserquantities = [
      assays[0].make(0),
      assays[1].make(3),
      assays[2].make(2),
    ];
    const quantitiesMatrix = [
      quantities,
      quantities,
      unsatisfiedUserquantities,
    ];
    t.notOk(isOfferSafeForAll(strategies, offerMatrix, quantitiesMatrix));
  } catch (e) {
    t.assert(false, e);
  } finally {
    t.end();
  }
});
