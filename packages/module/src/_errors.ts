import { type z } from 'zod'

export class UnableToParseConfigError extends Error {
  constructor (moduleName: string, componentName: string, readonly issues: z.ZodError['issues']) {
    super(`unable to parse config for module ${moduleName} (${componentName})`)
  }
}

export class UnableToStartModuleError extends Error {
  constructor (moduleName: string, componentName: string, readonly error: unknown) {
    super(`unable to start module ${moduleName} (${componentName})`)
  }
}

export class ModuleNotStartedError extends Error {
  constructor (moduleName: string, componentName: string) {
    super(`module ${moduleName} (${componentName}) is not started`)
  }
}

export class ModuleAlreadyStartedError extends Error {
  constructor (moduleName: string, componentName: string) {
    super(`module ${moduleName} (${componentName}) is already started`)
  }
}
