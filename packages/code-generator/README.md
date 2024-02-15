# Code generator

One place to run all generators.

## Idea

All of us know how to [generate typedoc](https://typedoc.org/options/) for your typescript code or [swagger for nestjs' controllers](https://docs.nestjs.com/openapi/introduction), [graphql schema from nexus declaraion](https://nexusjs.org/docs/guides/generated-artifacts) or ts [declarations for database tables using kanel](https://github.com/kristiandupont/kanel?tab=readme-ov-file#programmatical-usage).
But how to run all this generators at once? You can use this package to do it.

For example to generate database schema using kanel you can do
`./src/foo/_generator.ts`
```typescript
import { deferGenerator } from '@aliksend/code-generator'
import { processDatabase } from "kanel";

deferGenerator(async () => {
  await processDatabase({
    // config
  });
})
```

And run `npx @aliksend/code-generator` to run it. It will `import` all `_generator.ts` and runs all deferred (async) generators.

## Modular services

When you want to create service with modules (for example one module for http server, other for database connection) when each module lives in separated directory, you need to declare "public" interface for every module. Best place to do it - `index.ts` file in directory.
`deferGenerator` allows to do it - you can just return map of imports and list of declarations to put to your index.ts file.
For example you can parse your `swagger.yaml` and produce interfaces to call declared methods with specified typings.
You can run `deferGenerator` as many times as you want for your module and `code-generator` will generate `index.ts` file with all `imports` and `declarations` from all generators.
