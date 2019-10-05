import harden from '@agoric/harden';

import { makeHasOkRules, offerEqual } from '../../../contractUtils';

const hasOkRulesOfferFirst = makeHasOkRules(['offerExactly', 'wantExactly']);
const hasOkRulesWantFirst = makeHasOkRules(['wantExactly', 'offerExactly']);

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

const isValidFirstOfferDesc = newOfferDesc =>
  hasOkRulesOfferFirst(newOfferDesc) || hasOkRulesWantFirst(newOfferDesc);
const isValidSecondOfferDesc = (extentOps, firstOffer, newOfferDesc) =>
  offerEqual(extentOps, makeSecondOffer(firstOffer), newOfferDesc);

const isValidOffer = (
  extentOps,
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
        extentOps,
        offerIdsToOfferDescs.get(offerIds[0]),
        offerMadeDesc,
      ))
  );
};

const swapSrcs = harden({
  isValidOffer,
  canReallocate: (offerIds, _offerIdsToOfferDescs) => offerIds.length === 2,
  reallocate: (_extentOps, offerIds, _offerIdsToOfferDescs, getExtentsFor) =>
    harden({
      reallocOfferIds: offerIds,
      reallocExtents: harden([
        ...getExtentsFor(harden([offerIds[1]])),
        ...getExtentsFor(harden([offerIds[0]])),
      ]),
    }),
});

export { swapSrcs };
