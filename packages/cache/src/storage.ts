/** Allows to implement different cache storages like memory, disk, redis etc */
export interface CacheStorage {
  /**
   * Returns true if there is cached value for this key and false otherwise
   */
  has(key: string): PromiseLike<boolean>;

  /**
   * Returns value for key. Can throw if there's no value for key
   */
  get(key: string): PromiseLike<Buffer>;

  /**
   * Saves value for specific key. Should not throw
   */
  set(key: string, value: Buffer): PromiseLike<void>;

  /**
   * Removes value for specific key. Should not throw
   */
  unset(key: string): PromiseLike<void>;
}
