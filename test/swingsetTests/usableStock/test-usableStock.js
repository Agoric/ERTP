import { test } from 'tape-promise/tape';
import path from 'path';
import { buildVatController, loadBasedir } from '@agoric/swingset-vat';

async function main(withSES, basedir, argv) {
  const dir = path.resolve('test/swingsetTests', basedir);
  const config = await loadBasedir(dir);
  const ldSrcPath = require.resolve(
    '@agoric/swingset-vat/src/devices/loopbox-src',
  );
  config.devices = [['loopbox', ldSrcPath, {}]];

  const controller = await buildVatController(config, withSES, argv);
  await controller.run();
  return controller.dump();
}

// Alice holds one share of a stock. A stock has two uses - vote() and
// claimCashDividends() -> cash. Voting and claimingCashDividends can
// only be called once. There are two different designs possible:
// 1) the stock cannot be used when it is in escrow, except by the
//    escrow agent, who may pass on whatever use benefits exist to
//    whomever they want (for example, they may send the cash
//    dividends back to alice, or they could keep it, or not claim it
//    at all, depending on what the escrow code says)
// 2) the escrow agent could give back a childPayment to Alice, which
//    she could use while the stock is still in escrow.

// She wants to be able to put the stock
// in escrow and still be able to use it. This will not work with our
// current implementation, where if the stock is escrowed (the escrow
// agent does a getExclusive), the use rights that alice has a
// reference to no longer have an underlying asset. We could have an
// escrow agent that gives a childPayment back, from which Alice can
// derive a use object that is one level down from what she previously
// had. She can then call both vote() and claimCashDividends().

const useEscrowedStock = [
  '=> setup called',
  '++ bob.useEscrowedStock starting',
  '++ alice.acceptInvite starting',
  'alice invite balance {"label":{"issuer":{},"description":"contract host"},"quantity":{"installation":{},"terms":{"putUpCash":{"label":{"issuer":{},"description":"cash"},"quantity":10},"putUpStock":{"label":{"issuer":{},"description":"Tyrell"},"quantity":[1,2]}},"seatIdentity":{},"seatDesc":"putUpCash"}}',
  'verified invite balance {"label":{"issuer":{},"description":"contract host"},"quantity":{"installation":{},"terms":{"putUpCash":{"label":{"issuer":{},"description":"cash"},"quantity":10},"putUpStock":{"label":{"issuer":{},"description":"Tyrell"},"quantity":[1,2]}},"seatIdentity":{},"seatDesc":"putUpCash"}}',
  ' 2 vote(s) have been cast with position yea',
  'bob\'s cash dividend balance {"label":{"issuer":{},"description":"cash"},"quantity":14}',
  'bob\'s cash purse balance {"label":{"issuer":{},"description":"cash"},"quantity":1015}',
  'bob escrow wins: {"label":{"issuer":{},"description":"cash"},"quantity":10} refs: null',
  'alice escrow wins: {"label":{"issuer":{},"description":"Tyrell"},"quantity":[1,2]} refs: null',
  '++ bob.useEscrowedStock done',
  'bob\'s cash purse balance {"label":{"issuer":{},"description":"cash"},"quantity":1025}',
];

test('usableStock: useEscrowedStock with SES', async t => {
  const dump = await main(true, 'usableStock', ['useEscrowedStock']);
  t.deepEquals(dump.log, useEscrowedStock);
  t.end();
});

test.only('usableStock: useEscrowedStock without SES', async t => {
  const dump = await main(false, 'usableStock', ['useEscrowedStock']);
  t.deepEquals(dump.log, useEscrowedStock);
  t.end();
});
