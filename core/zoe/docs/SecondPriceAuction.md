# Second-price auction

In a second-price auction, bids are made and then the winner is the
participant with the highest bid, but the winner only pays the price
corresponding to the second highest bid. Second-price auctions must be
sealed to have the right economic incentives, so this should not be
used in production for high-value items with unsealed-bids.

variable: how many bids

start: haveExactly: 1moola, wantAtLeast: 3 simoleans

bids: wantExactly: 1moola, haveAtMost, 5 simoleans.
haveAtMost 10 simoleans,
haveAtMost 11 simoleans,

11 simoleans wins, pays 10, gets one back as a refund along with the
1moola
everyone else gets their simoleans back as a refund.

