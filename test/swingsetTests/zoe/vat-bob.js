import harden from '@agoric/harden';
import { insist } from '../../../util/insist';

const makeBobMaker = async (E, log, zoe) => {
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
      const bob = harden({
        doAutomaticRefund: async instanceId => {
          const { instance: automaticRefund, libraryName } = await E(
            zoe,
          ).getInstance(instanceId);

          insist(
            libraryName === 'automaticRefund',
          )`Alice was misrepresenting the contract she wanted bob to join`;

          const moolaIssuer = await E(moolaPurse).getIssuer();
          const simoleanIssuer = await E(simoleanPurse).getIssuer();

          const issuers = [moolaIssuer, simoleanIssuer];

          const contractIssuers = await E(zoe).getIssuersForInstance(
            instanceId,
          );
          insist(
            contractIssuers[0] === moolaIssuer,
          )`The first issuer should be the moola issuer`;
          insist(
            contractIssuers[1] === simoleanIssuer,
          )`The second issuer should be the simolean issuer`;

          // 1. Bob escrows his offer
          const bobOfferDesc = harden([
            {
              rule: 'wantExactly',
              amount: await E(issuers[0]).makeAmount(15),
            },
            {
              rule: 'offerExactly',
              amount: await E(issuers[1]).makeAmount(17),
            },
          ]);

          const bobSimoleanPayment = await E(simoleanPurse).withdrawAll();

          const bobPayments = [undefined, bobSimoleanPayment];

          const { escrowReceipt, claimPayoff } = await E(zoe).escrow(
            bobOfferDesc,
            bobPayments,
          );

          // 2. Bob makes an offer with his escrow receipt
          const bobOfferMadeDesc = await E(automaticRefund).makeOffer(
            escrowReceipt,
          );

          log(bobOfferMadeDesc);

          // 3: Bob unwraps the claimPayoff to get his seat
          const bobSeat = await E(claimPayoff).unwrap();

          // 4: Bob claims his share of the outcome (what he put in)
          const bobResult = await E(bobSeat).getPayoff();

          // 5: Bob deposits his winnings
          await E(moolaPurse).depositAll(bobResult[0]);
          await E(simoleanPurse).depositAll(bobResult[1]);

          await showPaymentBalance(moolaPurse, 'bobMoolaPurse');
          await showPaymentBalance(simoleanPurse, 'bobSimoleanPurse;');
        },
      });
      return bob;
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
      makeBobMaker(zoeHelpers) {
        return harden(makeBobMaker(E, log, zoeHelpers));
      },
    }),
  );
}
export default harden(setup);
