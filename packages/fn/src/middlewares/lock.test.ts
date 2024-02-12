import { describe, it, beforeEach } from 'node:test'
import assert from 'assert'
import { Fn } from '../fn'
import { z } from 'zod'
import { lock } from './lock'
import { InMemoryLockProvider } from './inMemory/lock'
import { combine, read } from '../_util.test'

/* eslint-disable  @typescript-eslint/no-floating-promises */

describe('lock middleware', () => {
  let lockProvider = new InMemoryLockProvider()
  let alreadyRun = false

  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  const makeFn = () => Fn.build({
    request: z.number().int(),
    response: z.string(),
    responseType: 'asynciterable',
  }).init(async function * (req) {
    assert.equal(alreadyRun, false)
    alreadyRun = true

    fnCallsCount += 1
    await new Promise<void>((resolve) => setTimeout(resolve, req))
    const wasLocked = lockProvider.wasLocked.getStore()
    if (wasLocked == null) {
      yield 'do not know'
    } else if (wasLocked) {
      yield 'was locked'
    } else {
      yield 'was not locked'
    }
    await new Promise<void>((resolve) => setTimeout(resolve, req))

    alreadyRun = false
  })

  let fnCallsCount = 0

  beforeEach(() => {
    lockProvider = new InMemoryLockProvider()
    fnCallsCount = 0
    alreadyRun = false
  })

  it('should work as usual if no lock', async () => {
    const fn = makeFn().use(lock(lockProvider))

    const fnRes = fn(100)
    const res = await read(fnRes)
    assert.deepStrictEqual(res, ['do not know'])
    assert.deepStrictEqual(fnCallsCount, 1)
  })

  it('should not call callback if already locked', async () => {
    const fn = makeFn().use(lock(lockProvider))

    const res = await read(combine([fn(100), fn(100)]))
    // if "check" not provided then "wasLocked" information will not be collected
    assert.deepStrictEqual(res, ['do not know', 'do not know'])
    assert.deepStrictEqual(fnCallsCount, 2)
  })

  it('should call callback if check is true', async () => {
    const fn = makeFn().use(lock(true, lockProvider))

    const res = await read(combine([fn(100), fn(100)]))
    assert.deepStrictEqual(res, ['was not locked', 'was locked'])
    assert.deepStrictEqual(fnCallsCount, 2)
  })

  it('should call callback if check returns true', async () => {
    const checkCalledWith: boolean[] = []
    const fn = makeFn().use(lock(async (_req, wasLocked) => {
      checkCalledWith.push(wasLocked)
      return true as const
    }, lockProvider))

    const res = await read(combine([fn(100), fn(100)]))
    assert.deepStrictEqual(res, ['was not locked', 'was locked'])
    assert.deepStrictEqual(fnCallsCount, 2)
    // first call: calls check with "false", then try to make lock (successful)
    // second call: calls check with "false", then try to make lock (not successful, wait for unlock)
    // (first call is done, lock is released)
    // second call: calls check with "true", then try to make lock (successful)
    assert.deepStrictEqual(checkCalledWith, [false, false, true])
  })

  it('should not call callback if check returns value', async () => {
    const checkCalledWith: boolean[] = []
    const fn = makeFn().use(lock((_req, wasLocked) => {
      checkCalledWith.push(wasLocked)
      return { value: 'was not locked' }
    }, lockProvider))

    const res = await read(combine([fn(100), fn(100)]))
    assert.deepStrictEqual(res, ['was not locked', 'was not locked'])
    assert.deepStrictEqual(fnCallsCount, 0)
    assert.deepStrictEqual(checkCalledWith, [false, false])
  })

  it('should not call callback if check returns value (async)', async () => {
    const checkCalledWith: boolean[] = []
    const fn = makeFn().use(lock(async (_req, wasLocked) => {
      checkCalledWith.push(wasLocked)
      return { value: 'was not locked' }
    }, lockProvider))

    const res = await read(combine([fn(100), fn(100)]))
    assert.deepStrictEqual(res, ['was not locked', 'was not locked'])
    assert.deepStrictEqual(fnCallsCount, 0)
    assert.deepStrictEqual(checkCalledWith, [false, false])
  })
})

/* eslint-enable  @typescript-eslint/no-floating-promises */
