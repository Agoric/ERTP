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

// Alice holds three shares of a stock and bob holds two shares. A
// stock has two uses - vote() and claimCashDividends() -> cash. The
// stock cannot be used when it is in escrow, except by the escrow
// agent, who can pass along access to the use rights while the
// payment is in escrow through adding a `getUse` method to the seat.

// In this particular exchange, alice puts up cash in exchange for
// bob's two stocks. Bob wants to still be able to use the stocks while
// the stocks are in escrow, so he will call vote() and
// claimCashDividents() after offering the stocks. Alice can use the
// stocks after she collects her stock winnings from the contract
// host. Bob can try to use his use object for the stocks, but after
// the exchange happens, his use object has no authority - it has been
// transferred to alice when the actual ERTP asset was transferred.

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
  ' 5 vote(s) have been cast with position nay',
  '++ bob.useEscrowedStock done',
  ' 0 vote(s) have been cast with position yea',
  'alice\'s cash dividend balance {"label":{"issuer":{},"description":"cash"},"quantity":35}',
  'bob tried to get cash dividend after transfer complete balance {"label":{"issuer":{},"description":"cash"},"quantity":0}',
];

test('usableStock: useEscrowedStock with SES', async t => {
  const dump = await main(true, 'usableStock', ['useEscrowedStock']);
  t.deepEquals(dump.log, useEscrowedStock);
  t.end();
});

test('usableStock: useEscrowedStock without SES', async t => {
  const dump = await main(false, 'usableStock', ['useEscrowedStock']);
  t.deepEquals(dump.log, useEscrowedStock);
  t.end();
});
