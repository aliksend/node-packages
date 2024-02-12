import { describe, it, beforeEach } from 'node:test'
import assert from 'assert'
import { Fn } from '../fn'
import { z } from 'zod'
import { cache } from './cache'
import { InMemoryCacheProvider } from './inMemory/cache'
import { InMemoryLockProvider } from './inMemory/lock'

/* eslint-disable  @typescript-eslint/no-floating-promises */

describe('cache middleware', () => {
  let alreadyRun = false

  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  const makeFn = () => Fn.build({
    request: z.string(),
    response: z.string(),
  }).init(async (req) => {
    assert.equal(alreadyRun, false)
    alreadyRun = true

    fnCallsCount += 1
    await new Promise<void>((resolve) => setTimeout(resolve, 100))

    alreadyRun = false
    return 'value'
  })

  let fnCallsCount = 0

  beforeEach(() => {
    fnCallsCount = 0
    alreadyRun = false
  })

  it('should work as usual if no cache', async () => {
    const fn = makeFn().usep(cache(new InMemoryCacheProvider(1000), new InMemoryLockProvider()))

    const fnRes = fn('')
    const res = await fnRes
    assert.deepStrictEqual(res, 'value')
    assert.deepStrictEqual(fnCallsCount, 1)
  })

  it('should use cache if called more than once', async () => {
    const fn = makeFn().usep(cache(new InMemoryCacheProvider(1000), new InMemoryLockProvider()))

    const fnRes1 = fn('')
    const res1 = await fnRes1
    const fnRes2 = fn('')
    const res2 = await fnRes2
    assert.deepStrictEqual([res1, res2], ['value', 'value'])
    assert.deepStrictEqual(fnCallsCount, 1)
  })

  it('should not use cache if it expired', async () => {
    const fn = makeFn().usep(cache(new InMemoryCacheProvider(10), new InMemoryLockProvider()))

    const fnRes1 = fn('')
    const res1 = await fnRes1
    // wait until cache expired
    await new Promise<void>((resolve) => setTimeout(resolve, 20))
    const fnRes2 = fn('')
    const res2 = await fnRes2
    assert.deepStrictEqual([res1, res2], ['value', 'value'])
    assert.deepStrictEqual(fnCallsCount, 2)
  })

  it('should use different caches for different requests', async () => {
    const fn = makeFn().usep(cache(new InMemoryCacheProvider(1000), new InMemoryLockProvider()))

    const fnRes1 = fn('1')
    const res1 = await fnRes1
    const fnRes2 = fn('2')
    const res2 = await fnRes2
    assert.deepStrictEqual([res1, res2], ['value', 'value'])
    assert.deepStrictEqual(fnCallsCount, 2)
  })

  it('should use same cache for same cache keys', async () => {
    const fn = makeFn().usep(cache(new InMemoryCacheProvider(1000), new InMemoryLockProvider(), (req) => req.length))

    const fnRes1 = fn('1')
    const res1 = await fnRes1
    const fnRes2 = fn('2')
    const res2 = await fnRes2
    assert.deepStrictEqual([res1, res2], ['value', 'value'])
    assert.deepStrictEqual(fnCallsCount, 1)
  })

  it('should wait for callback to be processed when called simultaneously', async () => {
    const fn = makeFn().usep(cache(new InMemoryCacheProvider(1000), new InMemoryLockProvider()))

    const fnRes1 = fn('')
    const fnRes2 = fn('')
    const res = await Promise.all([fnRes1, fnRes2])
    assert.deepStrictEqual(res, ['value', 'value'])
    assert.deepStrictEqual(fnCallsCount, 1)
  })
})

/* eslint-enable  @typescript-eslint/no-floating-promises */
