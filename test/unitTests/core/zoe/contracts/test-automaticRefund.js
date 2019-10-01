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

    // Setup Bob
    const bobMoolaPurse = mints[0].mint(issuers[0].makeAmount(0));
    const bobSimoleanPurse = mints[1].mint(issuers[1].makeAmount(17));
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
        rule: 'offerExactly',
        amount: issuers[0].makeAmount(3),
      },
      {
        rule: 'wantExactly',
        amount: issuers[1].makeAmount(7),
      },
    ]);
    const alicePayments = [aliceMoolaPayment, undefined];

    // Alice gets two kinds of ERTP payments back: an 'escrowReceipt' that
    // represents what she escrowed and which she can use interact
    // safely with untrusted contracts, and a 'claimPayoff'
    // ERTP payment that represents the right to claim the winnings of
    // the offer that she made.
    const {
      escrowReceipt: allegedAliceEscrowReceipt,
      claimPayoff: allegedAliceClaimPayoff,
    } = await zoeInstance.escrow(aliceOfferDesc, alicePayments);

    // 3: Alice does a claimAll on the escrowReceipt payment. (This is
    // unnecessary if she trusts zoe, but we will do it in the tests.)
    const aliceEscrowReceipt = await escrowReceiptIssuer.claimAll(
      allegedAliceEscrowReceipt,
    );

    // 4: Alice makes an offer with her escrow receipt

    // In the 'automaticRefund' trivial contract, you just get your
    // offerDesc back when you make an offer. The effect of calling
    // makeOffer will vary widely depending on the governing contract.
    const aliceOfferMadeDesc = await automaticRefund.makeOffer(
      aliceEscrowReceipt,
    );

    // 5: Imagine that Alice has shared the zoeInstance and
    // automaticRefund with Bob

    // 6: Bob also wants to get an automaticRefund (why? we don't
    // know) so he escrows his offer and his offer payments.

    const bobOfferDesc = harden([
      {
        rule: 'wantExactly',
        amount: issuers[0].makeAmount(15),
      },
      {
        rule: 'offerExactly',
        amount: issuers[1].makeAmount(17),
      },
    ]);
    const bobPayments = [undefined, bobSimoleanPayment];

    // Bob also gets two ERTP payments back: an escrowReceipt and a
    // claimPayoff payment
    const {
      escrowReceipt: allegedBobEscrowReceipt,
      claimPayoff: allegedBobClaimPayoff,
    } = await zoeInstance.escrow(bobOfferDesc, bobPayments);

    // 7: Bob does a claimAll on the escrowReceipt payment
    const bobEscrowReceipt = await escrowReceiptIssuer.claimAll(
      allegedBobEscrowReceipt,
    );

    // 8: Bob makes an offer with his escrow receipt
    const bobOfferMadeDesc = await automaticRefund.makeOffer(bobEscrowReceipt);

    t.equals(bobOfferMadeDesc, bobOfferDesc);
    t.equals(aliceOfferMadeDesc, aliceOfferDesc);

    // 9: Alice does a claimAll on her claimPayoff (she doesn't have
    // to if she already trusts Zoe, but we will in the tests.)
    const aliceClaimPayoff = await seatIssuer.claimAll(allegedAliceClaimPayoff);

    // 10: Bob does a claimAll on his claimPayoff (he doesn't have
    // to, but we will in the tests.)
    const bobClaimPayoff = await seatIssuer.claimAll(allegedBobClaimPayoff);

    // 11: Alice unwraps the claimPayoff to get her seat
    const aliceSeat = await aliceClaimPayoff.unwrap();

    // 12: Bob unwraps his claimPayoff to get his seat
    const bobSeat = await bobClaimPayoff.unwrap();

    // 9: Alice claims her portion of the outcome (what she put in,
    // since it's an automatic refund)
    const aliceResult = await aliceSeat.getPayoff();

    // 10: Bob claims his position of the outcome (what he put in,
    // since it's an automatic refund)
    const bobResult = await bobSeat.getPayoff();

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
    t.equals(bobSimoleanPurse.getBalance().quantity, 17);
  } catch (e) {
    t.assert(false, e);
    console.log(e);
  } finally {
    t.end();
  }
});

test('multiple zoeInstances for the same Zoe', async t => {
  try {
    // Setup zoe and mints
    const { issuers: originalIssuers, mints } = setup();
    const issuers = originalIssuers.slice(0, 2);
    const zoe = makeZoe();

    // Setup Alice
    const aliceMoolaPurse = mints[0].mint(issuers[0].makeAmount(30));
    const aliceMoolaPayment = aliceMoolaPurse.withdrawAll();
    const moola10 = issuers[0].makeAmount(10);
    const aliceMoolaPayments = issuers[0].split(aliceMoolaPayment, [
      moola10,
      moola10,
      moola10,
    ]);

    // 1: Alice creates 3 automatic refund instances
    const {
      zoeInstance: zoeInstance1,
      governingContract: automaticRefund1,
    } = zoe.makeInstance(makeAutomaticRefund, issuers);

    const {
      zoeInstance: zoeInstance2,
      governingContract: automaticRefund2,
    } = zoe.makeInstance(makeAutomaticRefund, issuers);

    const {
      zoeInstance: zoeInstance3,
      governingContract: automaticRefund3,
    } = zoe.makeInstance(makeAutomaticRefund, issuers);

    // 2: Alice escrows with zoeInstance1
    const aliceOfferDesc = harden([
      {
        rule: 'offerExactly',
        amount: issuers[0].makeAmount(10),
      },
      {
        rule: 'wantExactly',
        amount: issuers[1].makeAmount(7),
      },
    ]);
    const {
      escrowReceipt: aliceEscrowReceipt1,
      claimPayoff: aliceClaimPayoff1,
    } = await zoeInstance1.escrow(aliceOfferDesc, [
      aliceMoolaPayments[0],
      undefined,
    ]);

    // 3: Alice escrows with zoeInstance2
    const {
      escrowReceipt: aliceEscrowReceipt2,
      claimPayoff: aliceClaimPayoff2,
    } = await zoeInstance2.escrow(aliceOfferDesc, [
      aliceMoolaPayments[1],
      undefined,
    ]);

    // 4: Alice escrows with zoeInstance3
    const {
      escrowReceipt: aliceEscrowReceipt3,
      claimPayoff: aliceClaimPayoff3,
    } = await zoeInstance3.escrow(aliceOfferDesc, [
      aliceMoolaPayments[2],
      undefined,
    ]);

    // 5: Alice makes an offer with each of her escrow receipts
    await automaticRefund1.makeOffer(aliceEscrowReceipt1);
    await automaticRefund2.makeOffer(aliceEscrowReceipt2);
    await automaticRefund3.makeOffer(aliceEscrowReceipt3);

    // 6: Alice unwraps her claimPayoffs
    const aliceSeat1 = await aliceClaimPayoff1.unwrap();
    const aliceSeat2 = await aliceClaimPayoff2.unwrap();
    const aliceSeat3 = await aliceClaimPayoff3.unwrap();

    // 7: Alice gets her payoffs
    const aliceResult1 = await aliceSeat1.getPayoff();
    const aliceResult2 = await aliceSeat2.getPayoff();
    const aliceResult3 = await aliceSeat3.getPayoff();

    // Ensure that she got what she put in for each
    t.deepEquals(aliceResult1[0].getBalance(), aliceOfferDesc[0].amount);
    t.deepEquals(aliceResult2[0].getBalance(), aliceOfferDesc[0].amount);
    t.deepEquals(aliceResult3[0].getBalance(), aliceOfferDesc[0].amount);

    // Ensure that the number of offers received by each instance is one
    t.equals(automaticRefund1.getOffersCount(), 1);
    t.equals(automaticRefund2.getOffersCount(), 1);
    t.equals(automaticRefund3.getOffersCount(), 1);
  } catch (e) {
    t.assert(false, e);
    console.log(e);
  } finally {
    t.end();
  }
});
