// Copyright (C) 2019 Agoric, under Apache License 2.0

import harden from '@agoric/harden';

// An LRU queue. The maker returns two facets.  One allows initialization, the
// other only supports popping from the front (entries are re-queud) or
// requeuing arbitrary entries to the tail. Initialize by pushing an arbitrary
// number of items, then call resortArbitrarily() with the number of entries and
// a step size (something prime and not a multiple of the row size).
export function makeLruQueue() {
  function makeNode(obj, prev = null, next = null) {
    return { contents: obj, prev, next };
  }

  const emptyNode = makeNode({});
  let head = emptyNode;
  let tail = head;

  // is the queue empty?
  function isEmpty() {
    return head === emptyNode;
  }

  // push a new object on the queue. Only used during creation?
  function push(obj) {
    if (isEmpty()) {
      head = makeNode(obj);
      tail = head;
      return tail;
    }

    const newTail = makeNode(obj, tail);
    tail.next = newTail;
    tail = newTail;
    return newTail;
  }

  // return the content of the head, and move it to the tail of the queue.
  function popToTail() {
    if (isEmpty()) {
      return undefined;
    }
    // base case
    if (head === tail) {
      return head.contents;
    }

    const [oldHead, oldTail] = [head, tail];
    const content = head.contents;
    oldTail.next = head;
    [head, tail] = [head.next, oldHead];
    oldHead.next = undefined;
    return content;
  }

  function requeueNode(cur, prev) {
    prev.next = cur.next;
    tail.next = cur;
    cur.next = undefined;
    tail = cur;
  }

  // find an arbitrary object from the queue, and move it to the tail.
  function requeue(obj) {
    if (isEmpty() || tail.contents === obj) {
      return;
    }
    if (head.contents === obj) {
      popToTail();
      return;
    }

    let [prev, cur] = [head, head.next];
    while (cur !== undefined && cur.contents !== obj) {
      if (cur.next === undefined) {
        return;
      }

      prev = cur;
      cur = cur.next;
    }

    if (cur === undefined || cur.contents !== obj) {
      return;
    }

    requeueNode(cur, prev);
  }

  function resortArbitrarily(entries, step = 117) {
    let nextPositionToMove = step;
    for (let unmoved = entries; unmoved > 0; unmoved -= 1) {
      nextPositionToMove = (nextPositionToMove + step) % unmoved;
      if (nextPositionToMove === 0) {
        popToTail();
      } else {
        let [candidate, prev] = [head.next, head];
        for (let i = 1; i < nextPositionToMove; i += 1) {
          [candidate, prev] = [candidate.next, candidate];
        }
        requeueNode(candidate, prev);
      }
    }
  }

  function getState() {
    const result = [];
    let start = head;
    result.push(start.contents);
    while (start.next) {
      result.push(start.next.contents);
      start = start.next;
    }
    return result;
  }

  const lruQueue = harden({ popToTail, requeue, getState });
  const lruQueueBuilder = harden({ push, resortArbitrarily, isEmpty });

  return harden({ lruQueue, lruQueueBuilder });
}
