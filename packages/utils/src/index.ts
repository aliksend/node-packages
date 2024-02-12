import stackTrace from 'stack-trace'
import path from 'path'

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
