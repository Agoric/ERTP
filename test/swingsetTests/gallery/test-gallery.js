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

test('run gallery demo tapFaucet with SES', async t => {
  const dump = await main(true, 'gallery', ['tapFaucet']);
  t.deepEquals(dump.log, expectedTapFaucetLog);
  t.end();
});

test('run gallery demo tapFaucet without SES', async t => {
  const dump = await main(false, 'gallery', ['tapFaucet']);
  t.deepEquals(dump.log, expectedTapFaucetLog);
  t.end();
});

const expectedAliceChangesColorLog = [
  '=> setup called',
  'starting aliceChangesColor',
  'alice is made',
  'starting testAliceChangesColor',
  '++ alice.doChangeColor starting',
  'tapped Faucet',
  'current color #000000',
  'pixel index is 100 of 100',
];

test('run gallery demo aliceChangesColor with SES', async t => {
  const dump = await main(true, 'gallery', ['aliceChangesColor']);
  t.deepEquals(dump.log, expectedAliceChangesColorLog);
  t.end();
});

test('run gallery demo aliceChangesColor without SES', async t => {
  const dump = await main(false, 'gallery', ['aliceChangesColor']);
  t.deepEquals(dump.log, expectedAliceChangesColorLog);
  t.end();
});

const expectedAliceSendsOnlyUseRightLog = [
  '=> setup called',
  'starting aliceSendsOnlyUseRight',
  'alice is made',
  'starting testAliceSendsOnlyUseRight',
  '++ alice.doOnlySendUseRight starting',
  'tapped Faucet',
  'pixel x:1, y:4 has original color #a903be',
  '++ bob.receiveChildPayment starting',
  "pixel x:1, y:4 changed to bob's color #B695C0",
  "pixel x:1, y:4 changed to alice's color #9FBF95",
  'bob was unable to color: Error:       no use rights present in amount (a object)\nSee console for error data.',
  'bob was unable to color: Error:       no use rights present in amount (a object)\nSee console for error data.',
];

test('run gallery demo aliceSendsOnlyUseRight with SES', async t => {
  const dump = await main(true, 'gallery', ['aliceSendsOnlyUseRight']);
  t.deepEquals(dump.log, expectedAliceSendsOnlyUseRightLog);
  t.end();
});

test('run gallery demo aliceSendsOnlyUseRight without SES', async t => {
  const dump = await main(false, 'gallery', ['aliceSendsOnlyUseRight']);
  t.deepEquals(dump.log, expectedAliceSendsOnlyUseRightLog);
  t.end();
});

const expectedGalleryRevokesLog = [
  '=> setup called',
  'starting galleryRevokes',
  'starting testGalleryRevokes',
  '++ alice.doTapFaucetAndStore starting',
  '++ alice.checkAfterRevoked starting',
  'successfully threw Error:       no use rights present in amount (a object)\nSee console for error data.',
  'amount quantity should be an array of length 0: 0',
];

test('run gallery demo galleryRevokes with SES', async t => {
  const dump = await main(true, 'gallery', ['galleryRevokes']);
  t.deepEquals(dump.log, expectedGalleryRevokesLog);
  t.end();
});

test('run gallery demo galleryRevokes without SES', async t => {
  const dump = await main(false, 'gallery', ['galleryRevokes']);
  t.deepEquals(dump.log, expectedGalleryRevokesLog);
  t.end();
});

const expectedAliceSellsAndBuysLog = [
  '=> setup called',
  'starting aliceSellsAndBuys',
  'starting testAliceSellsAndBuys',
  '++ alice.doSellAndBuy starting',
  'gallery escrow wins: {"label":{"issuer":{},"description":"pixels"},"quantity":[{"x":1,"y":4}]} refs: null',
  'alice escrow wins: {"label":{"issuer":{},"description":"dust"},"quantity":6} refs: null',
  'gallery escrow wins: {"label":{"issuer":{},"description":"dust"},"quantity":6} refs: null',
  'alice escrow 2 wins: {"label":{"issuer":{},"description":"pixels"},"quantity":[{"x":1,"y":4}]} refs: null',
  'alice pixel purse balance {"label":{"issuer":{},"description":"pixels"},"quantity":[{"x":1,"y":4}]}',
  'alice dust purse balance {"label":{"issuer":{},"description":"dust"},"quantity":0}',
];

test('run gallery demo aliceSellsAndBuys with SES', async t => {
  const dump = await main(true, 'gallery', ['aliceSellsAndBuys']);
  t.deepEquals(dump.log, expectedAliceSellsAndBuysLog);
  t.end();
});

test('run gallery demo aliceSellsAndBuys without SES', async t => {
  const dump = await main(false, 'gallery', ['aliceSellsAndBuys']);
  t.deepEquals(dump.log, expectedAliceSellsAndBuysLog);
  t.end();
});

const expectedAliceSellsToBobLog = [
  '=> setup called',
  'starting aliceSellsToBob',
  'starting testAliceSellsToBob',
  '++ alice.doTapFaucetAndOfferViaCorkboard starting',
  'Alice collected 37 dust',
  'alice escrow wins: {"label":{"issuer":{},"description":"dust"},"quantity":37} refs: null',
  'bob option wins: {"label":{"issuer":{},"description":"pixels"},"quantity":[{"x":1,"y":4}]} refs: null',
  '++ aliceSellsToBob done',
  'bob tried to color, and produced #B695C0',
];

test('run gallery demo aliceSellsToBob with SES', async t => {
  const dump = await main(true, 'gallery', ['aliceSellsToBob']);
  t.deepEquals(dump.log, expectedAliceSellsToBobLog);
  t.end();
});

test('run gallery demo aliceSellsToBob without SES', async t => {
  const dump = await main(false, 'gallery', ['aliceSellsToBob']);
  t.deepEquals(dump.log, expectedAliceSellsToBobLog);
  t.end();
});

const expectedAliceCreatesFakeChild = [
  '=> setup called',
  'starting aliceCreatesFakeChild',
  'starting testAliceCreatesFakeChild',
  '++ alice.doCreateFakeChild starting',
  '++ bob.receiveSuspiciousPayment starting',
  'the payment could not be deposited in childPixelPurse',
  'is the issuer of the payment a real descendant? false',
];

// Alice tries an attack. She somehow gets access to makeMint,
// makeMintKeeper, and makePixelListAssayMaker. She uses these to
// create a childMint that she controls entirely. She wants to fool
// Bob into accepting a payment from her mint (which costs her nothing
// to make) for real money. Note that Alice has no control over the
// gallery and cannot change the color of pixels with her mint. Bob
// receives a payment, and is able to stop the attack in two ways - 1)
// he can create a new purse for that sublevel by getting the
// pixelIssuer's child and calling makeEmpty purse on that. When he
// tries to put the payment into the purse, it will fail. 2) he can
// check whether the issuer of the payment is a descendant of the
// pixelIssuer that he gets from the gallery,

test('run gallery demo aliceCreatesFakeChild with SES', async t => {
  const dump = await main(true, 'gallery', ['aliceCreatesFakeChild']);
  t.deepEquals(dump.log, expectedAliceCreatesFakeChild);
  t.end();
});

test('run gallery demo aliceCreatesFakeChild without SES', async t => {
  const dump = await main(false, 'gallery', ['aliceCreatesFakeChild']);
  t.deepEquals(dump.log, expectedAliceCreatesFakeChild);
  t.end();
});
