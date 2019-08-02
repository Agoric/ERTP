import harden from '@agoric/harden';

import { makeMintController } from './pixelMintController';
import { makePixelListAssayMaker } from './pixelAssays';

function makePixelConfigMaker(makeUseObj, canvasSize = 10) {
  const pixelConfigMaker = {
    makePixelConfig(makeMint, description) {
      let childIssuer;
      let childMint;

      const makePixelAssay = makePixelListAssayMaker(canvasSize);

      function getOrMakeChildMint(issuer) {
        if (childMint === undefined) {
          childMint = makeMint(
            description,
            pixelConfigMaker.makePixelConfig,
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
        const { quantity } = amount;
        const childAssay = childIssuer.getAssay();
        const childAmount = childAssay.make(quantity);
        return childAmount;
      }

      return {
        makeCustomPayment(issuer, payment) {
          const delegatedUsePaymentMethods = harden({
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
          return delegatedUsePaymentMethods;
        },
        makeCustomPurse(issuer, purse) {
          const delegatedUsePurseMethods = harden({
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
          return delegatedUsePurseMethods;
        },
        makeCustomMint(assay, destroy) {
          const customMint = harden({
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
          });
          return customMint;
        },
        makeCustomIssuer(issuer, parentIssuer) {
          return harden({
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
        },
        makeMintController,
        makeAssay: makePixelAssay,
      };
    },
  };
  return pixelConfigMaker;
}

export { makePixelConfigMaker };
