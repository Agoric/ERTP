import harden from '@agoric/harden';

import { makeCoreMintKeeper } from '../../core/config/coreMintKeeper';
import { makeNatAssay } from '../../core/config/assays';

/**
 * `makeUsableStockMaker` exists in order to pass in more parameters
 * // than makeUsableStockConfig allows.
 * @param  {function} makeUseObj creates a "use object", which has all
 * of the non-ERTP methods for assets that are designed to be used.
 * For instance, a stock might have vote() and claimCashDividends() as
 * methods. The use object is associated with an underlying asset that
 * provides the authority to use it.
 */
function makeUsableStockMaker(makeUseObj) {
  function makeUsableStockConfig() {
    return harden({
      makeCustomPayment(superPayment, issuer) {
        return harden({
          ...superPayment,
          // This creates a new use object on every call.
          getUse() {
            return makeUseObj(issuer, superPayment);
          },
        });
      },
      makeCustomPurse(superPurse, issuer) {
        return harden({
          ...superPurse,
          // This creates a new use object on every call.
          getUse() {
            return makeUseObj(issuer, superPurse);
          },
        });
      },
      makeCustomMint(superMint) {
        return harden({
          ...superMint,
        });
      },
      makeCustomIssuer(superIssuer) {
        return harden({
          ...superIssuer,
        });
      },
      makeMintKeeper: makeCoreMintKeeper,
      makeAssay: makeNatAssay,
    });
  }
  return makeUsableStockConfig;
}

export { makeUsableStockMaker };
