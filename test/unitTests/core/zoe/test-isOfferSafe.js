import { test } from 'tape-promise/tape';

import {
  isOfferSafeForPlayer,
  isOfferSafeForAll,
} from '../../../../core/zoe/zoe/isOfferSafe';
import { setup } from './setupBasicMints';

// The player must have rules for each issuer
test('isOfferSafeForPlayer - empty rules', t => {
  try {
    const { assays } = setup();
    const rules = [];
    const amounts = [assays[0].make(8), assays[1].make(6), assays[2].make(7)];

    t.throws(
      _ => isOfferSafeForPlayer(assays, rules, amounts),
      'assays, rules, and amounts must be arrays of the same length',
    );
  } catch (e) {
    t.assert(false, e);
  } finally {
    t.end();
  }
});

// The amounts array must have an item for each issuer/rule
test('isOfferSafeForPlayer - empty amounts', t => {
  try {
    const { assays } = setup();
    const rules = [
      { rule: 'wantExactly', amount: assays[0].make(8) },
      { rule: 'wantExactly', amount: assays[1].make(6) },
      { rule: 'wantExactly', amount: assays[2].make(7) },
    ];
    const amounts = [];

    t.throws(
      _ => isOfferSafeForPlayer(assays, rules, amounts),
      'assays, rules, and amounts must be arrays of the same length',
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
    const { assays } = setup();
    const rules = [
      { rule: 'offerExactly', amount: assays[0].make(8) },
      { rule: 'wantExactly', amount: assays[1].make(6) },
      { rule: 'wantExactly', amount: assays[2].make(7) },
    ];
    const amounts = [assays[0].make(0), assays[1].make(6), assays[2].make(7)];

    t.ok(isOfferSafeForPlayer(assays, rules, amounts));
  } catch (e) {
    t.assert(false, e);
  } finally {
    t.end();
  }
});

// The player gets exactly what they wanted, with no 'have'
test('isOfferSafeForPlayer - gets wantExactly', t => {
  try {
    const { assays } = setup();
    const rules = [
      { rule: 'wantExactly', amount: assays[0].make(8) },
      { rule: 'wantExactly', amount: assays[1].make(6) },
      { rule: 'wantExactly', amount: assays[2].make(7) },
    ];
    const amounts = [assays[0].make(8), assays[1].make(6), assays[2].make(7)];

    t.ok(isOfferSafeForPlayer(assays, rules, amounts));
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
    const { assays } = setup();
    const rules = [
      { rule: 'wantExactly', amount: assays[0].make(8) },
      { rule: 'wantExactly', amount: assays[1].make(6) },
      { rule: 'wantExactly', amount: assays[2].make(7) },
    ];
    const amounts = [assays[0].make(9), assays[1].make(6), assays[2].make(7)];

    t.ok(isOfferSafeForPlayer(assays, rules, amounts));
  } catch (e) {
    t.assert(false, e);
  } finally {
    t.end();
  }
});

// The user gets refunded exactly what they put in, with a 'wantExactly'
test(`isOfferSafeForPlayer - gets offerExactly, doesn't get wantExactly`, t => {
  try {
    const { assays } = setup();
    const rules = [
      { rule: 'offerExactly', amount: assays[0].make(1) },
      { rule: 'wantExactly', amount: assays[1].make(2) },
      { rule: 'offerExactly', amount: assays[2].make(3) },
    ];
    const amounts = [assays[0].make(1), assays[1].make(0), assays[2].make(3)];

    t.ok(isOfferSafeForPlayer(assays, rules, amounts));
  } catch (e) {
    t.assert(false, e);
  } finally {
    t.end();
  }
});

// The user gets refunded exactly what they put in, with no 'wantExactly'
test('isOfferSafeForPlayer - gets offerExactly, no wantExactly', t => {
  try {
    const { assays } = setup();
    const rules = [
      { rule: 'offerExactly', amount: assays[0].make(1) },
      { rule: 'offerExactly', amount: assays[1].make(2) },
      { rule: 'offerExactly', amount: assays[2].make(3) },
    ];
    const amounts = [assays[0].make(1), assays[1].make(2), assays[2].make(3)];

    t.ok(isOfferSafeForPlayer(assays, rules, amounts));
  } catch (e) {
    t.assert(false, e);
  } finally {
    t.end();
  }
});

// The user gets a refund *and* winnings. This is offer safe.
test('isOfferSafeForPlayer - refund and winnings', t => {
  try {
    const { assays } = setup();
    const rules = [
      { rule: 'offerExactly', amount: assays[0].make(2) },
      { rule: 'wantExactly', amount: assays[1].make(3) },
      { rule: 'wantExactly', amount: assays[2].make(3) },
    ];
    const amounts = [assays[0].make(2), assays[1].make(3), assays[2].make(3)];
    t.ok(isOfferSafeForPlayer(assays, rules, amounts));
  } catch (e) {
    t.assert(false, e);
  } finally {
    t.end();
  }
});

// The user gets more than they wanted - wantExactly
test('isOfferSafeForPlayer - more than wantExactly', t => {
  try {
    const { assays } = setup();
    const rules = [
      { rule: 'offerExactly', amount: assays[0].make(2) },
      { rule: 'wantExactly', amount: assays[1].make(3) },
      { rule: 'wantExactly', amount: assays[2].make(4) },
    ];
    const amounts = [assays[0].make(0), assays[1].make(3), assays[2].make(5)];
    t.notOk(isOfferSafeForPlayer(assays, rules, amounts));
  } catch (e) {
    t.assert(false, e);
  } finally {
    t.end();
  }
});

// The user gets more than they wanted - wantAtLeast
test('isOfferSafeForPlayer - more than wantAtLeast', t => {
  try {
    const { assays } = setup();
    const rules = [
      { rule: 'wantAtLeast', amount: assays[0].make(2) },
      { rule: 'wantAtLeast', amount: assays[1].make(3) },
      { rule: 'wantAtLeast', amount: assays[2].make(4) },
    ];
    const amounts = [assays[0].make(2), assays[1].make(6), assays[2].make(4)];
    t.ok(isOfferSafeForPlayer(assays, rules, amounts));
  } catch (e) {
    t.assert(false, e);
  } finally {
    t.end();
  }
});

// The user gets refunded more than what they put in
test('isOfferSafeForPlayer - more than offerExactly', t => {
  try {
    const { assays } = setup();
    const rules = [
      { rule: 'offerExactly', amount: assays[0].make(2) },
      { rule: 'offerExactly', amount: assays[1].make(3) },
      { rule: 'wantExactly', amount: assays[2].make(4) },
    ];
    const amounts = [assays[0].make(5), assays[1].make(6), assays[2].make(8)];
    t.notOk(isOfferSafeForPlayer(assays, rules, amounts));
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
    const { assays } = setup();
    const rules = [
      { rule: 'offerExactly', amount: assays[0].make(2) },
      { rule: 'offerExactly', amount: assays[1].make(3) },
      { rule: 'offerExactly', amount: assays[2].make(4) },
    ];
    const amounts = [assays[0].make(5), assays[1].make(6), assays[2].make(8)];
    t.ok(isOfferSafeForPlayer(assays, rules, amounts));
  } catch (e) {
    t.assert(false, e);
  } finally {
    t.end();
  }
});

// The user gets refunded more than what they put in, with 'offerAtMost'
test('isOfferSafeForPlayer - more than offerAtMost', t => {
  try {
    const { assays } = setup();
    const rules = [
      { rule: 'offerAtMost', amount: assays[0].make(2) },
      { rule: 'offerAtMost', amount: assays[1].make(3) },
      { rule: 'wantExactly', amount: assays[2].make(4) },
    ];
    const amounts = [assays[0].make(5), assays[1].make(3), assays[2].make(0)];
    t.ok(isOfferSafeForPlayer(assays, rules, amounts));
  } catch (e) {
    t.assert(false, e);
  } finally {
    t.end();
  }
});

// The user gets less than what they wanted - wantExactly
test('isOfferSafeForPlayer - less than wantExactly', t => {
  try {
    const { assays } = setup();
    const rules = [
      { rule: 'offerExactly', amount: assays[0].make(2) },
      { rule: 'wantExactly', amount: assays[1].make(3) },
      { rule: 'wantExactly', amount: assays[2].make(5) },
    ];
    const amounts = [assays[0].make(0), assays[1].make(2), assays[2].make(1)];
    t.notOk(isOfferSafeForPlayer(assays, rules, amounts));
  } catch (e) {
    t.assert(false, e);
  } finally {
    t.end();
  }
});

// The user gets less than what they wanted - wantAtLeast
test('isOfferSafeForPlayer - less than wantExactly', t => {
  try {
    const { assays } = setup();
    const rules = [
      { rule: 'offerExactly', amount: assays[0].make(2) },
      { rule: 'wantAtLeast', amount: assays[1].make(3) },
      { rule: 'wantAtLeast', amount: assays[2].make(9) },
    ];
    const amounts = [assays[0].make(0), assays[1].make(2), assays[2].make(1)];
    t.notOk(isOfferSafeForPlayer(assays, rules, amounts));
  } catch (e) {
    t.assert(false, e);
  } finally {
    t.end();
  }
});

// The user gets refunded less than they put in
test('isOfferSafeForPlayer - less than wantExactly', t => {
  try {
    const { assays } = setup();
    const rules = [
      { rule: 'offerExactly', amount: assays[0].make(2) },
      { rule: 'wantAtLeast', amount: assays[1].make(3) },
      { rule: 'wantAtLeast', amount: assays[2].make(3) },
    ];
    const amounts = [assays[0].make(1), assays[1].make(0), assays[2].make(0)];
    t.notOk(isOfferSafeForPlayer(assays, rules, amounts));
  } catch (e) {
    t.assert(false, e);
  } finally {
    t.end();
  }
});

// All users get exactly what they wanted
test('isOfferSafeForAll - get wantExactly', t => {
  try {
    const { assays } = setup();
    const rules = [
      { rule: 'offerExactly', amount: assays[0].make(2) },
      { rule: 'wantExactly', amount: assays[1].make(3) },
      { rule: 'wantExactly', amount: assays[2].make(3) },
    ];

    const offerMatrix = [rules, rules, rules];
    const amounts = [assays[0].make(0), assays[1].make(3), assays[2].make(3)];
    const amountMatrix = [amounts, amounts, amounts];
    t.ok(isOfferSafeForAll(assays, offerMatrix, amountMatrix));
  } catch (e) {
    t.assert(false, e);
  } finally {
    t.end();
  }
});

// One user doesn't get what they wanted
test(`isOfferSafeForAll - get wantExactly - one doesn't`, t => {
  try {
    const { assays } = setup();
    const rules = [
      { rule: 'offerExactly', amount: assays[0].make(2) },
      { rule: 'wantExactly', amount: assays[1].make(3) },
      { rule: 'wantExactly', amount: assays[2].make(3) },
    ];

    const offerMatrix = [rules, rules, rules];
    const amounts = [assays[0].make(0), assays[1].make(3), assays[2].make(3)];
    const unsatisfiedUserAmounts = [
      assays[0].make(0),
      assays[1].make(3),
      assays[2].make(2),
    ];
    const amountMatrix = [amounts, amounts, unsatisfiedUserAmounts];
    t.notOk(isOfferSafeForAll(assays, offerMatrix, amountMatrix));
  } catch (e) {
    t.assert(false, e);
  } finally {
    t.end();
  }
});
