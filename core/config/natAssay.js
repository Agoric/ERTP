import harden from '@agoric/harden';

import natLogic from './natLogic';
import { makeAssayMaker } from '../assay';
//
// The default assay makes the default kind of amount.  The default
// kind of amount is a labeled natural number describing a quantity of
// fungible erights. The label describes what kinds of rights these
// are. This is a form of labeled unit, as in unit typing.
const makeNatAssay = makeAssayMaker(natLogic);

harden(makeNatAssay);

export { makeNatAssay };
