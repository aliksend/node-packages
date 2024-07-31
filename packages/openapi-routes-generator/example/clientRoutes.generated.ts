// @generated

import { z } from "zod"
import { Readable } from "stream"

const __Date__Req = z.date().transform(v => v.toISOString().slice(0, 10))
const __Date__Res = z.string().transform(v => new Date(v))
export const routes = {
    "/types-conversion": {
        "GET": {
            request: z.object({
                query: z.object({
                    "number": z.number().optional(),
                    "integer": z.number().int().optional(),
                    "boolean": z.boolean().optional(),
                    "date-time": z.date().transform(v => v.toISOString()).optional(),
                    "date": z.date().transform(v => v.toISOString().slice(0, 10)).optional(),
                    "date-ref-in-request": __Date__Req.optional(),
                    "array": z.enum([
                        "a",
                        "b",
                        "c"
                    ]).array().optional(),
                    "object": z.object({
                        "n": z.number(),
                        "s": z.string().optional(),
                        "dt": z.date().transform(v => v.toISOString()).optional()
                    }).optional()
                })
            }),
            response: z.object({
                statusCode: z.literal(200),
                body: z.object({
                    "date": z.date().transform(v => v.toISOString().slice(0, 10)).optional(),
                    "date-ref-in-response": __Date__Res.optional(),
                    "date-time": z.date().transform(v => v.toISOString()).optional()
                })
            })
        }
    }
}
