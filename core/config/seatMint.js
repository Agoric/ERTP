import harden from '@agoric/harden';

import { makeSeatConfigMaker } from './seatConfig';
import { makeMint } from '../issuers';

/**
 * `makeSeatMint` creates an instance of the seatMint with an
 * associated WeakMap mapping ids (represented by unique empty
 * objects) to use objects
 */
const makeSeatMint = () => {
  const idObjsToSeats = new WeakMap();

  const addUseObj = (idObj, useObj) => {
    idObjsToSeats.set(idObj, useObj);
  };

  const makeUseObj = seatQuantity => {
    return harden(idObjsToSeats.get(seatQuantity.id));
  };

  const paymentMakeUseAndBurn = async (issuer, payment) => {
    const { quantity } = payment.getBalance();
    if (quantity === null) {
      throw new Error('the payment is empty or already used');
    }
    const useObj = makeUseObj(quantity);
    await issuer.burnAll(payment);
    return useObj;
  };

  // Note that we can't burn the underlying purse, we can only empty
  // it and burn the payment we withdraw.
  const purseMakeUseAndBurn = async (issuer, purse) => {
    const { quantity } = purse.getBalance();
    if (quantity === null) {
      throw new Error('the purse is empty or already used');
    }
    const useObj = makeUseObj(quantity);
    const payment = purse.withdrawAll();
    await issuer.burnAll(payment);
    return useObj;
  };

  const makeSeatConfig = makeSeatConfigMaker(
    paymentMakeUseAndBurn,
    purseMakeUseAndBurn,
  );

  const seatMint = makeMint('seats', makeSeatConfig);
  const seatIssuer = seatMint.getIssuer();

  return harden({
    seatMint,
    seatIssuer,
    addUseObj,
  });
};

harden(makeSeatMint);

export { makeSeatMint };
