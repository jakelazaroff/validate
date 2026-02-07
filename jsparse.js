// STANDARD SCHEMA TYPES
// See https://standardschema.dev

/**
 * @template [Input = unknown]
 * @template [Output = Input]
 * @typedef {{ readonly "~standard": Props<Input, Output> }} StandardSchemaV1 The Standard Schema interface.
 * See https://standardschema.dev.
 */

/**
 * @template [Input = unknown]
 * @template [Output = Input]
 * @typedef {object} Props The Standard Schema properties interface.
 * @property {1} version The version number of the standard.
 * @property {string} vendor The vendor name of the schema library.
 * @property {(value: unknown) => Result<Output>} validate Validates unknown input values.
 * @property {Types<Input, Output> | undefined} [types] Inferred types associated with the schema.
 */

/**
 * @template Output
 * @typedef {SuccessResult<Output> | FailureResult} Result The result interface of the validate function.
 */

/**
 * @template Output
 * @typedef {object} SuccessResult The result interface if validation succeeds.
 * @property {Output} value The typed output value.
 * @property {undefined} [issues] The non-existent issues.
 */

/**
 * @typedef {object} FailureResult The result interface if validation fails.
 * @property {ReadonlyArray<Issue>} issues The issues of failed validation.
 */

/**
 * @typedef {object} Issue The issue interface of the failure output.
 * @property {string} message The error message of the issue.
 * @property {ReadonlyArray<PropertyKey>} [path] The path of the issue, if any.
 */

/**
 * @template [Input = unknown]
 * @template [Output = Input]
 * @typedef {object} Types The Standard Schema types interface.
 * @property {Input} input The input type of the schema.
 * @property {Output} output The output type of the schema.
 */

/**
 * @template {StandardSchemaV1} Schema
 * @typedef {NonNullable<Schema['~standard']['types']>['output']} InferOutput
 */

// IMPLEMENTATION

const NS = "~standard";

class SchemaError extends Error {
  /** @param {readonly Issue[]} issues */
  constructor(issues) {
    const msg = issues
      .map(({ message, path }) => (path.length ? `- $.${path.join(".")}: ${message}` : message))
      .join("\n");
    super(msg);
  }
}

/**
 * Creates a schema from a validation function.
 * @template [Input = unknown]
 * @template [Output = Input]
 * @param {(input: any) => Result<Output>} validate The validation function.
 * @returns {StandardSchemaV1<Input, Output>}
 */
function schema(validate) {
  return {
    [NS]: {
      version: 1,
      vendor: "jsparse",
      validate,
    },
  };
}

/**
 * Validates a given input against a schema.
 * @template T
 * @param {StandardSchemaV1<any, T>} schm
 * @param {any} input
 */
const v = (schm, input) => schm[NS].validate(input);

/**
 * Creates a schema from a type predicate.
 * @template [Input = unknown]
 * @template [Output = Input]
 * @param {(value: unknown) => value is Output} fn The validation function.
 * @param {(value: unknown) => string} msg
 * @returns {StandardSchemaV1<Input, Output>}
 */
export function custom(fn, msg) {
  return schema((value) => {
    if (fn(value)) return { value };
    return { issues: [{ message: msg(value), path: [] }] };
  });
}

/**
 * @param {string} expected
 * @param {string} actual
 */
function formatError(expected, actual) {
  return `Expected ${expected}, received \`${JSON.stringify(actual)}\``;
}

/** @param {string} expected */
function formatErrorFor(expected) {
  /** @param {any} actual */
  return (actual) => formatError(expected, actual);
}

// schemata for `null` and `undefined` (defined in a way that avoids shadowing built-ins)
const _null = custom((x) => x === null, formatErrorFor("null"));
const _undefined = custom((x) => x === undefined, formatErrorFor("undefined"));
export { _null as null, _undefined as undefined };

export const bigint = custom((x) => typeof x === "bigint", formatErrorFor("bigint"));
export const boolean = custom((x) => typeof x === "boolean", formatErrorFor("boolean"));
export const number = custom((x) => typeof x === "number", formatErrorFor("number"));
export const string = custom((x) => typeof x === "string", formatErrorFor("string"));
export const symbol = custom((x) => typeof x === "symbol", formatErrorFor("symbol"));
export const any = custom(
  /** @returns {_ is any} */ (_) => true,
  () => "",
);

/**
 * @template const T
 * @param {T} lit
 */
export const literal = (lit) =>
  custom(
    /** @returns {v is T} */
    (val) => val === lit,
    formatErrorFor(`\`${lit}\``),
  );

/**
 * @template {Function} T
 * @param {T} fn
 */
export const instance = (fn) =>
  custom(
    /** @returns {v is InstanceType<T>} */
    (v) => v instanceof fn,
    formatErrorFor(`instance of ${fn.name}`),
  );

/**
 * @template {StandardSchemaV1[]} T
 * @param {T} schemata
 * @returns {StandardSchemaV1<unknown, InferOutput<T[number]>>}
 */
export const union = (...schemata) => {
  return schema((input) => {
    /** @type {Issue[]} */
    let issues = [];

    for (const schm of schemata) {
      const result = v(schm, input);
      if (!result.issues) return result;
      issues = issues.concat(result.issues);
    }

    return { issues };
  });
};

/**
 * Converts a union type to an intersection type;
 * see https://fettblog.eu/typescript-union-to-intersection/
 * @template T
 * @typedef {(T extends any ? (x: T) => any : never) extends (x: infer R) => any ? R : never} UnionToIntersection
 */

/**
 * Simplifies an intersection type into a single object type
 * @template T
 * @typedef {T extends infer O ? { [K in keyof O]: O[K] } : never} Simplify
 */

/**
 * @template {StandardSchemaV1[]} T
 * @param {T} schemata
 * @returns {StandardSchemaV1<unknown, Simplify<UnionToIntersection<InferOutput<T[number]>>>>}
 */
export const intersect = (...schemata) => {
  return schema((value) => {
    /** @type {Issue[]} */
    let issues = [];

    for (const schm of schemata) {
      const result = v(schm, value);
      if (result.issues) issues = issues.concat(result.issues);
    }

    return issues.length ? { issues } : { value };
  });
};

/**
 * @template {StandardSchemaV1} T
 * @param {T} schm
 */
export const optional = (schm) => union(_undefined, schm);

/**
 * @template {StandardSchemaV1} T
 * @param {T} schm
 */
export const nullable = (schm) => union(_null, schm);

/**
 * @template T
 * @param {StandardSchemaV1<unknown, T>} schm
 * @returns {StandardSchemaV1<unknown, T[]>}
 */
export const array = (schm) => {
  return schema((input) => {
    if (!Array.isArray(input)) return { issues: [{ message: formatError("array", input) }] };

    /** @type {Issue[]} */
    const issues = [];

    for (const [i, val] of input.entries()) {
      const result = v(schm, val);
      if (result.issues) {
        for (const issue of result.issues) {
          issue.path = /** @type {PropertyKey[]} */ ([i]).concat(issue.path || []);
          issues.push(issue);
        }
      }
    }

    if (issues.length) return { issues };
    return /** @type {SuccessResult<typeof values>} */ ({ value: input });
  });
};

/** @param {any} input */
function isObject(input) {
  return typeof input === "object" && input !== null && !Array.isArray(input);
}

/**
 * @template {{ [key: PropertyKey]: StandardSchemaV1}} T
 * @param {T} schm
 * @returns {StandardSchemaV1<unknown, Simplify<
 *   { [K in keyof T as undefined extends InferOutput<T[K]> ? never : K]: InferOutput<T[K]> } &
 *   { [K in keyof T as undefined extends InferOutput<T[K]> ? K : never]?: InferOutput<T[K]> }
 * >>}
 */
export const object = (schm) => {
  return schema((value) => {
    if (!isObject(value)) return { issues: [{ message: formatError("object", value) }] };

    /** @type {Issue[]} */
    const issues = [];

    for (const [key, subschm] of Object.entries(schm)) {
      const result = v(subschm, value[key]);
      if (result.issues) {
        for (const issue of result.issues || []) {
          issue.path = /** @type {[PropertyKey]} */ ([key]).concat(issue.path || []);
          issues.push(issue);
        }
      }
    }

    return issues.length ? { issues } : { value };
  });
};

/**
 * @template T
 * @param {StandardSchemaV1<unknown, T>} schm
 * @returns {StandardSchemaV1<unknown, { [key: PropertyKey]: T }>}
 */
export const record = (schm) => {
  return schema((value) => {
    if (!isObject(value)) return { issues: [{ message: formatError("object", value) }] };

    /** @type {Issue[]} */
    const issues = [];

    for (const [key, val] of Object.entries(value)) {
      const result = v(schm, val);
      if (result.issues) {
        for (const issue of result.issues || []) {
          issue.path = /** @type {[PropertyKey]} */ ([key]).concat(issue.path || []);
          issues.push(issue);
        }
      }
    }

    return issues.length ? { issues } : { value };
  });
};

/**
 * @template [Input = unknown]
 * @template [Output = Input]
 * @param {StandardSchemaV1<Input, Output>} schm
 * @param {unknown} input
 * @throws {SchemaError}
 * @returns {Output}
 */
export function parse(schm, input) {
  const result = v(schm, input);
  if (result.issues) throw new SchemaError(result.issues);
  return result.value;
}

/**
 * @template [Input = unknown]
 * @template [Output = Input]
 * @param {StandardSchemaV1<Input, Output>} schm
 * @param {unknown} input
 * @returns {input is Output}
 */
export function is(schm, input) {
  return !v(schm, input).issues;
}
