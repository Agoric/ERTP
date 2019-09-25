import { test } from 'tape-promise/tape';
import { makeMint } from '../../../core/issuers';
import { makeTotalSupplyConfig } from '../../../core/config/totalSupplyConfig';

test('totalSupplyConfig', async t => {
  try {
    const mint = makeMint('liquidityTokens', makeTotalSupplyConfig);
    const issuer = mint.getIssuer();
    const purse1 = await mint.mint(1000);
    t.deepEquals(mint.getTotalSupply(), issuer.makeAmount(1000));
    const purse2 = await mint.mint(532);
    t.deepEquals(mint.getTotalSupply(), issuer.makeAmount(1532));
    const payment1 = await purse1.withdrawAll();
    t.deepEquals(payment1.getBalance(), issuer.makeAmount(1000));
    const payment2 = await purse2.withdraw(issuer.makeAmount(10));
    t.deepEquals(payment2.getBalance(), issuer.makeAmount(10));
    t.deepEquals(mint.getTotalSupply(), issuer.makeAmount(1532));
    await issuer.burnAll(payment1);
    t.deepEquals(mint.getTotalSupply(), issuer.makeAmount(532));
    await mint.mint(4);
    t.deepEquals(mint.getTotalSupply(), issuer.makeAmount(536));
    await issuer.burnExactly(issuer.makeAmount(10), payment2);
    t.deepEquals(mint.getTotalSupply(), issuer.makeAmount(526));
  } catch (e) {
    t.assert(false, e);
  } finally {
    t.end();
  }
});
