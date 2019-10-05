import { test } from 'tape-promise/tape';
import harden from '@agoric/harden';

import { makeZoe } from '../../../../../core/zoe/zoe/zoe';
import { makeCoveredCallMaker } from '../../../../../core/zoe/contracts/coveredCall';
import { makeMint } from '../../../../../core/mint';

const setup = () => {
  const moolaMint = makeMint('moola');
  const simoleanMint = makeMint('simoleans');

  const moolaAssay = moolaMint.getAssay();
  const simoleanAssay = simoleanMint.getAssay();

  const moolaDescOps = moolaAssay.getDescOps();
  const simoleanDescOps = simoleanAssay.getDescOps();

  return harden({
    mints: [moolaMint, simoleanMint],
    assays: [moolaAssay, simoleanAssay],
    descOps: [moolaDescOps, simoleanDescOps],
    zoe: makeZoe(),
  });
};

test('zoe.makeInstance with simpleSwap', async t => {
  try {
    const { assays, mints, zoe } = setup();
    const escrowReceiptAssay = zoe.getEscrowReceiptAssay();

    // Setup Alice
    const aliceMoolaPurse = mints[0].mint(assays[0].makeAssetDesc(3));
    const aliceMoolaPayment = aliceMoolaPurse.withdrawAll();
    const aliceSimoleanPurse = mints[1].mint(assays[1].makeAssetDesc(0));
    const aliceSimoleanPayment = aliceSimoleanPurse.withdrawAll();

    // Setup Bob
    const bobMoolaPurse = mints[0].mint(assays[0].makeAssetDesc(0));
    const bobMoolaPayment = bobMoolaPurse.withdrawAll();
    const bobSimoleanPurse = mints[1].mint(assays[1].makeAssetDesc(7));
    const bobSimoleanPayment = bobSimoleanPurse.withdrawAll();

    // 1: Alice creates a simpleSwap instance
    const { zoeInstance, governingContract: simpleSwap } = zoe.makeInstance(
      makeCoveredCallMaker,
      assays,
    );

    // 2: Alice escrows with the zoeInstance
    const aliceOfferDesc = harden([
      {
        rule: 'haveExactly',
        assetDesc: assays[0].makeAssetDesc(3),
      },
      {
        rule: 'wantExactly',
        assetDesc: assays[1].makeAssetDesc(7),
      },
    ]);
    const alicePayments = [aliceMoolaPayment, aliceSimoleanPayment];
    const {
      escrowReceipt: allegedAliceEscrowReceipt,
      claimWinnings: aliceClaimWinnings,
    } = await zoeInstance.escrow(aliceOfferDesc, alicePayments);

    // 3: Alice does a claimAll on the escrowReceipt payment
    const aliceEscrowReceipt = await escrowReceiptAssay.claimAll(
      allegedAliceEscrowReceipt,
    );

    // 3: Alice initializes the swap with her escrow receipt

    // Alice gets two kinds of things back - invites (the ability to
    // make an offer) and a seat for herself (the right to claim after
    // an offer has been made). She gets a seat since she made an
    // offer. Bob gets an invite.
    const { offerMade: aliceOfferMadeDesc } = await simpleSwap.makeOffer(
      aliceEscrowReceipt,
    );

    // 3: Imagine that Bob also has access to the escrowReceiptAssay
    // and the automaticRefund

    // 4: Bob inspects the invite payment and checks that the offerToBeMade
    // matches what he expects

    const bobOfferDesc = harden([
      {
        rule: 'wantExactly',
        assetDesc: assays[0].makeAssetDesc(3),
      },
      {
        rule: 'haveExactly',
        assetDesc: assays[1].makeAssetDesc(7),
      },
    ]);
    const bobPayments = [bobMoolaPayment, bobSimoleanPayment];

    // 6: Bob escrows
    const {
      escrowReceipt: allegedBobEscrowReceipt,
      claimWinnings: bobClaimWinnings,
    } = await zoeInstance.escrow(bobOfferDesc, bobPayments);

    // 7: Bob does a claimAll on the escrowReceipt payment
    const bobEscrowReceipt = await escrowReceiptAssay.claimAll(
      allegedBobEscrowReceipt,
    );

    // 8: Bob makes an offer with his escrow receipt
    const { offerMade: bobOfferMadeDesc } = await simpleSwap.makeOffer(
      bobEscrowReceipt,
    );

    t.equals(await bobOfferMadeDesc, bobOfferDesc);
    t.equals(await aliceOfferMadeDesc, aliceOfferDesc);

    // 7: Alice unwraps the claimWinnings to get her seat
    const aliceSeat = await aliceClaimWinnings.unwrap();

    // 8: Bob unwraps his claimWinnings to get his seat
    const bobSeat = await bobClaimWinnings.unwrap();

    // 9: Alice claims her portion of the outcome (what Bob paid in)
    const aliceResult = await aliceSeat.getWinnings();

    // 10: Bob claims his position of the outcome (what Alice paid in)
    const bobResult = await bobSeat.getWinnings();

    // Alice gets back what she wanted
    t.deepEquals(aliceResult[1].getBalance(), aliceOfferDesc[1].assetDesc);

    // Alice didn't get any of what she put in
    t.equals(aliceResult[0].getBalance().extent, 0);

    // 11: Alice deposits her refund to ensure she can
    await aliceMoolaPurse.depositAll(aliceResult[0]);
    await aliceSimoleanPurse.depositAll(aliceResult[1]);

    // 12: Bob deposits his original payments to ensure he can
    await bobMoolaPurse.depositAll(bobResult[0]);
    await bobSimoleanPurse.depositAll(bobResult[1]);

    // Assert that the correct refund was achieved.
    // Alice had 3 moola and 0 simoleans.
    // Bob had 0 moola and 7 simoleans.
    t.equals(aliceMoolaPurse.getBalance().extent, 0);
    t.equals(aliceSimoleanPurse.getBalance().extent, 7);
    t.equals(bobMoolaPurse.getBalance().extent, 3);
    t.equals(bobSimoleanPurse.getBalance().extent, 0);
  } catch (e) {
    t.assert(false, e);
    console.log(e);
  } finally {
    t.end();
  }
});
