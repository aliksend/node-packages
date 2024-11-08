import { z } from 'zod'

/**
 * Машина, которая хранит информацию про все StateBuilder-ы и умеет создавать State-ы используя имя StateBuilder-а и данные этого State
 */
export class StateMachine<Info extends object | void = void> {
  private stateBuilders: Record<string, StateBuilder<any, any, Info>>
  private events: Record<string, EventDefinition<any, Info>>

  constructor() {
    this.stateBuilders = {}
    this.events = {}
  }

  /**
   * Создать StateDeclaration, при помощи которого затем создаётся StateBuilder
   * Имя должно быть уникальным в рамках StateMachine, кроме имён parent-ов
   */
  state<Schema extends z.ZodTypeAny>(name: string, def: StateDefinition<Schema, Info>): StateDeclaration<void, Schema, Info> {
    return new StateDeclaration(name, def, (sb) => {
      if (this.stateBuilders[sb.name] != null) {
        throw new Error(`state ${sb.name} is already declared`)
      }

      this.stateBuilders[sb.name] = sb
    }, undefined)
  }

  /**
   * Создать EventDefinition
   * Имя должно быть уникальным в рамках StateMachine, кроме системных имён, которые начинаются с "$"
   */
  event<ArgSchema extends z.ZodTypeAny>(name: string, argSchema: ArgSchema): EventDefinition<ArgSchema, Info> {
    if (this.events[name] != null) {
      throw new Error(`event ${name} is already declared`)
    }

    const event = new EventDefinition<ArgSchema, Info>(name, argSchema)
    this.events[name] = event
    return event
  }

  /**
   * Создать State при помощи имени и данных
   * Это позволяет export-ировать State, сохранить его в БД и затем создать снова
   * ParentState-ы не являются полноценными State-ами, а выступают лишь для хранения данных, поэтому их невозможно распарсить
   */
  parse(data: { $name: string, $data: unknown }): State<Info> | null {
    const sb = this.stateBuilders[data.$name]
    if (sb == null) {
      return null
    }
    return sb.build('$data' in data ? data.$data : undefined)
  }
}

/**
 * Объявление state-а - схема его данных и структура, позволяющая создать его info
 */
type StateDefinition<Schema extends z.ZodTypeAny, Info extends object | void> = {
  schema: Schema
} & (
  Info extends void
  ? {}
  : {
    info: InfoDefinition<Schema, Info>
  }
)

/**
 * Структура, позволяющая создать Info
 * Это позволяет создать info формата `{ a: string }` при помощи объекта `{ a: 'foo' }`,
 * так и при помощи `{ a: (data) => data.foo }`, где `data` - данные State-а для которого используется этот InfoDefinition
 */
type InfoDefinition<Schema extends z.ZodTypeAny, Info extends object | void> = Info extends void ? void : {
  [k in keyof Info]: Info[k] | ((data: z.infer<Schema>) => Info[k])
}

/**
 * Объявление State-а. Само по себе бесполезное, используется для создания StateBuilder-а
 * Хранит имя, формат схемы данных и Info
 * Имеет callback, который будет вызван когда StateBuilder будет создан
 */
class StateDeclaration<ParentSchema extends z.ZodTypeAny | void, Schema extends z.ZodTypeAny, Info extends object | void> {
  constructor(private readonly name: string, private readonly def: StateDefinition<MakeParentSchema<ParentSchema, Schema>, Info>, private readonly newStateBuilderCallback: ((b: StateBuilder<any, any, Info>) => void), private readonly parentStateBuilder: ParentSchema extends z.ZodTypeAny ? ParentStateBuilder<ParentSchema, Info> : undefined) { }

  /**
   * Создать StateBuilder, позволяющий создать State, который будет реагировать на какие-то события
   */
  initWithEvents(events: Array<EventDefinitionWithHandler<any, MakeParentSchema<ParentSchema, Schema>, Info>>): StateBuilder<ParentSchema, Schema, Info> {
    const stateBuilder = new StateBuilder(this.name, this.def, { type: 'EVENTS',  events }, this.parentStateBuilder)
    this.newStateBuilderCallback(stateBuilder)
    return stateBuilder
  }

  /**
   * Создать StateBuilder, позволяющий создать State, который будет вызывать Promise и ждать её завершения
   */
  initWithPromise(promiseCb: (data: z.output<MakeParentSchema<ParentSchema, Schema>>) => Promise<State<Info>>, catchCb?: (data: z.output<MakeParentSchema<ParentSchema, Schema>>, err: Error) => State<Info>): StateBuilder<ParentSchema, Schema, Info> {
    const stateBuilder = new StateBuilder(this.name, this.def, { type: 'PROMISE', promiseCb, catchCb }, this.parentStateBuilder)
    this.newStateBuilderCallback(stateBuilder)
    return stateBuilder
  }

  /**
   * Создать StateBuilder, позволяющий создать State, содержащий какое-то финальное значение
   */
  initAsFinal(): StateBuilder<ParentSchema, Schema, Info> {
    const stateBuilder = new StateBuilder(this.name, this.def, { type: 'FINAL' }, this.parentStateBuilder)
    this.newStateBuilderCallback(stateBuilder)
    return stateBuilder
  }

  /**
   * Создать StateBuilder, позволяющий создать ParentState, позволяющий создавать subState-ы
   * Это позволяет не дублировать значения data и info для subState-ов одного процесса
   */
  initAsParent(): ParentStateBuilder<MakeParentSchema<ParentSchema, Schema>, Info> {
    const stateBuilder = new ParentStateBuilder(this.name, this.def, this.newStateBuilderCallback, this.parentStateBuilder)
    return stateBuilder as any
  }
}

/**
 * Тип, позволяющий понять какая схема данных будет у State-а
 * Принимает ParentSchema - схема данных родителя (или void если родителя нет), Schema - схема данных State-а
 */
type MakeParentSchema<ParentSchema extends z.ZodTypeAny | void, Schema extends z.ZodTypeAny> =
  ParentSchema extends z.ZodTypeAny
  ? z.ZodObject<{
    $value: Schema,
    $parent: ParentSchema
  }>
  : Schema

/**
 * StateBuilder, позволяющий создать subState-ы (StateBuilder-ы потомков)
 */
class ParentStateBuilder<ParentSchema extends z.ZodTypeAny, Info extends object | void> {
  constructor(private readonly name: string, private readonly def: StateDefinition<ParentSchema, Info>, private readonly newStateBuilderCallback: ((b: StateBuilder<any, any, Info>) => void), private readonly parentStateBuilder: ParentStateBuilder<ParentSchema, Info> | undefined) {}

  /**
   * Создать состояние-потомок, наследующее схему данных (в параметре $parent) и info (может быть переопределено)
   */
  subState<Schema extends z.ZodTypeAny>(name: string, def: {
    schema: Schema
    info?: Partial<InfoDefinition<MakeParentSchema<ParentSchema, Schema>, Info>>
  }): StateDeclaration<ParentSchema, Schema, Info> {
    return new StateDeclaration<ParentSchema, Schema, Info>(name, {
      schema: z.object({
        $value: def.schema,
        $parent: this.def.schema
      }),
      info: def.info,
    } as any, this.newStateBuilderCallback, this as any)
  }

  /**
   * Построить ParentState. Не должно быть использовано в коде приложения
   */
  build(data: z.input<ParentSchema>): ParentState<Info> {
    const parsed = this.def.schema.parse(data)
    const infoDefinition: InfoDefinition<ParentSchema, Info> = 'info' in this.def ? this.def.info as any : undefined
    let parentState: ParentState<Info> | undefined
    if (this.parentStateBuilder != null) {
      parentState = this.parentStateBuilder.build(data.$parent)
    }
    return new ParentState(parsed, infoDefinition, parentState)
  }
}

/**
 * Хранилище данных состояния-родителя
 * Позволяет получить info
 */
class ParentState<Info extends object | void> {
  constructor(readonly data: unknown, protected readonly infoDefinition: InfoDefinition<any, Info>, protected readonly parentState: ParentState<Info> | undefined) {}

  get info(): Info {
    let res: any

    if (this.parentState) {
      res = this.parentState.info
    }

    if (this.infoDefinition != null) {
      if (res == null) {
        res = {}
      }
      for (const k in this.infoDefinition) {
        const v = this.infoDefinition[k]
        if (typeof v !== 'function') {
          res[k] = v as any
          continue
        }

        res[k] = v(this.data)
      }
    }

    return res
  }
}

/**
 * Возможные алгоритмы перехода State-а в другие State-ы
 */
type Transitions<Schema extends z.ZodTypeAny, Info extends object | void> = {
  type: 'EVENTS',
  events: Array<EventDefinitionWithHandler<any, Schema, Info>>
} | {
  type: 'PROMISE',
  promiseCb: (data: z.output<Schema>) => Promise<State<Info>>
  catchCb?: (data: z.output<Schema>, err: Error) => State<Info>
} | {
  type: 'FINAL'
}

/**
 * StateBuilder, позволяющий построить какой-то State
 */
class StateBuilder<ParentSchema extends z.ZodTypeAny | void, Schema extends z.ZodTypeAny, Info extends object | void> {
  constructor(readonly name: string, private readonly def: StateDefinition<MakeParentSchema<ParentSchema, Schema>, Info>, private readonly transitions: Transitions<MakeParentSchema<ParentSchema, Schema>, Info>, private readonly parentStateBuilder: ParentSchema extends z.ZodTypeAny ? ParentStateBuilder<ParentSchema, Info> : undefined) {}

  build(data: z.input<MakeParentSchema<ParentSchema, Schema>>, skipInit: boolean = false): State<Info> {
    const parsed = this.def.schema.parse(data)
    const infoDefinition: InfoDefinition<MakeParentSchema<ParentSchema, Schema>, Info> = 'info' in this.def ? this.def.info as any : undefined
    let parent: ParentState<Info> | undefined
    if (this.parentStateBuilder != null) {
      parent = this.parentStateBuilder.build(parsed.$parent)
    }
    const state = new State(this.name, parsed, this.transitions, infoDefinition, parent)
    if (!state.hasInitEvent || skipInit) {
      return state
    }

    return state.emit({ name: '$init', arg: undefined })
  }
}

/**
 * Текущее состояние системы. Может перейти в другое состояние при возникновении какого-то Event-а либо при выполнение какого-то Promise
 */
export class State<Info extends object | void> extends ParentState<Info> {
  constructor(readonly name: string, data: unknown, private readonly transitions: Transitions<any, Info>, infoDefinition: InfoDefinition<any, Info>, parent: ParentState<Info> | undefined) {
    super(data, infoDefinition, parent)
  }

  /**
   * Тип State-а
   */
  get type(): 'EVENTS' | 'PROMISE' | 'FINAL' | 'PARENT' {
    return this.transitions.type
  }

  /**
   * Индикатор есть ли у этого State обработчик события "$init"
   * Актуально для типа EVENTS, для других типов будет возвращен false
   */
  get hasInitEvent(): boolean {
    if (this.transitions.type !== 'EVENTS') {
      return false
    }

    const event = this.transitions.events.find(e => e.name === '$init')
    return event != null && event.isVoid
  }

  /**
   * Обработать какой-то Event и вернуть новый State
   * Актуально для типа EVENTS, для других типов будет возвращен этот же State
   */
  emit(event: Event<any>): State<Info>
  emit(name: string, arg: any): State<Info>

  emit(eventOrName: Event<any> | string, arg?: any): State<Info> {
    if (this.transitions.type !== 'EVENTS') {
      return this
    }

    let eventName: string
    let eventArg: any

    if (typeof eventOrName === 'string') {
      eventName = eventOrName
      eventArg = arg
    } else {
      eventName = eventOrName.name
      arg = eventOrName.arg
    }

    const eventHandler = this.transitions.events.find(e => e.name === eventName)
    if (eventHandler == null) {
      return this
    }
    const res = eventHandler.call(this.data, eventArg)
    if (res == null) {
      return this
    }
    return res
  }

  /**
   * Выполнить Promise и вернуть новый State
   * Актуально для типа PROMISE, для других типов будет возвращен этот же State
   */
  async exec(): Promise<State<Info>> {
    if (this.transitions.type !== 'PROMISE') {
      return this
    }

    try {
      const res = await this.transitions.promiseCb(this.data)
      return res
    } catch (err) {
      if (this.transitions.catchCb != null) {
        return this.transitions.catchCb(this.data, err as Error)
      }
      return this
    }
  }

  /**
   * Получить результат
   * Актуально для типа FINAL, для других типов будет возвращен этот же State
   */
  get result(): null | { value: unknown } {
    if (this.transitions.type !== 'FINAL') {
      return null
    }

    return {
      value: this.data
    }
  }

  /**
   * Экспортировать текущий State чтобы сохранить его в БД и затем распарсить при помощи StateMachine
   */
  export(): { $name: string, $data: unknown } {
    return {
      $name: this.name,
      $data: this.data,
    }
  }
}

/**
 * Объявление какого-то события
 * Позволяет сохранить имя события и формат его аргументов
 */
export class EventDefinition<ArgSchema extends z.ZodTypeAny, Info extends object | void> {
  constructor(private readonly name: string, private readonly argSchema: ArgSchema) { }

  /**
   * Создать обработчик для этого события
   */
  handler<Schema extends z.ZodTypeAny>(cb: (data: z.output<Schema>, arg: z.output<ArgSchema>) => State<Info> | void): EventDefinitionWithHandler<ArgSchema, Schema,  Info> {
    return new EventDefinitionWithHandler(this.name, this.argSchema, cb)
  }

  /**
   * Создать это событие, указать для него данные
   */
  build(arg: z.input<ArgSchema>): Event<ArgSchema> {
    return {
      name: this.name,
      arg: this.argSchema.parse(arg)
    }
  }
}

/**
 * Объявление события с обработчиком
 * Позволяет сохранить имя события, формат его аргументов и обработчик
 */
export class EventDefinitionWithHandler<ArgSchema extends z.ZodTypeAny, Schema extends z.ZodTypeAny, Info extends object | void> {
  constructor(readonly name: string, private readonly argSchema: ArgSchema, private readonly cb: (data: z.output<Schema>, arg: z.output<ArgSchema>) => State<Info> | void) { }

  /**
   * Принимает ли обработчик события какие-то аргументы
   * Если нет - isVoid будет true
   */
  get isVoid(): boolean {
    return this.argSchema instanceof z.ZodVoid
  }

  /**
   * Вызвать обработчик события с данными текущего State-а и какими-то аргументами
   */
  call(data: unknown, arg: z.input<ArgSchema>): State<Info> | undefined {
    const parsed = this.argSchema.parse(arg)
    const res = this.cb(data, parsed)
    return res ?? undefined
  }
}

/**
 * Объявление какого-то события и данные для него
 */
export interface Event<ArgSchema extends z.ZodTypeAny> {
  name: string
  arg: z.infer<ArgSchema>
}
