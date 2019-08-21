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
  '@@ tick:0: art deposit @@',
  '@@ tick:1: bidder offer @@',
  '++ bidder.offerSeat starting',
  '@@ tick:2: bidder offer @@',
  '++ bidder.offerSeat starting',
  '@@ tick:3 @@',
  '@@ tick:4: BIDDER: seat  @@',
  '@@ tick:5 @@',
  '@@ tick:6: BIDDER: seat  @@',
  '@@ tick:7 @@',
  '@@schedule task for:15, currently: 8 @@',
  '@@ tick:8: seller`s offer @@',
  '@@ tick:9: consignment @@',
  '@@ tick:10: newBidderSeat @@',
  '@@ tick:11: returning new Bidder Invite: bidder1 @@',
  '@@ tick:12: newBidderSeat @@',
  '@@ tick:13: returning new Bidder Invite: bidder2 @@',
  '@@ tick:14: amount bid 1000 @@',
  '@@ tick:15: added bidder @@',
  '@@ tick:16: amount bid 900 @@',
  '@@ tick:17: added bidder @@',
  '@@ tick:18: bestBids 1000, 900, 2, 2 @@',
  '@@ tick:19: consummate @@',
  '@@ tick:20: assigning purses @@',
  'auction earnings wins: {"label":{"issuer":{},"description":"Christies Art Auctions"},"quantity":null} refs: {"label":{"issuer":{},"description":"doubloons"},"quantity":900}',
  '@@ tick:21: closed Auction at 900 @@',
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

test.only('2 bidder auction', async t => {
  const dump = await main(false, 'auction', ['simple-auction']);
  t.deepEquals(dump.log, auctionGolden);
  t.end();
});
