export class RequestCanceledError extends Error {
  constructor () {
    super('Request canceled')
  }
}

export class UnauthorizedError extends Error {
  constructor () {
    super('Unauthorized')
  }
}
