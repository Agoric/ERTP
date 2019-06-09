// @flow

import harden from '@agoric/harden';

/* ::
export interface PromiseParts<T> {
  p: Promise<T>;
  res(T | Promise<T>): void;
  rej(mixed): void;
  reject(mixed): void;
}
*/

export default function makePromise /* :: <T> */() /* : PromiseParts<T> */ {
  let res = _ => undefined;
  let rej = _ => undefined;
  const p = new Promise((resolve, reject) => {
    res = resolve;
    rej = reject;
  });
  // Node.js adds the `domain` property which is not a standard
  // property on Promise. Because we do not know it to be ocap-safe,
  // we remove it.
  // $FlowFixMe
  if (p.domain) {
    // deleting p.domain may break functionality. To retain current
    // functionality at the expense of safety, set unsafe to true.
    const unsafe = false;
    if (unsafe) {
      const originalDomain = p.domain;
      // $FlowFixMe
      Object.defineProperty(p, 'domain', {
        get() {
          return originalDomain;
        },
      });
    } else {
      delete p.domain;
    }
  }
  // TODO: Retire name 'rej' as it looks too much like 'res'.
  return harden({ p, res, rej, reject: rej });
}
harden(makePromise);
