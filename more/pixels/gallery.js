import Nat from '@agoric/nat';
import harden from '@agoric/harden';

import {
  makeCompoundPixelAssayMaker,
  makeTransferRightPixelAssayMaker,
  makeUseRightPixelAssayMaker,
} from './pixelAssays';
import { makeCollect } from '../../core/contractHost';

import { makeMint } from '../../core/issuers';
import { makeWholePixelList, insistPixelList } from './types/pixelList';
import { insistPixel, isEqual as isEqualPixel } from './types/pixel';
import { makeMintController } from './pixelMintController';
import { makeLruQueue } from './lruQueue';

import { escrowExchangeSrcs } from '../../core/escrow';

function mockStateChangeHandler(_newState) {
  // does nothing
}

export function makeGallery(
  E,
  log,
  contractHost,
  stateChangeHandler = mockStateChangeHandler,
  canvasSize = 10,
) {
  function getRandomColor(fraction, num) {
    // This is a linear-feedback shift register with computed startState
    // and number of iterations.  Thus, it is totally deterministic, but
    // at least looks a little random.

    /* eslint-disable no-bitwise */
    const startState = Math.floor(fraction * 0xffffffff) ^ 0xdeadbeef;
    let lfsr = startState;
    for (let i = -3; i < num; i += 1) {
      lfsr ^= lfsr >>> 7;
      lfsr ^= (lfsr << 9) & 0xffffffff;
      lfsr ^= lfsr >>> 13;
    }
    /* eslint-enable no-bitwise */

    // lfsr may be negative, so we make it start at 0.
    const rand = (Math.floor(lfsr) % 0x800000) + 0x7fffff;

    // Need to pad the beginning of the string with zeros.
    const randomColor = `#${rand.toString(16).padStart(6, '0')}`;
    const isHexColor = color => /^#[0-9A-F]{6}$/i.test(color);
    if (!isHexColor(randomColor)) {
      throw new Error(`color ${randomColor} is not a valid color`);
    }
    return randomColor;
  }
  const collect = makeCollect(E, log);

  function makeRandomData() {
    const pixels = [];
    for (let x = 0; x < canvasSize; x += 1) {
      const pixelRow = [];
      for (let y = 0; y < canvasSize; y += 1) {
        pixelRow.push(getRandomColor(x / canvasSize, y));
      }
      pixels.push(pixelRow);
    }
    return pixels;
  }
  const state = makeRandomData();

  // provide state for the canvas html page
  function getState() {
    return JSON.stringify(state);
  }

  // create all pixels (list of raw objs)
  const allPixels = makeWholePixelList(canvasSize);

  // create LRU for "seemingly unpredictable" output from faucet
  const { lruQueue, lruQueueBuilder, lruQueueAdmin } = makeLruQueue(
    isEqualPixel,
  );

  for (const pixel of allPixels) {
    lruQueueBuilder.push(pixel);
  }
  lruQueueBuilder.resortArbitrarily(allPixels.length, 7);

  function setPixelState(pixel, newColor) {
    state[pixel.x][pixel.y] = newColor;
    lruQueue.requeue(pixel);
    // for now we pass the whole state
    stateChangeHandler(getState());
  }

  // read-only access for the admin interface.
  function reportPosition(entry) {
    return lruQueueAdmin.reportPosition(entry);
  }

  // START ERTP

  const makePixelListAssay = makeCompoundPixelAssayMaker(canvasSize);
  const makeTransferAssay = makeTransferRightPixelAssayMaker(canvasSize);
  const makeUseAssay = makeUseRightPixelAssayMaker(canvasSize);

  // a pixel represents the right to color and transfer the right to color
  const pixelMint = makeMint('pixels', makeMintController, makePixelListAssay);
  const pixelIssuer = pixelMint.getIssuer();
  const pixelAssay = pixelIssuer.getAssay();
  const pixelLabel = harden({ issuer: pixelIssuer, description: 'pixels' });

  const transferRightMint = makeMint(
    'pixelTransferRights',
    makeMintController,
    makeTransferAssay,
  );
  const useRightMint = makeMint(
    'pixelUseRights',
    makeMintController,
    makeUseAssay,
  );
  const useRightIssuer = useRightMint.getIssuer();
  const useRightAssay = useRightIssuer.getAssay();
  const transferRightIssuer = transferRightMint.getIssuer();
  const transferRightAssay = transferRightIssuer.getAssay();

  // Dust is the currency that the Gallery accepts for pixels
  const dustMint = makeMint('dust');
  const dustIssuer = dustMint.getIssuer();
  const dustAssay = dustIssuer.getAssay();

  // get the pixelList from the LRU
  function makePixelPayment(rawPixelList) {
    insistPixelList(rawPixelList, canvasSize);
    const pixelAmount = {
      label: pixelLabel,
      quantity: rawPixelList,
    };
    // we need to create this, since it was just destroyed
    const newGalleryPurse = pixelMint.mint(pixelAmount, 'gallery');
    const payment = newGalleryPurse.withdraw(pixelAmount);
    return payment;
  }

  const gallerySplitPixelPurse = pixelIssuer.makeEmptyPurse();

  // split pixelList into UseRights and TransferRights
  async function split(pixelListPaymentP) {
    return Promise.resolve(pixelListPaymentP).then(async pixelListPayment => {
      const pixelListAmount = pixelListPayment.getBalance();

      const exclusivePayment = await pixelIssuer.getExclusiveAll(
        pixelListPayment,
      );
      await gallerySplitPixelPurse.depositAll(exclusivePayment); // conserve pixels

      const { transferAmount, useAmount } = pixelAssay.toTransferAndUseRights(
        pixelListAmount,
        useRightAssay,
        transferRightAssay,
      );

      const transferRightPurse = transferRightMint.mint(transferAmount);
      const useRightPurse = useRightMint.mint(useAmount);

      const transferRightPayment = await transferRightPurse.withdrawAll(
        'transferRights',
      );
      const useRightPayment = await useRightPurse.withdrawAll('useRights');

      return {
        transferRightPayment,
        useRightPayment,
      };
    });
  }

  // merge UseRights and TransferRights into a pixel
  async function toPixel(transferRightPaymentP) {
    return Promise.resolve(transferRightPaymentP).then(
      async transferRightPayment => {
        // someone else may have the useRightPayment so we must destroy the
        // useRight

        // we have an exclusive on the transfer right
        const transferAmount = transferRightPayment.getBalance();
        await transferRightIssuer.getExclusiveAll(transferRightPayment);

        const pixelListAmount = transferRightAssay.toPixel(
          transferAmount,
          pixelAssay,
        );

        const { useAmount } = pixelAssay.toTransferAndUseRights(
          pixelListAmount,
          useRightAssay,
          transferRightAssay,
        );

        // commit point
        await useRightMint.destroy(useAmount);
        await transferRightMint.destroy(transferAmount);

        const pixelPayment = await gallerySplitPixelPurse.withdraw(
          pixelListAmount,
          'pixels',
        ); // conserve pixels
        return pixelPayment;
      },
    );
  }

  function insistColor(_myColor) {
    // TODO: check whether allowed
  }

  async function changeColor(useRightPaymentP, newColor) {
    return Promise.resolve(useRightPaymentP).then(async useRightPayment => {
      const emptyAmount = useRightAssay.make(harden([]));

      // withdraw empty amount from payment
      // if this doesn't error, it was a useRightPayment
      useRightIssuer.getExclusive(emptyAmount, useRightPaymentP);

      const pixelAmount = useRightPayment.getBalance();

      if (useRightAssay.isEmpty(pixelAmount)) {
        throw new Error('no use rights present');
      }
      insistColor(newColor);

      const pixelList = useRightAssay.quantity(pixelAmount);

      for (let i = 0; i < pixelList.length; i += 1) {
        const pixel = pixelList[i];
        setPixelState(pixel, newColor);
      }
      return pixelAmount;
    });
  }

  function revokePixel(rawPixel) {
    const pixelList = harden([rawPixel]);
    const pixelAmount = pixelAssay.make(pixelList);
    const useRightAmount = useRightAssay.make(pixelList);
    const transferRightAmount = transferRightAssay.make(pixelList);

    try {
      pixelMint.destroy(pixelAmount);
      useRightMint.destroy(useRightAmount);
      transferRightMint.destroy(transferRightAmount);
    } catch (err) {
      console.log(err);
    }
  }

  function tapFaucet() {
    const rawPixel = lruQueue.popToTail();
    revokePixel(rawPixel);
    return makePixelPayment(harden([rawPixel]));
  }

  function getDistance(a, b) {
    const { x: xA, y: yA } = a;
    const { x: xB, y: yB } = b;
    return Math.floor(Math.sqrt((xA - xB) ** 2 + (yA - yB) ** 2));
  }

  function getDistanceFromCenter(rawPixel) {
    const centerCoord = Math.floor(canvasSize / 2);
    const center = { x: centerCoord, y: centerCoord };
    return getDistance(rawPixel, center);
  }

  function pricePixelInternal(rawPixel) {
    insistPixel(rawPixel, canvasSize);
    const distance = getDistanceFromCenter(rawPixel);
    // prices are simplistic for now
    // they range from canvasSize / 2 to canvasSize
    const rawPrice = canvasSize - distance;
    return rawPrice;
  }

  function pricePixelAmount(pixelAmount) {
    pixelAmount = pixelAssay.coerce(pixelAmount);
    const rawPixelList = pixelAssay.quantity(pixelAmount);
    let totalPriceInDust = 0;
    for (const rawPixel of rawPixelList) {
      totalPriceInDust += pricePixelInternal(rawPixel);
    }
    return dustAssay.make(totalPriceInDust);
  }

  // anyone can getColor, no restrictions, no tokens
  function getColor(x, y) {
    const rawPixel = { x: Nat(x), y: Nat(y) };
    return state[rawPixel.x][rawPixel.y];
  }

  const sellBuyPixelPurseP = pixelIssuer.makeEmptyPurse();
  const sellBuyDustPurseP = dustIssuer.makeEmptyPurse();

  // only pixels can be sold to the gallery, not use or transfer rights
  function sellToGallery(pixelAmountP) {
    return Promise.resolve(pixelAmountP).then(async pixelAmount => {
      pixelAmount = pixelAssay.coerce(pixelAmount);
      const dustAmount = pricePixelAmount(pixelAmount);
      // just mint the dust that we need
      const tempDustPurseP = dustMint.mint(dustAmount);
      const dustPaymentP = tempDustPurseP.withdraw(
        dustAmount,
        'dust for pixel',
      );
      // dustPurse is dropped
      const terms = harden({ left: dustAmount, right: pixelAmount });
      const escrowExchangeInstallationP = await E(contractHost).install(
        escrowExchangeSrcs,
      );
      const { left: galleryInviteP, right: userInviteP } = await E(
        escrowExchangeInstallationP,
      ).spawn(terms);
      const seatP = E(contractHost).redeem(galleryInviteP);
      E(seatP).offer(dustPaymentP);
      collect(seatP, sellBuyPixelPurseP, sellBuyDustPurseP, 'gallery escrow');
      return {
        inviteP: userInviteP,
        host: contractHost,
      };
    });
  }

  // only pixels can be bought from the gallery, not use or transfer rights
  function buyFromGallery(pixelAmountP) {
    return Promise.resolve(pixelAmountP).then(async pixelAmount => {
      pixelAmount = pixelAssay.coerce(pixelAmount);

      // if the gallery purse contains this pixelAmount, we will
      // create a invite to trade, otherwise we return a message
      const pixelPurseAmount = sellBuyPixelPurseP.getBalance();
      if (!pixelAssay.includes(pixelPurseAmount, pixelAmount)) {
        return {
          inviteP: undefined,
          host: undefined,
          message: 'gallery did not have the pixels required',
        };
      }
      const pixelPaymentP = await E(sellBuyPixelPurseP).withdraw(pixelAmount);
      const dustAmount = pricePixelAmount(pixelAmount);

      // same order as in sellToGallery
      // the left will have to provide dust, right will have to
      // provide pixels. Left is the user, right is the gallery
      const terms = harden({ left: dustAmount, right: pixelAmount });
      const escrowExchangeInstallationP = E(contractHost).install(
        escrowExchangeSrcs,
      );
      // order switch compared to as in sellToGallery
      const { left: userInviteP, right: galleryInviteP } = await E(
        escrowExchangeInstallationP,
      ).spawn(terms);
      const seatP = E(contractHost).redeem(galleryInviteP);
      E(seatP).offer(pixelPaymentP);
      // user is buying from gallery, giving dust
      // gallery is selling, getting dust and giving pixels
      // win purse for gallery is a dust purse, refund is
      collect(seatP, sellBuyDustPurseP, sellBuyPixelPurseP, 'gallery escrow');
      return {
        inviteP: userInviteP,
        host: contractHost,
        dustNeeded: dustAmount,
      };
    });
  }

  function collectFromGallery(seatP, purseLeftP, purseRightP, name) {
    return collect(seatP, purseLeftP, purseRightP, name);
  }

  function getIssuers() {
    return {
      pixelIssuer,
      useRightIssuer,
      transferRightIssuer,
      dustIssuer,
    };
  }

  const userFacet = {
    changeColor,
    getColor,
    tapFaucet,
    split,
    toPixel,
    getIssuers,
    getCanvasSize() {
      return canvasSize;
    },
    pricePixelAmount, // transparent pricing for now
    sellToGallery,
    buyFromGallery,
    collectFromGallery,
  };

  const adminFacet = {
    revokePixel,
    getDistance,
    getDistanceFromCenter,
    reportPosition,
    pricePixelAmount,
    dustMint,
  };

  const readFacet = {
    getState,
    getColor,
  };

  const gallery = {
    userFacet,
    adminFacet,
    readFacet,
  };

  return gallery;
}
