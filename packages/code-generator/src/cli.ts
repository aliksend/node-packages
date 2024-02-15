#!/usr/bin/env node

import { generate } from './generator'

generate(process.cwd())
.catch((err) => {
  console.error(err)
  process.exit(1)
})
