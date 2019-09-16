import { test } from 'tape-promise/tape';
import harden from '@agoric/harden';

import { areRightsConserved } from '../../../../core/zoe/areRightsConserved';
import { makeMint } from '../../../../core/issuers';

const setup = () => {
  const moolaMint = makeMint('moola');
  const simoleanMint = makeMint('simoleans');
  const bucksMint = makeMint('bucks');

  const moolaIssuer = moolaMint.getIssuer();
  const simoleanIssuer = simoleanMint.getIssuer();
  const bucksIssuer = bucksMint.getIssuer();

  const moolaAssay = moolaIssuer.getAssay();
  const simoleanAssay = simoleanIssuer.getAssay();
  const bucksAssay = bucksIssuer.getAssay();

  return harden({
    mints: [moolaMint, simoleanMint, bucksMint],
    issuers: [moolaIssuer, simoleanIssuer, bucksIssuer],
    assays: [moolaAssay, simoleanAssay, bucksAssay],
  });
};

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
