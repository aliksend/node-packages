import { Format } from "../format";

export function noop<T>(): Format<T, T> {
  return {
    deserialize: (v) => v as any,
    serialize: (v) => v as any,
  }
}
