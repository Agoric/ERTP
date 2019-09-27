import { test } from 'tape-promise/tape';

import {
  bothTrue,
  anyTrue,
  transpose,
  offerEqual,
} from '../../../../core/zoe/utils';
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
    t.throws(() => offerEqual(assays, offer1, offer2), /Unrecognized label/);
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
