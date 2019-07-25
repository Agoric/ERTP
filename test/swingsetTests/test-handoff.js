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

const corkboardContentsGolden = [
  '=> setup called',
  'starting testCorkboardStorage',
];

test('run handoff --corkboard contents', async t => {
  const dump = await main(false, 'scaffolding/handoff', ['corkboard']);
  t.deepEquals(dump.log, corkboardContentsGolden);
  t.end();
});

test('run handoff --corkboard contents', async t => {
  const dump = await main(true, 'scaffolding/handoff', ['corkboard']);
  t.deepEquals(dump.log, corkboardContentsGolden);
  t.end();
});

const handoffTestGolden = [
  '=> setup called',
  'starting testHandoffStorage',
  'expected validate to throw',
];

test('run handoff --handoff service', async t => {
  const dump = await main(false, 'scaffolding/handoff', ['handoff']);
  t.deepEquals(dump.log, handoffTestGolden);
  t.end();
});

test('run handoff --handoff service', async t => {
  const dump = await main(true, 'scaffolding/handoff', ['handoff']);
  t.deepEquals(dump.log, handoffTestGolden);
  t.end();
});

const twoPartyHandoffGolden = [
  '=> setup called',
  'starting testHandoffStorage',
  'expecting coordination on 42.',
];

test('run handoff --Two Party handoff', async t => {
  const dump = await main(false, 'scaffolding/handoff', ['twoVatHandoff']);
  t.deepEquals(dump.log, twoPartyHandoffGolden);
  t.end();
});

test('run handoff --Two Party handoff', async t => {
  const dump = await main(true, 'scaffolding/handoff', ['twoVatHandoff']);
  t.deepEquals(dump.log, twoPartyHandoffGolden);
  t.end();
});
