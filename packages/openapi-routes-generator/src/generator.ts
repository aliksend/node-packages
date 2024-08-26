import SwaggerParser from '@apidevtools/swagger-parser'
import type { OpenAPIV3, OpenAPIV3_1 } from 'openapi-types'
import ts, { factory as f } from 'typescript'
import { makeDeclarationForModel } from './generator/schema'
import { makeDeclarationForOperation } from './generator/operation'

export async function generate (fullFilename: string, typesFormat: 'request' | 'handler' | 'server' | 'client', opts: { prefix?: string } = {}): Promise<{ imports: Map<string, ts.ImportDeclaration>, declarations: ts.Node[] }> {
  const literalsPrefix = opts.prefix ?? ''

  const imports = new Map<string, ts.ImportDeclaration>()
  const declarations: ts.Node[] = []

  imports.set('z', f.createImportDeclaration(undefined, f.createImportClause(false, undefined, f.createNamedImports([
    f.createImportSpecifier(false, undefined, f.createIdentifier('z')),
  ])), f.createStringLiteral('zod'), undefined))

  imports.set('Readable', f.createImportDeclaration(undefined, f.createImportClause(false, undefined, f.createNamedImports([
    f.createImportSpecifier(false, undefined, f.createIdentifier('Readable')),
  ])), f.createStringLiteral('stream'), undefined))

  function addSchemaDeclaration (name: string, schema: ts.Expression): void {
    declarations.push(f.createVariableStatement([f.createToken(ts.SyntaxKind.ExportKeyword)], f.createVariableDeclarationList([
      f.createVariableDeclaration(`${literalsPrefix}__${name}`, undefined, undefined, schema),
    ], ts.NodeFlags.Const)))
  }

  await SwaggerParser.validate(fullFilename)
  const parsed = await SwaggerParser.parse(fullFilename)
  if (!('openapi' in parsed)) {
    throw new Error('Only openapi v3 is supported')
  }
  const document = parsed

  const routes: Record<string, ts.Expression> = {}
  function addSchemaDeclarationForOperation (o: OpenAPIV3.OperationObject | OpenAPIV3_1.OperationObject, method: string, route: string): void {
    const { declaration } = makeDeclarationForOperation(o, method, route, typesFormat, `${literalsPrefix}__`, document, `#/paths/${route}/${method}`)
    const operationId = o.operationId ?? `${method.toUpperCase()} ${route.replace(/\{(.+?)\}/g, (_found, paramName) => `:${paramName}`)}`
    routes[operationId] = declaration
  }

  if (document.components?.schemas != null) {
    for (const name in document.components.schemas) {
      switch (typesFormat) {
        case 'request':
        case 'handler': {
          const declaration = makeDeclarationForModel(document.components.schemas[name], true, `${literalsPrefix}__`, '', typesFormat, false, document, `#/components/schemas/${name}`, 'unknown')
          addSchemaDeclaration(name, declaration)
          break
        }
        case 'client': {
          const stringifyDeclaration = makeDeclarationForModel(document.components.schemas[name], true, `${literalsPrefix}__`, '__Req', 'stringify', false, document, `#/components/schemas/${name}`, 'unknown')
          addSchemaDeclaration(name + '__Req', stringifyDeclaration)
          const parseDeclaration = makeDeclarationForModel(document.components.schemas[name], true, `${literalsPrefix}__`, '__Res', 'parse', false, document, `#/components/schemas/${name}`, 'unknown')
          addSchemaDeclaration(name + '__Res', parseDeclaration)
          break
        }
        case 'server': {
          const parseDeclaration = makeDeclarationForModel(document.components.schemas[name], true, `${literalsPrefix}__`, '__Req', 'parse', false, document, `#/components/schemas/${name}`, 'unknown')
          addSchemaDeclaration(name + '__Req', parseDeclaration)
          const stringifyDeclaration = makeDeclarationForModel(document.components.schemas[name], true, `${literalsPrefix}__`, '__Res', 'stringify', false, document, `#/components/schemas/${name}`, 'unknown')
          addSchemaDeclaration(name + '__Res', stringifyDeclaration)
          break
        }
      }
    }
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
