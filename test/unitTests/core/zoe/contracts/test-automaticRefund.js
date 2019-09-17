import { test } from 'tape-promise/tape';
import harden from '@agoric/harden';
import { makeZoe } from '../../../../../core/zoe/zoe/zoe';
import { makeAutomaticRefund } from '../../../../../core/zoe/contracts/automaticRefund';
import { setup } from '../setupBasicMints';

test('zoe.makeInstance with automaticRefund', async t => {
  try {
    // Setup zoe and mints
    const { issuers: originalIssuers, mints } = setup();
    const issuers = originalIssuers.slice(0, 2);
    const zoe = makeZoe();
    const escrowReceiptIssuer = zoe.getEscrowReceiptIssuer();
    const seatIssuer = zoe.getSeatIssuer();

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

    // 1: Alice creates an automatic refund instance
    const {
      zoeInstance,
      governingContract: automaticRefund,
    } = zoe.makeInstance(makeAutomaticRefund, issuers);

    // The issuers in the zoeInstance are now defined
    t.deepEquals(zoeInstance.getIssuers(), issuers);

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

    // Alice gets two kinds of ERTP payments back: an 'escrowReceipt' that
    // represents what she escrowed and which she can use interact
    // safely with untrusted contracts, and a 'claimWinnings'
    // ERTP payment that represents the right to claim the winnings of
    // the offer that she made.
    const {
      escrowReceipt: allegedAliceEscrowReceipt,
      claimWinnings: allegedAliceClaimWinnings,
    } = await zoeInstance.escrow(aliceOfferDesc, alicePayments);

    // 3: Alice does a claimAll on the escrowReceipt payment. (This is
    // unnecessary if she trusts zoe, but we will do it in the tests.)
    const aliceEscrowReceipt = await escrowReceiptIssuer.claimAll(
      allegedAliceEscrowReceipt,
    );

    // 4: Alice makes an offer with her escrow receipt

    // In the 'automaticRefund' trivial contract, you just get your
    // offerDesc back when you make an offer. This will vary widely
    // depending on the governing contract.
    const aliceOfferMadeDesc = await automaticRefund.makeOffer(
      aliceEscrowReceipt,
    );

    // 5: Imagine that Bob also has access to the zoeInstance and the
    // automaticRefund

    // 6: Bob also wants to get an automaticRefund (why? we don't
    // know) so he escrows his offer and his offer payments.

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

    // Bob also gets two ERTP payments back: an escrowReceipt and a
    // claimWinnings payment
    const {
      escrowReceipt: allegedBobEscrowReceipt,
      claimWinnings: allegedBobClaimWinnings,
    } = await zoeInstance.escrow(bobOfferDesc, bobPayments);

    // 7: Bob does a claimAll on the escrowReceipt payment
    const bobEscrowReceipt = await escrowReceiptIssuer.claimAll(
      allegedBobEscrowReceipt,
    );

    // 8: Bob makes an offer with his escrow receipt
    const bobOfferMadeDesc = await automaticRefund.makeOffer(bobEscrowReceipt);

    t.equals(bobOfferMadeDesc, bobOfferDesc);
    t.equals(aliceOfferMadeDesc, aliceOfferDesc);

    // 9: Alice does a claimAll on her claimWinnings (she doesn't have
    // to if she already trusts Zoe, but we will in the tests.)
    const aliceClaimWinnings = await seatIssuer.claimAll(
      allegedAliceClaimWinnings,
    );

    // 10: Bob does a claimAll on his claimWinnings (he doesn't have
    // to, but we will in the tests.)
    const bobClaimWinnings = await seatIssuer.claimAll(allegedBobClaimWinnings);

    // 11: Alice unwraps the claimWinnings to get her seat
    const aliceSeat = await aliceClaimWinnings.unwrap();

    // 12: Bob unwraps his claimWinnings to get his seat
    const bobSeat = await bobClaimWinnings.unwrap();

    // 9: Alice claims her portion of the outcome (what she put in,
    // since it's an automatic refund)
    const aliceResult = await aliceSeat.getWinnings();

    // 10: Bob claims his position of the outcome (what he put in,
    // since it's an automatic refund)
    const bobResult = await bobSeat.getWinnings();

    // Alice got back what she put in
    t.deepEquals(aliceResult[0].getBalance(), aliceOfferDesc[0].amount);

    // Alice didn't get any of what she wanted
    t.equals(aliceResult[1].getBalance().quantity, 0);

    // 11: Alice deposits her refund to ensure she can
    await aliceMoolaPurse.depositAll(aliceResult[0]);
    await aliceSimoleanPurse.depositAll(aliceResult[1]);

    // 12: Bob deposits his refund to ensure he can
    await bobMoolaPurse.depositAll(bobResult[0]);
    await bobSimoleanPurse.depositAll(bobResult[1]);

    // Assert that the correct refund was achieved.
    // Alice had 3 moola and 0 simoleans.
    // Bob had 0 moola and 7 simoleans.
    t.equals(aliceMoolaPurse.getBalance().quantity, 3);
    t.equals(aliceSimoleanPurse.getBalance().quantity, 0);
    t.equals(bobMoolaPurse.getBalance().quantity, 0);
    t.equals(bobSimoleanPurse.getBalance().quantity, 7);
  } catch (e) {
    t.assert(false, e);
    console.log(e);
  } finally {
    t.end();
  }
});
