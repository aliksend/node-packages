import { RequestOpts } from "./item.js";

/** Cached value */
export type Cached<T> = (opts?: RequestOpts) => PromiseLike<T>;

export * from "./cache.js";
export * from "./item.js";

export * from "./storage.js";
export * from "./storage/disk.js";
export * from "./storage/memory.js";

export * from "./format.js";
export * from "./format/json.js";
export * from "./format/noop.js";
