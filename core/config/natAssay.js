import harden from '@agoric/harden';

import natLogic from './natLogic';
import { makeAssayMaker } from './assay';

// This assays.js module treats labels as black boxes. It is not aware
// of issuers, and so can handle labels whose issuers are merely
// presences of remote issuers.

// Return an assay, which makes amounts, validates amounts, and
// provides set operations over amounts. An amount is a pass-by-copy
// description of some set of erights. An amount has a label and a
// quantity. All amounts made by the same assay have the same label
// but differ in quantity.
//
// An assay is pass-by-presence, but is not designed to be usefully
// passed. Rather, we expect each vat that needs to operate on amounts
// will have its own local assay to do so.
//
// The default assay makes the default kind of amount.  The default
// kind of amount is a labeled natural number describing a quantity of
// fungible erights. The label describes what kinds of rights these
// are. This is a form of labeled unit, as in unit typing.
const makeNatAssay = makeAssayMaker(natLogic);

harden(makeNatAssay);

export { makeNatAssay };
