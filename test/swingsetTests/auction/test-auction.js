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

const auctionGolden = [
  '=> setup called',
  '++ alice.createAuctionAndInviteBidders starting',
  '@@ tick:1: art deposit @@',
  '@@ tick:2: bidder offer @@',
  '++ bidder.offerSeat starting',
  '@@ tick:3: bidder offer @@',
  '++ bidder.offerSeat starting',
  '@@ tick:4: BIDDER: starting offerSeat() @@',
  '@@ tick:5: BIDDER: queuing collection @@',
  '@@ tick:6: BIDDER: starting offerSeat() @@',
  '@@ tick:7: BIDDER: queuing collection @@',
  '@@ schedule task for:11, currently: 7 @@',
  '@@ tick:8: BIDDER: verification. @@',
  '@@ tick:9: BIDDER: verification. @@',
  '@@ tick:10: BIDDER: bid 1000 @@',
  '@@ tick:11: BIDDER: bid 900 @@',
  '&& running a task scheduled for 11. &&',
  'auction earnings wins: {"label":{"issuer":{},"description":"Christies Art Auctions"},"quantity":null} refs: {"label":{"issuer":{},"description":"doubloons"},"quantity":900}',
  'auction earnings wins: {"label":{"issuer":{},"description":"Christies Art Auctions"},"quantity":"Salvator Mundi"} refs: {"label":{"issuer":{},"description":"doubloons"},"quantity":100}',
  'auction earnings wins: {"label":{"issuer":{},"description":"doubloons"},"quantity":900} refs: {"label":{"issuer":{},"description":"Christies Art Auctions"},"quantity":null}',
  '*** Alice sold her painting for 900. **',
  '++ auction done: 900',
];

test('2 bidder auction w/SES', async t => {
  const dump = await main(true, 'auction', ['simple-auction']);
  t.deepEquals(dump.log, auctionGolden);
  t.end();
});

test('2 bidder auction', async t => {
  const dump = await main(false, 'auction', ['simple-auction']);
  t.deepEquals(dump.log, auctionGolden);
  t.end();
});
