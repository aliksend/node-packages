import { beforeEach, describe, it } from "node:test";
import { Cache } from "./cache";
import { MemoryStorage } from "./storage/memory";
import { Cached } from ".";
import assert from 'node:assert'
import { json } from "./format/json";
import { noop } from "./format/noop";
import { CacheStorage } from "./storage";

describe('cache', () => {
  async function req(): Promise<number> {
    counter += 1
    return counter
  }

  let counter: number
  let cache: Cache
  let storage: CacheStorage

  beforeEach(() => {
    counter = 0
    storage = new MemoryStorage()
    cache = new Cache({
      storage
    })
  })

  it('should request and return value', async () => {
    const cached = cache.cached('value', req)

    assert.equal(counter, 0)

    const v = await cached()

    assert.equal(v, 1)
    assert.equal(counter, 1)
  })

  it('should not request value second time', async () => {
    const cached = cache.cached('value', req)

    assert.equal(counter, 0)

    let v = await cached()

    assert.equal(v, 1)
    assert.equal(counter, 1)

    v = await cached()

    assert.equal(v, 1)
    assert.equal(counter, 1)
  })

  it('should request value instantly if requestValueAfterCreating is set', async () => {
    const cached = cache.cached('value', req, { requestValueAfterCreating: true })

    assert.equal(counter, 1)

    const v = await cached()

    assert.equal(v, 1)
    assert.equal(counter, 1)
  })

  it('should respect experesInMs', async () => {
    const cached = cache.cached('value', req, { expiresInMs: 10 })

    assert.equal(counter, 0)

    let v = await cached()

    assert.equal(v, 1)
    assert.equal(counter, 1)

    await new Promise(r => setTimeout(r, 15))

    v = await cached()

    assert.equal(v, 2)
    assert.equal(counter, 2)
  })

  it('should invalidate value', async () => {
    const cached = cache.cached('value', req)

    assert.equal(counter, 0)

    let v = await cached()

    assert.equal(v, 1)
    assert.equal(counter, 1)

    cache.invalidate('value', false)

    assert.equal(counter, 1)

    v = await cached()

    assert.equal(v, 2)
    assert.equal(counter, 2)
  })

  it('should allow to reload value after invalidation', async () => {
    const cached = cache.cached('value', req)

    assert.equal(counter, 0)

    let v = await cached()

    assert.equal(v, 1)
    assert.equal(counter, 1)

    await cache.invalidate('value')

    assert.equal(counter, 2)

    v = await cached()

    assert.equal(v, 2)
    assert.equal(counter, 2)
  })

  it('should force request new value', async () => {
    const cached = cache.cached('value', req)

    assert.equal(counter, 0)

    let v = await cached()

    assert.equal(v, 1)
    assert.equal(counter, 1)

    v = await cached({ force: true })

    assert.equal(v, 2)
    assert.equal(counter, 2)
  })

  it('should not throw on invalidating non-existing value', async () => {
    await cache.invalidate('other')
  })

  describe('custom format', () => {
    it('should request and return value using noop', async () => {
      const cached = cache.cached('value', req, noop())

      assert.equal(counter, 0)
      assert.equal(await storage.get('value'), undefined)

      const v = await cached()

      assert.equal(v, 1)
      assert.equal(counter, 1)
      assert.equal(await storage.get('value'), 1)
    })

    it('should request and return value using json', async () => {
      const cached = cache.cached('value', req, json())

      assert.equal(counter, 0)
      assert.equal(await storage.get('value'), undefined)

      const v = await cached()

      assert.equal(v, 1)
      assert.equal(counter, 1)

      const rawValue = await storage.get('value')
      assert(rawValue instanceof Buffer)
      assert.equal(rawValue.toString(), '1')
    })

    it('should allow to use format & opts at the same time', async () => {
      const cached = cache.cached('value', req, noop(), { requestValueAfterCreating: true })

      await new Promise(r => setTimeout(r, 5))

      assert.equal(counter, 1)
      assert.equal(await storage.get('value'), 1)

      const v = await cached()

      assert.equal(v, 1)
      assert.equal(counter, 1)
      assert.equal(await storage.get('value'), 1)
    })
  })
})
