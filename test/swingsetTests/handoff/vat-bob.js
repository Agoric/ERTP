// Copyright (C) 2019 Agoric, under Apache License 2.0

import harden from '@agoric/harden';

function makeBobMaker(E, _host, _log) {
  return harden({
    make(handoffServiceP) {
      const bob = harden({
        findSomething(key) {
          return E(handoffServiceP)
            .grabBoard(key)
            .then(board => {
              return E(E(handoffServiceP).validate(board)).lookup(key);
            });
        },
      });
      return bob;
    },
  });
}

function setup(syscall, state, helpers) {
  function log(...args) {
    helpers.log(...args);
    console.log(...args);
  }
  return helpers.makeLiveSlots(syscall, state, E =>
    harden({
      makeBobMaker(host) {
        return harden(makeBobMaker(E, host, log));
      },
    }),
  );
}
export default harden(setup);
