import { test } from 'tape-promise/tape';
import { buildVatController, loadBasedir } from '@agoric/swingset-vat';

async function main(withSES, basedir, argv) {
  const config = await loadBasedir(basedir);
  const ldSrcPath = require.resolve(
    '@agoric/swingset-vat/src/devices/loopbox-src',
  );
  config.devices = [['loopbox', ldSrcPath, {}]];

  const controller = await buildVatController(config, withSES, argv);
  await controller.run();
  return controller.dump();
}

const corruptedPresenceGolden = [
  '=> setup called',
  '++ Expect creation of purse',
];

test.only('`run corrupted presence with SES', async t => {
  const dump = await main(true, 'test/presenceCorruption', [
    'corrupted-presence',
  ]);
  t.deepEquals(dump.log, corruptedPresenceGolden);
  t.end();
});
