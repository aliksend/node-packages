import { describe, it } from 'node:test'
import assert from 'assert'
import { Fn } from '../fn'
import { z } from 'zod'
import { expiration } from './expiration'
import { read } from '../_util.test'

/* eslint-disable  @typescript-eslint/no-floating-promises */

describe('expiration middleware', () => {
  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  const makeFn = () => Fn.build({
    request: z.number().int(),
    response: z.enum(['first', 'second']),
    responseType: 'asynciterable',
  }).init(async function * (req) {
    yield 'first'
    await new Promise<void>((resolve) => setTimeout(resolve, req))
    yield 'second'
  })

  it('should work as usual if no timeout', async () => {
    const fn = makeFn().use(expiration({ ttlMs: 1000 }))

    const fnRes = fn(0)
    const res = await read(fnRes)
    assert.deepStrictEqual(res, ['first', 'second'])
  })

  it('should throw error if there is timeout', async () => {
    const fn = makeFn().use(expiration({ ttlMs: 10 }))
    const res: unknown[] = []

    await assert.rejects(async () => {
      const fnRes = fn(100)
      for await (const v of fnRes) {
        res.push(v)
      }
    }, (err) => {
      if (!(err instanceof Error)) {
        throw new Error('err isn\'t Error')
      }
      assert.strictEqual(err.message, 'timed out')
      return true
    })

    assert.deepStrictEqual(res, ['first'])
  })
})

/* eslint-enable  @typescript-eslint/no-floating-promises */
