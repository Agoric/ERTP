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

const expectedAutomaticRefundOkLog = [
  '=> setup called',
  '=> automaticRefundOk called',
  '=> alice and bob are setup',
  '=> alice.doCreateAutomaticRefund called',
  '[{"rule":"offerExactly","amount":{"label":{"issuer":{},"description":"moola"},"quantity":3}},{"rule":"wantExactly","amount":{"label":{"issuer":{},"description":"simoleans"},"quantity":7}}]',
  '[{"rule":"wantExactly","amount":{"label":{"issuer":{},"description":"moola"},"quantity":15}},{"rule":"offerExactly","amount":{"label":{"issuer":{},"description":"simoleans"},"quantity":17}}]',
  'bobMoolaPurse: balance {"label":{"issuer":{},"description":"moola"},"quantity":0}',
  'bobSimoleanPurse;: balance {"label":{"issuer":{},"description":"simoleans"},"quantity":17}',
  'aliceMoolaPurse: balance {"label":{"issuer":{},"description":"moola"},"quantity":3}',
  'aliceSimoleanPurse;: balance {"label":{"issuer":{},"description":"simoleans"},"quantity":0}',
];

test('zoe - automaticRefund - valid inputs - with SES', async t => {
  const dump = await main(true, 'zoe', ['automaticRefundOk']);
  t.deepEquals(dump.log, expectedAutomaticRefundOkLog);
  t.end();
});

test.only('zoe - automaticRefund - valid inputs - no SES', async t => {
  const dump = await main(false, 'zoe', ['automaticRefundOk']);
  t.deepEquals(dump.log, expectedAutomaticRefundOkLog);
  t.end();
});
