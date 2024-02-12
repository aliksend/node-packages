import { describe, it, beforeEach } from 'node:test'
import assert from 'assert'
import { Module } from './module'
import { z } from 'zod'

/* eslint-disable  @typescript-eslint/no-floating-promises */

describe('Module', () => {
  let module: Module<any, any, any>

  beforeEach(async () => {
    await Module.stopAll()
    Module.clear()

    module = Module.declare('test', 'input', {
      configSchema: z.any(),
      moduleName: 'test module',
      startArg: null as any,
      start: async (config, startArg) => ({ config, startArg }),
    })
  })

  it('should not return value if not started', () => {
    assert.throws(() => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const _ = module.value
    }, { message: 'module test module (test) is not started' })
  })

  it('should start, return value and stop', async () => {
    assert.equal(module.started, false)

    await module.start('bar')
    assert.equal(module.started, true)

    const v = module.value
    assert.deepStrictEqual(v, { config: 'bar', startArg: null })

    await module.stop()
    assert.equal(module.started, false)
  })

  it('should not allow to read startArg when started', async () => {
    await module.start('bar')

    assert.throws(() => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const _ = module.startArg
    }, { message: 'module test module (test) is already started' })
  })

  it('should not allow to modify startArg when started', async () => {
    await module.start('bar')

    assert.throws(() => {
      module.startArg = 'foo'
    }, { message: 'module test module (test) is already started' })
  })

  describe('with stop callback defined', () => {
    it('should call callback on stop', async () => {
      let stopCalledWith: { value: unknown } | undefined
      const m = Module.declare('test 2', 'input', {
        configSchema: z.any(),
        startArg: null as any,
        start: async (config, startArg) => ({ config, startArg }),
        stop: async (value) => {
          stopCalledWith = { value }
        },
      })

      await m.start('foo')
      await m.stop()

      assert.deepStrictEqual(stopCalledWith, { value: { config: 'foo', startArg: null } })
    })
  })

  describe('with custom startArg', () => {
    it('should allow to modify startArg before start', async () => {
      assert.equal(module.started, false)
      module.startArg = 'foo'

      await module.start('bar')
      assert.equal(module.started, true)

      const v = module.value
      assert.deepStrictEqual(v, { config: 'bar', startArg: 'foo' })
    })
  })

  it('should start all modules at once', async () => {
    assert.equal(module.started, false)
    await Module.startAll({
      'test module': 'foo',
    })

    assert.equal(module.started, true)
    const v = module.value
    assert.deepStrictEqual(v, { config: 'foo', startArg: null })
  })

  it('should stop all modules at once', async () => {
    await Module.startAll(undefined)

    assert.equal(module.started, true)
    await Module.stopAll()
    assert.equal(module.started, false)
  })
})

/* eslint-enable  @typescript-eslint/no-floating-promises */
