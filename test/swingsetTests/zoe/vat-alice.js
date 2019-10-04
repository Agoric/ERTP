import harden from '@agoric/harden';

const makeAliceMaker = async (E, log, zoe) => {
  const showPaymentBalance = async (paymentP, name) => {
    try {
      const amount = await E(paymentP).getBalance();
      log(name, ': balance ', amount);
    } catch (err) {
      console.error(err);
    }
  };

  return harden({
    make(moolaPurse, simoleanPurse) {
      const alice = harden({
        doCreateAutomaticRefund: async bobP => {
          log(`=> alice.doCreateAutomaticRefund called`);
          // 1: Alice creates the automaticRefund instance

          const moolaIssuer = await E(moolaPurse).getIssuer();
          const simoleanIssuer = await E(simoleanPurse).getIssuer();

          const issuers = [moolaIssuer, simoleanIssuer];

          const { instance: automaticRefund, instanceId } = await E(
            zoe,
          ).makeInstance('automaticRefund', issuers);

          // 2: Alice escrows with Zoe
          const offerDesc = harden([
            {
              rule: 'offerExactly',
              amount: await E(issuers[0]).makeAmount(3),
            },
            {
              rule: 'wantExactly',
              amount: await E(issuers[1]).makeAmount(7),
            },
          ]);

          const aliceMoolaPayment = await E(moolaPurse).withdrawAll();

          const offerPayments = [aliceMoolaPayment, undefined];

          const { escrowReceipt, claimPayoff } = await E(zoe).escrow(
            offerDesc,
            offerPayments,
          );

          // 4. Alice makes an offer with her escrow receipt
          const offerMadeDesc = await E(automaticRefund).makeOffer(
            escrowReceipt,
          );

          log(offerMadeDesc);

          // 5: Alice sends the automaticRefund instanceId to Bob so he can use
          // it
          await E(bobP).doAutomaticRefund(instanceId);

          // 6: Alice unwraps the claimPayoff to get her seat
          const aliceSeat = await E(claimPayoff).unwrap();

          // 7: Alice claims her portion of the outcome (what she put in,
          // since it's an automatic refund)
          const aliceResult = await E(aliceSeat).getPayoff();

          // 8: Alice deposits her refund to ensure she can
          await E(moolaPurse).depositAll(aliceResult[0]);
          await E(simoleanPurse).depositAll(aliceResult[1]);

          await showPaymentBalance(moolaPurse, 'aliceMoolaPurse');
          await showPaymentBalance(simoleanPurse, 'aliceSimoleanPurse;');
        },
      });
      return alice;
    },
  });
};

function setup(syscall, state, helpers) {
  function log(...args) {
    helpers.log(...args);
    console.log(...args);
  }
  return helpers.makeLiveSlots(syscall, state, E =>
    harden({
      makeAliceMaker(zoe) {
        return harden(makeAliceMaker(E, log, zoe));
      },
    }),
  );
}
export default harden(setup);
