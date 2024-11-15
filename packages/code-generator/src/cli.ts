#!/usr/bin/env node

import { generate } from './generator.js'
import { defineCommand, runMain } from 'citty'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf-8'))

void runMain(defineCommand({
  meta: packageJson,
  args: {
    wd: {
      type: 'positional',
      description: 'Directory to process',
      default: process.cwd()
    }
  }, async run({ args }) {
    await generate(args.wd)
  }
}))
