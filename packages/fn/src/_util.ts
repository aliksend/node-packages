import { PromiseRequiresExactlyOneElementError } from './_errors'

/**
 * Converts Promise to AsyncIterable with one element
 */
export function promiseToAsyncIterable<T> (p: PromiseLike<T>): AsyncIterable<T> {
  const res = {
    [Symbol.asyncIterator]: () => ({
      returned: false,

      async next () {
        if (this.returned) {
          return {
            done: true,
            value: undefined as any, // https://github.com/microsoft/TypeScript/issues/38479
          }
        }

        const value = await p
        this.returned = true
        return {
          done: false,
          value,
        }
      },
    }),
  }
  return res
}

/**
 * Converts AsyncIterable with one element to Promise
 * If AsyncIterable will contain zero or more than one element, an error will be thrown
 */
export async function asyncIterableToPromise<T> (ai: AsyncIterable<T>): Promise<T> {
  let promiseRes: undefined | { value: T }
  for await (const value of ai) {
    if (promiseRes == null) {
      promiseRes = { value }
    } else {
      throw new PromiseRequiresExactlyOneElementError('more than one')
    }
  }
  if (promiseRes == null) {
    throw new PromiseRequiresExactlyOneElementError('zero')
  }
  return promiseRes.value
}
