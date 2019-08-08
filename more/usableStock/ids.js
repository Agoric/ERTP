import Nat from '@agoric/nat';
import harden from '@agoric/harden';

import { passStyleOf } from '@agoric/marshal';
import { insist } from '../../util/insist';

// ids is an array of Nat ids
function insistIds(ids) {
  insist(passStyleOf(ids) === 'copyArray')`ids must be an array`;
  for (const id of ids) {
    Nat(id);
  }
}

// does not check validity of the id or ids
function includesId(ids, targetId) {
  let result = false;
  for (const id of ids) {
    if (id === targetId) {
      result = true;
    }
  }
  return result;
}

// does not check validity of the id or ids
// does ids include id
function insistIncludesId(ids, id) {
  insist(includesId(ids, id))`id is not in ids`;
}

// does left include right?
function includesIds(leftIds, rightIds) {
  // Iterate through the ids in rightIds, see if left
  // includes it. If rightId is empty, this just returns true
  for (const id of rightIds) {
    const result = includesId(leftIds, id);
    if (!result) {
      return false; // return early if false
    }
  }
  return true;
}

function insistIncludesIds(leftIds, rightIds) {
  insist(includesIds(leftIds, rightIds))`\
  leftIds is not in rightIds`;
}

function withIds(leftIds, rightIds) {
  const combinedList = Array.from(leftIds);
  for (const rightId of rightIds) {
    if (!includesId(leftIds, rightId)) {
      combinedList.push(rightId);
    }
  }
  return harden(combinedList);
}

// Covering set subtraction of erights.
// If leftAmount does not include rightAmount, error.
// Describe the erights described by `leftAmount` and not described
// by `rightAmount`.
function withoutIds(leftIds, rightIds) {
  insistIncludesIds(leftIds, rightIds);
  const leftMinusRight = [];
  for (const leftId of leftIds) {
    if (!includesId(rightIds, leftId)) {
      leftMinusRight.push(leftId);
    }
  }
  return harden(leftMinusRight);
}

function insistIdsEqual(leftIds, rightIds) {
  // includes both ways, super inefficient
  // if Ids were ordered, this would be must more efficient
  insistIncludesIds(leftIds, rightIds);
  insistIncludesIds(rightIds, leftIds);
}

export {
  insistIds,
  includesId,
  insistIncludesId,
  includesIds,
  withIds,
  withoutIds,
  insistIdsEqual,
};
