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
  '=> case automaticRefundOk',
  '=> alice and bob are setup',
  '=> alice.doCreateAutomaticRefund called',
  '{"offerDesc":[{"rule":"offerExactly","assetDesc":{"label":{"assay":{},"description":"moola"},"extent":3}},{"rule":"wantExactly","assetDesc":{"label":{"assay":{},"description":"simoleans"},"extent":7}}],"exit":{"kind":"noExit"}}',
  '{"offerDesc":[{"rule":"wantExactly","assetDesc":{"label":{"assay":{},"description":"moola"},"extent":15}},{"rule":"offerExactly","assetDesc":{"label":{"assay":{},"description":"simoleans"},"extent":17}}],"exit":{"kind":"noExit"}}',
  'bobMoolaPurse: balance {"label":{"assay":{},"description":"moola"},"extent":0}',
  'bobSimoleanPurse;: balance {"label":{"assay":{},"description":"simoleans"},"extent":17}',
  'aliceMoolaPurse: balance {"label":{"assay":{},"description":"moola"},"extent":3}',
  'aliceSimoleanPurse;: balance {"label":{"assay":{},"description":"simoleans"},"extent":0}',
];

test('zoe - automaticRefund - valid inputs - with SES', async t => {
  try {
    const dump = await main(true, 'zoe', ['automaticRefundOk']);
    t.deepEquals(dump.log, expectedAutomaticRefundOkLog);
  } catch (e) {
    t.isNot(e, e, 'unexpected exception');
  } finally {
    t.end();
  }
});

test('zoe - automaticRefund - valid inputs - no SES', async t => {
  try {
    const dump = await main(false, 'zoe', ['automaticRefundOk']);
    t.deepEquals(dump.log, expectedAutomaticRefundOkLog);
  } catch (e) {
    t.isNot(e, e, 'unexpected exception');
  } finally {
    t.end();
  }
});

const expectedCoveredCallOkLog = [
  '=> setup called',
  '=> case coveredCallOk',
  '=> alice and bob are setup',
  '=> alice.doCreateCoveredCall called',
  'The offer has been accepted. Once the contract has been completed, please check your winnings',
  'The offer has been accepted. Once the contract has been completed, please check your winnings',
  'bobMoolaPurse: balance {"label":{"assay":{},"description":"moola"},"extent":3}',
  'bobSimoleanPurse;: balance {"label":{"assay":{},"description":"simoleans"},"extent":0}',
  'aliceMoolaPurse: balance {"label":{"assay":{},"description":"moola"},"extent":0}',
  'aliceSimoleanPurse;: balance {"label":{"assay":{},"description":"simoleans"},"extent":7}',
];

test('zoe - coveredCall - valid inputs - with SES', async t => {
  try {
    const dump = await main(true, 'zoe', ['coveredCallOk']);
    t.deepEquals(dump.log, expectedCoveredCallOkLog);
  } catch (e) {
    t.isNot(e, e, 'unexpected exception');
  } finally {
    t.end();
  }
});

test('zoe - coveredCall - valid inputs - no SES', async t => {
  try {
    const dump = await main(false, 'zoe', ['coveredCallOk']);
    t.deepEquals(dump.log, expectedCoveredCallOkLog);
  } catch (e) {
    t.isNot(e, e, 'unexpected exception');
  } finally {
    t.end();
  }
});
