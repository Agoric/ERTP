// flow-typed signature: 463bd664500a30443b5b8e173442acc8
// flow-typed version: <<STUB>>/@agoric/swingset-vat_v0.0.12/flow_v0.100.0

/**
 * libdef stub for:
 *
 *   '@agoric/swingset-vat'
 *
 * Once filled out, we encourage you to share your work with the
 * community by sending a pull request to:
 * https://github.com/flowtype/flow-typed
 */

declare module '@agoric/swingset-vat' {
  declare export var E: Eventual;

  declare export interface Eventual {
    // ISSUE:
    //<O: $ReadOnly<{[key: string]: Function}>>(x: Promise<O>): $ObjMap<O, PromiseForReturn>,
    // <T, U>(x: T): { [string]: (...args: mixed[]) => Promise<U>};
    <T, U>(x: Promise<T>): { [string]: (...args: mixed[]) => Promise<U>};
    resolve<T>(x: T): Promise<T>;
    resolve<T>(x: Promise<T>): Promise<T>;
  }

  // declare type PromiseForReturn =
  // (<V>(() => V) => (() => Promise<V>)) |
  // (<V, A1>((A1) => V) => ((A1) => Promise<V>)) |
  // (<V, A1, A2>((A1, A2) => V) => ((A1, A2) => Promise<V>)) |
  // (<V, A1, A2, A3>((A1, A2, A3) => V) => ((A1, A2, A3) => Promise<V>)) |
  // (<V, A1, A2, A3, A4>((A1, A2, A3, A4) => V) => ((A1, A2, A3, A4) => Promise<V>)) ;
}
