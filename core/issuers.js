/* eslint no-use-before-define: 0 */ // => OFF
// Copyright (C) 2019 Agoric, under Apache License 2.0

import harden from '@agoric/harden';

import { insist } from '../util/insist';
import { makeNatAssay } from './assays';
import { makeBasicMintController } from './mintController';

function makeMint(
  description,
  makeMintController = makeBasicMintController,
  makeAssay = makeNatAssay,
  makeUseObj = harden((_issuer, _purseOrPayment) => harden({})),
  parentIssuer,
) {
  insist(description)`\
Description must be truthy: ${description}`;

  let childIssuer;
  let childMint;

  function getOrMakeChildMint() {
    if (childMint === undefined) {
      childMint = makeMint(
        description,
        makeMintController,
        makeAssay,
        makeUseObj,
        issuer,
      );
      childIssuer = childMint.getIssuer();
    }
    return childMint;
  }

  function getChildAmount(amount) {
    getOrMakeChildMint();
    // quantity is the same, but amounts are different for
    // different issuers
    const quantity = assay.quantity(amount);
    const childAssay = childIssuer.getAssay();
    const childAmount = childAssay.make(quantity);
    return childAmount;
  }

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

    const payment = harden({
      getIssuer() {
        return issuer;
      },
      getBalance() {
        return paymentController.getAmount(payment);
      },
      getName() {
        return paymentName;
      },
      getUse() {
        return makeUseObj(issuer, payment);
      },
      getDelegatedUse() {
        // quantity is the same, but amounts are different for
        // different issuers
        const childAmount = getChildAmount(payment.getBalance());
        const childPurse = childMint.mint(childAmount);
        const childPayment = childPurse.withdrawAll();
        return makeUseObj(childIssuer, childPayment);
      },
      revokeChildren() {
        const childAmount = getChildAmount(payment.getBalance());
        childMint.revoke(childAmount);
      },
    });

    // ///////////////// commit point //////////////////
    // All queries above passed with no side effects.
    // During side effects below, any early exits should be made into
    // fatal turn aborts.
    paymentController.recordNew(payment, paymentAmount);
    srcController.updateAmount(assetSrc, newSrcAmount);
    return payment;
  }

  const issuer = harden({
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
      const sinkPurse = issuer.makeEmptyPurse('sink purse');
      return sinkPurse.deposit(amount, srcPaymentP);
    },

    burnAll(srcPaymentP) {
      const sinkPurse = issuer.makeEmptyPurse('sink purse');
      return sinkPurse.depositAll(srcPaymentP);
    },

    getParentIssuer() {
      return parentIssuer;
    },
    getChildIssuer() {
      getOrMakeChildMint();
      return childIssuer;
    },
    isDescendantIssuer(allegedDescendant) {
      if (childIssuer === undefined) {
        return false;
      }
      if (childIssuer === issuer) {
        return true;
      }
      return childIssuer.isDescendantIssuer(allegedDescendant);
    },
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

  const mint = harden({
    getIssuer() {
      return issuer;
    },
    destroyAll() {
      purseController.destroyAll();
      paymentController.destroyAll();
    },
    revoke(amount) {
      amount = assay.coerce(amount);
      // for non-fungible tokens that are unique, revoke them by removing them from
      // the purses/payments that they live in

      // the amount may not exist in the case of childMint amounts, so
      // catch the error

      try {
        destroy(amount);
        if (childMint !== undefined) {
          childMint.revoke(getChildAmount(amount)); // recursively revoke child assets
        }
      } catch (err) {
        console.log(err);
      }
    },
    mint(initialBalance, name = 'a purse') {
      initialBalance = assay.coerce(initialBalance);
      name = `${name}`;

      const purse = harden({
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
        getUse() {
          return makeUseObj(issuer, purse);
        },
        getDelegatedUse() {
          const childAmount = getChildAmount(purse.getBalance());
          const childPurse = childMint.mint(childAmount);
          return makeUseObj(childIssuer, childPurse);
        },
        revokeChildren() {
          const childAmount = getChildAmount(purse.getBalance());
          childMint.revoke(childAmount);
        },
      });
      purseController.recordNew(purse, initialBalance);
      return purse;
    },
  });
  return mint;
}
harden(makeMint);

// Creates a local issuer that locally represents a remotely issued
// currency. Returns a promise for a peg object that asynchonously
// converts between the two. The local currency is synchronously
// transferable locally.
function makePeg(
  E,
  remoteIssuerP,
  makeMintController,
  makeAssay = makeNatAssay,
) {
  const remoteLabelP = E(remoteIssuerP).getLabel();

  // The remoteLabel is a local copy of the remote pass-by-copy
  // label. It has a presence of the remote issuer and a copy of the
  // description.
  return Promise.resolve(remoteLabelP).then(remoteLabel => {
    // Retaining remote currency deposits it in here.
    // Redeeming local currency withdraws remote from here.
    const backingPurseP = E(remoteIssuerP).makeEmptyPurse('backing');

    const { description } = remoteLabel;
    const localMint = makeMint(description, makeMintController, makeAssay);
    const localIssuer = localMint.getIssuer();
    const localLabel = localIssuer.getLabel();

    function localAmountOf(remoteAmount) {
      return harden({
        label: localLabel,
        quantity: remoteAmount.quantity,
      });
    }

    function remoteAmountOf(localAmount) {
      return harden({
        label: remoteLabel,
        quantity: localAmount.quantity,
      });
    }

    return harden({
      getLocalIssuer() {
        return localIssuer;
      },

      getRemoteIssuer() {
        return remoteIssuerP;
      },

      retainAll(remotePaymentP, name = 'backed') {
        return E(backingPurseP)
          .depositAll(remotePaymentP)
          .then(remoteAmount =>
            localMint
              .mint(localAmountOf(remoteAmount), `${name} purse`)
              .withdrawAll(name),
          );
      },

      redeemAll(localPayment, name = 'redeemed') {
        return localIssuer
          .burnAll(localPayment)
          .then(localAmount =>
            E(backingPurseP).withdraw(remoteAmountOf(localAmount), name),
          );
      },
    });
  });
}
harden(makePeg);

export { makeMint, makePeg };
