import { test } from 'tape-promise/tape';
import harden from '@agoric/harden';
import bundleSource from '@agoric/bundle-source';

import { makeZoe } from '../../../../../core/zoe/zoe';
import { setup } from '../setupBasicMints';
import buildManualTimer from '../../../../../tools/manualTimer';
import { sameStructure } from '../../../../../util/sameStructure';

const coveredCallRoot = `${__dirname}/../../../../../core/zoe/contracts/coveredCall`;
const publicSwapRoot = `${__dirname}/../../../../../core/zoe/contracts/publicSwap`;

test('zoe - coveredCall', async t => {
  try {
    const {
      mints: defaultMints,
      assays: defaultAssays,
      moola,
      simoleans,
      unitOps,
    } = setup();
    const mints = defaultMints.slice(0, 2);
    const assays = defaultAssays.slice(0, 2);
    const zoe = makeZoe({ require });
    // Pack the contract.
    const { source, moduleFormat } = await bundleSource(coveredCallRoot);
    const coveredCallInstallationHandle = zoe.install(source, moduleFormat);
    const timer = buildManualTimer(console.log);

    // Setup Alice
    const aliceMoolaPurse = mints[0].mint(moola(3));
    const aliceMoolaPayment = aliceMoolaPurse.withdrawAll();
    const aliceSimoleanPurse = mints[1].mint(simoleans(0));

    // Setup Bob
    const bobMoolaPurse = mints[0].mint(moola(0));
    const bobSimoleanPurse = mints[1].mint(simoleans(7));
    const bobSimoleanPayment = bobSimoleanPurse.withdrawAll();

    // 1: Alice creates a coveredCall instance
    const terms = {
      assays,
    };
    const { invite: aliceInvite } = await zoe.makeInstance(
      coveredCallInstallationHandle,
      terms,
    );

    // 2: Alice escrows with Zoe
    const aliceOfferRules = harden({
      payoutRules: [
        {
          kind: 'offer',
          units: moola(3),
        },
        {
          kind: 'want',
          units: simoleans(7),
        },
      ],
      exitRule: {
        kind: 'afterDeadline',
        deadline: 1,
        timer,
      },
    });
    const alicePayments = [aliceMoolaPayment, undefined];
    const { seat: aliceSeat, payout: alicePayoutP } = await zoe.redeem(
      aliceInvite,
      aliceOfferRules,
      alicePayments,
    );

    // 3: Alice creates a call option

    const option = aliceSeat.makeCallOption();

    // Imagine that Alice sends the option to Bob for free (not done here
    // since this test doesn't actually have separate vats/parties)

    // 4: Bob inspects the option (an invite payment) and checks that it is the
    // contract instance that he expects as well as that Alice has
    // already escrowed.

    const inviteAssay = zoe.getInviteAssay();
    const bobExclOption = await inviteAssay.claimAll(option);
    const optionExtent = bobExclOption.getBalance().extent;
    const { installationHandle } = zoe.getInstance(optionExtent.instanceHandle);
    t.equal(installationHandle, coveredCallInstallationHandle);
    t.equal(optionExtent.seatDesc, 'exerciseOption');
    t.ok(unitOps[0].equals(optionExtent.underlyingAsset, moola(3)));
    t.ok(unitOps[1].equals(optionExtent.strikePrice, simoleans(7)));
    t.equal(optionExtent.expirationDate, 1);
    t.deepEqual(optionExtent.timerAuthority, timer);

    const bobPayments = [undefined, bobSimoleanPayment];

    const bobOfferRules = harden({
      payoutRules: [
        {
          kind: 'want',
          units: optionExtent.underlyingAsset,
        },
        {
          kind: 'offer',
          units: optionExtent.strikePrice,
        },
      ],
      exitRule: {
        kind: 'onDemand',
      },
    });

    // 6: Bob escrows
    const { seat: bobSeat, payout: bobPayoutP } = await zoe.redeem(
      bobExclOption,
      bobOfferRules,
      bobPayments,
    );

    // 8: Bob makes an offer with his escrow receipt
    const bobOutcome = await bobSeat.exercise();

    t.equals(
      bobOutcome,
      'The offer has been accepted. Once the contract has been completed, please check your payout',
    );

    const bobPayout = await bobPayoutP;
    const alicePayout = await alicePayoutP;

    const [bobMoolaPayout, bobSimoleanPayout] = await Promise.all(bobPayout);
    const [aliceMoolaPayout, aliceSimoleanPayout] = await Promise.all(
      alicePayout,
    );

    // Alice gets what Alice wanted
    t.deepEquals(
      aliceSimoleanPayout.getBalance(),
      aliceOfferRules.payoutRules[1].units,
    );

    // Alice didn't get any of what Alice put in
    t.equals(aliceMoolaPayout.getBalance().extent, 0);

    // 13: Alice deposits her payout to ensure she can
    await aliceMoolaPurse.depositAll(aliceMoolaPayout);
    await aliceSimoleanPurse.depositAll(aliceSimoleanPayout);

    // 14: Bob deposits his original payments to ensure he can
    await bobMoolaPurse.depositAll(bobMoolaPayout);
    await bobSimoleanPurse.depositAll(bobSimoleanPayout);

    // Assert that the correct payouts were received.
    // Alice had 3 moola and 0 simoleans.
    // Bob had 0 moola and 7 simoleans.
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

test(`zoe - coveredCall - alice's deadline expires, cancelling alice and bob`, async t => {
  try {
    const {
      mints: defaultMints,
      assays: defaultAssays,
      moola,
      simoleans,
      unitOps,
    } = setup();
    const mints = defaultMints.slice(0, 2);
    const assays = defaultAssays.slice(0, 2);
    const zoe = makeZoe({ require });
    // Pack the contract.
    const { source, moduleFormat } = await bundleSource(coveredCallRoot);
    const coveredCallInstallationHandle = zoe.install(source, moduleFormat);
    const timer = buildManualTimer(console.log);

    // Setup Alice
    const aliceMoolaPurse = mints[0].mint(moola(3));
    const aliceMoolaPayment = aliceMoolaPurse.withdrawAll();
    const aliceSimoleanPurse = mints[1].mint(simoleans(0));

    // Setup Bob
    const bobMoolaPurse = mints[0].mint(moola(0));
    const bobSimoleanPurse = mints[1].mint(simoleans(7));
    const bobSimoleanPayment = bobSimoleanPurse.withdrawAll();

    // 1: Alice creates a coveredCall instance
    const terms = {
      assays,
    };
    const { invite: aliceInvite } = await zoe.makeInstance(
      coveredCallInstallationHandle,
      terms,
    );

    // 2: Alice escrows with Zoe
    const aliceOfferRules = harden({
      payoutRules: [
        {
          kind: 'offer',
          units: moola(3),
        },
        {
          kind: 'want',
          units: simoleans(7),
        },
      ],
      exitRule: {
        kind: 'afterDeadline',
        deadline: 1,
        timer,
      },
    });
    const alicePayments = [aliceMoolaPayment, undefined];
    const { seat: aliceSeat, payout: alicePayoutP } = await zoe.redeem(
      aliceInvite,
      aliceOfferRules,
      alicePayments,
    );

    // 3: Alice gets an option
    const option = aliceSeat.makeCallOption();
    timer.tick();

    // Imagine that Alice sends the option to Bob for free (not done here
    // since this test doesn't actually have separate vats/parties)

    // 4: Bob inspects the option (an invite payment) and checks that it is the
    // contract instance that he expects as well as that Alice has
    // already escrowed.

    const inviteAssay = zoe.getInviteAssay();
    const bobExclOption = await inviteAssay.claimAll(option);
    const optionExtent = bobExclOption.getBalance().extent;
    const { installationHandle } = zoe.getInstance(optionExtent.instanceHandle);
    t.equal(installationHandle, coveredCallInstallationHandle);
    t.equal(optionExtent.seatDesc, 'exerciseOption');
    t.ok(unitOps[0].equals(optionExtent.underlyingAsset, moola(3)));
    t.ok(unitOps[1].equals(optionExtent.strikePrice, simoleans(7)));
    t.equal(optionExtent.expirationDate, 1);
    t.deepEqual(optionExtent.timerAuthority, timer);

    const bobPayments = [undefined, bobSimoleanPayment];

    const bobOfferRules = harden({
      payoutRules: [
        {
          kind: 'want',
          units: optionExtent.underlyingAsset,
        },
        {
          kind: 'offer',
          units: optionExtent.strikePrice,
        },
      ],
      exitRule: {
        kind: 'onDemand',
      },
    });

    // 6: Bob escrows
    const { seat: bobSeat, payout: bobPayoutP } = await zoe.redeem(
      bobExclOption,
      bobOfferRules,
      bobPayments,
    );

    t.throws(() => bobSeat.exercise(), /The covered call option is expired/);

    const bobPayout = await bobPayoutP;
    const alicePayout = await alicePayoutP;

    const [bobMoolaPayout, bobSimoleanPayout] = await Promise.all(bobPayout);
    const [aliceMoolaPayout, aliceSimoleanPayout] = await Promise.all(
      alicePayout,
    );

    // Alice gets back what she put in
    t.deepEquals(aliceMoolaPayout.getBalance(), moola(3));

    // Alice doesn't get what she wanted
    t.deepEquals(aliceSimoleanPayout.getBalance(), simoleans(0));

    // 11: Alice deposits her winnings to ensure she can
    await aliceMoolaPurse.depositAll(aliceMoolaPayout);
    await aliceSimoleanPurse.depositAll(aliceSimoleanPayout);

    // 12: Bob deposits his winnings to ensure he can
    await bobMoolaPurse.depositAll(bobMoolaPayout);
    await bobSimoleanPurse.depositAll(bobSimoleanPayout);

    // Assert that the correct outcome was achieved.
    // Alice had 3 moola and 0 simoleans.
    // Bob had 0 moola and 7 simoleans.
    t.deepEquals(aliceMoolaPurse.getBalance(), moola(3));
    t.deepEquals(aliceSimoleanPurse.getBalance(), simoleans(0));
    t.deepEquals(bobMoolaPurse.getBalance(), moola(0));
    t.deepEquals(bobSimoleanPurse.getBalance(), simoleans(7));
  } catch (e) {
    t.isNot(e, e, 'unexpected exception');
  } finally {
    t.end();
  }
});

// Alice makes a covered call and escrows. She shares the invite to
// Bob. Bob tries to sell the invite to Dave through a swap. Can Bob
// trick Dave? Can Dave describe what it is that he wants in the swap
// offer description?
test('zoe - coveredCall with swap for invite', async t => {
  try {
    // Setup the environment
    const { mints, assays } = setup();
    const [moolaMint, simoleanMint, bucksMint] = mints;
    const [moolaAssay, simoleanAssay, bucksAssay] = assays;
    const timer = buildManualTimer(console.log);
    const zoe = makeZoe({ require });
    // Pack the contract.
    const { source, moduleFormat } = await bundleSource(coveredCallRoot);

    const coveredCallInstallationHandle = zoe.install(source, moduleFormat);
    const {
      source: swapSource,
      moduleFormat: swapModuleFormat,
    } = await bundleSource(publicSwapRoot);

    const swapInstallationId = zoe.install(swapSource, swapModuleFormat);

    // Setup Alice
    // Alice starts with 3 moola
    const aliceMoolaPurse = moolaMint.mint(moolaAssay.makeUnits(3));
    const aliceMoolaPayment = aliceMoolaPurse.withdrawAll();
    const aliceSimoleanPurse = simoleanMint.mint(simoleanAssay.makeUnits(0));

    // Setup Bob
    // Bob starts with nothing
    const bobMoolaPurse = moolaMint.mint(moolaAssay.makeUnits(0));
    const bobSimoleanPurse = simoleanMint.mint(simoleanAssay.makeUnits(0));
    const bobBucksPurse = bucksMint.mint(bucksAssay.makeUnits(0));

    // Setup Dave
    // Dave starts with 1 buck
    const daveMoolaPurse = moolaMint.mint(moolaAssay.makeUnits(0));
    const daveSimoleanPurse = simoleanMint.mint(simoleanAssay.makeUnits(7));
    const daveBucksPurse = bucksMint.mint(bucksAssay.makeUnits(1));
    const daveBucksPayment = daveBucksPurse.withdrawAll();
    const daveSimoleanPayment = daveSimoleanPurse.withdrawAll();

    // 1: Alice creates a coveredCall instance of moola for simoleans
    const terms = harden({
      assays: [moolaAssay, simoleanAssay],
    });
    const {
      instance: aliceCoveredCall,
      instanceHandle,
    } = await zoe.makeInstance(coveredCallInstallationHandle, terms);

    // 2: Alice escrows with Zoe. She specifies her offer offerRules,
    // which include an offer description as well as the exit
    // offerRules. In this case, she choses an exit condition of after
    // the deadline of "100" according to a particular timer. This is
    // meant to be something far in the future, and will not be
    // reached in this test.

    const aliceOfferRules = harden({
      payoutRules: [
        {
          kind: 'offer',
          units: assays[0].makeUnits(3),
        },
        {
          kind: 'want',
          units: assays[1].makeUnits(7),
        },
      ],
      exitRule: {
        kind: 'afterDeadline',
        deadline: 100, // we will not reach this
        timer,
      },
    });
    const alicePayments = [aliceMoolaPayment, undefined];
    const {
      escrowReceipt: aliceEscrowReceipt,
      payout: alicePayoutP,
    } = await zoe.escrow(aliceOfferRules, alicePayments);

    // 3: Alice initializes the coveredCall with her escrow receipt

    // Alice gets two kinds of things back - she gets an 'outcome'
    // which is just a message that the offer was accepted or
    // rejected. She also gets an invite, which is an ERTP payment
    // that can be unwrapped to get an object with a `matchOffer`
    // method. The invite is the only way to make a counter-offer in
    // this particular contract. It is not public.
    const {
      outcome: aliceOutcome,
      invite: bobInvitePayment,
    } = await aliceCoveredCall.makeFirstOffer(aliceEscrowReceipt);

    t.equals(
      aliceOutcome,
      'The offer has been accepted. Once the contract has been completed, please check your payout',
    );

    // 4: Imagine that Alice sends the invite to Bob as well as the
    // instanceHandle (not done here since this test doesn't actually have
    // separate vats/parties)

    // 5: Bob inspects the invite payment and checks its information against the
    // questions that he has about whether it is worth being a counter
    // party in the covered call: Did the covered call use the
    // expected covered call installation (code)? Does it use the assays
    // that he expects (moola and simoleans)?

    const inviteExtent = bobInvitePayment.getBalance().extent;

    // Does the instanceHandle in the invite match what Alice told him?
    t.equal(inviteExtent.instanceHandle, instanceHandle);

    const {
      terms: inviteTerms,
      installationHandle: inviteInstallationHandle,
    } = zoe.getInstance(instanceHandle);

    // Is the installation as expected?
    t.equal(inviteInstallationHandle, coveredCallInstallationHandle);

    // Are the assays and other terms as expected?
    t.ok(
      sameStructure(
        inviteTerms,
        harden({ assays: [moolaAssay, simoleanAssay] }),
      ),
    );

    // Do bob's expected offer offerRules match what the covered call
    // expects from a counter-party?

    const bobExpectationsOfAliceOfferRules = harden({
      payoutRules: [
        {
          kind: 'offer',
          units: assays[0].makeUnits(3),
        },
        {
          kind: 'want',
          units: assays[1].makeUnits(7),
        },
      ],
      exitRule: {
        kind: 'afterDeadline',
        deadline: 100, // we will not reach this
        timer,
      },
    });

    t.ok(
      sameStructure(
        inviteExtent.offerMadeRules,
        bobExpectationsOfAliceOfferRules,
      ),
    );

    // Bob's planned offerRules
    const bobOfferRulesCoveredCall = harden({
      payoutRules: [
        {
          kind: 'want',
          units: assays[0].makeUnits(3),
        },
        {
          kind: 'offer',
          units: assays[1].makeUnits(7),
        },
      ],
      exitRule: {
        kind: 'onDemand',
      },
    });

    t.ok(
      sameStructure(
        inviteExtent.offerToBeMade,
        bobOfferRulesCoveredCall.payoutRules,
      ),
    );

    // Satisfied with the description, Bob claims all with the Zoe
    // inviteAssay and can therefore know that it was a valid invite
    const inviteAssay = zoe.getInviteAssay();
    const bobExclInvitePayment = await inviteAssay.claimAll(bobInvitePayment);

    // Let's imagine that Bob wants to create a swap to trade this
    // invite for bucks.
    const {
      instance: bobSwap,
      instanceHandle: bobSwapInstanceHandle,
    } = await zoe.makeInstance(swapInstallationId, {
      assays: harden([inviteAssay, bucksAssay]),
    });

    // Bob wants to swap an invite with the same units as his
    // current invite from Alice. He wants 1 buck in return.
    const bobOfferRulesSwap = harden({
      payoutRules: [
        {
          kind: 'offer',
          units: bobExclInvitePayment.getBalance(),
        },
        {
          kind: 'want',
          units: bucksAssay.makeUnits(1),
        },
      ],
      exitRule: {
        kind: 'onDemand',
      },
    });

    const bobPayments = [bobExclInvitePayment, undefined];

    // 6: Bob escrows his invite
    const {
      escrowReceipt: bobEscrowReceipt,
      payout: bobPayoutP,
    } = await zoe.escrow(bobOfferRulesSwap, bobPayments);

    // 8: Bob makes an offer to the swap with his "higher order" escrow receipt
    const bobOutcome = await bobSwap.makeFirstOffer(bobEscrowReceipt);

    t.equals(
      bobOutcome,
      'The offer has been accepted. Once the contract has been completed, please check your payout',
    );

    // Bob passes the swap instance id to Dave and tells him about
    // what kind of offer the swap is for (Dave doesn't necessarily
    // trust this, but he can use the information). This swap is a
    // public swap in that only having the instanceHandle for the swap is
    // enough to get access to the swap.

    const {
      instance: daveSwapInstance,
      installationHandle: daveSwapInstallId,
      terms: daveSwapTerms,
    } = zoe.getInstance(bobSwapInstanceHandle);

    // Dave is looking to buy the option to trade his 7 simoleans for
    // 3 moola, and is willing to pay 1 buck for the option. He
    // checks that this instance matches what he wants

    // Did this swap use the correct swap installation? Yes
    t.equal(daveSwapInstallId, swapInstallationId);

    // Is this swap for the correct assays and has no other terms? Yes
    t.ok(
      sameStructure(
        daveSwapTerms,
        harden({
          assays: harden([inviteAssay, bucksAssay]),
        }),
      ),
    );

    // What's actually up to be bought? Is it the kind of invite that
    // Dave wants? What's the price for that invite? Is it acceptable
    // to Dave? Bob can tell Dave this out of band, and if he lies,
    // Dave's offer will be rejected and he will get a refund. Dave
    // knows this to be true because he knows the swap.

    // Dave escrows his 1 buck with Zoe and forms his offer offerRules
    const daveSwapOfferRules = harden({
      payoutRules: [
        {
          kind: 'want',
          units: bobOfferRulesSwap.payoutRules[0].units,
        },
        {
          kind: 'offer',
          units: bucksAssay.makeUnits(1),
        },
      ],
      exitRule: {
        kind: 'onDemand',
      },
    });

    const daveSwapPayments = [undefined, daveBucksPayment];
    const {
      escrowReceipt: daveSwapEscrowReceipt,
      payout: daveSwapPayoutP,
    } = await zoe.escrow(daveSwapOfferRules, daveSwapPayments);

    const daveSwapOutcome = await daveSwapInstance.matchOffer(
      daveSwapEscrowReceipt,
    );
    t.equals(
      daveSwapOutcome,
      'The offer has been accepted. Once the contract has been completed, please check your payout',
    );

    const [coveredCallInvite, daveBucksPayout] = await daveSwapPayoutP;

    const coveredCallObj = await coveredCallInvite.unwrap();

    // Dave exercises his option by making an offer to the covered
    // call. First, he escrows with Zoe.

    const daveCoveredCallOfferRules = harden({
      payoutRules: [
        {
          kind: 'want',
          units: moolaAssay.makeUnits(3),
        },
        {
          kind: 'offer',
          units: simoleanAssay.makeUnits(7),
        },
      ],
      exitRule: {
        kind: 'onDemand',
      },
    });
    const daveCoveredCallPayments = [undefined, daveSimoleanPayment];
    const {
      escrowReceipt: daveCoveredCallEscrowReceipt,
      payout: daveCoveredCallPayoutP,
    } = await zoe.escrow(daveCoveredCallOfferRules, daveCoveredCallPayments);

    const daveCoveredCallOutcome = await coveredCallObj.matchOffer(
      daveCoveredCallEscrowReceipt,
    );
    t.equals(
      daveCoveredCallOutcome,
      'The offer has been accepted. Once the contract has been completed, please check your payout',
    );

    // Dave should get 3 moola, Bob should get 1 buck, and Alice
    // get 7 simoleans
    const daveCoveredCallResult = await daveCoveredCallPayoutP;
    const aliceResult = await alicePayoutP;
    const bobResult = await bobPayoutP;

    t.deepEquals(
      daveCoveredCallResult[0].getBalance(),
      moolaAssay.makeUnits(3),
    );
    t.deepEquals(
      daveCoveredCallResult[1].getBalance(),
      simoleanAssay.makeUnits(0),
    );

    t.deepEquals(aliceResult[0].getBalance(), moolaAssay.makeUnits(0));
    t.deepEquals(aliceResult[1].getBalance(), simoleanAssay.makeUnits(7));

    t.deepEquals(bobResult[0].getBalance(), inviteAssay.makeUnits(null));
    t.deepEquals(bobResult[1].getBalance(), bucksAssay.makeUnits(1));

    // Alice deposits her payouts
    await aliceMoolaPurse.depositAll(aliceResult[0]);
    await aliceSimoleanPurse.depositAll(aliceResult[1]);

    // Bob deposits his payouts
    await bobBucksPurse.depositAll(bobResult[1]);

    // Dave deposits his payouts
    await daveMoolaPurse.depositAll(daveCoveredCallResult[0]);
    await daveSimoleanPurse.depositAll(daveCoveredCallResult[1]);
    await daveBucksPurse.depositAll(daveBucksPayout);

    t.equals(aliceMoolaPurse.getBalance().extent, 0);
    t.equals(aliceSimoleanPurse.getBalance().extent, 7);

    t.equals(bobMoolaPurse.getBalance().extent, 0);
    t.equals(bobSimoleanPurse.getBalance().extent, 0);
    t.equals(bobBucksPurse.getBalance().extent, 1);

    t.equals(daveMoolaPurse.getBalance().extent, 3);
    t.equals(daveSimoleanPurse.getBalance().extent, 0);
    t.equals(daveBucksPurse.getBalance().extent, 0);
  } catch (e) {
    t.isNot(e, e, 'unexpected exception');
  } finally {
    t.end();
  }
});

// Alice makes a covered call and escrows. She shares the invite to
// Bob. Bob tries to sell the invite to Dave through another covered
// call. Can Bob trick Dave? Can Dave describe what it is that he
// wants in his offer description in the second covered call?
test('zoe - coveredCall with coveredCall for invite', async t => {
  try {
    // Setup the environment
    const { mints, assays } = setup();
    const [moolaMint, simoleanMint, bucksMint] = mints;
    const [moolaAssay, simoleanAssay, bucksAssay] = assays;
    const timer = buildManualTimer(console.log);
    const zoe = makeZoe({ require });
    // Pack the contract.
    const { source, moduleFormat } = await bundleSource(coveredCallRoot);

    const coveredCallInstallationHandle = zoe.install(source, moduleFormat);

    // Setup Alice
    // Alice starts with 3 moola
    const aliceMoolaPurse = moolaMint.mint(moolaAssay.makeUnits(3));
    const aliceSimoleanPurse = simoleanMint.mint(simoleanAssay.makeUnits(0));
    const aliceMoolaPayment = aliceMoolaPurse.withdrawAll();

    // Setup Bob
    // Bob starts with nothing
    const bobMoolaPurse = moolaMint.mint(moolaAssay.makeUnits(0));
    const bobSimoleanPurse = simoleanMint.mint(simoleanAssay.makeUnits(0));
    const bobBucksPurse = bucksMint.mint(bucksAssay.makeUnits(0));

    // Setup Dave
    // Dave starts with 1 buck and 7 simoleans
    const daveMoolaPurse = moolaMint.mint(moolaAssay.makeUnits(0));
    const daveSimoleanPurse = simoleanMint.mint(simoleanAssay.makeUnits(7));
    const daveBucksPurse = bucksMint.mint(bucksAssay.makeUnits(1));
    const daveBucksPayment = daveBucksPurse.withdrawAll();
    const daveSimoleanPayment = daveSimoleanPurse.withdrawAll();

    // 1: Alice creates a coveredCall instance of moola for simoleans
    const terms = harden({
      assays: [moolaAssay, simoleanAssay],
    });
    const {
      instance: aliceCoveredCall,
      instanceHandle,
    } = await zoe.makeInstance(coveredCallInstallationHandle, terms);

    // 2: Alice escrows with Zoe. She specifies her offer offerRules,
    // which include an offer description as well as the exit
    // offerRules. In this case, she choses an exit condition of after
    // the deadline of "100" according to a particular timer. This is
    // meant to be something far in the future, and will not be
    // reached in this test.

    const aliceOfferRules = harden({
      payoutRules: [
        {
          kind: 'offer',
          units: assays[0].makeUnits(3),
        },
        {
          kind: 'want',
          units: assays[1].makeUnits(7),
        },
      ],
      exitRule: {
        kind: 'afterDeadline',
        deadline: 100, // we will not reach this
        timer,
      },
    });
    const alicePayments = [aliceMoolaPayment, undefined];
    const {
      escrowReceipt: aliceEscrowReceipt,
      payout: alicePayoutP,
    } = await zoe.escrow(aliceOfferRules, alicePayments);

    // 3: Alice initializes the coveredCall with her escrow receipt

    // Alice gets two kinds of things back - she gets an 'outcome'
    // which is just a message that the offer was accepted or
    // rejected. She also gets an invite, which is an ERTP payment
    // that can be unwrapped to get an object with a `matchOffer`
    // method. The invite is the only way to make a counter-offer in
    // this particular contract. It is not public.
    const {
      outcome: aliceOutcome,
      invite: bobInvitePayment,
    } = await aliceCoveredCall.makeFirstOffer(aliceEscrowReceipt);

    t.equals(
      aliceOutcome,
      'The offer has been accepted. Once the contract has been completed, please check your payout',
    );

    // 4: Imagine that Alice sends the invite to Bob as well as the
    // instanceHandle (not done here since this test doesn't actually have
    // separate vats/parties)

    // 5: Bob inspects the invite payment and checks its information against the
    // questions that he has about whether it is worth being a counter
    // party in the covered call: Did the covered call use the
    // expected covered call installation (code)? Does it use the assays
    // that he expects (moola and simoleans)?

    const inviteExtent = bobInvitePayment.getBalance().extent;

    // Does the instanceHandle in the invite match what Alice told him?
    t.equal(inviteExtent.instanceHandle, instanceHandle);

    const {
      installationHandle: inviteInstallationHandle,
      terms: inviteTerms,
    } = zoe.getInstance(instanceHandle);

    // Is the installation as expected?
    t.equal(inviteInstallationHandle, coveredCallInstallationHandle);

    // Are the assays and other terms as expected?
    t.ok(
      sameStructure(
        inviteTerms,
        harden({ assays: [moolaAssay, simoleanAssay] }),
      ),
    );

    // Do bob's expected offer offerRules match what the covered call
    // expects from a counter-party?

    const bobExpectationsOfAliceOfferRules = harden({
      payoutRules: [
        {
          kind: 'offer',
          units: assays[0].makeUnits(3),
        },
        {
          kind: 'want',
          units: assays[1].makeUnits(7),
        },
      ],
      exitRule: {
        kind: 'afterDeadline',
        deadline: 100, // we will not reach this
        timer,
      },
    });

    t.ok(
      sameStructure(
        inviteExtent.offerMadeRules,
        bobExpectationsOfAliceOfferRules,
      ),
    );

    // Bob's planned offerRules
    const bobOfferRulesCoveredCall = harden({
      payoutRules: [
        {
          kind: 'want',
          units: assays[0].makeUnits(3),
        },
        {
          kind: 'offer',
          units: assays[1].makeUnits(7),
        },
      ],
      exitRule: {
        kind: 'onDemand',
      },
    });

    t.ok(
      sameStructure(
        inviteExtent.offerToBeMade,
        bobOfferRulesCoveredCall.payoutRules,
      ),
    );

    // Satisfied with the description, Bob claims all with the Zoe
    // inviteAssay and can therefore know that it was a valid invite
    const inviteAssay = zoe.getInviteAssay();
    const bobExclInvitePayment = await inviteAssay.claimAll(bobInvitePayment);

    // Let's imagine that Bob wants to create another coveredCall, but
    // this time to trade this invite for bucks.
    const {
      instance: bobSecondCoveredCall,
      instanceHandle: secondCoveredCallInstanceHandle,
    } = await zoe.makeInstance(
      coveredCallInstallationHandle,
      harden({
        assays: [inviteAssay, bucksAssay],
      }),
    );

    // Bob wants to swap an invite with the same units as his
    // current invite from Alice. He wants 1 buck in return.
    const firstCoveredCallInviteAssetDec = bobExclInvitePayment.getBalance();
    const bobOfferRulesSecondCoveredCall = harden({
      payoutRules: [
        {
          kind: 'offer',
          units: firstCoveredCallInviteAssetDec,
        },
        {
          kind: 'want',
          units: bucksAssay.makeUnits(1),
        },
      ],
      exitRule: {
        kind: 'afterDeadline',
        deadline: 100, // we will not reach this
        timer,
      },
    });

    const bobPayments = [bobExclInvitePayment, undefined];

    // 6: Bob escrows his invite
    const {
      escrowReceipt: bobEscrowReceipt,
      payout: bobPayoutP,
    } = await zoe.escrow(bobOfferRulesSecondCoveredCall, bobPayments);

    // 8: Bob makes an offer to the swap with his "higher order" escrow receipt
    const {
      outcome: bobOutcome,
      invite: inviteForDave,
    } = await bobSecondCoveredCall.makeFirstOffer(bobEscrowReceipt);

    t.equals(
      bobOutcome,
      'The offer has been accepted. Once the contract has been completed, please check your payout',
    );

    // Bob passes the invite to the higher order covered call and
    // instanceHandle to Dave

    // Dave is looking to buy the option to trade his 7 simoleans for
    // 3 moola, and is willing to pay 1 buck for the option. He
    // checks that this invite matches what he wants

    const daveInviteExtent = inviteForDave.getBalance().extent;

    // Does the instanceHandle in the invite match what Bob told him?
    t.equal(daveInviteExtent.instanceHandle, secondCoveredCallInstanceHandle);

    const {
      installationHandle: daveInviteInstallationHandle,
      terms: daveInviteTerms,
    } = zoe.getInstance(daveInviteExtent.instanceHandle);

    // Is the installation as expected?
    t.equal(daveInviteInstallationHandle, coveredCallInstallationHandle);

    // Are the assays and other terms as expected?
    t.ok(
      sameStructure(
        daveInviteTerms,
        harden({ assays: [inviteAssay, bucksAssay] }),
      ),
    );

    // Do dave's expected offer offerRules match what the covered call
    // expects from a counter-party?

    const daveExpectationsOfBobOfferRules = harden({
      payoutRules: [
        {
          kind: 'offer',
          units: firstCoveredCallInviteAssetDec,
        },
        {
          kind: 'want',
          units: bucksAssay.makeUnits(1),
        },
      ],
      exitRule: {
        kind: 'afterDeadline',
        deadline: 100, // we will not reach this
        timer,
      },
    });

    t.ok(
      sameStructure(
        daveInviteExtent.offerMadeRules,
        daveExpectationsOfBobOfferRules,
      ),
    );

    // Dave's planned offerRules
    const daveOfferRulesCoveredCall = harden({
      payoutRules: [
        {
          kind: 'want',
          units: firstCoveredCallInviteAssetDec,
        },
        {
          kind: 'offer',
          units: bucksAssay.makeUnits(1),
        },
      ],
      exitRule: {
        kind: 'onDemand',
      },
    });

    t.ok(
      sameStructure(
        daveInviteExtent.offerToBeMade,
        daveOfferRulesCoveredCall.payoutRules,
      ),
    );

    // Satisfied with the description, Dave claims all with the Zoe
    // inviteAssay and can therefore know that it was a valid invite
    const secondCoveredCallInvite = await inviteAssay.claimAll(inviteForDave);

    // Dave escrows his 1 buck with Zoe and forms his offer offerRules

    const daveSecondCoveredCallPayments = [undefined, daveBucksPayment];
    const {
      escrowReceipt: daveCoveredCallEscrowReceipt,
      payout: daveSecondCoveredCallPayoutP,
    } = await zoe.escrow(
      daveOfferRulesCoveredCall,
      daveSecondCoveredCallPayments,
    );
    const secondCoveredCallObj = await secondCoveredCallInvite.unwrap();
    const daveSecondCoveredCallOutcome = await secondCoveredCallObj.matchOffer(
      daveCoveredCallEscrowReceipt,
    );
    t.equals(
      daveSecondCoveredCallOutcome,
      'The offer has been accepted. Once the contract has been completed, please check your payout',
    );

    const [
      firstCoveredCallInvite,
      daveBucksPayout,
    ] = await daveSecondCoveredCallPayoutP;

    const firstCoveredCallObj = await firstCoveredCallInvite.unwrap();

    // Dave exercises his option by making an offer to the covered
    // call. First, he escrows with Zoe.

    const daveFirstCoveredCallOfferRules = harden({
      payoutRules: [
        {
          kind: 'want',
          units: moolaAssay.makeUnits(3),
        },
        {
          kind: 'offer',
          units: simoleanAssay.makeUnits(7),
        },
      ],
      exitRule: {
        kind: 'onDemand',
      },
    });
    const daveFirstCoveredCallPayments = [undefined, daveSimoleanPayment];
    const {
      escrowReceipt: daveFirstCoveredCallEscrowReceipt,
      payout: daveFirstCoveredCallPayoutP,
    } = await zoe.escrow(
      daveFirstCoveredCallOfferRules,
      daveFirstCoveredCallPayments,
    );

    const daveFirstCoveredCallOutcome = await firstCoveredCallObj.matchOffer(
      daveFirstCoveredCallEscrowReceipt,
    );
    t.equals(
      daveFirstCoveredCallOutcome,
      'The offer has been accepted. Once the contract has been completed, please check your payout',
    );

    // Dave should get 3 moola, Bob should get 1 buck, and Alice
    // get 7 simoleans
    const daveFirstCoveredCallResult = await daveFirstCoveredCallPayoutP;
    const aliceResult = await alicePayoutP;
    const bobResult = await bobPayoutP;

    t.deepEquals(
      daveFirstCoveredCallResult[0].getBalance(),
      moolaAssay.makeUnits(3),
    );
    t.deepEquals(
      daveFirstCoveredCallResult[1].getBalance(),
      simoleanAssay.makeUnits(0),
    );

    t.deepEquals(aliceResult[0].getBalance(), moolaAssay.makeUnits(0));
    t.deepEquals(aliceResult[1].getBalance(), simoleanAssay.makeUnits(7));

    t.deepEquals(bobResult[0].getBalance(), inviteAssay.makeUnits(null));
    t.deepEquals(bobResult[1].getBalance(), bucksAssay.makeUnits(1));

    // Alice deposits her payouts
    await aliceMoolaPurse.depositAll(aliceResult[0]);
    await aliceSimoleanPurse.depositAll(aliceResult[1]);

    // Bob deposits his payouts
    await bobBucksPurse.depositAll(bobResult[1]);

    // Dave deposits his payouts
    await daveMoolaPurse.depositAll(daveFirstCoveredCallResult[0]);
    await daveSimoleanPurse.depositAll(daveFirstCoveredCallResult[1]);
    await daveBucksPurse.depositAll(daveBucksPayout);

    t.equals(aliceMoolaPurse.getBalance().extent, 0);
    t.equals(aliceSimoleanPurse.getBalance().extent, 7);

    t.equals(bobMoolaPurse.getBalance().extent, 0);
    t.equals(bobSimoleanPurse.getBalance().extent, 0);
    t.equals(bobBucksPurse.getBalance().extent, 1);

    t.equals(daveMoolaPurse.getBalance().extent, 3);
    t.equals(daveSimoleanPurse.getBalance().extent, 0);
    t.equals(daveBucksPurse.getBalance().extent, 0);
  } catch (e) {
    t.isNot(e, e, 'unexpected exception');
  } finally {
    t.end();
  }
});
