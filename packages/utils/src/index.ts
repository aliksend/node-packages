import stackTrace from 'stack-trace'
import path from 'path'
import { z } from 'zod'
import { BadRequestError, InternalServerError } from './error'

/**
 * Get current directory of file, where this method is called, ignoring files inside node_modules.
 */
export function getRuntimeDirname (): string {
  const stack = stackTrace.get()
  while (true) {
    const line = stack.shift()
    if (line == null) {
      break
    }
    const filename = line.getFileName()
    if (filename.includes('/node_modules/')) {
      continue
    }
    return path.relative(process.cwd(), path.dirname(filename))
  }
  throw new Error('unable to get runtime dirname')
}

/**
 * Get value from object by path
 *
 * @example
 *     const ret = getValueOnPath({ foo: { bar: 'baz' } }, ['foo', 'bar'])
 *     ret === 'baz' // => true
 */
export function getValueOnPath (object: unknown, path: string[]): unknown {
  let value: any = object
  for (let i = 0; i < path.length; i++) {
    if (value == null) {
      break
    }
    value = value[path[i]]
  }
  return value
}

/**
 * Assert that value is parsed and throw fancy error instead
 */
export function assertParsed<I extends any, O extends any> (r: z.SafeParseReturnType<I, O>, errorType: 'bad_request' | 'internal_server_error' | 'error' = 'error', inputValue?: I, message?: string): asserts r is z.SafeParseSuccess<O> {
  if (r.success) {
    return
  }
  switch (errorType) {
    case 'error': {
      const err = new Error(message)
      ;(err as any).issues = r.error.issues
      ;(err as any).inputValue = inputValue
      throw err
    }
    case 'bad_request': {
      throw new BadRequestError(r.error.issues, { message, value: inputValue })
    }
    case 'internal_server_error': {
      throw new InternalServerError({ message, value: inputValue, issues: r.error.issues })
    }
  }
}
