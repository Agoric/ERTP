// Copyright (C) 2019 Agoric, under Apache License 2.0

import { numIsEmpty, listIsEmpty } from './extentOps';
import { importManager } from '../../../../more/imports/importManager';

// This file models the way a module could export functionality to be run
// locally within a vat, but with the behavior determined by remote objects.
function makeGoodImportManager() {
  const mgr = importManager();
  return mgr.addExports({ numIsEmpty, listIsEmpty });
}

export { makeGoodImportManager };
