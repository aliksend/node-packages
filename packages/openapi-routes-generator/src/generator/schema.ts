import type { OpenAPIV3, OpenAPIV3_1 } from 'openapi-types'
import ts, { factory as f } from 'typescript'
import { resolveRef } from './ref'

// Wrapper for makeDeclarationForModel to check required & default
export function checkRequired (required: boolean, errorText: string, r: ReturnType<typeof makeDeclarationForModel>): ts.Expression {
  if (required) {
    if (r.hasDefault) {
      // https://swagger.io/docs/specification/describing-parameters/#mistakes
      throw new Error(errorText)
    }
  } else if (!r.hasDefault) {
    return f.createCallExpression(f.createPropertyAccessExpression(r.declaration, 'optional'), undefined, [])
  }

  return r.declaration
}

export function makeDeclarationForModel (schemaOrRef: OpenAPIV3.ReferenceObject | OpenAPIV3.SchemaObject | OpenAPIV3_1.SchemaObject, literalsPrefix: string, refSuffix: string, typesFormat: 'request' | 'handler' | 'parse' | 'stringify', parsedDocument: OpenAPIV3.Document | OpenAPIV3_1.Document, path: string, usedIn: 'request' | 'response' | 'unknown'): { declaration: ts.Expression, hasDefault: boolean } {
  let hasDefault = false

  if ('$ref' in schemaOrRef) {
    const expectedRefPrefix = '#/components/schemas/'
    if (!schemaOrRef.$ref.startsWith(expectedRefPrefix)) {
      throw new Error(`$ref has invalid value ${schemaOrRef.$ref} at ${path}/$ref`)
    }
    const ref = schemaOrRef.$ref.slice(expectedRefPrefix.length)
    return {
      declaration: f.createIdentifier(`${literalsPrefix}${ref}${refSuffix}`),
      hasDefault,
    }
  }
  const schema = schemaOrRef

  if (schema.oneOf != null) {
    const zodSchemas = schema.oneOf.map((v, index) => makeDeclarationForModel(v, literalsPrefix, refSuffix, typesFormat, parsedDocument, `${path}/oneOf/${index}`, usedIn))
    if (zodSchemas.length === 1) {
      return {
        declaration: zodSchemas[0].declaration,
        hasDefault,
      }
    }

    let declaration
    if (schema.discriminator?.propertyName != null) {
      declaration = f.createCallExpression(f.createPropertyAccessExpression(f.createIdentifier('z'), 'discriminatedUnion'), undefined, [
        f.createStringLiteral(schema.discriminator.propertyName),
        f.createArrayLiteralExpression(zodSchemas.map(({ declaration }) => declaration)),
      ])
    } else {
      declaration = f.createCallExpression(f.createPropertyAccessExpression(f.createIdentifier('z'), 'union'), undefined, [
        f.createArrayLiteralExpression(zodSchemas.map(({ declaration }) => declaration)),
      ])
    }
    return {
      declaration,
      hasDefault,
    }
  }
  if (schema.anyOf != null) {
    const zodSchemas = schema.anyOf.map((v, index) => makeDeclarationForModel(v, literalsPrefix, refSuffix, typesFormat, parsedDocument, `${path}/anyOf/${index}`, usedIn))
    const declaration = zodSchemas.reduce((res: ts.Expression | undefined, zodSchema) => {
      if (res == null) {
        return zodSchema.declaration
      }
      return f.createCallExpression(f.createPropertyAccessExpression(res, 'or'), undefined, [zodSchema.declaration])
    }, undefined)
    if (declaration == null) {
      throw new Error(`anyOf must contain at least one value at ${path}/anyOf`)
    }
    return {
      declaration,
      hasDefault,
    }
  }
  if (schema.allOf != null) {
    const zodSchemas = schema.allOf.map((v, index) => makeDeclarationForModel(v, literalsPrefix, refSuffix, typesFormat, parsedDocument, `${path}/allOf/${index}`, usedIn))
    const declaration = zodSchemas.reduce((res: ts.Expression | undefined, zodSchema) => {
      if (res == null) {
        return zodSchema.declaration
      }
      return f.createCallExpression(f.createPropertyAccessExpression(res, 'and'), undefined, [zodSchema.declaration])
    }, undefined)
    if (declaration == null) {
      throw new Error(`allOf must contain at least one value at ${path}/allOf`)
    }
    return {
      declaration,
      hasDefault,
    }
  }
  if (schema.enum != null) {
    let res = makeDeclarationForEnum(schema.enum, `${path}/enum`)
    if ('nullable' in schema && schema.nullable === true) {
      res = f.createCallExpression(f.createPropertyAccessExpression(res, 'nullable'), undefined, [])
    }
    if (schema.default != null) {
      res = f.createCallExpression(f.createPropertyAccessExpression(res, 'default'), undefined, [createLiteral(schema.default, `${path}/default`)])
      hasDefault = true
    }
    return {
      declaration: res,
      hasDefault,
    }
  }

  switch (schema.type) {
    case 'null': {
      const res = f.createCallExpression(f.createPropertyAccessExpression(f.createIdentifier('z'), 'null'), undefined, [])
      return {
        declaration: res,
        hasDefault,
      }
    }
    case 'boolean': {
      let res = f.createCallExpression(f.createPropertyAccessExpression(f.createIdentifier('z'), 'boolean'), undefined, [])
      if (schema.default != null) {
        res = f.createCallExpression(f.createPropertyAccessExpression(res, 'default'), undefined, [createLiteral(schema.default, `${path}/default`)])
        hasDefault = true
      }
      if ('nullable' in schema && schema.nullable === true) {
        res = f.createCallExpression(f.createPropertyAccessExpression(res, 'nullable'), undefined, [])
      }
      return {
        declaration: res,
        hasDefault,
      }
    }
    case 'string': {
      let byteString = false
      let res = f.createCallExpression(f.createPropertyAccessExpression(f.createIdentifier('z'), 'string'), undefined, [])
      if (schema.format != null) {
        switch (schema.format) {
          case 'uuid':
            res = f.createCallExpression(f.createPropertyAccessExpression(res, 'uuid'), undefined, [])
            break
          case 'email':
            res = f.createCallExpression(f.createPropertyAccessExpression(res, 'email'), undefined, [])
            break
          case 'uri':
            res = f.createCallExpression(f.createPropertyAccessExpression(res, 'url'), undefined, [])
            break
          case 'date':
            switch (typesFormat) {
              case 'handler':
                res = f.createCallExpression(f.createPropertyAccessExpression(f.createIdentifier('z'), 'date'), undefined, [])
                break
              case 'request':
                res = f.createCallExpression(f.createPropertyAccessExpression(
                  f.createCallExpression(f.createPropertyAccessExpression(f.createIdentifier('z'), 'string'), undefined, []), 'regex'),
                  undefined,
                  [
                    f.createRegularExpressionLiteral("/^\\d{4}-\\d{2}-\\d{2}$/")
                  ]
                )
                break
              case 'stringify':
                res = f.createCallExpression(f.createPropertyAccessExpression(
                  f.createCallExpression(f.createPropertyAccessExpression(f.createIdentifier('z'), 'date'), undefined, []), 'transform'),
                  undefined,
                  [
                    f.createArrowFunction(
                      undefined,
                      undefined,
                      [f.createParameterDeclaration(
                        undefined,
                        undefined,
                        f.createIdentifier("v"),
                        undefined,
                        undefined,
                        undefined
                      )],
                      undefined,
                      f.createToken(ts.SyntaxKind.EqualsGreaterThanToken),
                      f.createCallExpression(
                        f.createPropertyAccessExpression(
                          f.createCallExpression(
                            f.createPropertyAccessExpression(
                              f.createIdentifier("v"),
                              f.createIdentifier("toISOString")
                            ),
                            undefined,
                            []
                          ),
                          f.createIdentifier("slice")
                        ),
                        undefined,
                        [
                          f.createNumericLiteral("0"),
                          f.createNumericLiteral("10")
                        ]
                      )
                    )
                  ]
                )
                break
              case 'parse':
                res = f.createCallExpression(f.createPropertyAccessExpression(
                  f.createCallExpression(f.createPropertyAccessExpression(f.createIdentifier('z'), 'string'), undefined, []), 'transform'),
                  undefined,
                  [
                    f.createArrowFunction(
                      undefined,
                      undefined,
                      [f.createParameterDeclaration(
                        undefined,
                        undefined,
                        f.createIdentifier("v"),
                        undefined,
                        undefined,
                        undefined
                      )],
                      undefined,
                      f.createToken(ts.SyntaxKind.EqualsGreaterThanToken),
                      f.createNewExpression(
                        f.createIdentifier("Date"),
                        undefined,
                        [f.createIdentifier("v")]
                      )
                    )
                  ]
                )
                break
            }
            break
          case 'date-time':
            switch (typesFormat) {
              case 'handler':
                res = f.createCallExpression(f.createPropertyAccessExpression(f.createIdentifier('z'), 'date'), undefined, [])
                break
              case 'request':
                res = f.createCallExpression(f.createPropertyAccessExpression(
                  f.createCallExpression(f.createPropertyAccessExpression(f.createIdentifier('z'), 'string'), undefined, []), 'regex'),
                  undefined,
                  [
                    f.createRegularExpressionLiteral("/^\\d{4}-\\d\\d-\\d\\dT\\d\\d:\\d\\d:\\d\\d(\\.\\d+)?(([+-]\\d\\d:\\d\\d)|Z)$/")
                  ]
                )
                break
              case 'stringify':
                res = f.createCallExpression(f.createPropertyAccessExpression(
                  f.createCallExpression(f.createPropertyAccessExpression(f.createIdentifier('z'), 'date'), undefined, []), 'transform'),
                  undefined,
                  [
                    f.createArrowFunction(
                      undefined,
                      undefined,
                      [f.createParameterDeclaration(
                        undefined,
                        undefined,
                        f.createIdentifier("v"),
                        undefined,
                        undefined,
                        undefined
                      )],
                      undefined,
                      f.createToken(ts.SyntaxKind.EqualsGreaterThanToken),
                      f.createCallExpression(
                        f.createPropertyAccessExpression(
                          f.createIdentifier("v"),
                          f.createIdentifier("toISOString")
                        ),
                        undefined,
                        []
                      )
                    )
                  ]
                )
                break
              case 'parse':
                res = f.createCallExpression(f.createPropertyAccessExpression(
                  f.createCallExpression(f.createPropertyAccessExpression(f.createIdentifier('z'), 'string'), undefined, []), 'transform'),
                  undefined,
                  [
                    f.createArrowFunction(
                      undefined,
                      undefined,
                      [f.createParameterDeclaration(
                        undefined,
                        undefined,
                        f.createIdentifier("v"),
                        undefined,
                        undefined,
                        undefined
                      )],
                      undefined,
                      f.createToken(ts.SyntaxKind.EqualsGreaterThanToken),
                      f.createNewExpression(
                        f.createIdentifier("Date"),
                        undefined,
                        [f.createIdentifier("v")]
                      )
                    )
                  ]
                )
                break
            }
            break
          case 'byte': // base64-encoded file contents
          case 'binary': // binary file contents
            if (usedIn === 'response') {
              res = f.createCallExpression(f.createPropertyAccessExpression(f.createIdentifier('z'), 'union'), undefined, [f.createArrayLiteralExpression([
                f.createCallExpression(f.createPropertyAccessExpression(f.createIdentifier('z'), 'instanceof'), undefined, [f.createIdentifier('Buffer')]),
                f.createCallExpression(f.createPropertyAccessExpression(f.createIdentifier('z'), 'instanceof'), undefined, [f.createIdentifier('Readable')]),
              ])])
            } else {
              res = f.createCallExpression(f.createPropertyAccessExpression(f.createIdentifier('z'), 'instanceof'), undefined, [f.createIdentifier('Buffer')])
            }
            byteString = true
            break
          default:
            // eslint-disable-next-line no-console
            console.error(`unknown schema format ${schema.format}`)
        }
      }
      if (schema.minLength != null) {
        if (byteString) {
          throw new Error(`setting "minLength" not available for format: byte at ${path}/minLength`)
        }
        res = f.createCallExpression(f.createPropertyAccessExpression(res, 'min'), undefined, [f.createNumericLiteral(schema.minLength)])
      }
      if (schema.maxLength != null) {
        if (byteString) {
          throw new Error(`setting "maxLength" not available for format: byte at ${path}/maxLength`)
        }
        res = f.createCallExpression(f.createPropertyAccessExpression(res, 'max'), undefined, [f.createNumericLiteral(schema.maxLength)])
      }
      if (schema.pattern != null) {
        if (byteString) {
          throw new Error(`setting "pattern" not available for format: byte at ${path}/pattern`)
        }
        res = f.createCallExpression(f.createPropertyAccessExpression(res, 'regex'), undefined, [
          f.createNewExpression(f.createIdentifier('RegExp'), undefined, [f.createStringLiteral(schema.pattern)]
          ),
        ])
      }
      if (schema.default != null) {
        if (byteString) {
          throw new Error(`setting "default" not available for format: byte at ${path}/default`)
        }
        res = f.createCallExpression(f.createPropertyAccessExpression(res, 'default'), undefined, [createLiteral(schema.default, `${path}/default`)])
        hasDefault = true
      }
      if ('nullable' in schema && schema.nullable === true) {
        res = f.createCallExpression(f.createPropertyAccessExpression(res, 'nullable'), undefined, [])
      }
      return {
        declaration: res,
        hasDefault,
      }
    }
    case 'number': {
      let res = f.createCallExpression(f.createPropertyAccessExpression(f.createIdentifier('z'), 'number'), undefined, [])
      if (schema.minimum != null) {
        res = f.createCallExpression(f.createPropertyAccessExpression(res, 'min'), undefined, [f.createNumericLiteral(schema.minimum)])
      }
      if (schema.maximum != null) {
        res = f.createCallExpression(f.createPropertyAccessExpression(res, 'max'), undefined, [f.createNumericLiteral(schema.maximum)])
      }
      if (schema.default != null) {
        res = f.createCallExpression(f.createPropertyAccessExpression(res, 'default'), undefined, [createLiteral(schema.default, `${path}/default`)])
        hasDefault = true
      }
      if ('nullable' in schema && schema.nullable === true) {
        res = f.createCallExpression(f.createPropertyAccessExpression(res, 'nullable'), undefined, [])
      }
      return {
        declaration: res,
        hasDefault,
      }
    }
    case 'integer': {
      let res = f.createCallExpression(f.createPropertyAccessExpression(f.createCallExpression(f.createPropertyAccessExpression(f.createIdentifier('z'), 'number'), undefined, []), 'int'), undefined, [])
      if (schema.minimum != null) {
        res = f.createCallExpression(f.createPropertyAccessExpression(res, 'min'), undefined, [f.createNumericLiteral(schema.minimum)])
      }
      if (schema.maximum != null) {
        res = f.createCallExpression(f.createPropertyAccessExpression(res, 'max'), undefined, [f.createNumericLiteral(schema.maximum)])
      }
      if (schema.default != null) {
        res = f.createCallExpression(f.createPropertyAccessExpression(res, 'default'), undefined, [createLiteral(schema.default, `${path}/default`)])
        hasDefault = true
      }
      if ('nullable' in schema && schema.nullable === true) {
        res = f.createCallExpression(f.createPropertyAccessExpression(res, 'nullable'), undefined, [])
      }
      return {
        declaration: res,
        hasDefault,
      }
    }
    case 'array': {
      const arrayItemSchema = makeDeclarationForModel(schema.items, literalsPrefix, refSuffix, typesFormat, parsedDocument, `${path}/items`, usedIn)
      let res = f.createCallExpression(f.createPropertyAccessExpression(arrayItemSchema.declaration, 'array'), undefined, [])
      if (schema.default != null) {
        if (!Array.isArray(schema.default)) {
          throw new Error(`default value for array must be array at ${path}/default`)
        }
        res = f.createCallExpression(f.createPropertyAccessExpression(res, 'default'), undefined, [createLiteral(schema.default, `${path}/default`)])
        hasDefault = true
      }
      if ('nullable' in schema && schema.nullable === true) {
        res = f.createCallExpression(f.createPropertyAccessExpression(res, 'nullable'), undefined, [])
      }
      return {
        declaration: res,
        hasDefault,
      }
    }
    case 'object': {
      let properties: ts.ObjectLiteralElementLike[]
      if (schema.properties == null) {
        properties = []
      } else {
        properties = Object.entries(schema.properties).map(([name, property]) => {
          const declaration = checkRequired(schema.required != null && schema.required.includes(name), `field must be either required (forced to be provided by user) or have default value at ${path}/properties/${name}`, makeDeclarationForModel(property, literalsPrefix, refSuffix, typesFormat, parsedDocument, `${path}/properties/${name}`, usedIn))
          return f.createPropertyAssignment(f.createStringLiteral(name), declaration)
        })
      }
      if (schema.required != null) {
        for (const field of schema.required) {
          if (schema.properties == null || schema.properties[field] == null) {
            throw new Error(`field ${field} is declared as required, but not listed in properties at ${path}`)
          }
        }
      }
      let res = f.createCallExpression(f.createPropertyAccessExpression(f.createIdentifier('z'), 'object'), undefined, [f.createObjectLiteralExpression(properties, true)])

      let passthrough = schema.properties == null

      if (schema.additionalProperties != null) {
        if (schema.additionalProperties === false) {
          passthrough = false
        } else if (schema.additionalProperties === true) {
          passthrough = true
        } else if (Object.keys(schema.additionalProperties).length === 0) {
          // according to specification, additionalProperties can be specified as `{}`, and it means "true"
          passthrough = true
        } else {
          passthrough = false

          const additionalPropertiesSchema = resolveRef(schema.additionalProperties, parsedDocument, `${path}/additionalProperties`)
          const el = makeDeclarationForModel(additionalPropertiesSchema, literalsPrefix, refSuffix, typesFormat, parsedDocument, `${path}/additionalProperties`, usedIn)

          res = f.createCallExpression(f.createPropertyAccessExpression(res, 'and'), undefined, [
            f.createCallExpression(f.createPropertyAccessExpression(f.createIdentifier('z'), 'record'), undefined, [
              el.declaration,
            ]),
          ])
        }
      }

      if (passthrough) {
        res = f.createCallExpression(f.createPropertyAccessExpression(res, 'passthrough'), undefined, [])
      }

      if (schema.default != null) {
        if (typeof schema.default !== 'object') {
          throw new Error(`default value for object must be object at ${path}/default`)
        }
        res = f.createCallExpression(f.createPropertyAccessExpression(res, 'default'), undefined, [createLiteral(schema.default, `${path}/default`)])
        hasDefault = true
      }

      if ('nullable' in schema && schema.nullable === true) {
        res = f.createCallExpression(f.createPropertyAccessExpression(res, 'nullable'), undefined, [])
      }

      return {
        declaration: res,
        hasDefault,
      }
    }
    default:
      throw new Error(`Unsupported schema type ${schema.type as any} at ${path}/type`)
  }
}

function makeDeclarationForEnum (enumDeclaration: NonNullable<OpenAPIV3.BaseSchemaObject['enum']>, path: string): ts.Expression {
  if (enumDeclaration.length === 0) {
    return f.createCallExpression(f.createPropertyAccessExpression(f.createIdentifier('z'), 'never'), undefined, [])
  }

  if (enumDeclaration.every(v => typeof v === 'string')) {
    return f.createCallExpression(f.createPropertyAccessExpression(f.createIdentifier('z'), 'enum'), undefined, [f.createArrayLiteralExpression(enumDeclaration.map(v => f.createStringLiteral(v)), true)])
  }

  if (enumDeclaration.length === 1) {
    return createLiteral(enumDeclaration[0], `${path}/0`)
  }

  return f.createCallExpression(f.createPropertyAccessExpression(f.createIdentifier('z'), 'union'), undefined, [
    f.createArrayLiteralExpression(enumDeclaration.map((v, index) =>
      f.createCallExpression(f.createPropertyAccessExpression(f.createIdentifier('z'), 'literal'), undefined, [createLiteral(v, `${path}/${index}`)])
    )),
  ])
}

function createLiteral (v: string | number | boolean | object, path: string): ts.Expression {
  if (typeof v === 'string') {
    return f.createStringLiteral(v)
  }
  if (typeof v === 'number') {
    return f.createNumericLiteral(v)
  }
  if (typeof v === 'boolean') {
    if (v) {
      return f.createTrue()
    }
    return f.createFalse()
  }
  if (typeof v === 'object') {
    if (Array.isArray(v)) {
      return f.createArrayLiteralExpression(v.map((v, index) => createLiteral(v, `${path}/default/${index}`)))
    }

    return f.createObjectLiteralExpression(Object.entries(v).map(([field, value]) => f.createPropertyAssignment(f.createStringLiteral(field), createLiteral(value, `${path}/${field}`))))
  }

  throw new Error(`Invalid default value for boolean type ${v as any} at ${path}`)
}
