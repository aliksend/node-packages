import { CacheStorage } from "../storage";

export class MemoryStorage implements CacheStorage {
  #cache: Record<string, undefined | { value: any }> = {}

  async has(key: string): Promise<boolean> {
    // console.log('!! has', key, { cache: this.#cache })
    return this.#cache[key] != null
  }

  async get(key: string): Promise<Buffer> {
    // console.log('!! get', key, { cache: this.#cache })
    return this.#cache[key]?.value
  }

  async set(key: string, value: Buffer): Promise<void> {
    // console.log('!! set', key, '=', value, { cache: this.#cache })
    this.#cache[key] = { value }
  }

  async unset(key: string): Promise<void> {
    // console.log('!! unset', key, { cache: this.#cache })
    this.#cache[key] = undefined
  }
}
