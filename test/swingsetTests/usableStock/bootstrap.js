// Copyright (C) 2019 Agoric, under Apache License 2.0

import harden from '@agoric/harden';

import { insist } from '../../../util/insist';
import { escrowExchangeSrcs } from '../../../core/escrow';
import { makeUsableStockMaker } from '../../../more/usableStock/usableStockConfig';
import { makeMint } from '../../../core/issuers';

function build(E, log) {
  async function useEscrowedStock(host, aliceMaker, bobMaker) {
    const escrowExchangeInstallationP = E(host).install(escrowExchangeSrcs);

    const cashMint = makeMint('cash');
    const cashIssuer = cashMint.getIssuer();
    const cashAssay = cashIssuer.getAssay();
    const companyCashPurseP = await E(cashMint).mint(1000, 'companyPurse');
    const votes = new Map();
    const cashDividendsClaimed = new Map();
    const cashPerStock = cashIssuer.makeAmount(7);

    function makeUseObj(issuer, asset) {

      // we allow infinite voting and claiming of dividends in order
      // to easily prove who has the authority to use the use object,
      // but it is very easy to protect against it with a `has` check
      // on the maps
      const useObj = harden({
        // change the color of the pixels in the amount after checking
        // that the asset has the authority to do so.
        vote(position) {
          insist(
            position === 'yea' || position === 'nay',
          )`position ${position} must be yea or nay`;

          const assay = issuer.getAssay();
          const amount = asset.getBalance();
          const ids = assay.quantity(amount);
          for (const id of ids) {
            votes.set(id, position);
          }
          const count = ids.length;
          log(` ${count} vote(s) have been cast with position ${position}`);
          return amount;
        },
        async claimCashDividends() {
          const assay = issuer.getAssay();
          let resultCashAmount = cashAssay.empty();
          const amount = asset.getBalance();
          const ids = assay.quantity(amount);
          for (const id of ids) {
            cashDividendsClaimed.set(id, true);
            resultCashAmount = cashAssay.with(resultCashAmount, cashPerStock);
          }
          return E(companyCashPurseP).withdraw(resultCashAmount);
        },
      });
      return useObj;
    }

    const usableStockConfig = makeUsableStockMaker(makeUseObj);

    const stockMint = makeMint('Tyrell', usableStockConfig);
    const stockIssuer = stockMint.getIssuer();

    const bobStockAmount = await E(stockIssuer).makeAmount(harden([1, 2]));
    const bobStockPurse = await E(stockMint).mint(bobStockAmount);

    const aliceStockAmount = await E(stockIssuer).makeAmount(harden([3, 4, 5]));
    const aliceStockPurse = await E(stockMint).mint(aliceStockAmount);

    const aliceCashPurseP = await E(cashMint).mint(1000);
    const bobCashPurseP = await E(cashMint).mint(1001);

    const aliceP = E(aliceMaker).make(
      escrowExchangeInstallationP,
      aliceCashPurseP,
      aliceStockPurse,
    );
    const bobP = E(bobMaker).make(
      escrowExchangeInstallationP,
      bobCashPurseP,
      bobStockPurse,
    );
    return E(bobP).useEscrowedStock(aliceP);
  }

  const obj0 = {
    async bootstrap(argv, vats) {
      async function makeStartingObjs() {
        const host = await E(vats.host).makeHost();
        const aliceMaker = await E(vats.alice).makeAliceMaker(host);
        const bobMaker = await E(vats.bob).makeBobMaker(host);
        return harden({
          host,
          aliceMaker,
          bobMaker,
        });
      }

      switch (argv[0]) {
        case 'useEscrowedStock': {
          const { host, aliceMaker, bobMaker } = await makeStartingObjs();
          return useEscrowedStock(host, aliceMaker, bobMaker);
        }
        default: {
          throw new Error(`unrecognized argument value ${argv[0]}`);
        }
      }
    },
  };
  return harden(obj0);
}
harden(build);

function setup(syscall, state, helpers) {
  function log(...args) {
    helpers.log(...args);
    console.log(...args);
  }
  log(`=> setup called`);
  return helpers.makeLiveSlots(
    syscall,
    state,
    E => build(E, log),
    helpers.vatID,
  );
}
export default harden(setup);
