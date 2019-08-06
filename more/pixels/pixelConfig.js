import harden from '@agoric/harden';

import { makePixelMintKeeper } from './pixelMintKeeper';
import { makePixelListAssayMaker } from './pixelAssays';

function makePixelConfigMaker(makeUseObj, canvasSize = 10, parentIssuer) {
  function makePixelConfig(makeMint, description) {
    let childIssuer;
    let childMint;

    const makePixelAssay = makePixelListAssayMaker(canvasSize);

    function getOrMakeChildMint(issuer) {
      if (childMint === undefined) {
        const makePixelConfigChild = makePixelConfigMaker(
          makeUseObj,
          canvasSize,
          issuer,
        );
        childMint = makeMint(description, makePixelConfigChild);
        childIssuer = childMint.getIssuer();
      }
      return childMint;
    }

    function getChildAmount(issuer, amount) {
      getOrMakeChildMint(issuer);
      // quantity is the same, but amounts are different for
      // different issuers
      const { quantity } = amount;
      return childIssuer.makeAmount(quantity);
    }

    return harden({
      makeCustomPayment(superPayment, issuer) {
        return harden({
          ...superPayment,
          getUse() {
            return makeUseObj(issuer, superPayment);
          },
          getChildPayment() {
            // quantity is the same, but amounts are different for
            // different issuers
            const childAmount = getChildAmount(
              issuer,
              superPayment.getBalance(),
            );
            const childPurse = childMint.mint(childAmount);
            return childPurse.withdrawAll();
          },
          revokeChildren() {
            const childAmount = getChildAmount(
              issuer,
              superPayment.getBalance(),
            );
            childMint.revoke(childAmount);
          },
        });
      },
      makeCustomPurse(superPurse, issuer) {
        return harden({
          ...superPurse,
          getUse() {
            return makeUseObj(issuer, superPurse);
          },
          getChildPurse() {
            const childAmount = getChildAmount(issuer, superPurse.getBalance());
            return childMint.mint(childAmount);
          },
          revokeChildren() {
            const childAmount = getChildAmount(issuer, superPurse.getBalance());
            childMint.revoke(childAmount);
          },
        });
      },
      makeCustomMint(superMint, issuer, assay, mintKeeper) {
        return harden({
          ...superMint,
          revoke(amount) {
            amount = assay.coerce(amount);
            // for non-fungible tokens that are unique, revoke them by removing them from
            // the purses/payments that they live in

            // the amount may not exist in the case of childMint amounts, so
            // catch the error

            try {
              mintKeeper.destroy(amount);
              if (childMint !== undefined) {
                childMint.revoke(getChildAmount(issuer, amount)); // recursively revoke child assets
              }
            } catch (err) {
              console.log(err);
            }
          },
        });
      },
      makeCustomIssuer(superIssuer) {
        return harden({
          ...superIssuer,
          getParentIssuer() {
            return parentIssuer;
          },
          getChildIssuer() {
            getOrMakeChildMint(superIssuer);
            return childIssuer;
          },
          isDescendantIssuer(allegedDescendant) {
            if (childIssuer === undefined) {
              return false;
            }
            if (childIssuer === superIssuer) {
              return true;
            }
            return childIssuer.isDescendantIssuer(allegedDescendant);
          },
        });
      },
      makeMintKeeper: makePixelMintKeeper,
      makeAssay: makePixelAssay,
    });
  }
  return makePixelConfig;
}

export { makePixelConfigMaker };
