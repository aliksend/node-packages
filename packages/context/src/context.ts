import { AsyncLocalStorage } from 'async_hooks'
import crypto from 'crypto'
import util from 'util'
import { RequestCanceledError, UnauthorizedError } from './_errors'

function genRandomId (): string {
  // return uuid.v4()
  return crypto.randomBytes(8).toString('hex')
}

type TagValue = string | number | boolean

function camelToSnake (s: string): string {
  return s.replace(/[a-z][A-Z]/g, (m) => `${m[0]}_${m[1]}`).toLowerCase()
}

export interface Auth {
  /** ID of current auth session */
  sessionId: string
  /** ID of current authorized user */
  userId: string
  /** RBAC permissions of current authorized user */
  permissions: string[]

  /** Other custom auth data */
  [k: string]: any
}

interface CreateContextOpts {
  /**
   * Id of request. If not provided, will be generated automatically.
   */
  requestId?: string
  /**
   * Current authorization. Can be provided later.
   */
  auth?: Auth
  /**
   * Expiration for new context.
   * If not provided, context will be created without expiration.
   */
  expiration?: { validUntil: Date } | { ttlMs: number }
}

type CreateSubContextOpts = Pick<CreateContextOpts, 'expiration'> & {
  /**
   * Don't save created context as sub-context.
   * So it will not be canceled or finished together with parent context.
   */
  detached?: true
}

/**
 * Object that can be used to track context actions.
 * Can be used to connect sentry
 */
interface ContextTracker {
  /** Context created */
  createCtx?: (this: Context, operation: string, isRootContext: boolean) => void
  /** Context finished */
  finishCtx?: (this: Context) => void
  /** Exception logged */
  exception?: (this: Context, err: Error) => void
  /** Authorization provided */
  setAuth?: (this: Context, auth: Auth) => void
  /** Tag is set */
  setTag?: (this: Context, name: string, value: TagValue) => void
}

/**
 * Common logger that will be used to log into stdout
 */
interface Logger {
  debug: (v: object) => void
  info: (v: object) => void
  error: (v: object) => void
}

/**
 * Context is used to store information about the current request.
 * Allows to create sub-contexts for sub-tasks, that used to process request (e.g. database requests).
 */
export class Context {
  /** Logger, that used to log into stdout */
  static #logger: Logger
  /** Async storage for current active context */
  static readonly #ls: AsyncLocalStorage<Context> = new AsyncLocalStorage()
  /** List of context trackers */
  static readonly #contextTrackers: Set<ContextTracker> = new Set()

  /**
   * Initialize context.
   * Must be called before any interaction with Context
   */
  static init (logger: Logger): void {
    this.#logger = logger
  }

  /** Get current active context */
  static current (): Context {
    const context = this.#ls.getStore()
    if (context != null) {
      return context
    }
    return new Context('--UNKNOWN--')
  }

  /**
   * Add context tracker
   */
  static addTracker (contextTracker: ContextTracker): void {
    this.#contextTrackers.add(contextTracker)
  }

  /** Human-readable name of current action. */
  readonly operation: string
  /** ID of current request. Like traceID in opentelemetry */
  readonly requestId: string
  /** ID of current context. Like spanID in opentelemetry */
  readonly contextId: string
  /** List of sub-contexts. Used to finish or cancel it when parent context is finished/canceled */
  readonly #subContexts: Context[]
  /** If set - time until context is valid. If not set - context considered valid forever */
  readonly #validUntil: Date | undefined
  /** Current authorization */
  #auth: Auth | undefined
  /** List of tags for current context. Can be used together with operation to find request in logs */
  #tags: Map<string, TagValue>
  /** Indicator that context is canceled because of some external reason - frontend stopped waiting for response (http code 499) or context became invalid (look at validUntil).
   * You can work with a canceled context in the same way as with a non-canceled context, but it would be better to stop doing the work and exit */
  #canceled: boolean = false
  /** Indicator that the context is finished. Set the end of interaction with the context */
  #finished: boolean = false
  /** A value used to cancel a timer that automatically terminates the context when the validUntil time is reached */
  #expirationTimeout: NodeJS.Timeout | undefined

  constructor (operation: string, opts: CreateContextOpts = {}) {
    this.operation = operation
    this.requestId = opts.requestId ?? genRandomId()
    this.contextId = genRandomId()
    this.#auth = opts.auth
    this.#subContexts = []
    this.#tags = new Map()

    if (opts.expiration != null) {
      if ('validUntil' in opts.expiration) {
        this.#validUntil = opts.expiration.validUntil
      } else if ('ttlMs' in opts.expiration) {
        const validUntil = new Date()
        validUntil.setTime(validUntil.getTime() + opts.expiration.ttlMs * 1000)

        this.#validUntil = validUntil
      }
    }

    if (this.#validUntil != null) {
      const ttlMs = (this.#validUntil.getTime() - Date.now()) / 1000
      this.#expirationTimeout = setTimeout(() => {
        this.logDebug('Context expired')
        this.cancel()
      }, ttlMs)
    }

    this.#triggerTrackers('createCtx', [operation, opts.requestId == null])
  }

  #triggerTrackers<M extends keyof ContextTracker> (method: M, args: Parameters<NonNullable<ContextTracker[M]>>): void {
    for (const t of Context.#contextTrackers) {
      const m = t[method]
      if (m == null) {
        continue
      }
      ;(m as Function).apply(this, args)
    }
  }

  /** Set value for tag. The tag name will be translated into snake_case. If a value was already specified, it will be replaced */
  setTag (name: string, value: TagValue): void {
    const field = camelToSnake(name)
    this.#tags.set(field, value)

    this.#triggerTrackers('setTag', [name, value])
  }

  #metadata (): object {
    let tags: object | undefined
    if (this.#tags.size !== 0) {
      tags = Array.from(this.#tags.entries()).reduce((res: Record<string, TagValue>, [name, value]) => {
        res[name] = value
        return res
      }, {})
    }
    return {
      operation: this.operation,
      requestId: this.requestId,
      contextId: this.contextId,
      canceled: this.canceled ? true : undefined,
      finished: this.finished ? true : undefined,
      tags,
    }
  }

  /** Log debug message to log. Should be used for technical logs - those that relate to the functioning of the service rather than business logic */
  logDebug (msg: string, data?: any): void {
    Context.#logger?.debug({ ...this.#metadata(), msg, data })
  }

  /** Log informational message to log. Should be used for business logic logs */
  logInfo (msg: string, data?: any): void {
    Context.#logger?.info({ ...this.#metadata(), msg, data })
  }

  /** Log error message to log and set tag "error" to `true` */
  logError (msg: string, error?: any): void {
    Context.#logger?.error({ ...this.#metadata(), msg, error: error !== undefined ? util.inspect(error, undefined, 10) : undefined })
    this.setTag('error', true)

    if (error != null && error instanceof Error) {
      this.#triggerTrackers('exception', [error])
    }
  }

  /** Create sub-context */
  createSubContext (operation: string, opts?: CreateSubContextOpts): Context {
    const subContext = new Context(operation, { requestId: this.requestId, auth: this.#auth, expiration: opts?.expiration })
    if (opts?.detached !== true) {
      this.#subContexts.push(subContext)
    }
    return subContext
  }

  /** Create sub-context, call callback with it and then finish created context */
  async wrap<T> (cb: (context: Context) => Promise<T>, autoFinish: boolean = false): Promise<T> {
    // eslint-disable-next-line n/no-callback-literal
    return await Context.#ls.run(this, async () => await cb(this)).finally(() => {
      if (autoFinish) {
        this.finish()
      }
    })
  }

  /** Cancel current context and all sub-contexts */
  cancel (): void {
    if (this.#canceled) {
      return
    }

    this.#canceled = true
    this.#clearExpirationTimeout()

    this.#subContexts.forEach((subContext) => {
      subContext.cancel()
    })
  }

  #clearExpirationTimeout (): void {
    if (this.#expirationTimeout == null) {
      return
    }
    clearTimeout(this.#expirationTimeout)
    this.#expirationTimeout = undefined
  }

  /** Finish current context and all sub-contexts */
  finish (): void {
    if (this.#finished) {
      return
    }

    this.#finished = true
    this.#clearExpirationTimeout()

    this.#triggerTrackers('finishCtx', [])

    this.#subContexts.forEach((subContext) => {
      subContext.finish()
    })
  }

  /**
   * Authorization of the current context
   * If the current context is not authorized, an UnauthorizedError() will be thrown
   * To check whether the context is authorized, you can use the `authorized` field
   *
   * In real world you don't really need to check authorization. More often you need to assert it. So this method can be used
   */
  get auth (): Auth {
    if (this.#auth == null) {
      throw new UnauthorizedError()
    }
    return this.#auth
  }

  /** Indicator that current context is authorized */
  get authorized (): boolean {
    return this.#auth != null
  }

  /** Indicator that current context is canceled */
  get canceled (): boolean {
    return this.#canceled
  }

  /** Assert that the context is not canceled. Otherwise, a RequestCanceledError will be thrown. */
  assertNotCanceled (): void {
    if (this.canceled) {
      throw new RequestCanceledError()
    }
  }

  /** Indicator that current context is finished */
  get finished (): boolean {
    return this.#finished
  }

  /** Set auth for current context */
  setAuth (auth: Auth | undefined): void {
    this.#auth = auth

    if (auth != null) {
      this.#triggerTrackers('setAuth', [auth])
    }
  }
}
