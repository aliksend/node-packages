#!/usr/bin/env node
import { defineCommand, runMain } from 'citty'
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'

const dirname = path.dirname(fileURLToPath(import.meta.url))

const packageJson = JSON.parse(fs.readFileSync(path.join(dirname, '../package.json'), 'utf-8'))

void runMain(defineCommand({
  meta: packageJson,
  args: {
    fix: {
      type: 'boolean',
      description: 'Lint and fix',
    },
  },
  run ({ args }) {
    let cmd = `eslint ./src --config ${path.join(dirname, '../.eslintrc.yml')} --ext .ts,.mts`
    if (args.fix) {
      cmd += ' --fix'
    }
    run(cmd)
  },
}))

function run (command: string): void {
  const cmd = spawnSync(command, {
    shell: true,
    stdio: 'inherit',
    cwd: process.cwd(),
  })
  if (cmd.status != null && cmd.status !== 0) {
    process.exit(cmd.status)
  }
}
