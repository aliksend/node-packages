// @generated

import { z } from "zod"
import { Readable } from "stream"

const __Date__Req = z.string().transform(v => new Date(v))
const __Date__Res = z.date().transform(v => v.toISOString().slice(0, 10))
export const routes = {
    "/types-conversion": {
        "GET": {
            request: z.object({
                query: z.object({
                    "number": z.number().optional(),
                    "integer": z.number().int().optional(),
                    "boolean": z.boolean().optional(),
                    "date-time": z.string().transform(v => new Date(v)).optional(),
                    "date": z.string().transform(v => new Date(v)).optional(),
                    "date-ref-in-request": __Date__Req.optional(),
                    "array": z.enum([
                        "a",
                        "b",
                        "c"
                    ]).array().optional(),
                    "object": z.object({
                        "n": z.number(),
                        "s": z.string().optional(),
                        "dt": z.string().transform(v => new Date(v)).optional()
                    }).optional()
                })
            }),
            response: z.object({
                statusCode: z.literal(200),
                body: z.object({
                    "date": z.string().transform(v => new Date(v)).optional(),
                    "date-ref-in-response": __Date__Res.optional(),
                    "date-time": z.string().transform(v => new Date(v)).optional()
                })
            })
        }
    }
}
