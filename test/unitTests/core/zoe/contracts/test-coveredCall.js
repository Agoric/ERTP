import { test } from 'tape-promise/tape';
import harden from '@agoric/harden';

import { makeZoe } from '../../../../../core/zoe/zoe/zoe';
import { setup } from '../setupBasicMints';

import { offerEqual } from '../../../../../core/zoe/contractUtils';

test('zoe - coveredCall', async t => {
  try {
    const {
      mints: defaultMints,
      assays: defaultAssays,
      extentOps: defaultExtentOps,
    } = setup();
    const mints = defaultMints.slice(0, 2);
    const assays = defaultAssays.slice(0, 2);
    const extentOps = defaultExtentOps.slice(0, 2);
    const zoe = await makeZoe();
    const escrowReceiptAssay = zoe.getEscrowReceiptAssay();

    // Setup Alice
    const aliceMoolaPurse = mints[0].mint(assays[0].makeAssetDesc(3));
    const aliceMoolaPayment = aliceMoolaPurse.withdrawAll();
    const aliceSimoleanPurse = mints[1].mint(assays[1].makeAssetDesc(0));

    // Setup Bob
    const bobMoolaPurse = mints[0].mint(assays[0].makeAssetDesc(0));
    const bobSimoleanPurse = mints[1].mint(assays[1].makeAssetDesc(7));
    const bobSimoleanPayment = bobSimoleanPurse.withdrawAll();

    // 1: Alice creates a coveredCall instance
    const { instance: aliceCoveredCall, instanceId } = await zoe.makeInstance(
      'coveredCall',
      assays,
    );

    // The assays are defined at this step
    t.deepEquals(zoe.getAssaysForInstance(instanceId), assays);

    // 2: Alice escrows with Zoe
    const aliceOffer = harden([
      {
        rule: 'offerExactly',
        assetDesc: assays[0].makeAssetDesc(3),
      },
      {
        rule: 'wantExactly',
        assetDesc: assays[1].makeAssetDesc(7),
      },
    ]);
    const alicePayments = [aliceMoolaPayment, undefined];
    const {
      escrowReceipt: allegedAliceEscrowReceipt,
      claimPayoff: aliceClaimPayoff,
    } = await zoe.escrow(aliceOffer, alicePayments);

    // 3: Alice does a claimAll on the escrowReceipt payment
    const aliceEscrowReceipt = await escrowReceiptAssay.claimAll(
      allegedAliceEscrowReceipt,
    );

    // 3: Alice initializes the coveredCall with her escrow receipt

    // Alice gets two kinds of things back - invites (the ability to
    // make an offer) and a seat for herself (the right to claim after
    // an offer has been made). She gets a seat since she made an
    // offer. Bob gets an invite.
    const {
      outcome: aliceOutcome,
      invite: bobInvitePayment,
    } = await aliceCoveredCall.init(aliceEscrowReceipt);

    // Check that the assays and bobInvitePayment are as expected
    t.deepEquals(bobInvitePayment.getBalance().extent.src, 'coveredCall');
    t.deepEquals(bobInvitePayment.getBalance().extent.offerToBeMade, [
      {
        rule: 'wantExactly',
        assetDesc: assays[0].makeAssetDesc(3),
      },
      {
        rule: 'offerExactly',
        assetDesc: assays[1].makeAssetDesc(7),
      },
    ]);

    // 3: Imagine that Alice sends the invite to Bob (not done here
    // since this test doesn't actually have separate vats/parties)

    // 4: Bob inspects the invite payment and checks that the offerToBeMade
    // matches what he expects

    const bobIntendedOffer = harden([
      {
        rule: 'wantExactly',
        assetDesc: assays[0].makeAssetDesc(3),
      },
      {
        rule: 'offerExactly',
        assetDesc: assays[1].makeAssetDesc(7),
      },
    ]);

    t.ok(
      offerEqual(
        extentOps,
        bobInvitePayment.getBalance().extent.offerToBeMade,
        bobIntendedOffer,
      ),
    );

    t.equal(bobInvitePayment.getBalance().extent.src, 'coveredCall');

    // 5: Only after assaying the invite does he unwrap it (destroying
    // the ERTP invite) and accept it
    const bobInvite = await bobInvitePayment.unwrap();
    const bobPayments = [undefined, bobSimoleanPayment];

    // 6: Bob escrows
    const {
      escrowReceipt: allegedBobEscrowReceipt,
      claimPayoff: bobClaimPayoff,
    } = await zoe.escrow(bobIntendedOffer, bobPayments);

    // 7: Bob does a claimAll on the escrowReceipt payment
    const bobEscrowReceipt = await escrowReceiptAssay.claimAll(
      allegedBobEscrowReceipt,
    );

    // 8: Bob makes an offer with his escrow receipt
    const bobOutcome = await bobInvite.makeOffer(bobEscrowReceipt);

    t.equals(bobOutcome, 'offer successfully made');
    t.equals(aliceOutcome, 'offer successfully made');

    // 7: Alice unwraps the claimPayoff to get her seat
    const aliceSeat = await aliceClaimPayoff.unwrap();

    // 8: Bob unwraps his claimPayoff to get his seat
    const bobSeat = await bobClaimPayoff.unwrap();

    // 9: Alice claims her portion of the outcome (what Bob paid in)
    const aliceResult = await aliceSeat.getPayoff();

    // 10: Bob claims his position of the outcome (what Alice paid in)
    const bobResult = await bobSeat.getPayoff();

    // Alice gets back 0 of the kind she put in
    t.equals(aliceResult[0].getBalance().extent, 0);

    // Alice got what she wanted
    t.deepEquals(aliceResult[1].getBalance(), aliceOffer[1].assetDesc);

    // 11: Alice deposits her winnings to ensure she can
    await aliceMoolaPurse.depositAll(aliceResult[0]);
    await aliceSimoleanPurse.depositAll(aliceResult[1]);

    // 12: Bob deposits his winnings to ensure he can
    await bobMoolaPurse.depositAll(bobResult[0]);
    await bobSimoleanPurse.depositAll(bobResult[1]);

    // Assert that the correct outcome was achieved.
    // Alice had 3 moola and 0 simoleans.
    // Bob had 0 moola and 7 simoleans.
    // Now, Alice should have 0 moola and 7 simoleans.
    // Bob should have 3 moola and 0 simoleans.
    t.equals(aliceMoolaPurse.getBalance().extent, 0);
    t.equals(aliceSimoleanPurse.getBalance().extent, 7);
    t.equals(bobMoolaPurse.getBalance().extent, 3);
    t.equals(bobSimoleanPurse.getBalance().extent, 0);
  } catch (e) {
    t.isNot(e, e, 'unexpected exception');
  } finally {
    t.end();
  }
});
