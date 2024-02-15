import { type default as _acceptLanguageParser } from 'accept-language-parser'
import { inspect } from 'util'
import { type Context as _Context } from '@aliksend/context'

// -- optional peer deps
let Context: typeof _Context | undefined

try {
  const module = await import('@aliksend/context')
  Context = module.Context
} catch {}

let acceptLanguageParser: typeof _acceptLanguageParser | undefined

try {
  const module = await import('accept-language-parser')
  acceptLanguageParser = module.default
} catch {}
// --

export type AppErrorCode = 'internal_server_error' | 'bad_request' | 'unauthorized' | 'forbidden' | 'not_found' | 'not_implemented' | 'business_error' | 'request_canceled'

interface ErrorOpts {
  code: AppErrorCode
  sub_code?: string
  http_status_code: number
  details?: Record<string, any>
  internalDetails?: Record<string, any>
}

// description: string | { [lang: string]: string }
type Descriptions = Record<string, string | Record<string, string>>

export abstract class AppError extends Error {
  static #descriptions: Descriptions = {}

  static setDescriptions(descriptions: Descriptions): void {
    for (const d in descriptions) {
      AppError.#descriptions[d] = descriptions[d]
    }
  }

  #opts: ErrorOpts
  #name: string

  protected constructor (opts: ErrorOpts) {
    super(opts.code)

    this.#name = this.constructor.name
    this.#opts = opts
  }

  get httpStatusCode (): number {
    return this.#opts.http_status_code
  }

  // https://nodejs.org/api/util.html#utilinspectobject-options
  get [Symbol.toStringTag] (): string {
    if (this.#opts.internalDetails == null) {
      return ''
    }

    const msg: string[] = []
    Object.entries(this.#opts.internalDetails).forEach(([name, value]) => {
      if (value == null) {
        return
      }
      let valueStr
      if (typeof value === 'object') {
        valueStr = inspect(value)
      } else {
        valueStr = `${value}`
      }
      msg.push(`<${name}: ${valueStr}>`)
    })
    return msg.join(' ')
  }

  override toString (): string {
    let msg = this.#name
    const add = this[Symbol.toStringTag]
    if (add !== '') {
      msg += ` ${add}`
    }
    msg += `: ${this.message}.`

    return msg
  }

  toJson (acceptLanguage?: string): object {
    let description = AppError.#descriptions[`${this.#opts.code} ${this.#opts.sub_code}`]
    if (description == null) {
      description = AppError.#descriptions[this.#opts.code]
    }
    if (description != null && typeof description === 'object') {
      const availableLangs = Object.keys(description)
      const lang = acceptLanguageParser?.pick(availableLangs, acceptLanguage ?? 'en', { loose: true })
      description = description[lang ?? 'en']
    }

    return {
      code: this.#opts.code,
      description,
      details: this.#opts.details,
    }
  }
}

/**
 * Какая-то внутренняя ошибка сервера. Обычно клиенту не нужно знать детали, просто что-то пошло не так.
 * Запрос можно повторить без модификации через какое-то время.
 */
export class InternalServerError extends AppError {
  constructor (internalDetails: Record<string, any>) {
    super({ code: 'internal_server_error', http_status_code: 500, internalDetails })
  }
}

/**
 * Некорректный запрос - не прошел валидацию.
 * В поле details ошибки будут содержаться доп. информация.
 * Необходимо исправить запрос и повторить его.
 */
export class BadRequestError extends AppError {
  constructor (details: Record<string, any>, internalDetails?: Record<string, any>, subCode?: string) {
    super({ code: 'bad_request', http_status_code: 400, details, internalDetails, sub_code: subCode })
  }
}

/**
 * Запрос не авторизован.
 * Необходимо предоставить данные для авторизации и повторить запрос.
 */
export class UnauthorizedError extends AppError {
  constructor () {
    super({ code: 'unauthorized', http_status_code: 401 })
  }
}

/**
 * Доступ для указанных авторизационных данных к этому ресурсу запрещён.
 * Необходимо предоставить другие авторизационные данные и повторить запрос.
 */
export class ForbiddenError extends AppError {
  constructor (requiredPermission: string) {
    let existingPermissions: string[] | undefined
    if (Context != null) {
      const context = Context.current()
      existingPermissions = context.authorized ? context.auth.permissions : []
    }
    super({ code: 'forbidden', http_status_code: 403, internalDetails: { requiredPermission, existingPermissions } })
  }
}

/**
 * Запрашиваемый ресурс не найден.
 * В поле sub_code ошибки будет информация о каком ресурсе идёт речь, а в поле details - по какому selector-у он не был найден.
 * Необходимо повторить запрос с правильным selector-ом.
 */
export class NotFoundError extends AppError {
  constructor (entity: string, selector: object) {
    super({ code: 'not_found', sub_code: entity, http_status_code: 404, details: selector })
  }
}

/**
 * Запрашиваемый ресурс не реализован.
 * Вероятно была использована версия API в которой данный ресурс отсутствует
 */
export class NotImplementedError extends AppError {
  constructor () {
    super({ code: 'not_implemented', http_status_code: 501 })
  }
}

/**
 * Логическая (бизнес) ошибка.
 * В поле details будут содержаться детали.
 */
export class BusinessError extends AppError {
  constructor (subCode: string, details: Record<string, any>) {
    super({ code: 'business_error', sub_code: subCode, http_status_code: 422, details })
  }
}

/**
 * Запрос отменён
 */
export class RequestCanceledError extends AppError {
  constructor () {
    super({ code: 'request_canceled', http_status_code: 499 })
  }
}
