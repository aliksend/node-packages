import { z } from 'zod'
import { asyncIterableToPromise, promiseToAsyncIterable } from './_util'
import { BadRequestError, BadResponseError, FnAlreadyInitializedError, FnNotInitializedError } from './_errors'

export interface Definition {
  request: z.ZodTypeAny
  response: z.ZodTypeAny
}

export type MiddlewarePromise<Req, Res> = (req: Req, next: () => PromiseLike<Res>) => PromiseLike<Res>
export type MiddlewareAsyncIterable<Req, Res> = (req: Req, next: () => AsyncIterable<Res>) => AsyncIterable<Res>

// TODO observable, stream etc
// TODO safeParse: true | false - use safeParse and return its result instead of throwing on error
type FnResponseTypeSelector = 'promise' | 'asynciterable'

type Arguments<Def extends Definition> = Def['request'] extends z.ZodTuple
  ? z.input<Def['request']>
  : [z.input<Def['request']>]

// "public" interface
type FnWithCallNotation<Def extends Definition, S extends FnResponseTypeSelector> =
  & Fn<Def, S>
  & (S extends 'asynciterable'
    ? (...req: Arguments<Def>) => AsyncIterable<z.output<Def['response']>>
    : (...req: Arguments<Def>) => Promise<z.output<Def['response']>>)

type CallbackReturnType<Def extends Definition, S extends FnResponseTypeSelector> =
  | z.input<Def['response']>
  | PromiseLike<z.input<Def['response']>>
  | (S extends 'asynciterable' ? AsyncIterable<z.input<Def['response']>> : never)

// callback interface
type Callback<Def extends Definition, S extends FnResponseTypeSelector> = (req: z.output<Def['request']>) => CallbackReturnType<Def, S>

export class Fn<Def extends Definition, S extends FnResponseTypeSelector> extends Function {
  /**
   * Make Fn
   */
  static build<Def extends Definition>(def: Def & { responseType?: never }): FnWithCallNotation<Def, 'promise'>
  /**
   * Make Fn
   */
  static build<Def extends Definition, S extends FnResponseTypeSelector>(def: Def & { responseType: S }): FnWithCallNotation<Def, S>

  static build<Def extends Definition, S extends FnResponseTypeSelector>(def: Def & { responseType?: S }): FnWithCallNotation<Def, S> {
    const fn = new Fn(def, def.responseType ?? 'promise')
    return fn._proxy as any
  }

  protected _callback: undefined | Callback<Def, S>
  readonly def: Def
  protected readonly _responseType: S
  protected _processMiddlewares: (req: unknown, value: () => AsyncIterable<unknown>) => () => AsyncIterable<unknown>

  protected constructor (def: Def, responseType: S) {
    super()

    this.def = def
    this._responseType = responseType
    this._processMiddlewares = (_req, value) => value
  }

  /**
   * Add promise middleware to call before _callback will be called
   */
  usep (m: S extends 'promise' ? MiddlewarePromise<z.output<Def['request']>, z.input<Def['response']>> : never): this {
    const oldProcessMiddlewares = this._processMiddlewares
    this._processMiddlewares = (req, makeAsyncIterable) => oldProcessMiddlewares(req, () => {
      const p = m(req, async () => await asyncIterableToPromise(makeAsyncIterable()))
      return promiseToAsyncIterable(p)
    })
    return this
  }

  /**
   * Add AsyncIterable middleware to call before _callback will be called
   */
  use (m: MiddlewareAsyncIterable<z.output<Def['request']>, z.input<Def['response']>>): this {
    // We need to make chain of middlewares
    // First of all - save current middlewares as oldProcessMiddlewares
    // We want to call it first, and then call provided middleware
    const oldProcessMiddlewares = this._processMiddlewares
    this._processMiddlewares = (req, makeAsyncIterable) => oldProcessMiddlewares(req, () => m(req, makeAsyncIterable))
    return this
  }

  /**
   * Return proxy that allow to call object as function
   */
  protected get _proxy (): this {
    return new Proxy(this, {
      apply: (target, thisArg, args: [unknown]): unknown => target._call(...args),
      get: (target: any, prop) => target[prop],
    })
  }

  /**
   * Method called when Fn is called as function
   * Parses req, calls middlewares, then calls callback, parses result and returns
   */
  protected _call (...rawReq: Arguments<Def>): unknown {
    if (!(this.def.request instanceof z.ZodTuple)) {
      rawReq = rawReq[0]
    }

    const res = this._processMiddlewares(rawReq, () => {
      const req = this.def.request.safeParse(rawReq)
      if (!req.success) {
        throw new BadRequestError(req.error)
      }

      return this.#parseResponse(this.#process(req.data))
    })()

    switch (this._responseType) {
      case 'asynciterable':
        return res
      case 'promise':
        return asyncIterableToPromise(res)
      default:
        throw new Error('unsupported responseType')
    }
  }

  /**
   * Set _callback to call when function is called
   */
  init (cb: Callback<Def, S>): this {
    if (this._callback != null) {
      throw new FnAlreadyInitializedError()
    }
    this._callback = cb
    return this
  }

  /**
   * Call _callback and convert result to AsyncIterable
   */
  #process (req: unknown): AsyncIterable<unknown> {
    if (this._callback == null) {
      throw new FnNotInitializedError()
    }
    const res = this._callback(req)
    if (typeof res !== 'object') {
      return promiseToAsyncIterable(Promise.resolve(res))
    }

    if (res instanceof Promise) {
      return promiseToAsyncIterable(res)
    } else if (Symbol.asyncIterator in res) {
      return res
    } else {
      return promiseToAsyncIterable(Promise.resolve(res))
    }
  }

  /**
   * Parse response as asynciterable
   */
  async * #parseResponse (res: AsyncIterable<unknown>): AsyncIterable<z.output<Def['response']>> {
    for await (const rawItem of res) {
      const item = this.def.response.safeParse(rawItem)
      if (!item.success) {
        throw new BadResponseError(item.error)
      }
      yield item.data
    }
  }
}
