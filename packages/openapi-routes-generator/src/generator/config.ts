import ts, { factory as f } from 'typescript'
import type { OpenAPIV3, OpenAPIV3_1 } from 'openapi-types'
import { resolveRef } from './ref'

export function generate (document: OpenAPIV3.Document | OpenAPIV3_1.Document): ts.Statement {
  const configElements: ts.ObjectLiteralElementLike[] = []
  if (document.servers != null) {
    if (document.servers.length !== 1) {
      throw new Error('More than one server not supported at #/servers')
    }
    const url = new URL(document.servers[0].url)
    configElements.push(f.createPropertyAssignment('protocol', f.createStringLiteral(url.protocol)))
    configElements.push(f.createPropertyAssignment('host', f.createStringLiteral(url.hostname)))
    if (url.port !== '') {
      configElements.push(f.createPropertyAssignment('port', f.createNumericLiteral(url.port)))
    }
    if (url.pathname !== '/') {
      configElements.push(f.createPropertyAssignment('basePath', f.createStringLiteral(url.pathname)))
    }
  }
  if (document.components?.securitySchemes != null) {
    const securitySchemes = []
    for (const name in document.components.securitySchemes) {
      const securityScheme = resolveRef(document.components.securitySchemes[name], document, `#/components/securitySchemes/${name}`)
      const opts = []
      for (const optName in securityScheme) {
        // TODO нет полноценной поддержки для type: 'oauth2' так как там могут быть не только string, но и object (поле flows)
        opts.push(f.createPropertyAssignment(optName, f.createAsExpression(
          f.createStringLiteral((securityScheme as any)[optName]), f.createTypeReferenceNode(f.createIdentifier('const'), undefined)
        )
        ))
      }
      securitySchemes.push(f.createPropertyAssignment(name, f.createObjectLiteralExpression(opts, true)))
    }
    configElements.push(f.createPropertyAssignment('securitySchemes', f.createObjectLiteralExpression(securitySchemes, true)))
  }

  return f.createVariableStatement(
    [f.createToken(ts.SyntaxKind.ExportKeyword)], f.createVariableDeclarationList(
      [
        f.createVariableDeclaration(f.createIdentifier('config'), undefined, undefined, f.createObjectLiteralExpression(configElements, true)),
      ], ts.NodeFlags.Const
    )
  )
}
