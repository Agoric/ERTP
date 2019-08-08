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

const auctionGolden = ['=> setup called', 'starting testAuctionServiceSuccess'];

test('2 bidder auction w/SES', async t => {
  const dump = await main(true, 'auction', ['simple-auction']);
  t.deepEquals(dump.log, auctionGolden);
  t.end();
});

test.only('2 bidder auction', async t => {
  const dump = await main(false, 'auction', ['simple-auction']);
  t.deepEquals(dump.log, auctionGolden);
  t.end();
});
