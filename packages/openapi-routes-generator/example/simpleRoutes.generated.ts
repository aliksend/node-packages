// @generated

import { z } from "zod"
import { Readable } from "stream"

export const __TestType = z.object({
    "s": z.string(),
    "n": z.number(),
    "i": z.number().int(),
    "optional_array": z.string().array().optional(),
    "optional_complex": z.object({
        "first": z.string().optional(),
        "typeAndValue": z.discriminatedUnion("type", [z.object({
                "type": z.enum([
                    "string"
                ]),
                "value": z.string()
            }), z.object({
                "type": z.enum([
                    "number",
                    "integer"
                ]),
                "value": z.number()
            })]).optional()
    }).optional()
})
export const routes = {
    "GET /simple": {
        method: "GET" as const,
        route: "/simple",
        request: z.object({}),
        response: z.object({
            statusCode: z.literal(200),
            body: z.string()
        })
    },
    "POST /simple": {
        method: "POST" as const,
        route: "/simple",
        request: z.object({
            body: z.string()
        }),
        response: z.object({
            statusCode: z.literal(200),
            body: __TestType
        })
    },
    "GET /headers": {
        method: "GET" as const,
        route: "/headers",
        request: z.object({
            headers: z.object({
                "in-header": z.string().optional()
            })
        }),
        response: z.object({
            statusCode: z.literal(204),
            body: z.undefined(),
            headers: z.object({
                "out-header": z.string().optional()
            })
        })
    },
    "GET /path-and-query-params/:id": {
        method: "GET" as const,
        route: "/path-and-query-params/:id",
        request: z.object({
            params: z.object({
                "id": z.string()
            }),
            query: z.object({
                "kind": z.enum([
                    "full",
                    "partial",
                    "simple"
                ]).optional()
            })
        }),
        response: z.object({
            statusCode: z.literal(204),
            body: z.undefined()
        })
    }
}
