import { describe, it } from 'node:test'
import assert from 'assert'
import { Fn } from './fn'
import { z } from 'zod'
import { read } from './_util.test'

/* eslint-disable  @typescript-eslint/no-floating-promises */

describe('Fn', () => {
  it('should allow to declare request as tuple to call with multiple arguments', async () => {
    let called = false

    const fn = Fn.build({
      request: z.tuple([z.string(), z.number()]),
      response: z.void(),
    }).init(([str, num]) => {
      assert.strictEqual(typeof str, 'string')
      assert.strictEqual(typeof num, 'number')
      called = true
    })

    await fn('string', 123)

    assert.strictEqual(called, true)
  })

  describe('promise', () => {
    it('should work with sync', async () => {
      const fn = Fn.build({
        request: z.string(),
        response: z.number().int(),
      }).init((req) => {
        return parseInt(req)
      })

      const res = await fn('123')
      assert.strictEqual(res, 123)
    })

    it('should work with promise', async () => {
      const fn = Fn.build({
        request: z.string(),
        response: z.number().int(),
      }).init(async (req) => {
        return parseInt(req)
      })

      const res = await fn('123')
      assert.strictEqual(res, 123)
    })
  })

  describe('asynciterable', () => {
    it('should work with sync', async () => {
      const fn = Fn.build({
        request: z.string(),
        response: z.number().int(),
        responseType: 'asynciterable',
      }).init((req) => {
        return parseInt(req)
      })

      const res = await read(fn('123'))
      assert.deepStrictEqual(res, [123])
    })

    it('should work with promise', async () => {
      const fn = Fn.build({
        request: z.string(),
        response: z.number().int(),
        responseType: 'asynciterable',
      }).init(async (req) => {
        return parseInt(req)
      })

      const res = await read(fn('123'))
      assert.deepStrictEqual(res, [123])
    })

    it('should work with asynciterable', async () => {
      const fn = Fn.build({
        request: z.string(),
        response: z.number().int(),
        responseType: 'asynciterable',
      }).init((req) => {
        const values = req.split(' ')
        return {
          [Symbol.asyncIterator]: () => ({
            async next () {
              if (values.length === 0) {
                return {
                  done: true,
                  value: undefined as any, // https://github.com/microsoft/TypeScript/issues/38479
                }
              }
              return {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                value: parseInt(values.shift()!),
              }
            },
          }),
        }
      })

      const res = await read(fn('123 456'))
      assert.deepStrictEqual(res, [123, 456])
    })
  })

  describe('middleware as function', () => {
    it('should work with promise', async () => {
      const callOrder: string[] = []

      const fn = Fn.build({
        request: z.string(),
        response: z.number().int(),
      }).use((req, next) => {
        callOrder.push('middleware')
        return next()
      }).init((req) => {
        callOrder.push('callback')
        return parseInt(req)
      })

      const res = await fn('123')

      assert.deepStrictEqual(res, 123)
      assert.deepStrictEqual(callOrder, ['middleware', 'callback'])
    })

    it('should work with asynciterable', async () => {
      const callOrder: string[] = []

      const fn = Fn.build({
        request: z.string(),
        response: z.number().int(),
        responseType: 'asynciterable',
      }).use((req, next) => {
        callOrder.push('middleware')
        return next()
      }).init((req) => {
        callOrder.push('callback')
        return parseInt(req)
      })

      const res = await read(fn('123'))

      assert.deepStrictEqual(res, [123])
      assert.deepStrictEqual(callOrder, ['middleware', 'callback'])
    })
  })

  describe('middleware as generator or promise', () => {
    it('should work with promise', async () => {
      const callOrder: string[] = []

      const fn = Fn.build({
        request: z.string(),
        response: z.number().int(),
      }).use(async function * (req, next) {
        callOrder.push('middleware 1')
        for await (const v of next()) {
          yield v
        }
        callOrder.push('end of middleware 1')
      }).usep(async (req, next) => {
        callOrder.push('middleware 2')
        const res = await next()
        callOrder.push('end of middleware 2')
        return res * 2
      }).init((req) => {
        callOrder.push('callback')
        return parseInt(req)
      })

      const res = await fn('123')

      assert.deepStrictEqual(res, 246)
      assert.deepStrictEqual(callOrder, ['middleware 1', 'middleware 2', 'callback', 'end of middleware 2', 'end of middleware 1'])
    })
  })
})

/* eslint-enable  @typescript-eslint/no-floating-promises */
