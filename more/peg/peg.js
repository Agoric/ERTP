import harden from '@agoric/harden';

import { makeMint } from '../../core/issuers';
import { makeBasicFungibleConfig } from '../../core/config/basicFungibleConfig';
import { makeRemoteLabelConfigMaker } from './remoteLabelConfig';

// Creates a local issuer that locally represents a remotely issued
// currency. Returns a promise for a peg object that asynchonously
// converts between the two. The local currency is synchronously
// transferable locally.
//
// The `E` argument will go away once `E` becomes pure and safely
// importable.
//
// The `makeOverriddenConfig` should be an adequate local analog of
// the `makeConfig` that was used to make the remote issuer. However,
// the peg abstraction below overrides it to make assays and amounts
// with the remote issuer's label.
function makePeg(
  E,
  remoteIssuerP,
  makeOverriddenConfig = makeBasicFungibleConfig,
) {
  const remoteLabelP = E(remoteIssuerP).getLabel();
  const backingPursePP = E(remoteIssuerP).makeEmptyPurse('backing');

  return Promise.all([remoteLabelP, backingPursePP]).then(
    // The remoteLabel is a local copy of the remote pass-by-copy
    // label. It has a presence of the remote issuer and a copy of the
    // description.
    //
    // Retaining a remote payment deposits it in backingPurseP.
    // Redeeming a local payment withdraws the remote payment from
    // backingPurseP.
    ([remoteLabel, backingPurseP]) => {
      const { description } = remoteLabel;
      const makeRemoteLabelConfig = makeRemoteLabelConfigMaker(
        makeOverriddenConfig,
        remoteLabel,
      );
      const localMint = makeMint(description, makeRemoteLabelConfig);
      const localIssuer = localMint.getIssuer();

      return harden({
        getLocalIssuer() {
          return localIssuer;
        },

        getRemoteIssuer() {
          return remoteIssuerP;
        },

        retainAll(remotePaymentP, name = 'backed') {
          return E(backingPurseP)
            .depositAll(remotePaymentP)
            .then(amount =>
              localMint.mint(amount, `${name} purse`).withdrawAll(name),
            );
        },

        redeemAll(localPayment, name = 'redeemed') {
          return localIssuer
            .burnAll(localPayment)
            .then(amount => E(backingPurseP).withdraw(amount, name));
        },
      });
    },
  );
}
harden(makePeg);

export { makePeg };
