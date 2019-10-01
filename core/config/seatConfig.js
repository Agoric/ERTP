import harden from '@agoric/harden';

import { makeCoreMintKeeper } from './coreMintKeeper';
import { seatStrategy } from './strategies/seatStrategy';

/**
 * `makeSeatConfigMaker` exists in order to pass in two makeUseObj
 * functions, one for payments and one for purses. A "use object" has
 * all of the non-ERTP methods for assets that are designed to be
 * used. For instance, a stock might have vote() and
 * claimCashDividends() as methods. The use object is associated with
 * an underlying asset that provides the authority to use it.
 * @param {function} makeUseObjForPayment creates a "use object" for
 * payments
 * @param {function} makeUseObjForPurse creates a "use object" for
 * purses
 */
function makeSeatConfigMaker(makeUseObjForPayment, makeUseObjForPurse) {
  function makeSeatConfig() {
    function* makePaymentTrait(_superPayment, issuer) {
      const payment = yield harden({
        // This creates a new use object which destroys the payment
        unwrap: () => makeUseObjForPayment(issuer, payment),
      });
      return payment;
    }

    function* makePurseTrait(_superPurse, issuer) {
      const purse = yield harden({
        // This creates a new use object which empties the purse
        unwrap: () => makeUseObjForPurse(issuer, purse),
      });
      return purse;
    }

    function* makeMintTrait(_superMint) {
      return yield harden({});
    }

    function* makeIssuerTrait(_superIssuer) {
      return yield harden({});
    }

    return harden({
      makePaymentTrait,
      makePurseTrait,
      makeMintTrait,
      makeIssuerTrait,
      makeMintKeeper: makeCoreMintKeeper,
      strategy: seatStrategy,
    });
  }
  return makeSeatConfig;
}

export { makeSeatConfigMaker };
