import harden from '@agoric/harden';

import { makeHasOkRules, offerEqual } from '../contractUtils';

const hasOkLength = array => array.length === 2;
const hasOkRules = offer =>
  makeHasOkRules(['offerExactly', 'wantExactly'])(offer) ||
  makeHasOkRules(['wantExactly', 'offerExactly'])(offer);

const makeSecondOffer = firstOffer =>
  harden([
    {
      rule: firstOffer[1].rule,
      assetDesc: firstOffer[0].assetDesc,
    },
    {
      rule: firstOffer[0].rule,
      assetDesc: firstOffer[1].assetDesc,
    },
  ]);

const coveredCallSrcs = harden({
  // TODO: this name should be in the namespace of the smart contract library
  name: 'coveredCall',
  areAssaysValid: hasOkLength,
  isValidInitialOfferDesc: newOfferDesc =>
    hasOkLength(newOfferDesc) && hasOkRules(newOfferDesc),
  makeWantedOfferDescs: firstOfferDesc =>
    harden([makeSecondOffer(firstOfferDesc)]),
  isValidOfferDesc: (extentOps, offerDescToBeMade, offerDescMade) =>
    offerEqual(extentOps, offerDescToBeMade, offerDescMade),
  canReallocate: offerIds => offerIds.length === 2, // we can reallocate with 2 valid offers
  reallocate: allocations => harden([allocations[1], allocations[0]]),
});

harden(coveredCallSrcs);

export { coveredCallSrcs };
