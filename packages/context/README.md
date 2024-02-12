# context

Can be used to track the context of current request.

```typescript
import express from 'express'
import { Context } from '@aliksend/context'
import pino from 'pino'

const prettyLogs = process.env.PRETTY_LOGS === 'true'
const logLevel = process.env.LOG_LEVEL

Context.init(pino({
  formatters: {
    level: (label) => ({ level: label }),
    bindings: () => ({}),
  },
  transport: prettyLogs
    ? {
        target: 'pino-pretty',
        options: {
          ignore: 'hostname,requestId,contextId',
        },
      }
    : undefined,
  level: logLevel,
}))

const app = express()

app.use((req, res, next) => {
  const context = new Context('http request', { requestId: req.header('x-request-id') })
  context.logInfo('request', { method: req.method, url: req.url })

  if (req.header.authorization != null) {
    context.setAuth({
      // TODO
      sessionId: req.header.authorization,
      userId: req.header.authorization,
      permissions: []
    })
  }

  let send = res.send
  res.send = (body: any) => {
    context.logInfo('response', { status: res.statusCode, body })
    res.send = send
    send(body)
  }

  context.wrap(() => {
    next()
  }, false)
})

app.get('/ping', (req, res) => {
  Context.current().logInfo('ping called')
  res.send('pong')
})

```
