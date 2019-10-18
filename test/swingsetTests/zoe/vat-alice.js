import harden from '@agoric/harden';

const build = async (
  E,
  log,
  zoe,
  moolaPurseP,
  simoleanPurseP,
  installationIdP,
) => {
  const showPaymentBalance = async (paymentP, name) => {
    try {
      const assetDesc = await E(paymentP).getBalance();
      log(name, ': balance ', assetDesc);
    } catch (err) {
      console.error(err);
    }
  };

  return harden({
    doCreateAutomaticRefund: async bobP => {
      log(`=> alice.doCreateAutomaticRefund called`);
      // 1: Alice creates the automaticRefund instance

      const moolaAssay = await E(moolaPurseP).getAssay();
      const simoleanAssay = await E(simoleanPurseP).getAssay();

      const assays = [moolaAssay, simoleanAssay];
      const automaticRefundInstallId = await installationIdP;

      const { instance: automaticRefund, instanceId } = await E(
        zoe,
      ).makeInstance(assays, automaticRefundInstallId);

      // 2: Alice escrows with Zoe
      const conditions = harden({
        offerDesc: [
          {
            rule: 'offerExactly',
            assetDesc: await E(assays[0]).makeAssetDesc(3),
          },
          {
            rule: 'wantExactly',
            assetDesc: await E(assays[1]).makeAssetDesc(7),
          },
        ],
        exit: {
          kind: 'noExit',
        },
      });

      const aliceMoolaPayment = await E(moolaPurseP).withdrawAll();

      const offerPayments = [aliceMoolaPayment, undefined];

      const { escrowReceipt, payoff: payoffP } = await E(zoe).escrow(
        conditions,
        offerPayments,
      );

      // 4. Alice makes an offer with her escrow receipt
      const offerMadeDesc = await E(automaticRefund).makeOffer(escrowReceipt);

      log(offerMadeDesc);

      // 5: Alice sends the automaticRefund instanceId to Bob so he can use
      // it
      await E(bobP).doAutomaticRefund(instanceId);

      const payoff = await payoffP;

      // 8: Alice deposits her refund to ensure she can
      await E(moolaPurseP).depositAll(payoff[0]);
      await E(simoleanPurseP).depositAll(payoff[1]);

      await showPaymentBalance(moolaPurseP, 'aliceMoolaPurse');
      await showPaymentBalance(simoleanPurseP, 'aliceSimoleanPurse;');
    },
  });
};

const setup = (syscall, state, helpers) =>
  helpers.makeLiveSlots(syscall, state, E =>
    harden({
      build: (...args) => build(E, helpers.log, ...args),
    }),
  );
export default harden(setup);
