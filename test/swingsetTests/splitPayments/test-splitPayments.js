import { test } from 'tape-promise/tape';
import { loadBasedir, buildVatController } from '@agoric/swingset-vat';
import path from 'path';

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

const expectedTapFaucetLog = [
  '=> setup called',
  'starting tapFaucet',
  'alice is made',
  'starting testTapFaucet',
  '++ alice.doTapFaucet starting',
  'pixel from faucet balance {"label":{"issuer":{},"description":"pixels"},"quantity":[{"x":1,"y":4}]}',
];

test('test splitPayments with SES', async t => {
  const dump = await main(true, 'splitPayments', ['splitPayments']);
  t.deepEquals(dump.log, expectedTapFaucetLog);
  t.end();
});

test.only('test splitPayments without SES', async t => {
  const dump = await main(false, 'splitPayments', ['splitPayments']);
  t.deepEquals(dump.log, expectedTapFaucetLog);
  t.end();
});
