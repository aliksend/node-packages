// https://stackoverflow.com/a/50586391
export async function * combine<T> (iterables: Array<AsyncIterable<T>>): AsyncIterable<T> {
  const asyncIterators = Array.from(iterables, o => o[Symbol.asyncIterator]())
  const results = []
  let count = asyncIterators.length
  const never = new Promise<never>(() => {})
  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  async function getNext (asyncIterator: AsyncIterator<T>, index: number) {
    return await asyncIterator.next().then(result => ({
      index,
      result,
    }))
  }
  const nextPromises = asyncIterators.map(getNext)
  try {
    while (count > 0) {
      const { index, result } = await Promise.race(nextPromises)
      if (result.done === true) {
        nextPromises[index] = never
        results[index] = result.value
        count--
      } else {
        nextPromises[index] = getNext(asyncIterators[index], index)
        yield result.value
      }
    }
  } finally {
    for (const [index, iterator] of asyncIterators.entries()) {
      if (nextPromises[index] !== never && iterator.return != null) {
        void iterator.return()
      }
    }
    // no await here - see https://github.com/tc39/proposal-async-iteration/issues/126
  }
  return results
}

export async function read<T> (asynciterable: AsyncIterable<T>): Promise<T[]> {
  const res: T[] = []
  for await (const v of asynciterable) {
    res.push(v)
  }
  return res
}
