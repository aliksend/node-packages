# modules-for-services

Used to declare modules in your services

Usage example:
```typescript
// db/knex.ts
const m = Module.declare('knex', 'input', {
  configSchema: z.object({}).passthrough(),
  startArg: null,
  start: async (config, startArg) => {
    return knex(config)
  },
  stop: async (db) => {
    await db.destroy()
  },
})

// now you can use `m`, even while module isn't started
// you can use `m.value` in http-handlers that will be called after module is started

// then you can call `startAll` with config to start all modules, declared in your service
await Module.startAll({
  db: {
    client: 'pg',
    connection: 'TODO'
  }
})
```
