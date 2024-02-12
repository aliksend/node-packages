import { type MiddlewarePromise } from '../fn'
import { type Lock, type LockProvider } from './lock'

export interface CacheProvider {
  set: (req: any, value: any) => Promise<void>

  /** Returns value if present or undefined otherwise */
  get: (req: any) => Promise<{ value: any } | undefined>
}

type FormatKeyFn<Req> = (req: Req) => unknown

export function cache<Req, Res> (cacheProvider: CacheProvider, lockProvider: LockProvider, formatKey?: FormatKeyFn<Req>): MiddlewarePromise<Req, Res> {
  return async (req, next) => {
    let cacheKey: any = req
    if (formatKey != null) {
      cacheKey = formatKey(req)
    }
    const cached = await cacheProvider.get(cacheKey)
    if (cached != null) {
      return cached.value
    }

    let cacheLock: Lock | undefined
    try {
      cacheLock = await lockProvider.lock(cacheKey, true)
      if (cacheLock == null) {
        // already locked
        cacheLock = await lockProvider.lock(cacheKey)
        const cached = await cacheProvider.get(cacheKey)
        if (cached != null) {
          return cached.value
        }
      }

      const res = await next()
      await cacheProvider.set(cacheKey, res)
      return res
    } finally {
      await cacheLock?.unlock()
    }
  }
}
