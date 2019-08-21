// Copyright (C) 2019 Agoric, under Apache License 2.0

import harden from '@agoric/harden';

// ImportManager allows a package to make some code available that can be run
// locally by a calling vat without requiring a remote round trip to the hosting
// vat. Remote code can indicate what function to run using a key.
//
// Long term, we may want to import from a well-known repository, and manage
// version upgrades, but for now, we just import the code from the file system.
//
// A package that wanted to export some code for clients to run in their own vat
// would import or define some functions, then call
//
//   const mgr = importManager();
//   mgr.addImport('usefulFn', export1);
//   mgr.addImport('helpfulFn', export2);
//   return mgr.lock();
//
// then it could pass strings like 'usefulFn' to clients, who could import the
// manager above, then call
//
// const genericFn = importer.lookupImport(name);
function importManager() {
  const entries = new Map();

  return harden({
    addImport(name, referent) {
      if (entries.has(name)) {
        throw new Error(`Name "${name}" already has an entry.`);
      }
      entries.set(name, referent);
    },

    lock() {
      return harden({
        lookupImport(name) {
          if (!entries.has(name)) {
            throw new Error(`There is no entry for "${name}".`);
          }
          return entries.get(name);
        },
      });
    },
  });
}

export { importManager };
