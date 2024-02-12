import { inspect } from 'util'
import { Stream } from 'stream'

export function formatValueForLog(
  input: unknown,
  parents: Array<any> = [],
): any {
  if (parents.includes(input)) {
    return '(circular)';
  }

  switch (typeof input) {
    case 'bigint':
    case 'string':
    case 'boolean':
    case 'number':
    case 'undefined':
      return input;
    case 'symbol':
      return input.description;
    case 'function':
      return '(function)';
    case 'object':
      if (input === null) {
        return null;
      } else if (input instanceof Error) {
        // if (input instanceof AxiosError) {
        //   const err = new Error() as any;
        //   err.name = 'AxiosError (minified)';
        //   err.code = input.code;
        //   err.request = {
        //     method: input.config?.method,
        //     url: input.config?.url,
        //     headers: input.config?.headers,
        //   };
        //   err.response = {
        //     status: input.response?.status,
        //     headers: input.response?.headers,
        //     data: input.response?.data,
        //   };
        //   err.origStack = input.stack;
        //   input = err;
        // }

        return inspect(input, undefined, 10);
      } else if (input instanceof Stream) {
        return '(stream)';
      } else if (input instanceof Buffer) {
        return '(buffer)';
      } else if (Array.isArray(input)) {
        return input.map((v) => formatValueForLog(v, parents.concat([input])));
      } else {
        const res: any = {};
        for (const key in input) {
          res[key] = formatValueForLog((input as Record<string, unknown>)[key], parents.concat([(input)]));
        }
        return res;
      }
  }
}
