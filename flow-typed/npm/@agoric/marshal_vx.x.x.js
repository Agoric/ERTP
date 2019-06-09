// flow-typed signature: e77f457664250b0eb875ae9094af7464
// flow-typed version: <<STUB>>/@agoric/marshal_v0.0.1/flow_v0.100.0

/**
 * libdef stub for:
 *
 *   '@agoric/marshal'
 *
 * Once filled out, we encourage you to share your work with the
 * community by sending a pull request to:
 * https://github.com/flowtype/flow-typed
 */

declare module '@agoric/marshal' {
  declare export interface PassByCopyError {
    name: string,
    message: string,
  }
  declare export function passStyleOf(val: mixed): string;
}
