import { test } from 'tape-promise/tape';

import {
  bothTrue,
  eitherTrue,
  transpose,
  mapArrayOnMatrix,
  offerEqual,
  toAmountMatrix,
  makeEmptyQuantities,
  vectorWith,
} from '../../../../core/zoe/contractUtils';
import { setup } from './setupBasicMints';

test('bothTrue', t => {
  try {
    t.ok([1, 2].reduce(bothTrue));
    t.notOk([false, 2].reduce(bothTrue));
    t.notOk([false, false].reduce(bothTrue));
    t.ok([true, true].reduce(bothTrue));
  } catch (e) {
    t.assert(false, e);
  } finally {
    t.end();
  }
});

test('eitherTrue', t => {
  try {
    t.ok([1, 2].reduce(eitherTrue));
    t.ok([false, 2].reduce(eitherTrue));
    t.notOk([false, false].reduce(eitherTrue));
    t.ok([true, true].reduce(eitherTrue));
  } catch (e) {
    t.assert(false, e);
  } finally {
    t.end();
  }
});

test('transpose', t => {
  try {
    t.deepEquals(transpose([[1, 2, 3], [4, 5, 6]]), [[1, 4], [2, 5], [3, 6]]);
  } catch (e) {
    t.assert(false, e);
  } finally {
    t.end();
  }
});

test('mapArrayOnMatrix', t => {
  try {
    const matrix = [[1, 2, 3], [4, 5, 6]];
    const add2 = x => x + 2;
    const subtract4 = x => x - 4;
    const mult5 = x => x * 5;
    const arrayF = [add2, subtract4, mult5];
    t.deepEquals(mapArrayOnMatrix(matrix, arrayF), [[3, -2, 15], [6, 1, 30]]);
  } catch (e) {
    t.assert(false, e);
  } finally {
    t.end();
  }
});

test('toAmountMatrix', t => {
  try {
    const { assays } = setup();
    const matrix = [[1, 2, 3], [4, 5, 6]];
    t.deepEquals(toAmountMatrix(assays, matrix), [
      [assays[0].make(1), assays[1].make(2), assays[2].make(3)],
      [assays[0].make(4), assays[1].make(5), assays[2].make(6)],
    ]);
  } catch (e) {
    t.assert(false, e);
  } finally {
    t.end();
  }
});

test('makeEmptyQuantities', t => {
  try {
    const { issuers } = setup();
    const strategies = issuers.map(issuer => issuer.getStrategy());
    t.deepEquals(makeEmptyQuantities(strategies), [0, 0, 0]);
  } catch (e) {
    t.assert(false, e);
  } finally {
    t.end();
  }
});

test('offerEqual - offers are equal', t => {
  const { issuers, strategies } = setup();
  try {
    const offer1 = [
      {
        rule: 'offerExactly',
        amount: issuers[0].makeAmount(3),
      },
      {
        rule: 'wantExactly',
        amount: issuers[1].makeAmount(7),
      },
      {
        rule: 'wantExactly',
        amount: issuers[2].makeAmount(7),
      },
    ];
    t.ok(offerEqual(strategies, offer1, offer1));
  } catch (e) {
    t.assert(false, e);
  } finally {
    t.end();
  }
});

test('offerEqual - throws bc offers have different issuers', t => {
  const { issuers, strategies } = setup();
  try {
    const offer1 = [
      {
        rule: 'offerExactly',
        amount: issuers[0].makeAmount(3),
      },
      {
        rule: 'wantExactly',
        amount: issuers[1].makeAmount(7),
      },
      {
        rule: 'wantExactly',
        amount: issuers[2].makeAmount(7),
      },
    ];
    const offer2 = [
      {
        rule: 'offerExactly',
        amount: issuers[1].makeAmount(3),
      },
      {
        rule: 'wantExactly',
        amount: issuers[0].makeAmount(7),
      },
      {
        rule: 'wantExactly',
        amount: issuers[2].makeAmount(7),
      },
    ];
    t.notOk(offerEqual(strategies, offer1, offer2));
  } catch (e) {
    t.assert(false, e);
  } finally {
    t.end();
  }
});

test('offerEqual - returns false bc different quantity', t => {
  const { issuers, strategies } = setup();
  try {
    const offer1 = [
      {
        rule: 'offerExactly',
        amount: issuers[0].makeAmount(3),
      },
      {
        rule: 'wantExactly',
        amount: issuers[1].makeAmount(7),
      },
      {
        rule: 'wantExactly',
        amount: issuers[2].makeAmount(7),
      },
    ];
    const offer2 = [
      {
        rule: 'offerExactly',
        amount: issuers[0].makeAmount(4),
      },
      {
        rule: 'wantExactly',
        amount: issuers[1].makeAmount(7),
      },
      {
        rule: 'wantExactly',
        amount: issuers[2].makeAmount(7),
      },
    ];
    t.notOk(offerEqual(strategies, offer1, offer2));
  } catch (e) {
    t.assert(false, e);
  } finally {
    t.end();
  }
});

test('offerEqual - returns false bc different rule', t => {
  const { issuers, strategies } = setup();
  try {
    const offer1 = [
      {
        rule: 'offerExactly',
        amount: issuers[0].makeAmount(3),
      },
      {
        rule: 'wantExactly',
        amount: issuers[1].makeAmount(7),
      },
      {
        rule: 'wantExactly',
        amount: issuers[2].makeAmount(7),
      },
    ];
    const offer2 = [
      {
        rule: 'offerExactly',
        amount: issuers[0].makeAmount(3),
      },
      {
        rule: 'offerExactly',
        amount: issuers[1].makeAmount(7),
      },
      {
        rule: 'wantExactly',
        amount: issuers[2].makeAmount(7),
      },
    ];
    t.notOk(offerEqual(strategies, offer1, offer2));
  } catch (e) {
    t.assert(false, e);
  } finally {
    t.end();
  }
});

test('offerEqual - wantExactly vs wantAtLeast - returns false', t => {
  const { issuers, strategies } = setup();
  try {
    const offer1 = [
      {
        rule: 'offerExactly',
        amount: issuers[0].makeAmount(3),
      },
      {
        rule: 'wantExactly',
        amount: issuers[1].makeAmount(7),
      },
      {
        rule: 'wantExactly',
        amount: issuers[2].makeAmount(7),
      },
    ];
    const offer2 = [
      {
        rule: 'offerExactly',
        amount: issuers[0].makeAmount(3),
      },
      {
        rule: 'wantExactly',
        amount: issuers[1].makeAmount(7),
      },
      {
        rule: 'wantAtLeast',
        amount: issuers[2].makeAmount(7),
      },
    ];
    t.notOk(offerEqual(strategies, offer1, offer2));
  } catch (e) {
    t.assert(false, e);
  } finally {
    t.end();
  }
});

test('vectorWith', t => {
  try {
    const { strategies } = setup();
    const leftQuantities = [4, 5, 6];
    const rightQuantities = [3, 5, 10];
    t.deepEquals(vectorWith(strategies, leftQuantities, rightQuantities), [
      7,
      10,
      16,
    ]);
  } catch (e) {
    t.assert(false, e);
  } finally {
    t.end();
  }
});
