import { test } from 'tape-promise/tape';

import { toAmountMatrix } from '../../../../core/zoe/zoe/zoeUtils';
import { setup } from './setupBasicMints';

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
