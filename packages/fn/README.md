# fn

This module allows to make functions with typechecking

Example:
```typescript
import { z } from 'zod'

const typedParseInt = Fn.build({
  request: z.string(),
  response: z.number().int()
}).init((req) => {
  return parseInt(req)
})

const parsed = await typedParseInt('123')
console.log(parsed)

// Output:
// 123
```

It also supports AsyncIterators

```typescript
import { z } from 'zod'

const fn = Fn.build({
  request: z.string(),
  response: z.number().int(),
  responseType: 'asynciterable',
}).init((req) => {
  const values = req.split(' ')
  return {
    [Symbol.asyncIterator]: () => ({
      async next () {
        if (values.length === 0) {
          return { done: true, value: undefined as any } // https://github.com/microsoft/TypeScript/issues/38479
        }
        return { value: parseInt(values.shift()!) }
      },
    }),
  }
})

for await (const parsed of fn('123 465')) {
  console.log(parsed)
}

// Output:
// 123
// 456
```

And middlewares like
[lock](https://github.com/aliksend/typed-fn/blob/main/src/middlewares/lock.test.ts) (don't allow to call callback simultaneuosly),
[cache](https://github.com/aliksend/typed-fn/blob/main/src/middlewares/cache.test.ts) and
[expiration](https://github.com/aliksend/typed-fn/blob/main/src/middlewares/expiration.test.ts) (allows to set timeout for callback)
