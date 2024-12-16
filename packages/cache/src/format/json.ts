import { Format } from "../format";

export function json<T>(): Format<T, T> {
  return {
    deserialize: (v) => JSON.parse(v.toString()),
    serialize: (v) => Buffer.from(JSON.stringify(v)),
  }
}
