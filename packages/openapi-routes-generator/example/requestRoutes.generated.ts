// @generated

import { z } from "zod"
import { Readable } from "stream"

const __Date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
export const routes = {
    "/types-conversion": {
        "GET": {
            request: z.object({
                query: z.object({
                    "number": z.number().optional(),
                    "integer": z.number().int().optional(),
                    "boolean": z.boolean().optional(),
                    "date-time": z.string().regex(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(\.\d+)?(([+-]\d\d:\d\d)|Z)$/).optional(),
                    "date": z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
                    "date-ref-in-request": __Date.optional(),
                    "array": z.enum([
                        "a",
                        "b",
                        "c"
                    ]).array().optional(),
                    "object": z.object({
                        "n": z.number(),
                        "s": z.string().optional(),
                        "dt": z.string().regex(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(\.\d+)?(([+-]\d\d:\d\d)|Z)$/).optional()
                    }).optional()
                })
            }),
            response: z.object({
                statusCode: z.literal(200),
                body: z.object({
                    "date": z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
                    "date-ref-in-response": __Date.optional(),
                    "date-time": z.string().regex(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(\.\d+)?(([+-]\d\d:\d\d)|Z)$/).optional()
                })
            })
        }
    }
}
