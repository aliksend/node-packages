import type { OpenAPIV3, OpenAPIV3_1 } from 'openapi-types'
import jsonpointer from 'jsonpointer'

export function resolveRef<T extends object> (schema: OpenAPIV3.ReferenceObject | OpenAPIV3_1.ReferenceObject | T, parsedDocument: OpenAPIV3.Document | OpenAPIV3_1.Document, path: string): T {
  if ('$ref' in schema) {
    if (!schema.$ref.startsWith('#')) {
      throw new Error(`External $ref not supported at ${path}`)
    }
    return jsonpointer.get(parsedDocument, schema.$ref.slice(1))
  }

  return schema
}
