import dayjs from "dayjs";
import { Opts } from "./cache.js";
import { CacheStorage } from "./storage.js";
import { Format } from "./format.js";

export interface RequestOpts {
  /**
   * Force request actual value
   * @default false
   */
  force?: boolean;
}

/**
 * Class that holds cached value
 */
export class CacheItem<I, O> {
  /**
   * Key of this cached value
   */
  #key: string;
  /**
   * Function to requset actual value
   */
  #requestActualValue: () => PromiseLike<I>;
  #reloadingPromise: PromiseLike<void>;
  #format: Format<I, O>;
  #storage: CacheStorage;
  #expiresAt: undefined | dayjs.Dayjs;
  #opts: Opts;

  constructor(
    key: string,
    requestActualValue: () => PromiseLike<I>,
    storage: CacheStorage,
    format: Format<I, O>,
    opts: Opts,
  ) {
    this.#key = key;
    this.#requestActualValue = requestActualValue;
    this.#storage = storage;
    this.#format = format;
    this.#opts = opts;
    this.#reloadingPromise = Promise.resolve();

    if (opts.requestValueAfterCreating) {
      this.#reload();
    }
  }

  #reload(): void {
    this.#reloadingPromise = (async () => {
      const value = await this.#requestActualValue();
      this.#storage.set(this.#key, this.#format.serialize(value));
      this.#expiresAt = this.#opts.expiresInMs != null ? dayjs().add(this.#opts.expiresInMs, "ms") : undefined;
    })();
  }

  async get(opts?: RequestOpts): Promise<O> {
    if (opts?.force === true) {
      this.#reload();
    }
    if (this.#expiresAt != null && this.#expiresAt.isBefore(dayjs())) {
      this.#reload();
    }

    await this.#reloadingPromise;

    const exists = await this.#storage.has(this.#key);
    if (!exists) {
      this.#reload();
      await this.#reloadingPromise;
    }

    const v = await this.#storage.get(this.#key);

    return this.#format.deserialize(v);
  }

  async invalidate(reload: boolean): Promise<void> {
    await this.#storage.unset(this.#key);

    if (reload) {
      this.#reload();
    }
  }
}
