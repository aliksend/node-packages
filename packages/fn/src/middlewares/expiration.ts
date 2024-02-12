import { type MiddlewareAsyncIterable } from '../fn'

export function expiration<Req, Res> (opts: { ttlMs: number } | { due: Date }): MiddlewareAsyncIterable<Req, Res> {
  return async function * (req, next) {
    const ttlMs = 'ttlMs' in opts ? opts.ttlMs : (opts.due.getTime() - Date.now())
    if (ttlMs < 0) {
      throw new Error('timeout')
    }
    let timeout
    const timeoutPromise = new Promise((resolve, reject) => {
      timeout = setTimeout(() => {
        reject(new Error('timed out'))
      }, ttlMs)
    })

    const iterable = next()[Symbol.asyncIterator]()
    try {
      while (true) {
        const next = await Promise.race([iterable.next(), timeoutPromise]) as IteratorResult<Res>

        if (next.done === true) {
          return
        }

        yield next.value
      }
    } catch (err) {
      await iterable.return?.()
      throw err
    } finally {
      clearTimeout(timeout)
    }
  }
}
