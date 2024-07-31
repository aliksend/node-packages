#!/usr/bin/env node

import { defineCommand, runMain } from 'citty'
import path from 'node:path'
import fs from 'node:fs'
import { generate } from './generator'
import ts from 'typescript'
import { z } from 'zod'

const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf-8'))

void runMain(defineCommand({
  meta: packageJson,
  args: {
    openapi_definition: {
      type: "positional",
      description: "OpenAPI definition",
      required: true,
    },
    output_ts: {
      type: "positional",
      description: "Output ts file",
      required: true,
    },
    types_format: {
      description: [
        "Format of types to generate. See README for more info",
        "Available values:",
        "- request",
        "- handler",
        "- server",
        "- client",
      ].join('\n'),
      default: "handler",
    },
    prefix: {
      description: 'Prefix for declarations'
    }
  },
  async run({ args: rawArgs }) {
    const argsSchema = z.object({
      openapi_definition: z.string(),
      output_ts: z.string(),
      types_format: z.enum(['request', 'handler', 'server',  'client']).default('handler'),
      prefix: z.string().optional(),
    })
    const args = argsSchema.parse(rawArgs)

    const { imports, declarations } = await generate(args.openapi_definition, args.types_format, { prefix: args.prefix })

    const outputFilename = args.output_ts

    const printer = ts.createPrinter({
      newLine: ts.NewLineKind.LineFeed,
      removeComments: false,
      omitTrailingSemicolon: true
    })
    const sourceFile = ts.createSourceFile(outputFilename, '', ts.ScriptTarget.ESNext, false, ts.ScriptKind.TS)
    const lines: string[] = ['// @generated', '']
    for (const i of imports.values()) {
      lines.push(printer.printNode(ts.EmitHint.Unspecified, i, sourceFile))
    }
    lines.push('')
    for (const d of declarations) {
      lines.push(printer.printNode(ts.EmitHint.Unspecified, d, sourceFile))
    }
    lines.push('')
    fs.writeFileSync(outputFilename, lines.join('\n'))
  },
}))
