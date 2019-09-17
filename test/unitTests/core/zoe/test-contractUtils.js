import { test } from 'tape-promise/tape';

import {
  allTrue,
  anyTrue,
  transpose,
  mapArrayOnMatrix,
  offerEqual,
  toAmountMatrix,
  makeEmptyQuantities,
} from '../../../../core/zoe/contractUtils';
import { setup } from './setupBasicMints';

test('allTrue', t => {
  try {
    t.ok([1, 2].reduce(allTrue));
    t.notOk([false, 2].reduce(allTrue));
    t.notOk([false, false].reduce(allTrue));
    t.ok([true, true].reduce(allTrue));
  } catch (e) {
    t.assert(false, e);
  } finally {
    t.end();
  }
});

test('anyTrue', t => {
  try {
    t.ok([1, 2].reduce(anyTrue));
    t.ok([false, 2].reduce(anyTrue));
    t.notOk([false, false].reduce(anyTrue));
    t.ok([true, true].reduce(anyTrue));
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
  const { issuers, assays } = setup();
  try {
    const offer1 = [
      {
        rule: 'haveExactly',
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
    t.ok(offerEqual(assays, offer1, offer1));
  } catch (e) {
    t.assert(false, e);
  } finally {
    t.end();
  }
});

test('offerEqual - throws bc offers have different issuers', t => {
  const { issuers, assays } = setup();
  try {
    const offer1 = [
      {
        rule: 'haveExactly',
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
        rule: 'haveExactly',
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
    // This throws because the assay does not recognize the amounts
    // for a different issuer
    t.throws(() => offerEqual(assays, offer1, offer2), /Unrecognized amount/);
  } catch (e) {
    t.assert(false, e);
  } finally {
    t.end();
  }
});

test('offerEqual - returns false bc different quantity', t => {
  const { issuers, assays } = setup();
  try {
    const offer1 = [
      {
        rule: 'haveExactly',
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
        rule: 'haveExactly',
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
    t.notOk(offerEqual(assays, offer1, offer2));
  } catch (e) {
    t.assert(false, e);
  } finally {
    t.end();
  }
});

test('offerEqual - returns false bc different rule', t => {
  const { issuers, assays } = setup();
  try {
    const offer1 = [
      {
        rule: 'haveExactly',
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
        rule: 'haveExactly',
        amount: issuers[0].makeAmount(3),
      },
      {
        rule: 'haveExactly',
        amount: issuers[1].makeAmount(7),
      },
      {
        rule: 'wantExactly',
        amount: issuers[2].makeAmount(7),
      },
    ];
    t.notOk(offerEqual(assays, offer1, offer2));
  } catch (e) {
    t.assert(false, e);
  } finally {
    t.end();
  }
});

test('offerEqual - wantExactly vs wantAtLeast - returns false', t => {
  const { issuers, assays } = setup();
  try {
    const offer1 = [
      {
        rule: 'haveExactly',
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
        rule: 'haveExactly',
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
    t.notOk(offerEqual(assays, offer1, offer2));
  } catch (e) {
    t.assert(false, e);
  } finally {
    t.end();
  }
});
