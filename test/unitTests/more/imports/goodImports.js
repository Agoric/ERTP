// Copyright (C) 2019 Agoric, under Apache License 2.0

import { importManager } from '../../../../more/imports/importManager';

function makeGoodImportManager() {
  function double(x) {
    return x * 2;
  }
  const mgr = importManager();
  mgr.addImport('a', 37);
  mgr.addImport('b', double);
  return mgr.lock();
}

export { makeGoodImportManager };
