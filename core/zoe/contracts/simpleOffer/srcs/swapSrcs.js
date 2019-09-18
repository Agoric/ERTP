import harden from '@agoric/harden';

import { makeHasOkRules, offerEqual } from '../../../contractUtils';

const hasOkRules = makeHasOkRules([
  ['haveExactly', 'wantExactly'],
  ['wantExactly', 'haveExactly'],
]);

const makeSecondOffer = firstOffer =>
  harden([
    {
      rule: firstOffer[1].rule,
      amount: firstOffer[0].amount,
    },
    {
      rule: firstOffer[0].rule,
      amount: firstOffer[1].amount,
    },
  ]);

const isValidFirstOfferDesc = newOfferDesc => hasOkRules(newOfferDesc);
const isValidSecondOfferDesc = (assays, firstOffer, newOfferDesc) =>
  offerEqual(assays, makeSecondOffer(firstOffer), newOfferDesc);

const isValidOffer = (
  assays,
  offerIds,
  offerIdsToOfferDescs,
  offerMadeDesc,
) => {
  const isFirstOffer = offerIds.length === 0;
  const isSecondOffer = offerIds.length === 1;
  return (
    (isFirstOffer && isValidFirstOfferDesc(offerMadeDesc)) ||
    (isSecondOffer &&
      isValidSecondOfferDesc(
        assays,
        offerIdsToOfferDescs.get(offerIds[0]),
        offerMadeDesc,
      ))
  );
};

const swapSrcs = harden({
  isValidOffer,
  canReallocate: (offerIds, _offerIdsToOfferDescs) => offerIds.length === 2,
  reallocate: quantities => harden([quantities[1], quantities[0]]),
});

export { swapSrcs };
