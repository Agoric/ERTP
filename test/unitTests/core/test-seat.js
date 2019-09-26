import { test } from 'tape-promise/tape';
import harden from '@agoric/harden';

import { makeSeatMint } from '../../../core/seatMint';
import { offerEqual } from '../../../core/zoe/contractUtils';
import { setup } from './zoe/setupBasicMints';
import { insist } from '../../../util/insist';

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

test('seatMint', async t => {
  const { assays } = setup();
  const { seatMint, addUseObj } = makeSeatMint();

  const makeUseObj = quantity => {
    insist(quantity !== null)`the asset is empty or already used`;
    if (quantity.offerToBeMade) {
      return harden({
        makeOffer: offer => {
          insist(offerEqual(assays, offer, quantity.offerToBeMade));
          // do things with the offer
          return true;
        },
      });
    }
    if (quantity.offerMade) {
      return harden({
        claim: () => {
          return [];
        },
      });
    }
    return harden({});
  };

  const purse1Quantity = harden({
    id: harden({}),
    offerToBeMade: [
      { rule: 'offerExactly', amount: assays[0].make(8) },
      { rule: 'wantExactly', amount: assays[1].make(6) },
    ],
  });

  const purse1 = seatMint.mint(purse1Quantity);
  t.deepEqual(purse1.getBalance().quantity, purse1Quantity);
  addUseObj(purse1Quantity.id, makeUseObj(purse1Quantity));

  const useObjPurse1 = await purse1.unwrap();
  // purse1 should be empty at this point. Note that `withdrawAll` doesn't
  // destroy purses; it just empties the balance.
  t.deepEqual(purse1.getBalance().quantity, null);

  t.rejects(purse1.unwrap(), /the purse is empty or already used/);

  t.equal(useObjPurse1.makeOffer(purse1Quantity.offerToBeMade), true);

  const purse2Quantity = harden({
    id: harden({}),
    offerMade: [
      { rule: 'offerExactly', amount: assays[0].make(8) },
      { rule: 'wantExactly', amount: assays[1].make(6) },
    ],
  });

  const purse2 = seatMint.mint(purse2Quantity);
  t.deepEqual(purse2.getBalance().quantity, purse2Quantity);
  addUseObj(purse2Quantity.id, makeUseObj(purse2Quantity));

  const useObjPurse2 = await purse2.unwrap();
  // purse1 should be empty at this point. Note that `withdrawAll` doesn't
  // destroy purses; it just empties the balance.
  t.deepEqual(purse2.getBalance().quantity, null);

  t.rejects(purse2.unwrap(), /the purse is empty or already used/);

  t.deepEqual(useObjPurse2.claim(), []);

  t.end();
});
