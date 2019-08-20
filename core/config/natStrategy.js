import Nat from '@agoric/nat';
import harden from '@agoric/harden';

const natStrategy = harden({
  insistKind: Nat,
  empty: _ => 0,
  isEmpty: nat => nat === 0,
  includes: (whole, part) => whole >= part,
  equals: (left, right) => left === right,
  with: (left, right) => Nat(left + right),
  without: (whole, part) => Nat(whole - part),
});

export default natStrategy;
