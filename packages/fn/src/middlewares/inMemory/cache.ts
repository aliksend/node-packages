import { type CacheProvider } from '../cache'

export class InMemoryCacheProvider implements CacheProvider {
  readonly #values = new Map<string, { value: any, validUntil: Date }>()
  readonly #ttlMs: number

  constructor (ttlMs: number) {
    this.#ttlMs = ttlMs
  }

  #key (req: any): string {
    return JSON.stringify(req)
  }

  async get (req: any): Promise<{ value: any } | undefined> {
    const res = this.#values.get(this.#key(req))
    if (res == null) {
      return undefined
    }
    if (res.validUntil < new Date()) {
      return undefined
    }
    return { value: res.value }
  }

  async set (req: any, value: any): Promise<void> {
    const validUntil = new Date(Date.now() + this.#ttlMs)
    this.#values.set(this.#key(req), { value, validUntil })
  }
}
