/* eslint no-use-before-define: 0 */ // => OFF
// Copyright (C) 2019 Agoric, under Apache License 2.0

import harden from '@agoric/harden';

import { insist } from '../util/insist';

import { makeBasicConfig } from './config/basicConfig';

function makeMint(description, makeConfig = makeBasicConfig) {
  insist(description)`\
Description must be truthy: ${description}`;

  const {
    makeCustomIssuer,
    makeCustomPayment,
    makeCustomPurse,
    makeCustomMint,
    makeMintController,
    makeAssay,
  } = makeConfig(makeMint, description);

  // assetSrc is a purse or payment. Return a fresh payment.  One internal
  // function used for both cases, since they are so similar.
  function takePayment(
    assetSrc,
    srcController,
    paymentAmount,
    unsafePaymentName,
  ) {
    const paymentName = `${unsafePaymentName}`;
    paymentAmount = assay.coerce(paymentAmount);
    const oldSrcAmount = srcController.getAmount(assetSrc);
    const newSrcAmount = assay.without(oldSrcAmount, paymentAmount);

    const corePayment = harden({
      getIssuer() {
        return issuer;
      },
      getBalance() {
        return paymentController.getAmount(payment);
      },
      getName() {
        return paymentName;
      },
    });

    const payment = harden({
      ...corePayment,
      ...makeCustomPayment(issuer, corePayment),
    });

    // ///////////////// commit point //////////////////
    // All queries above passed with no side effects.
    // During side effects below, any early exits should be made into
    // fatal turn aborts.
    paymentController.recordNew(payment, paymentAmount);
    srcController.updateAmount(assetSrc, newSrcAmount);
    return payment;
  }

  const coreIssuer = harden({
    getLabel() {
      return assay.getLabel();
    },

    getAssay() {
      return assay;
    },

    makeAmount(quantity) {
      return assay.make(quantity);
    },

    makeEmptyPurse(name = 'a purse') {
      return mint.mint(assay.empty(), name); // mint and issuer call each other
    },

    getExclusive(amount, srcPaymentP, name) {
      return Promise.resolve(srcPaymentP).then(srcPayment => {
        name = name !== undefined ? name : srcPayment.getName(); // use old name
        return takePayment(srcPayment, paymentController, amount, name);
      });
    },

    getExclusiveAll(srcPaymentP, name) {
      return Promise.resolve(srcPaymentP).then(srcPayment => {
        name = name !== undefined ? name : srcPayment.getName(); // use old name
        return takePayment(
          srcPayment,
          paymentController,
          paymentController.getAmount(srcPayment),
          name,
        );
      });
    },

    burn(amount, srcPaymentP) {
      // We deposit the alleged payment, rather than just doing a get
      // exclusive on it, in order to consume the usage erights as well.
      const sinkPurse = coreIssuer.makeEmptyPurse('sink purse');
      return sinkPurse.deposit(amount, srcPaymentP);
    },

    burnAll(srcPaymentP) {
      const sinkPurse = coreIssuer.makeEmptyPurse('sink purse');
      return sinkPurse.depositAll(srcPaymentP);
    },
  });

  const issuer = harden({
    ...coreIssuer,
    ...makeCustomIssuer(coreIssuer),
  });

  const label = harden({ issuer, description });

  const assay = makeAssay(label);
  const { purseController, paymentController, destroy } = makeMintController(
    assay,
  );

  function depositInto(purse, amount, payment) {
    amount = assay.coerce(amount);
    const oldPurseAmount = purseController.getAmount(purse);
    const oldPaymentAmount = paymentController.getAmount(payment);
    // Also checks that the union is representable
    const newPurseAmount = assay.with(oldPurseAmount, amount);
    const newPaymentAmount = assay.without(oldPaymentAmount, amount);

    // ///////////////// commit point //////////////////
    // All queries above passed with no side effects.
    // During side effects below, any early exits should be made into
    // fatal turn aborts.
    paymentController.updateAmount(payment, newPaymentAmount);
    purseController.updateAmount(purse, newPurseAmount);

    return amount;
  }

  const coreMint = harden({
    getIssuer() {
      return issuer;
    },
    destroyAll() {
      purseController.destroyAll();
      paymentController.destroyAll();
    },
    mint(initialBalance, name = 'a purse') {
      initialBalance = assay.coerce(initialBalance);
      name = `${name}`;

      const corePurse = harden({
        getName() {
          return name;
        },
        getIssuer() {
          return issuer;
        },
        getBalance() {
          return purseController.getAmount(purse);
        },
        deposit(amount, srcPaymentP) {
          return Promise.resolve(srcPaymentP).then(srcPayment => {
            return depositInto(purse, amount, srcPayment);
          });
        },
        depositAll(srcPaymentP) {
          return Promise.resolve(srcPaymentP).then(srcPayment => {
            return depositInto(
              purse,
              paymentController.getAmount(srcPayment),
              srcPayment,
            );
          });
        },
        withdraw(amount, paymentName = 'a withdrawal payment') {
          return takePayment(purse, purseController, amount, paymentName);
        },
        withdrawAll(paymentName = 'a withdrawal payment') {
          return takePayment(
            purse,
            purseController,
            purseController.getAmount(purse),
            paymentName,
          );
        },
      });

      const delegatedUsePurseMethods = makeCustomPurse(issuer, corePurse);

      const purse = harden({
        ...corePurse,
        ...delegatedUsePurseMethods,
      });
      purseController.recordNew(purse, initialBalance);
      return purse;
    },
  });

  const customMint = makeCustomMint(assay, destroy, issuer);

  const mint = harden({
    ...coreMint,
    ...customMint,
  });
  return mint;
}
harden(makeMint);

export { makeMint };
