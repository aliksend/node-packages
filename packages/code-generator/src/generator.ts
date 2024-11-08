import fs from 'fs'
import path from 'path'
import type ts from 'typescript'

type DeferredGenerator = () => Promise<void | { imports?: Map<string, ts.ImportDeclaration>, declarations?: ts.Node[] }>

const deferredGenerators: DeferredGenerator[] = []

export function deferGenerator (cb: DeferredGenerator): void {
  deferredGenerators.push(cb)
}

export async function generate (rootDir: string, generateMainIndexTs: boolean): Promise<void> {
  // no typescript dependencies at runtime
  const ts = await import('typescript')

  const scriptsList = makeScriptsList(rootDir)

  const printer = ts.createPrinter({
    newLine: ts.NewLineKind.LineFeed,
    removeComments: false,
    omitTrailingSemicolon: true
  })

  const mainIndexTsImports: Record<string, true> = {}

  const filesByIndexTs = scriptsList.reduce((res: Record<string, string[]>, filename) => {
    const indexTsName = path.join(path.dirname(filename), 'index.ts')
    if (res[indexTsName] != null) {
      res[indexTsName].push(filename)
    } else {
      res[indexTsName] = [filename]
    }
    return res
  }, {})

  try {
    // @ts-expect-error Optional ts-node dependency
    await import('ts-node/register')
  } catch {}

  let exitCode: number | undefined = undefined

  for (const indexTsFilename in filesByIndexTs) {
    const imports: Map<string, ts.ImportDeclaration> = new Map()
    const declarations: ts.Node[] = []

    for (const filename of filesByIndexTs[indexTsFilename]) {
      const fullFileName = path.join(process.cwd(), './' + filename)
      try {
        try {
          await import(fullFileName)
        } catch (err) {
          const e = new Error(`unable to import ${filename}`)
          ;(e as any).error = err
          throw e
        }

        while (true) {
          const generator = deferredGenerators.shift()
          if (generator == null) {
            break
          }

          const res = await generator()
          if (res?.imports != null) {
            for (const i of res.imports.entries()) {
              imports.set(i[0], i[1])
            }
          }
          if (res?.declarations != null) {
            for (const d of res.declarations) {
              declarations.push(d)
            }
          }
        }

        if (generateMainIndexTs) {
          const dirname = path.dirname(indexTsFilename)
          const fsItems = fs.readdirSync(dirname, { withFileTypes: true })
          for (const fsItem of fsItems) {
            if (fsItem.isFile()
              && !fsItem.name.startsWith('_')
              && fsItem.name !== 'index.ts'
              && fsItem.name.endsWith('.ts')
              && !fsItem.name.endsWith('.d.ts')
              && !fsItem.name.endsWith('.test.ts')
              && !fsItem.name.endsWith('.spec.ts')
            ) {
              let relativeIndexTsPathForImport = path.relative(rootDir, path.join(dirname, fsItem.name))
              const extname = path.extname(relativeIndexTsPathForImport)
              relativeIndexTsPathForImport = './' + relativeIndexTsPathForImport.slice(0, relativeIndexTsPathForImport.length - extname.length)
              mainIndexTsImports[relativeIndexTsPathForImport] = true
            }
          }
        }
      } catch (err) {
        console.error(`Unable to process file ${filename}`, err)
        exitCode = 1
      }
    }

    if (exitCode != null) {
      continue
    }

    if (imports.size === 0 && declarations.length === 0) {
      continue
    }

    const sourceFile = ts.createSourceFile(indexTsFilename, '', ts.ScriptTarget.ESNext, false, ts.ScriptKind.TS)
    const lines: string[] = ['// @generated', '']
    for (const i of imports.values()) {
      lines.push(printer.printNode(ts.EmitHint.Unspecified, i, sourceFile))
    }
    lines.push('')
    for (const d of declarations) {
      lines.push(printer.printNode(ts.EmitHint.Unspecified, d, sourceFile))
    }
    lines.push('')
    fs.writeFileSync(indexTsFilename, lines.join('\n'))
  }

  if (exitCode != null) {
    process.exit(exitCode)
  }

  if (generateMainIndexTs) {
    const mainIndexTsLines: string[] = ['// @generated', '']
    mainIndexTsLines.push(...Object.keys(mainIndexTsImports).map(v => `import ${JSON.stringify(v)}`))
    // TODO start somehow?

    fs.writeFileSync(path.join(rootDir, 'index.ts'), mainIndexTsLines.join('\n'))
  }
}

function makeScriptsList (rootDir: string): string[] {
  const fsItems = fs.readdirSync(rootDir, { withFileTypes: true })
  const res: string[] = []
  for (const fsItem of fsItems) {
    if (fsItem.isFile()) {
      if (fsItem.name !== '_generator.ts') {
        continue
      }

      res.push(path.join(rootDir, fsItem.name))
    } else if (fsItem.isDirectory()) {
      if (fsItem.name === 'node_modules') {
        continue
      }
      if (fsItem.name.startsWith('_')) {
        continue
      }

      res.push(...makeScriptsList(path.join(rootDir, fsItem.name)))
    } else {
      // skip unknown fsItems
    }
  }
  return res
}
