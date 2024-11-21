import fs from 'fs'
import path from 'path'
import ts, { factory as f } from 'typescript'
import { makeScriptsList } from './generator.js'

export function importAllRecursive(rootDir: string): Map<string, ts.ImportDeclaration> {
  const imports: Record<string, true> = {}

  const scriptsList = makeScriptsList(rootDir)

  for (const filename of scriptsList) {
    const dirname = path.dirname(filename)
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
        imports[relativeIndexTsPathForImport] = true
      }
    }
  }

  return Object.keys(imports).sort().reduce((map: Map<string, ts.ImportDeclaration>, filename) => {
    map.set(filename, f.createImportDeclaration(
      undefined,
      undefined,
      f.createStringLiteral(filename),
      undefined,
    ))
    return map
  }, new Map())
}
