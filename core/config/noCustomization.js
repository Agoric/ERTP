import harden from '@agoric/harden';

// These methods do no customization; they just return the original
// parameter. In other configurations, these methods would be used to
// add custom methods (or otherwise customize) payments, purses, etc.

// These methods must be paired with a mintKeeper and Assay to be a
// full configuration that can be passed into `makeMint`.
const noCustomization = harden({
  makeCustomPayment(superPayment) {
    return harden({
      ...superPayment,
    });
  },
  makeCustomPurse(superPurse) {
    return harden({
      ...superPurse,
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
});

export { noCustomization };
