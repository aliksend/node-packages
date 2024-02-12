import { type z } from 'zod'
import path from 'path'
import { ModuleAlreadyStartedError, ModuleNotStartedError, UnableToParseConfigError, UnableToStartModuleError } from './_errors'
import { getRuntimeDirname, getValueOnPath } from '@aliksend/utils'

let basePath: string | undefined

/**
 * Set global base path for all modules.
 * Used to get correct module name, that used for errors and to get module config to start module with.
 *
 * For example module can be located in 'src/foo/bar'
 * and if base path is set to 'src',
 * then `config.foo.bar` value will be used to start module with.
 */
export function setBasePath (value: string): void {
  basePath = value
}

interface DeclareModuleOpts<ConfigSchema extends z.ZodTypeAny, StartArg, Value> {
  /**
   * Schema for this module config
   */
  configSchema: ConfigSchema
  /**
   * Function to start module
   */
  start: (config: z.output<ConfigSchema>, startArg: StartArg) => Promise<Value>
  /**
   * Argument for "start" function
   * Allows to add some values to module before start
   */
  startArg: StartArg
  /**
   * Global module name. If not provided, then current runtime dirname will be used
   * Also used to get configuration for module
   */
  moduleName?: string
  /**
   * Function to stop module
   */
  stop?: (value: Value) => Promise<void>
}

/**
 * Service component
 */
export class Module<ConfigSchema extends z.ZodTypeAny, StartArg, Value> {
  static readonly #modules = new Map<string, Module<any, any, any>>()

  /**
   * Declare module
   * @param componentName used to declare more than one module in one directory. Good place to specify module implementation details (e.g. "fastify", "cron", "knex" etc)
   * @param kind kind of module. Input modules is used to process input requests (like http servers), output modules is used to process output requests (like http or database clients)
   * @param opts module declaration
   *
   * @example
   * const m = Module.declare('knex', 'input', {
   *   configSchema: z.object({}).passthrough(),
   *   startArg: null,
   *   start: async (config, startArg) => {
   *     return knex(config)
   *   },
   *   stop: async (db) => {
   *     await db.destroy()
   *   },
   * })
   */
  static declare<ConfigSchema extends z.ZodTypeAny, StartArg, Value> (componentName: string, kind: 'input' | 'output', opts: DeclareModuleOpts<ConfigSchema, StartArg, Value>): Module<ConfigSchema, StartArg, Value> {
    const moduleSelector = `${opts.moduleName ?? getRuntimeDirname()} ${componentName}`
    const existingModule = Module.#modules.get(moduleSelector)
    if (existingModule != null) {
      return existingModule
    }

    const module = new Module(componentName, kind, opts)
    Module.#modules.set(moduleSelector, module)
    return module
  }

  /**
   * Get all modules
   * Can be filtered by kind
   */
  static modules (kind?: 'input' | 'output'): Array<Module<any, any, any>> {
    const res = Array.from(this.#modules.values())
    if (kind == null) {
      return res
    }
    return res.filter(m => m.kind === kind)
  }

  /**
   * Get specific module by name
   */
  static get (name: string): Module<any, any, any> | null {
    if (basePath != null) {
      name = path.join(basePath, name)
    }
    return this.#modules.get(name) ?? null
  }

  /**
   * Start all modules with specified config
   */
  static async startAll (config: unknown, kind?: 'input' | 'output'): Promise<void> {
    for (const module of this.modules(kind)) {
      const moduleConfig = getValueOnPath(config, module.name.split('/'))
      // Context.current().logDebug(`module ${module.moduleName} (${module.componentName}) starting...`)
      try {
        await module.start(moduleConfig)
      } catch (err) {
        // Context.current().logError(`module ${module.moduleName} (${module.componentName}) not started`, err)
        throw new UnableToStartModuleError(module.name, module.componentName, err)
      }
      // Context.current().logDebug(`module ${module.moduleName} (${module.componentName}) successfully started`)
    }
  }

  /**
   * Stop all modules
   */
  static async stopAll (kind?: 'input' | 'output'): Promise<void> {
    for (const module of this.modules(kind)) {
      await module.stop()
    }
  }

  /**
   * Clear all declared modules
   */
  static clear (): void {
    this.#modules.clear()
  }

  /** Name of module component */
  readonly componentName: string
  /** Type of module component - for input or for output communication */
  readonly kind: 'input' | 'output'
  /** Configuration schema for module */
  readonly #configSchema: ConfigSchema
  /** Name of directory where module is declared */
  readonly moduleDirname: string
  /** Custom module name. */
  readonly moduleName: string | undefined
  /** Argument to start module with */
  #startArg: StartArg
  readonly #start: (config: z.output<ConfigSchema>, startArg: StartArg) => Promise<Value>
  readonly #stop: undefined | ((value: Value) => Promise<void>)
  #value: Value | undefined
  #started: boolean

  private constructor (componentName: string, kind: 'input' | 'output', opts: DeclareModuleOpts<ConfigSchema, StartArg, Value>) {
    this.componentName = componentName
    this.kind = kind
    this.#configSchema = opts.configSchema
    this.moduleDirname = getRuntimeDirname()
    this.moduleName = opts.moduleName
    this.#startArg = opts.startArg
    this.#start = opts.start
    this.#stop = opts.stop
    this.#started = false
  }

  /**
   * Get name of module
   */
  get name (): string {
    if (this.moduleName != null) {
      return this.moduleName
    }
    return path.relative(basePath ?? '', this.moduleDirname)
  }

  /**
   * Start module
   */
  async start (config: z.input<ConfigSchema>): Promise<void> {
    const parsedConfig = this.#configSchema.safeParse(config)
    if (!parsedConfig.success) {
      throw new UnableToParseConfigError(this.name, this.componentName, parsedConfig.error.issues)
    }
    const value = await this.#start(parsedConfig.data, this.#startArg)
    this.#value = value
    this.#started = true
  }

  /**
   * Get value of started module
   */
  get value (): Value {
    if (!this.#started) {
      throw new ModuleNotStartedError(this.name, this.componentName)
    }
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return this.#value!
  }

  /**
   * Get startArg of not started module
   */
  get startArg (): StartArg {
    if (this.#started) {
      throw new ModuleAlreadyStartedError(this.name, this.componentName)
    }
    return this.#startArg
  }

  /**
   * Set new value for startArg
   */
  set startArg (v: StartArg) {
    if (this.#started) {
      throw new ModuleAlreadyStartedError(this.name, this.componentName)
    }
    this.#startArg = v
  }

  /**
   * Stop module
   */
  async stop (): Promise<void> {
    if (this.#started && this.#stop != null) {
      await this.#stop(this.value)
    }
    this.#started = false
  }

  /**
   * Is module already started
   */
  get started (): boolean {
    return this.#started
  }
}
