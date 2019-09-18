import { test } from 'tape-promise/tape';
import harden from '@agoric/harden';

import { makeZoe } from '../../../../../core/zoe/zoe/zoe';
import { makeSimpleOfferMaker } from '../../../../../core/zoe/contracts/simpleOffer/simpleOffer';
import { swapSrcs } from '../../../../../core/zoe/contracts/simpleOffer/srcs/swapSrcs';
import { setup } from '../setupBasicMints';

test('zoe.makeInstance with simpleOffer with swapSrcs', async t => {
  try {
    const { issuers: originalIssuers, mints } = setup();
    const issuers = originalIssuers.slice(0, 2);
    const zoe = makeZoe();
    const escrowReceiptIssuer = zoe.getEscrowReceiptIssuer();

    // Setup Alice
    const aliceMoolaPurse = mints[0].mint(issuers[0].makeAmount(3));
    const aliceMoolaPayment = aliceMoolaPurse.withdrawAll();
    const aliceSimoleanPurse = mints[1].mint(issuers[1].makeAmount(0));
    const aliceSimoleanPayment = aliceSimoleanPurse.withdrawAll();

    // Setup Bob
    const bobMoolaPurse = mints[0].mint(issuers[0].makeAmount(0));
    const bobMoolaPayment = bobMoolaPurse.withdrawAll();
    const bobSimoleanPurse = mints[1].mint(issuers[1].makeAmount(7));
    const bobSimoleanPayment = bobSimoleanPurse.withdrawAll();

    // 1: Alice creates a simpleSwap instance
    const makeSimpleSwap = makeSimpleOfferMaker(swapSrcs);
    const { zoeInstance, governingContract: simpleSwap } = zoe.makeInstance(
      makeSimpleSwap,
      issuers,
    );

    // 2: Alice escrows with the zoeInstance
    const aliceOfferDesc = harden([
      {
        rule: 'haveExactly',
        amount: issuers[0].makeAmount(3),
      },
      {
        rule: 'wantExactly',
        amount: issuers[1].makeAmount(7),
      },
    ]);
    const alicePayments = [aliceMoolaPayment, aliceSimoleanPayment];
    const {
      escrowReceipt: allegedAliceEscrowReceipt,
      claimWinnings: aliceClaimWinnings,
    } = await zoeInstance.escrow(aliceOfferDesc, alicePayments);

    // 3: Alice does a claimAll on the escrowReceipt payment
    const aliceEscrowReceipt = await escrowReceiptIssuer.claimAll(
      allegedAliceEscrowReceipt,
    );

    // 3: Alice initializes the swap with her escrow receipt

    // Alice gets two kinds of things back - invites (the ability to
    // make an offer) and a seat for herself (the right to claim after
    // an offer has been made). She gets a seat since she made an
    // offer. Bob gets an invite.
    const aliceOfferResult = await simpleSwap.makeOffer(aliceEscrowReceipt);

    // 3: Imagine that Bob also has access to the escrowReceiptIssuer
    // and the automaticRefund

    // 4: Bob inspects the invite payment and checks that the offerToBeMade
    // matches what he expects

    const bobOfferDesc = harden([
      {
        rule: 'wantExactly',
        amount: issuers[0].makeAmount(3),
      },
      {
        rule: 'haveExactly',
        amount: issuers[1].makeAmount(7),
      },
    ]);
    const bobPayments = [bobMoolaPayment, bobSimoleanPayment];

    // 6: Bob escrows
    const {
      escrowReceipt: allegedBobEscrowReceipt,
      claimWinnings: bobClaimWinnings,
    } = await zoeInstance.escrow(bobOfferDesc, bobPayments);

    // 7: Bob does a claimAll on the escrowReceipt payment
    const bobEscrowReceipt = await escrowReceiptIssuer.claimAll(
      allegedBobEscrowReceipt,
    );

    // 8: Bob makes an offer with his escrow receipt
    const bobOfferResult = await simpleSwap.makeOffer(bobEscrowReceipt);

    t.equals(
      bobOfferResult,
      'The offer has been accepted. Once another offer has been accepted, please check your winnings',
    );
    t.equals(
      aliceOfferResult,
      'The offer has been accepted. Once another offer has been accepted, please check your winnings',
    );

    // 7: Alice unwraps the claimWinnings to get her seat
    const aliceSeat = await aliceClaimWinnings.unwrap();

    // 8: Bob unwraps his claimWinnings to get his seat
    const bobSeat = await bobClaimWinnings.unwrap();

    // 9: Alice claims her portion of the outcome (what Bob paid in)
    const aliceResult = await aliceSeat.getWinnings();

    // 10: Bob claims his position of the outcome (what Alice paid in)
    const bobResult = await bobSeat.getWinnings();

    // Alice gets back what she wanted
    t.deepEquals(aliceResult[1].getBalance(), aliceOfferDesc[1].amount);

    // Alice didn't get any of what she put in
    t.equals(aliceResult[0].getBalance().quantity, 0);

    // 11: Alice deposits her refund to ensure she can
    await aliceMoolaPurse.depositAll(aliceResult[0]);
    await aliceSimoleanPurse.depositAll(aliceResult[1]);

    // 12: Bob deposits his original payments to ensure he can
    await bobMoolaPurse.depositAll(bobResult[0]);
    await bobSimoleanPurse.depositAll(bobResult[1]);

    // Assert that the correct refund was achieved.
    // Alice had 3 moola and 0 simoleans.
    // Bob had 0 moola and 7 simoleans.
    t.equals(aliceMoolaPurse.getBalance().quantity, 0);
    t.equals(aliceSimoleanPurse.getBalance().quantity, 7);
    t.equals(bobMoolaPurse.getBalance().quantity, 3);
    t.equals(bobSimoleanPurse.getBalance().quantity, 0);
  } catch (e) {
    t.assert(false, e);
    console.log(e);
  } finally {
    t.end();
  }
});
