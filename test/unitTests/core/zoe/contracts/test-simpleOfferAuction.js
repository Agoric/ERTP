import { test } from 'tape-promise/tape';
import harden from '@agoric/harden';

import { makeZoe } from '../../../../../core/zoe/zoe/zoe';
import { makeSimpleOfferMaker } from '../../../../../core/zoe/contracts/simpleOffer/simpleOffer';
import { makeSecondPriceSrcs } from '../../../../../core/zoe/contracts/simpleOffer/srcs/secondPriceSrcs';
import { setup } from '../setupBasicMints';

test('zoe.makeInstance with simpleOffer with secondPriceSrcs', async t => {
  try {
    const { issuers: originalIssuers, mints, assays } = setup();
    const issuers = originalIssuers.slice(0, 2);
    const zoe = makeZoe();
    const escrowReceiptIssuer = zoe.getEscrowReceiptIssuer();

    // Setup Alice
    const aliceMoolaPurse = mints[0].mint(issuers[0].makeAmount(1));
    const aliceMoolaPayment = aliceMoolaPurse.withdrawAll();
    const aliceSimoleanPurse = mints[1].mint(issuers[1].makeAmount(0));

    // Setup Bob
    const bobMoolaPurse = mints[0].mint(issuers[0].makeAmount(0));
    const bobSimoleanPurse = mints[1].mint(issuers[1].makeAmount(11));
    const bobSimoleanPayment = bobSimoleanPurse.withdrawAll();

    // Setup Carol
    const carolMoolaPurse = mints[0].mint(issuers[0].makeAmount(0));
    const carolSimoleanPurse = mints[1].mint(issuers[1].makeAmount(7));
    const carolSimoleanPayment = carolSimoleanPurse.withdrawAll();

    // Setup Dave
    const daveMoolaPurse = mints[0].mint(issuers[0].makeAmount(0));
    const daveSimoleanPurse = mints[1].mint(issuers[1].makeAmount(5));
    const daveSimoleanPayment = daveSimoleanPurse.withdrawAll();

    // 1: Alice creates a secondPriceAuction instance
    const secondPriceSrcs = makeSecondPriceSrcs(3);
    const makeSecondPriceAuction = makeSimpleOfferMaker(secondPriceSrcs);
    const { zoeInstance, governingContract: auction } = zoe.makeInstance(
      makeSecondPriceAuction,
      issuers,
    );

    // 2: Alice escrows with the zoeInstance
    const aliceOfferDesc = harden([
      {
        rule: 'offerExactly',
        amount: issuers[0].makeAmount(1),
      },
      {
        rule: 'wantAtLeast',
        amount: issuers[1].makeAmount(3),
      },
    ]);
    const alicePayments = [aliceMoolaPayment, undefined];
    const {
      escrowReceipt: allegedAliceEscrowReceipt,
      claimPayoff: aliceClaimPayoff,
    } = await zoeInstance.escrow(aliceOfferDesc, alicePayments);

    // 3: Alice does a claimAll on the escrowReceipt payment. It's
    // unnecessary if she trusts Zoe but we will do it for the tests.
    const aliceEscrowReceipt = await escrowReceiptIssuer.claimAll(
      allegedAliceEscrowReceipt,
    );

    // 4: Alice initializes the auction with her escrow receipt
    const aliceOfferResult = await auction.makeOffer(aliceEscrowReceipt);

    t.equals(
      aliceOfferResult,
      'The offer has been accepted. Once the contract has been completed, please check your winnings',
    );

    // 5: Alice spreads the zoeInstance and auction far and wide with
    // instructions on how to use it and Bob decides he wants to
    // participate in the auction.
    const bobOfferDesc = harden([
      {
        rule: 'wantExactly',
        amount: issuers[0].makeAmount(1),
      },
      {
        rule: 'offerAtMost',
        amount: issuers[1].makeAmount(11),
      },
    ]);
    const bobPayments = [undefined, bobSimoleanPayment];

    // 6: Bob escrows with the zoeInstance
    const {
      escrowReceipt: allegedBobEscrowReceipt,
      claimPayoff: bobClaimPayoff,
    } = await zoeInstance.escrow(bobOfferDesc, bobPayments);

    // 7: Bob does a claimAll on the escrowReceipt payment. This is
    // unnecessary but we will do it anyways for the test
    const bobEscrowReceipt = await escrowReceiptIssuer.claimAll(
      allegedBobEscrowReceipt,
    );

    // 8: Bob makes an offer with his escrow receipt
    const bobOfferResult = await auction.makeOffer(bobEscrowReceipt);

    t.equals(
      bobOfferResult,
      'The offer has been accepted. Once the contract has been completed, please check your winnings',
    );

    // 9: Carol decides to bid for the one moola
    const carolOfferDesc = harden([
      {
        rule: 'wantExactly',
        amount: issuers[0].makeAmount(1),
      },
      {
        rule: 'offerAtMost',
        amount: issuers[1].makeAmount(7),
      },
    ]);
    const carolPayments = [undefined, carolSimoleanPayment];

    // 10: Carol escrows with the zoeInstance
    const {
      escrowReceipt: carolEscrowReceipt,
      claimPayoff: carolClaimPayoff,
    } = await zoeInstance.escrow(carolOfferDesc, carolPayments);

    // 11: Carol makes an offer with her escrow receipt
    const carolOfferResult = await auction.makeOffer(carolEscrowReceipt);

    t.equals(
      carolOfferResult,
      'The offer has been accepted. Once the contract has been completed, please check your winnings',
    );

    // 12: Dave decides to bid for the one moola
    const daveOfferDesc = harden([
      {
        rule: 'wantExactly',
        amount: issuers[0].makeAmount(1),
      },
      {
        rule: 'offerAtMost',
        amount: issuers[1].makeAmount(5),
      },
    ]);
    const davePayments = [undefined, daveSimoleanPayment];

    // 13: Dave escrows with the zoeInstance
    const {
      escrowReceipt: daveEscrowReceipt,
      claimPayoff: daveClaimPayoff,
    } = await zoeInstance.escrow(daveOfferDesc, davePayments);

    // 14: Dave makes an offer with his escrow receipt
    const daveOfferResult = await auction.makeOffer(daveEscrowReceipt);

    t.equals(
      daveOfferResult,
      'The offer has been accepted. Once the contract has been completed, please check your winnings',
    );

    // 15: Alice unwraps the claimPayoff to get her seat
    const aliceSeat = await aliceClaimPayoff.unwrap();

    // 16: Bob unwraps his claimPayoff to get his seat
    const bobSeat = await bobClaimPayoff.unwrap();

    // 17: Carol unwraps her claimPayoff to get her seat
    const carolSeat = await carolClaimPayoff.unwrap();

    // 18: Dave unwraps his claimPayoff to get his seat
    const daveSeat = await daveClaimPayoff.unwrap();

    // 19: Alice claims her portion of the outcome
    const aliceResult = await aliceSeat.getPayoff();

    // 20: Bob claims his portion of the outcome
    const bobResult = await bobSeat.getPayoff();

    // 21: Carol claims her portion of the outcome
    const carolResult = await carolSeat.getPayoff();

    // 22: Dave claims his portion of the outcome
    const daveResult = await daveSeat.getPayoff();

    // Alice (the creator of the auction) gets back the second highest bid
    t.deepEquals(aliceResult[1].getBalance(), carolOfferDesc[1].amount);

    // Alice didn't get any of what she put in
    t.equals(aliceResult[0].getBalance().quantity, 0);

    // 23: Alice deposits her winnings to ensure she can
    await aliceMoolaPurse.depositAll(aliceResult[0]);
    await aliceSimoleanPurse.depositAll(aliceResult[1]);

    // Bob (the winner of the auction) gets the one moola and the
    // difference between his bid and the price back
    t.deepEquals(bobResult[0].getBalance(), assays[0].make(1));
    t.deepEquals(bobResult[1].getBalance(), assays[1].make(4));

    // 24: Bob deposits his winnings to ensure he can
    await bobMoolaPurse.depositAll(bobResult[0]);
    await bobSimoleanPurse.depositAll(bobResult[1]);

    // Carol gets a full refund
    t.deepEquals(carolResult[0].getBalance(), assays[0].make(0));
    t.deepEquals(carolResult[1].getBalance(), carolOfferDesc[1].amount);

    // 25: Carol deposits her winnings to ensure she can
    await carolMoolaPurse.depositAll(carolResult[0]);
    await carolSimoleanPurse.depositAll(carolResult[1]);

    // Dave gets a full refund
    t.deepEquals(daveResult[0].getBalance(), assays[0].make(0));
    t.deepEquals(daveResult[1].getBalance(), daveOfferDesc[1].amount);

    // 24: Dave deposits his winnings to ensure he can
    await daveMoolaPurse.depositAll(daveResult[0]);
    await daveSimoleanPurse.depositAll(daveResult[1]);

    // Assert that the correct winnings were received.
    // Alice had 1 moola and 0 simoleans.
    // Bob had 0 moola and 11 simoleans.
    // Carol had 0 moola and 7 simoleans.
    // Dave had 0 moola and 5 simoleans.

    // Now, they should have:
    // Alice: 0 moola and 7 simoleans
    // Bob: 1 moola and 4 simoleans
    // Carol: 0 moola and 7 simoleans
    // Dave: 0 moola and 5 simoleans
    t.equals(aliceMoolaPurse.getBalance().quantity, 0);
    t.equals(aliceSimoleanPurse.getBalance().quantity, 7);
    t.equals(bobMoolaPurse.getBalance().quantity, 1);
    t.equals(bobSimoleanPurse.getBalance().quantity, 4);
    t.equals(carolMoolaPurse.getBalance().quantity, 0);
    t.equals(carolSimoleanPurse.getBalance().quantity, 7);
    t.equals(daveMoolaPurse.getBalance().quantity, 0);
    t.equals(daveSimoleanPurse.getBalance().quantity, 5);
  } catch (e) {
    t.assert(false, e);
    console.log(e);
  } finally {
    t.end();
  }
});
