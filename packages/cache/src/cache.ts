import { Cached } from '.';
import { Format } from './format';
import { json } from './format/json';
import { CacheItem } from './item';
import { CacheStorage } from './storage';

/** Cache options */
export interface Opts {
  /**
   * Request value to be cached just after cache item is declared
   */
  requestValueAfterCreating: boolean;

  /**
   * Invalidate value after specific ms.
   * null to disable
   */
  expiresInMs: number | null;
}

/** Params to create cache with. Includes Opts with defaults */
interface Params {
  storage: CacheStorage;

  /**
   * Request value to be cached just after cache item is declared
   * @default false
   */
  requestValueAfterCreating?: boolean;

  /**
   * Invalidate value after specific ms.
   * null to disable
   * @default null
   */
  expiresInMs?: number | null;
}

/** Cache primitive */
export class Cache {
  #storage: CacheStorage;
  #opts: Opts;
  #items: Record<string, CacheItem<any, any>>

  constructor (opts: Params) {
    this.#storage = opts.storage;
    this.#opts = {
      requestValueAfterCreating: opts.requestValueAfterCreating ?? false,
      expiresInMs: opts.expiresInMs ?? null,
    };
    this.#items = {}
  }

  /**
   * Declare cache item
   * @param key key to store item under
   * @param cb function to retrieve value for cached item
   * @param opts change some params for this specific cached item
   */
  cached<T>(key: string, cb: () => PromiseLike<T>, opts?: Partial<Opts>): Cached<T>

  /**
   * Declare cache item
   * @param key key to store item under
   * @param cb function to retrieve value for cached item
   * @param format formatter to serialize and deserialize value to store and load
   * @param opts change some params for this specific cached item
   */
  cached<I, O>(key: string, cb: () => PromiseLike<I>, format: Format<I, O>, opts?: Partial<Opts>): Cached<O>

  cached(key: string, cb: () => PromiseLike<unknown>, optsOrFormat?: any, optsOrNothing?: any): Cached<any> {
    let format: undefined | Format<unknown, unknown>
    let opts: undefined | Partial<Opts>
    if (optsOrFormat != null) {
      if (optsOrNothing != null) {
        format = optsOrFormat
        opts = optsOrNothing
      } else if ('serialize' in optsOrFormat){
        format = optsOrFormat
      } else {
        opts = optsOrFormat
      }
    }

    if (format == null) {
      format = json()
    }

    if (this.#items[key] == null) {
      this.#items[key] = new CacheItem(key, cb, this.#storage, format, { ...this.#opts, ...opts })
    }

    return async (reqOpts) => {
      return await this.#items[key].get(reqOpts);
    }
  }

  /**
   * Invalidate value
   * @param key key to invalidate item for
   * @param reload request actual value just after invalidating old
   */
  async invalidate(key: string, reload: boolean = true): Promise<void> {
    if (this.#items[key] == null) {
      return
    }

    await this.#items[key].invalidate(reload);
  }
}
