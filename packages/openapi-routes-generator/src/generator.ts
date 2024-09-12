import SwaggerParser from '@apidevtools/swagger-parser'
import type { OpenAPIV3, OpenAPIV3_1 } from 'openapi-types'
import ts, { factory as f } from 'typescript'
import { makeDeclarationForModel } from './generator/schema'
import { makeDeclarationForOperation } from './generator/operation'

export async function generate(fullFilename: string, typesFormat: 'request' | 'handler' | 'server' | 'client', opts: { prefix?: string } = {}): Promise<{ imports: Map<string, ts.ImportDeclaration>, declarations: ts.Node[] }> {
  const literalsPrefix = opts.prefix ?? ''

  const imports = new Map<string, ts.ImportDeclaration>()
  const declarations: ts.Node[] = []

  imports.set('z', f.createImportDeclaration(undefined, f.createImportClause(false, undefined, f.createNamedImports([
    f.createImportSpecifier(false, undefined, f.createIdentifier('z')),
  ])), f.createStringLiteral('zod'), undefined))

  imports.set('Readable', f.createImportDeclaration(undefined, f.createImportClause(false, undefined, f.createNamedImports([
    f.createImportSpecifier(false, undefined, f.createIdentifier('Readable')),
  ])), f.createStringLiteral('stream'), undefined))

  await SwaggerParser.validate(fullFilename)
  const parsed = await SwaggerParser.parse(fullFilename)
  if (!('openapi' in parsed)) {
    throw new Error('Only openapi v3 is supported')
  }
  const document = parsed

  const routes: Record<string, ts.Expression> = {}
  function addSchemaDeclarationForOperation(o: OpenAPIV3.OperationObject | OpenAPIV3_1.OperationObject, method: string, route: string): void {
    const { declaration } = makeDeclarationForOperation(o, method, route, typesFormat, `${literalsPrefix}__`, document, `#/paths/${route}/${method}`)
    const operationId = o.operationId ?? `${method.toUpperCase()} ${route.replace(/\{(.+?)\}/g, (_found, paramName) => `:${paramName}`)}`
    routes[operationId] = declaration
  }

  const schemaDeclarations: Array<{
    name: string,
    declaration: ts.Expression,
    dependsOn: string[]
  }> = []
  if (document.components?.schemas != null) {
    for (const name in document.components.schemas) {
      switch (typesFormat) {
        case 'request':
        case 'handler': {
          const { declaration, dependsOn } = makeDeclarationForModel(document.components.schemas[name], true, `${literalsPrefix}__`, '', typesFormat, false, {}, document, `#/components/schemas/${name}`, 'unknown')
          schemaDeclarations.push({ name: `${literalsPrefix}__${name}`, declaration, dependsOn })
          break
        }
        case 'client': {
          const { declaration: stringifyDeclaration, dependsOn: stringifyDependsOn } = makeDeclarationForModel(document.components.schemas[name], true, `${literalsPrefix}__`, '__Req', 'stringify', false, {}, document, `#/components/schemas/${name}`, 'unknown')
          schemaDeclarations.push({ name: `${literalsPrefix}__${name}__Req`, declaration: stringifyDeclaration, dependsOn: stringifyDependsOn })
          const { declaration: parseDeclaration, dependsOn: parseDependsOn } = makeDeclarationForModel(document.components.schemas[name], true, `${literalsPrefix}__`, '__Res', 'parse', false, {}, document, `#/components/schemas/${name}`, 'unknown')
          schemaDeclarations.push({ name: `${literalsPrefix}__${name}__Res`, declaration: parseDeclaration, dependsOn: parseDependsOn })
          break
        }
        case 'server': {
          const { declaration: parseDeclaration, dependsOn: parseDependsOn } = makeDeclarationForModel(document.components.schemas[name], true, `${literalsPrefix}__`, '__Req', 'parse', false, {}, document, `#/components/schemas/${name}`, 'unknown')
          schemaDeclarations.push({ name: `${literalsPrefix}__${name}__Req`, declaration: parseDeclaration, dependsOn: parseDependsOn })
          const { declaration: stringifyDeclaration, dependsOn: stringifyDependsOn } = makeDeclarationForModel(document.components.schemas[name], true, `${literalsPrefix}__`, '__Res', 'stringify', false, {}, document, `#/components/schemas/${name}`, 'unknown')
          schemaDeclarations.push({ name: `${literalsPrefix}__${name}__Res`, declaration: stringifyDeclaration, dependsOn: stringifyDependsOn })
          break
        }
      }
    }
  }
  function isDependsOn(dependsOn: string[], name: string, callStack: string[]): boolean {
    if (dependsOn.includes(name)) {
      return true
    }
    // TODO по сути этот цикл нужен только для проверки callStack-а, в остальном sort нормально справляется с последовательными зависимостями
    for (const dependency of dependsOn) {
      if (callStack.includes(dependency)) {
        // TODO такое тоже возможно сделать: https://github.com/colinhacks/zod?tab=readme-ov-file#recursive-types
        throw new Error('circular dependency found: ' + [...callStack, dependency].join(' depends on '))
      }
      const item = schemaDeclarations.find((i) => i.name === dependency)
      if (item == null) {
        continue
      }
      if (isDependsOn(item.dependsOn, name, [...callStack, dependency])) {
        return true
      }
    }
    return false
  }
  schemaDeclarations.sort((a, b) => {
    // if (!(a.dependsOn.length === 0 && b.dependsOn.length === 0)) {
    //   console.log(`sort ${a.name} (${JSON.stringify(a.dependsOn)}) and ${b.name} (${JSON.stringify(b.dependsOn)})`)
    // }
    if (a.dependsOn.length === 0) {
      if (b.dependsOn.length === 0) {
        return a.name < b.name ? -1 : 1
      }
      return -1
    }
    if (b.dependsOn.length === 0) {
      return 1
    }
    if (isDependsOn(b.dependsOn, a.name, [])) {
      // console.log('  b have dependency of a; put a first')
      return -1
    }
    // console.log('  UNKNOWN')
    return 0
  })
  for (const { name, declaration } of schemaDeclarations) {
    declarations.push(f.createVariableStatement([f.createToken(ts.SyntaxKind.ExportKeyword)], f.createVariableDeclarationList([
      f.createVariableDeclaration(name, undefined, undefined, declaration),
    ], ts.NodeFlags.Const)))
  }

  if (document.paths != null) {
    for (const route in document.paths) {
      const operationsByMethods = document.paths[route]
      if (operationsByMethods != null) {
        if (operationsByMethods.get != null) {
          addSchemaDeclarationForOperation(operationsByMethods.get, 'get', route)
        }
        if (operationsByMethods.post != null) {
          addSchemaDeclarationForOperation(operationsByMethods.post, 'post', route)
        }
        if (operationsByMethods.put != null) {
          addSchemaDeclarationForOperation(operationsByMethods.put, 'put', route)
        }
        if (operationsByMethods.patch != null) {
          addSchemaDeclarationForOperation(operationsByMethods.patch, 'patch', route)
        }
        if (operationsByMethods.delete != null) {
          addSchemaDeclarationForOperation(operationsByMethods.delete, 'delete', route)
        }
      }
    }
  }

  declarations.push(f.createVariableStatement(
    [f.createToken(ts.SyntaxKind.ExportKeyword)], f.createVariableDeclarationList(
      [
        f.createVariableDeclaration(f.createIdentifier('routes'), undefined, undefined, f.createObjectLiteralExpression(
          Object.entries(routes).map(([operationId, declaration]) => f.createPropertyAssignment(f.createStringLiteral(operationId), declaration)), true
        )),
      ], ts.NodeFlags.Const
    )
  ))

  return {
    imports,
    declarations,
  }
}
