import harden from '@agoric/harden';

import { noCustomization } from '../../config/noCustomization';
import { makeCoreMintKeeper } from '../../config/coreMintKeeper';
import { seatStrategy } from '../../config/strategies/seatStrategy';

// This is used by Zoe to create the EscrowReceipt ERTP payments
function makeEscrowReceiptConfig() {
  return harden({
    ...noCustomization,
    makeMintKeeper: makeCoreMintKeeper,
    strategy: seatStrategy,
  });
}

export { makeEscrowReceiptConfig };
