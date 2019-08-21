// Copyright (C) 2019 Agoric, under Apache License 2.0

import { test } from 'tape-promise/tape';
import { makeGoodImportManager } from './goodImports';
import { makeBadImportManager } from './badImports';

test('import integer', t => {
  const importer = makeGoodImportManager();
  t.equals(37, importer.lookupImport('a'));
  t.end();
});

test('import function', t => {
  const importer = makeGoodImportManager();
  t.equals(40, importer.lookupImport('b')(20));
  t.end();
});

test('import not found', t => {
  const importer = makeGoodImportManager();
  t.throws(() => importer.lookupImport('c'), 'There is no entry for "c".');
  t.end();
});

test('duplicate import', t => {
  t.throws(() => makeBadImportManager(), '"a" already has an entry.');
  t.end();
});
