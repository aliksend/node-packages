import { type MiddlewareAsyncIterable } from '../fn'
import { type AsyncLocalStorage } from 'async_hooks'

export interface Lock {
  unlock: () => Promise<void>
}
export interface LockProvider {
  readonly wasLocked: AsyncLocalStorage<boolean | undefined>
  lock: ((req: any) => Promise<Lock>) & ((req: any, tryOnce: true) => Promise<Lock | undefined>)
}

type CheckFn<Req, Res> = (req: Req, wasLocked: boolean) => { value: Res } | Promise<true | { value: Res }>

type FormatKeyFn<Req> = (req: Req) => unknown

export function lock<Req, Res> (check: CheckFn<Req, Res>, provider: LockProvider, formatKey?: FormatKeyFn<Req>): MiddlewareAsyncIterable<Req, Res>
export function lock<Req, Res> (check: true, provider: LockProvider, formatKey?: FormatKeyFn<Req>): MiddlewareAsyncIterable<Req, Res>
export function lock<Req, Res> (provider: LockProvider, formatKey?: FormatKeyFn<Req>): MiddlewareAsyncIterable<Req, Res>

export function lock<Req, Res> (checkOrProvider: true | CheckFn<Req, Res> | LockProvider, providerOrFormatKey?: LockProvider | FormatKeyFn<Req>, formatKeyOrNothing?: FormatKeyFn<Req>): MiddlewareAsyncIterable<Req, Res> {
  let check: CheckFn<Req, Res> | true | undefined
  let lockProvider: LockProvider
  let formatKey: FormatKeyFn<Req> | undefined

  if ((typeof checkOrProvider === 'boolean' || typeof checkOrProvider === 'function') && (providerOrFormatKey != null && typeof providerOrFormatKey !== 'function')) {
    check = checkOrProvider
    lockProvider = providerOrFormatKey
    formatKey = formatKeyOrNothing
  } else if (typeof checkOrProvider === 'object' && (providerOrFormatKey == null || typeof providerOrFormatKey === 'function')) {
    check = undefined
    lockProvider = checkOrProvider
    formatKey = providerOrFormatKey
  } else {
    throw new Error('invalid call')
  }

  return async function * (req, next) {
    let lockKey: unknown = req
    if (formatKey != null) {
      lockKey = formatKey(req)
    }

    let lock: Lock | undefined
    let wasLocked: boolean | undefined
    if (check != null) {
      wasLocked = false
      const callbackMustBeCalled = typeof check === 'boolean' ? check : await Promise.resolve(check(req, false))
      if (callbackMustBeCalled !== true) {
        yield callbackMustBeCalled.value
        return
      }

      lock = await lockProvider.lock(lockKey, true)
      if (lock == null) {
        wasLocked = true
        lock = await lockProvider.lock(lockKey)

        const callbackMustBeCalled = typeof check === 'boolean' ? check : await Promise.resolve(check(req, true))
        if (callbackMustBeCalled !== true) {
          yield callbackMustBeCalled.value
          return
        }
      }
    } else {
      lock = await lockProvider.lock(lockKey)
    }

    try {
      lockProvider.wasLocked.enterWith(wasLocked)
      for await (const v of next()) {
        yield v
      }
    } finally {
      lockProvider.wasLocked.disable()
      await lock?.unlock()
    }
  }
}
