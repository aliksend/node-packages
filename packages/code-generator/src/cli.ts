#!/usr/bin/env node

import { generate } from './generator'

const generateMainIndexTs = process.argv.includes('--main')

generate(process.cwd(), generateMainIndexTs)
.catch((err) => {
  console.error(err)
  process.exit(1)
})
