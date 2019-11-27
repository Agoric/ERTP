/* eslint-disable no-use-before-define */
import harden from '@agoric/harden';
import { natSafeMath } from './helpers/safeMath';

import { makeHelpers } from './helpers/userFlow';

import { makeMint } from '../../mint';

export const makeContract = harden((zoe, terms) => {
  // The user passes in an array of two assays for the two kinds of
  // assets to be swapped.
  const startingAssays = terms.assays;
  const {
    rejectOffer,
    hasValidPayoutRules,
    vectorWith,
    vectorWithout,
    makeEmptyUnits,
  } = makeHelpers(zoe, assays);

  // There is also a third assay, the assay for the liquidity token,
  // which is created in this contract. We will return all three as
  // the canonical array of assays for this contract
  const liquidityMint = makeMint('liquidity');
  const liquidityAssay = liquidityMint.getAssay();
  const liquidityUnitOps = liquidityAssay.getUnitOps();
  const assays = [...startingAssays, liquidityAssay];
  const unitOpsArray = zoe.getUnitOpsForAssays(assays);

  let poolInviteHandle;
  let liqTokenSupplyExtent = 0;

  const { add, subtract, multiply, divide } = natSafeMath;

  // Calculate how many liquidity tokens we should be minting.
  // Calculations are based on the extents represented by index 0.
  // If the current supply is zero, start off by just taking the
  // extent at index 0 and using it as the extent for the
  // liquidity token.
  const calculateLiquidityOut = inviteHandle => {
    const [poolUnits, addedUnits] = zoe.getUnitMatrix(
      harden([poolInviteHandle, inviteHandle]),
      assays,
    );
    return liquidityUnitOps.make(
      liqTokenSupplyExtent > 0
        ? divide(
            multiply(addedUnits[0].extent, liqTokenSupplyExtent),
            poolUnits[0].extent,
          )
        : addedUnits[0].extent,
    );
  };

  const makeSeatInvite = () => {
    const seat = harden({
      addLiquidity: async () => {
        // Create an empty offer to represent the extents of the
        // liquidity pool.
        if (poolInviteHandle === undefined) {
          poolInviteHandle = zoe.makeEmptyOffer(assays);
        }

        // Check the payout rules
        if (!hasValidPayoutRules(['offer', 'offer', 'want'], inviteHandle)) {
          throw rejectOffer(
            inviteHandle,
            `The offer to add liquidity was invalid.`,
          );
        }
        // Mint new liquidity tokens.
        const liquidityUnits = calculateLiquidityOut(inviteHandle);
        const newPurse = liquidityMint.mint(liquidityUnits);
        const newPayment = newPurse.withdrawAll();
        liqTokenSupplyExtent = add(liqTokenSupplyExtent, liquidityUnits.extent);

        // Finish the reallocation for the pool before the await.
        const [poolUnits, addedUnits] = zoe.getUnitMatrix(
          harden([poolInviteHandle, inviteHandle]),
          assays,
        );
        const newPoolUnits = vectorWith(poolUnits, addedUnits);
        zoe.reallocate(
          harden([poolInviteHandle, inviteHandle]),
          harden([newPoolUnits, makeEmptyUnits()]),
        );

        // Create an offer to let Zoe escrow the liquidity tokens. We
        // do this such that the user can include liquidity token
        // units in their offer rules as 'want'
        const liquidityInviteHandle = await zoe.makeWantNothingOffer(
          harden([undefined, undefined, newPayment]),
        );

        // Make an array of empty units per assay, then overwrite the
        // liquidity units with the actual liquidity units to be given
        // to the user.
        const newUserUnits = makeEmptyUnits();
        newUserUnits[2] = liquidityUnits;
        zoe.reallocate(
          harden([inviteHandle, liquidityInviteHandle]),
          harden([newUserUnits, makeEmptyUnits()]),
        );
        // The newly created liquidityOffer is temporary and is
        // completed as well.
        zoe.complete(harden([liquidityInviteHandle, inviteHandle]));
        return 'Added liquidity.';
      },
      removeLiquidity: () => {
        if (!hasValidPayoutRules(['want', 'want', 'offer'], inviteHandle)) {
          throw rejectOffer(inviteHandle);
        }
        const handles = harden([poolInviteHandle, inviteHandle]);
        const [poolUnits, userUnits] = zoe.getUnitMatrix(handles, assays);
        const liquidityTokenUnits = userUnits[2];

        const newUserUnits = unitOpsArray.map((unitOps, i) =>
          unitOps.make(
            divide(
              multiply(liquidityTokenUnits.extent, poolUnits[i].extent),
              liqTokenSupplyExtent,
            ),
          ),
        );
        const newPoolUnits = vectorWith(
          vectorWithout(poolUnits, newUserUnits),
          [0, 0, liquidityTokenUnits],
        );
        liqTokenSupplyExtent = subtract(
          liqTokenSupplyExtent - liquidityTokenUnits.extent,
        );
        zoe.reallocate(
          harden([inviteHandle, poolInviteHandle]),
          harden([newUserUnits, newPoolUnits]),
        );
        zoe.complete(harden([inviteHandle]));
        return 'Liquidity successfully removed.';
      },
      swap: () => {
        const newUserUnits = makeEmptyUnits();
        let newPoolUnits;

        const [poolUnits, userUnits] = zoe.getUnitMatrix(
          harden(poolInviteHandle, inviteHandle),
          assays,
        );
        const [poolUnitsA, poolUnitsB] = poolUnits;

        // offer token A, want token B
        if (hasValidPayoutRules(['offer', 'want', 'want'], inviteHandle)) {
          const [offerUnits, wantUnits] = userUnits;
          const {
            tokenOutE,
            newTokenInPoolE,
            newTokenOutPoolE,
          } = calculateSwap(
            poolUnitsA.extent,
            poolUnitsB.extent,
            offerUnits.extent,
          );
          if (tokenOutE < wantUnits.extent) {
            throw rejectOffer(inviteHandle);
          }
          newPoolUnits = [
            unitOpsArray[0].make(newTokenInPoolE),
            unitOpsArray[1].make(newTokenOutPoolE),
            poolUnits[2],
          ];
          newUserUnits[1] = unitOpsArray[1].make(tokenOutE);

          // want token A, offer token B
        } else if (
          hasValidPayoutRules(['want', 'offer', 'want'], inviteHandle)
        ) {
          const [wantUnits, offerUnits] = userUnits;
          const {
            tokenOutE,
            newTokenInPoolE,
            newTokenOutPoolE,
          } = calculateSwap(
            poolUnitsB.extent,
            poolUnitsA.extent,
            offerUnits.extent,
          );
          if (tokenOutE < wantUnits.extent) {
            throw rejectOffer(inviteHandle);
          }
          newPoolUnits = [
            unitOpsArray[0].make(newTokenOutPoolE),
            unitOpsArray[1].make(newTokenInPoolE),
            poolUnits[2],
          ];
          newUserUnits[0] = unitOpsArray[0].make(tokenOutE);
        } else {
          throw rejectOffer(inviteHandle);
        }
        zoe.reallocate(
          harden([inviteHandle, poolInviteHandle]),
          harden([newUserUnits, newPoolUnits]),
        );
        zoe.complete(harden([inviteHandle]));
        return `Swap was successful`;
      },
    });
    const { invite, inviteHandle } = zoe.makeInvite(seat, {
      seatDesc: 'swap and add/remove liquidity',
    });
    return invite;
  };

  /**
   * `calculateSwap` contains the logic for calculating how many
   * tokens should be given back to the user in exchange for what they
   * sent in. It also calculates the fee as well as the new extents of
   * the assets in the pool. `calculateSwap` is reused in several
   * different places, including to check whether an offer is valid,
   * getting the current price for an asset on user request, and to do
   * the actual reallocation after an offer has been made. The `E` in
   * variable names stands for extent.
   * @param  {number} tokenInPoolE - the extent in the liquidity pool
   * of the kind of token that was sent in.
   * @param  {number} tokenOutPoolE - the extent in the liquidity pool
   * of the other kind of token, the kind that will be sent out.
   * @param  {number} tokenInE - the extent that was sent in to be
   * exchanged
   * @param  {number} feeInTenthOfPercent=3 - the fee taken in tenths
   * of a percent. The default is 0.3%. The fee is taken in terms of
   * tokenIn, which is the kind that was sent in.
   */
  const calculateSwap = (
    tokenInPoolE,
    tokenOutPoolE,
    tokenInE,
    feeInTenthOfPercent = 3,
  ) => {
    // Constant product invariant means:
    // tokenInPoolE * tokenOutPoolE =
    //   (tokenInPoolE + tokenInE) *
    //   (tokenOutPoolE - tokensOutE)

    // newTokenInPoolE = tokenInPoolE + tokenInE;
    const newTokenInPoolE = add(tokenInPoolE, tokenInE);

    // newTokenOutPool = tokenOutPool / (1 + (tokenInE/tokenInPoolE)*(1-.003))

    // the order in which we do this makes a difference because of
    // rounding to floor.
    const numerator = multiply(multiply(tokenOutPoolE, tokenInPoolE), 1000);
    const denominator = add(
      multiply(tokenInPoolE, 1000),
      multiply(tokenInE, subtract(1000, feeInTenthOfPercent)),
    );
    // save divide for last
    const newTokenOutPoolE = divide(numerator, denominator);
    return {
      tokenOutE: tokenOutPoolE - newTokenOutPoolE,
      newTokenInPoolE,
      newTokenOutPoolE,
    };
  };

  /**
   * `getPrice` calculates the result of a trade, given a certain units
   * of tokens in.
   */
  const getPrice = unitsIn => {
    const [poolUnits] = zoe.getUnitMatrix(harden(poolInviteHandle), assays);
    const [poolUnitsA, poolUnitsB] = poolUnits;
    const [userUnitsA, userUnitsB] = unitsIn;

    // offer tokenA, want tokenB
    if (userUnitsA.extent > 0 && userUnitsB.extent === 0) {
      const { tokenOutE } = calculateSwap(
        poolUnitsA.extent,
        poolUnitsB.extent,
        userUnitsA.extent,
      );
      return unitOpsArray[1].make(tokenOutE);
    }

    // want tokenA, offer tokenB
    if (userUnitsA.extent === 0 && userUnitsB.extent > 0) {
      const { tokenOutE } = calculateSwap(
        poolUnitsB.extent,
        poolUnitsB.extent,
        userUnitsA.extent,
      );
      return unitOpsArray[0].make(tokenOutE);
    }

    throw new Error(`The asset descriptions were invalid`);
  };

  return harden({
    invite: makeSeatInvite(),
    publicAPI: {
      getPrice,
      getLiquidityAssay: () => liquidityAssay,
      getPoolUnits: () =>
        zoe.getUnitMatrix(harden([poolInviteHandle]), assays)[0],
      makeInvite: makeSeatInvite,
    },
    terms,
  });
});
