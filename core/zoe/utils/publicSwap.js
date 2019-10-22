import { sameStructure } from '../../../util/sameStructure';

export const isMatchingOfferDesc = (extentOps, leftOffer, rightOffer) => {
  // "matching" means that assetDescs are the same, but that the
  // rules have switched places in the array
  return (
    extentOps[0].equals(
      leftOffer[0].assetDesc.extent,
      rightOffer[0].assetDesc.extent,
    ) &&
    extentOps[1].equals(
      leftOffer[1].assetDesc.extent,
      rightOffer[1].assetDesc.extent,
    ) &&
    sameStructure(
      leftOffer[0].assetDesc.label,
      rightOffer[0].assetDesc.label,
    ) &&
    sameStructure(
      leftOffer[1].assetDesc.label,
      rightOffer[1].assetDesc.label,
    ) &&
    leftOffer[0].rule === rightOffer[1].rule &&
    leftOffer[1].rule === rightOffer[0].rule
  );
};

export const isValidFirstOfferDesc = newOfferDesc =>
  ['offerExactly', 'wantExactly'].every(
    (rule, i) => rule === newOfferDesc[i].rule,
  );
