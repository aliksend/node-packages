import { type z } from 'zod'

export class FnAlreadyInitializedError extends Error {
  constructor () {
    super('Fn already initialized')
  }
}

export class FnNotInitializedError extends Error {
  constructor () {
    super('Fn not initialized')
  }
}

export class BadRequestError extends Error {
  constructor (readonly zodError: z.ZodError) {
    super('Bad request')
  }
}

export class BadResponseError extends Error {
  constructor (readonly zodError: z.ZodError) {
    super('Bad response')
  }
}

export class PromiseRequiresExactlyOneElementError extends Error {
  constructor (numberOfElements: 'zero' | 'more than one') {
    super(`Promise requires to have only one element, asynciterable contains ${numberOfElements}`)
  }
}
