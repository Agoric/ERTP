import { test } from 'tape-promise/tape';

import { areRightsConserved } from '../../../../core/zoe/zoe/areRightsConserved';
import { setup } from './setupBasicMints';

// rights are conserved for Nat quantities
test(`areRightsConserved - true for nat quantities`, t => {
  try {
    const { issuers } = setup();
    const strategies = issuers.map(issuer => issuer.getStrategy());
    const oldQuantities = [[0, 1, 0], [4, 1, 0], [6, 3, 0]];
    const newQuantities = [[1, 2, 0], [3, 1, 0], [6, 2, 0]];

    t.ok(areRightsConserved(strategies, oldQuantities, newQuantities));
  } catch (e) {
    t.assert(false, e);
  } finally {
    t.end();
  }
});

// rights are *not* conserved for Nat quantities
test(`areRightsConserved - false for nat quantities`, t => {
  try {
    const { issuers } = setup();
    const strategies = issuers.map(issuer => issuer.getStrategy());
    const oldQuantities = [[0, 1, 4], [4, 1, 0], [6, 3, 0]];
    const newQuantities = [[1, 2, 0], [3, 1, 0], [6, 2, 0]];

    t.notOk(areRightsConserved(strategies, oldQuantities, newQuantities));
  } catch (e) {
    t.assert(false, e);
  } finally {
    t.end();
  }
});

test(`areRightsConserved - empty arrays`, t => {
  try {
    const { issuers } = setup();
    const strategies = issuers.map(issuer => issuer.getStrategy());
    const oldQuantities = [[], [], []];
    const newQuantities = [[], [], []];

    t.ok(areRightsConserved(strategies, oldQuantities, newQuantities));
  } catch (e) {
    t.assert(false, e);
  } finally {
    t.end();
  }
});
