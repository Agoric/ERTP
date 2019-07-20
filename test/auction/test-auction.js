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

const auctionGolden = ['=> setup called', 'starting testAuctionServiceSuccess'];

test('2 bidder auction w/SES', async t => {
  const dump = await main(true, 'test/auction', ['simple-auction']);
  t.deepEquals(dump.log, auctionGolden);
  t.end();
});

test.only('2 bidder auction', async t => {
  const dump = await main(false, 'test/auction', ['simple-auction']);
  t.deepEquals(dump.log, auctionGolden);
  t.end();
});
