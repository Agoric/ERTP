import harden from '@agoric/harden';

// These methods do no customization; they just return the original
// parameter. In other configurations, these methods would be used to
// add custom methods (or otherwise customize) payments, purses, etc.

// These methods must be paired with a mintKeeper and Assay to be a
// full configuration that can be passed into `makeMint`.

function* makePaymentTrait(_superPayment) {
  yield harden({});
}

function* makePurseTrait(_superPurse) {
  yield harden({});
}

function* makeMintTrait(_superMint) {
  yield harden({});
}

function* makeIssuerTrait(_superIssuer) {
  yield harden({});
}

const noCustomization = harden({
  makePaymentTrait,
  makePurseTrait,
  makeMintTrait,
  makeIssuerTrait,
});

export { noCustomization };
