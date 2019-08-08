// Copyright (C) 2019 Agoric, under Apache License 2.0

import harden from '@agoric/harden';

import { insist } from '../../../util/insist';
import { escrowExchangeSrcs } from '../../../core/escrow';
import { makeUsableStockMaker } from '../../../more/usableStock/usableStockConfig';

function build(E) {
  async function useEscrowedStock(host, mint, aliceMaker, bobMaker) {
    const escrowExchangeInstallationP = E(host).install(escrowExchangeSrcs);

    const cashMintP = await E(mint).makeMint('cash');
    const cashIssuerP = await E(cashMintP).getIssuer();
    const cashAssayP = await E(cashIssuerP).getAssay();
    const companyCashPurseP = await E(cashMintP).mint(1000, 'companyPurse');
    const votes = new Map();
    const cashDividendsClaimed = new Map();
    const cashPerStock = 5;

    function makeUseObj(issuer, asset) {
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
            if (!votes.has(id)) {
              votes.set(id, position);
            }
          }
          return amount;
        },
        claimCashDividends() {
          let resultCashAmount;
          const assay = issuer.getAssay();
          const amount = assay.getBalance();
          const ids = assay.quantity(amount);
          for (const id of ids) {
            if (!cashDividendsClaimed.has(id)) {
              cashDividendsClaimed.set(id, true);
              resultCashAmount = E(cashAssayP).with(
                resultCashAmount,
                cashPerStock,
              );
            }
          }
          return E(companyCashPurseP).withdraw(resultCashAmount);
        },
      });
      return useObj;
    }

    const usableStockConfig = makeUsableStockMaker(makeUseObj);

    const stockMintP = await E(mint).makeMint(usableStockConfig, 'Tyrell');

    const bobStockPurseP = await E(stockMintP).mint(harden([1, 2]));
    const aliceStockPurseP = await E(stockMintP).mint(harden([3, 4, 5]));

    const aliceCashPurseP = await E(cashMintP).mint(1000);
    const bobCashPurseP = await E(cashMintP).mint(1001);

    const aliceP = E(aliceMaker).make(
      escrowExchangeInstallationP,
      aliceCashPurseP,
      aliceStockPurseP,
    );
    const bobP = E(bobMaker).make(
      escrowExchangeInstallationP,
      bobCashPurseP,
      bobStockPurseP,
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
          mint: vats.mint,
          aliceMaker,
          bobMaker,
        });
      }

      switch (argv[0]) {
        case 'useEscrowedStock': {
          const { host, mint, aliceMaker, bobMaker } = await makeStartingObjs();
          return useEscrowedStock(host, mint, aliceMaker, bobMaker);
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
