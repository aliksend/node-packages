import type { OpenAPIV3, OpenAPIV3_1 } from 'openapi-types'
import type ts from 'typescript'
import { factory as f } from 'typescript'
import { resolveRef } from './ref'
import { makeDeclarationForModel } from './schema'

function makeRequestDeclarationForOperation(o: OpenAPIV3.OperationObject | OpenAPIV3_1.OperationObject, typesFormat: 'request' | 'handler' | 'server' | 'client', literalsPrefix: string, parsedDocument: OpenAPIV3.Document | OpenAPIV3_1.Document, path: string): { declaration: ts.Expression, security: undefined | ts.Expression } {
  let modelTypesFormat: 'request' | 'handler' | 'parse' | 'stringify'
  let refSuffix = ''
  let convertType: 'from_string' | 'to_string' | false
  switch (typesFormat) {
    case 'client':
      modelTypesFormat = 'stringify'
      refSuffix = '__Req'
      convertType = 'to_string'
      break
    case 'server':
      modelTypesFormat = 'parse'
      refSuffix = '__Req'
      convertType = 'from_string'
      break
    default:
      modelTypesFormat = typesFormat
      convertType = false
      break
  }

  // -- process "parameters"
  const requestPathElements: ts.ObjectLiteralElementLike[] = []
  const requestQueryElements: ts.ObjectLiteralElementLike[] = []
  const requestHeadersElements: ts.ObjectLiteralElementLike[] = []
  if (o.parameters != null) {
    for (let index = 0; index < o.parameters.length; index++) {
      const paramOrRef = o.parameters[index]
      const param = resolveRef(paramOrRef, parsedDocument, `${path}/parameters/${index}`)
      if (param.schema == null) {
        throw new Error(`schema not defined for param ${param.name} at ${path}/parameters/${index}/schema`)
      }
      const styleExplode = {
        style: param.style,
        explode: param.explode
      }
      switch (param.in) {
        case 'path': {
          const { declaration } = makeDeclarationForModel(param.schema, param.required === true, literalsPrefix, refSuffix, modelTypesFormat, convertType === false ? false : `${convertType} path`, styleExplode, parsedDocument, `${path}/parameters/${index}/schema`, 'request')
          requestPathElements.push(f.createPropertyAssignment(f.createStringLiteral(param.name), declaration))
          break
        }
        case 'query': {
          const { declaration } = makeDeclarationForModel(param.schema, param.required === true, literalsPrefix, refSuffix, modelTypesFormat, convertType === false ? false : `${convertType} query`, styleExplode, parsedDocument, `${path}/parameters/${index}/schema`, 'request')
          requestQueryElements.push(f.createPropertyAssignment(f.createStringLiteral(param.name), declaration))
          break
        }
        case 'header': {
          const { declaration } = makeDeclarationForModel(param.schema, param.required === true, literalsPrefix, refSuffix, modelTypesFormat, convertType === false ? false : `${convertType} header`, styleExplode, parsedDocument, `${path}/parameters/${index}/schema`, 'request')
          requestHeadersElements.push(f.createPropertyAssignment(f.createStringLiteral(param.name.toLowerCase()), declaration))
          break
        }
        default:
          throw new Error(`invalid param "in" value ${param.in} for ${param.name} at ${path}/parameters/${index}/in`)
      }
    }
  }
  // --

  // -- make request schema using declared things
  const requestSchemaElements: ts.ObjectLiteralElementLike[] = []
  if (requestQueryElements.length !== 0) {
    requestSchemaElements.unshift(f.createPropertyAssignment('query', f.createCallExpression(f.createPropertyAccessExpression(f.createIdentifier('z'), 'object'), undefined, [f.createObjectLiteralExpression(requestQueryElements, true)])))
  }
  if (requestPathElements.length !== 0) {
    requestSchemaElements.unshift(f.createPropertyAssignment('params', f.createCallExpression(f.createPropertyAccessExpression(f.createIdentifier('z'), 'object'), undefined, [f.createObjectLiteralExpression(requestPathElements, true)])))
  }
  if (requestHeadersElements.length !== 0) {
    requestSchemaElements.unshift(f.createPropertyAssignment('headers', f.createCallExpression(f.createPropertyAccessExpression(f.createIdentifier('z'), 'object'), undefined, [f.createObjectLiteralExpression(requestHeadersElements, true)])))
  }

  let res: undefined | ts.Expression
  if (requestSchemaElements.length !== 0) {
    res = f.createCallExpression(f.createPropertyAccessExpression(f.createIdentifier('z'), 'object'), undefined, [f.createObjectLiteralExpression(requestSchemaElements, true)])
  }
  // --

  // -- process body schema(s)
  if (o.requestBody != null) {
    const requestBody = resolveRef(o.requestBody, parsedDocument, `${path}/requestBody`)
    let requestBodySchema = Object.keys(requestBody.content)
      .map((contentType) => {
        const requestBodyContent = requestBody.content[contentType]
        if (requestBodyContent.schema == null) {
          throw new Error(`requestBody schema must be defined for ${contentType} at ${path}/requestBody/${contentType}/schema`)
        }
        const { declaration } = makeDeclarationForModel(requestBodyContent.schema, true, literalsPrefix, refSuffix, modelTypesFormat, false, {}, parsedDocument, `${path}requestBody/${contentType}/schema`, 'request')

        const elements = [
          f.createPropertyAssignment('body', declaration),
        ]
        if (contentType !== 'application/json') {
          elements.push(f.createPropertyAssignment('headers', f.createCallExpression(f.createPropertyAccessExpression(f.createIdentifier('z'), 'object'), undefined, [
            f.createObjectLiteralExpression([
              f.createPropertyAssignment(f.createStringLiteral('content-type'), f.createCallExpression(f.createPropertyAccessExpression(f.createIdentifier('z'), 'literal'), undefined, [
                f.createStringLiteral(contentType),
              ])),
            ], true),
          ])))
        }
        return f.createCallExpression(f.createPropertyAccessExpression(f.createIdentifier('z'), 'object'), undefined, [
          f.createObjectLiteralExpression(elements, true),
        ])
      })
      .reduce((chain, expr) => {
        return f.createCallExpression(f.createPropertyAccessExpression(chain, 'or'), undefined, [expr])
      })

    const requestBodyRequired = 'required' in o.requestBody && o.requestBody.required === true
    if (!requestBodyRequired) {
      requestBodySchema = f.createCallExpression(f.createPropertyAccessExpression(requestBodySchema, 'or'), undefined, [
        f.createCallExpression(f.createPropertyAccessExpression(f.createIdentifier('z'), 'object'), undefined, [
          f.createObjectLiteralExpression([]),
        ]),
      ])
    }

    if (res != null) {
      res = f.createCallExpression(f.createPropertyAccessExpression(res, 'and'), undefined, [
        requestBodySchema,
      ])
    } else {
      res = requestBodySchema
    }
  }
  // --

  // -- process security schema(s)
  const security: ts.Expression[] = []
  const operationSecurity = o.security ?? parsedDocument?.security
  if (operationSecurity != null && operationSecurity.length !== 0) {
    for (const s of operationSecurity) {
      for (const securitySchemaName in s) {
        security.push(f.createObjectLiteralExpression([
          f.createPropertyAssignment('securitySchemaName', f.createStringLiteral(securitySchemaName)),
          f.createPropertyAssignment('requiredPermissions', f.createArrayLiteralExpression(s[securitySchemaName].map(r => f.createStringLiteral(r)))),
        ], true))
      }
    }
  }
  // --

  return {
    declaration: res ?? f.createCallExpression(f.createPropertyAccessExpression(f.createIdentifier('z'), 'object'), undefined, [f.createObjectLiteralExpression([], true)]),
    security: security.length !== 0 ? f.createArrayLiteralExpression(security, true) : undefined,
  }
}

function makeResponseDeclarationForOperation(o: OpenAPIV3.OperationObject | OpenAPIV3_1.OperationObject, typesFormat: 'request' | 'handler' | 'server' | 'client', literalsPrefix: string, parsedDocument: OpenAPIV3.Document | OpenAPIV3_1.Document, path: string): { declaration: ts.Expression } {
  let modelTypesFormat: 'request' | 'handler' | 'parse' | 'stringify'
  let refSuffix = ''
  let convertType: 'from_string' | 'to_string' | false
  switch (typesFormat) {
    case 'client':
      modelTypesFormat = 'parse'
      refSuffix = '__Res'
      convertType = 'from_string'
      break
    case 'server':
      modelTypesFormat = 'stringify'
      refSuffix = '__Res'
      convertType = 'to_string'
      break
    default:
      modelTypesFormat = typesFormat
      convertType = false
      break
  }

  if (o.responses == null) {
    throw new Error(`responses must be defined at ${path}/responses`)
  }
  const res = Object.entries(o.responses)
    .map(([statusCode, responseOrRef]) => {
      const response = resolveRef(responseOrRef, parsedDocument, `${path}/responses/${statusCode}`)

      let responseHeaders: undefined | ts.ObjectLiteralElementLike[]
      if (response.headers != null) {
        responseHeaders = Object.keys(response.headers)
          .map((header) => {
            if (response.headers[header].schema == null) {
              throw new Error(`schema must be set for header ${header} in ${statusCode} response for status code ${statusCode} at ${path}/responses/${statusCode}/headers/${header}/schema`)
            }
            const { declaration } = makeDeclarationForModel(response.headers[header].schema, response.headers[header].required === true, literalsPrefix, refSuffix, modelTypesFormat, convertType === false ? false : `${convertType} header`, {}, parsedDocument, `${path}/responses/${statusCode}/headers/${header}/schema`, 'response')

            return f.createPropertyAssignment(f.createStringLiteral(header.toLowerCase()), declaration)
          })
      }

      let responseSchemas: Array<{ payloadSchema: ts.Expression, headers?: ts.ObjectLiteralElementLike[] }>
      if (response.content == null) {
        responseSchemas = [{
          payloadSchema: f.createCallExpression(f.createPropertyAccessExpression(f.createIdentifier('z'), 'undefined'), undefined, []),
          headers: responseHeaders,
        }]
      } else {
        responseSchemas = Object.keys(response.content)
          .map((responseType) => {
            if (response.content[responseType].schema == null) {
              throw new Error(`schema must be set for ${statusCode} ${responseType} response for status code ${statusCode} at ${path}/responses/${statusCode}/content/${responseType}/schema`)
            }

            const headers = responseHeaders != null ? [...responseHeaders] : []
            if (responseType !== 'application/json') {
              headers.push(f.createPropertyAssignment(f.createStringLiteral('content-type'), f.createCallExpression(f.createPropertyAccessExpression(f.createIdentifier('z'), 'literal'), undefined, [f.createStringLiteral(responseType)])))
            }

            const { declaration } = makeDeclarationForModel(response.content[responseType].schema, true, literalsPrefix, refSuffix, modelTypesFormat, false, {}, parsedDocument, `${path}/responses/${statusCode}/content/${responseType}/schema`, 'response')

            return {
              payloadSchema: declaration,
              headers: headers.length !== 0 ? headers : undefined,
            }
          })
      }
      return responseSchemas
        .map(({ payloadSchema, headers }) => {
          const elements = [
            f.createPropertyAssignment('statusCode', f.createCallExpression(f.createPropertyAccessExpression(f.createIdentifier('z'), 'literal'), undefined, [f.createNumericLiteral(statusCode)])),
            f.createPropertyAssignment('body', payloadSchema),
          ]
          if (headers != null) {
            elements.push(f.createPropertyAssignment('headers', f.createCallExpression(f.createPropertyAccessExpression(f.createIdentifier('z'), 'object'), undefined, [f.createObjectLiteralExpression(headers, true)])))
          }
          return f.createCallExpression(f.createPropertyAccessExpression(f.createIdentifier('z'), 'object'), undefined, [f.createObjectLiteralExpression(elements, true)])
        })
        .reduce((chain, expr) => {
          return f.createCallExpression(f.createPropertyAccessExpression(chain, 'or'), undefined, [expr])
        })
    }).reduce((chain, expr) => {
      return f.createCallExpression(f.createPropertyAccessExpression(chain, 'or'), undefined, [expr])
    })

  return {
    declaration: res,
  }
}

export function makeDeclarationForOperation(o: OpenAPIV3.OperationObject | OpenAPIV3_1.OperationObject, method: string, route: string, typesFormat: 'request' | 'handler' | 'server' | 'client', literalsPrefix: string, parsedDocument: OpenAPIV3.Document | OpenAPIV3_1.Document, path: string): { declaration: ts.Expression } {
  const requestDeclaration = makeRequestDeclarationForOperation(o, typesFormat, literalsPrefix, parsedDocument, path)
  const responseDeclaration = makeResponseDeclarationForOperation(o, typesFormat, literalsPrefix, parsedDocument, path)

  const resElements: ts.ObjectLiteralElementLike[] = [
    f.createPropertyAssignment('method', f.createAsExpression(f.createStringLiteral(method.toUpperCase()), f.createTypeReferenceNode(f.createIdentifier('const'), undefined))),
    f.createPropertyAssignment('route', f.createStringLiteral(route.replace(/\{(.+?)\}/g, (found, paramName) => `:${paramName}`))),
    f.createPropertyAssignment('request', requestDeclaration.declaration),
    f.createPropertyAssignment('response', responseDeclaration.declaration),
  ]
  if (requestDeclaration.security != null) {
    resElements.push(f.createPropertyAssignment('security', requestDeclaration.security))
  }
  return {
    declaration: f.createObjectLiteralExpression(resElements, true),
  }
}
