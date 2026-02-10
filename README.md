# validate.js

2kb vanilla JavaScript validation library with [TypeScript](https://www.typescriptlang.org) and [Standard Schema](https://standardschema.dev) support.

## Why validate.js?

The JavaScript validation library field is crowded. Why use validate.js over [Valibot](https://valibot.dev) or [Zod](https://zod.dev)?

validate.js is _vanilla JavaScript_ — drop this file in any JavaScript or TypeScript project and it will Just Work regardless of toolchain. You might use it if you're building a website without a bundler, if you're not using TypeScript or if you just want something small and vanilla.

Why _not_ use vanilla.js? If you're building a Real Production Application, you probably already have package.json set up with a bundler, in which case you may as well use one of the larger libraries (as long as they tree shake to a small bundle size).

## Installing

validate.js is not on npm; instead, it's meant to be [vendored](https://htmx.org/essays/vendoring/), or copied directly into your project's source code.

Don't be put off — validate.js a single 350 line file, of which only 150 lines are actually JavaScript code. It doesn't bite!

## Examples

Easily validate complex types by using simple validators together:

```javascript
import { is, object, number, string } from "./validate.js";

const schema = object({
  a: string,
  b: number
});

is(schema, { a: "abc", b: 123 }); // true
is(schema, 42); // false
```

If you're using TypeScript, validate.js is even **more** useful:

```typescript
import { parse, object, number, string } from "./validate.js";

const schema = object({
  a: string,
  b: number
});

const foo: unknown = { a: "abc", b: 123 };
const result = parse(schema, foo);
result; // { a: string; b: number }
```

validate.js conforms to [Standard Schema](https://standardschema.dev), so you can use it anywhere you'd use another conformant validation library.

## Extending

Use `custom` to write your own validators. They take a type predicate and an error message function:

```typescript
import { custom, parse } from "./validate.js";

const positive = custom(
  (x): x is number => typeof x === "number" && x > 0,
  (x) => `Expected positive number, received \`${JSON.stringify(x)}\``
);

parse(positive, 5); // 5
parse(positive, -1); // throws
```

## API

### `parse(schema, value)`

Validates a value against a schema. Returns the value on success, throws a `SchemaError` on failure.

```typescript
import { parse, string } from "./validate.js";

parse(string, "hello"); // "hello"
parse(string, 42); // throws SchemaError
```

### `is(schema, value)`

Validates a value against a schema. Returns `true` or `false`.

```typescript
import { is, string } from "./validate.js";

is(string, "hello"); // true
is(string, 42); // false
```

### Primitive Schemas

#### `boolean`

Matches booleans.

```typescript
import { is, boolean } from "./validate.js";

is(boolean, false); // true
is(boolean, 0); // false
```

#### `number`

Matches numbers.

```typescript
import { is, number } from "./validate.js";

is(number, 0); // true
is(number, "string"); // false
```

#### `string`

Matches strings.

```typescript
import { is, string } from "./validate.js";

is(string, "test"); // true
is(string, true); // false
```

#### `bigint`

Matches bigints.

```typescript
import { is, bigint } from "./validate.js";

is(bigint, 1n); // true
is(bigint, 1); // false
```

#### `symbol`

Matches symbols.

```typescript
import { is, symbol } from "./validate.js";

is(symbol, Symbol()); // true
is(symbol, "string"); // false
```

#### `undefined`

Matches `undefined`.

```typescript
import { is, undefined as undef } from "./validate.js";

is(undef, undefined); // true
is(undef, null); // false
```

#### `null`

Matches `null`.

```typescript
import { is, null as nil } from "./validate.js";

is(nil, null); // true
is(nil, undefined); // false
```

#### `any`

Matches any value.

```typescript
import { is, any } from "./validate.js";

is(any, "anything"); // true
```

#### `literal(value)`

Matches a specific value using strict equality.

```typescript
import { is, literal } from "./validate.js";

const schema = literal(5);

is(schema, 5); // true
is(schema, 6); // false
```

### Complex Schemas

#### `object(shape)`

Validates that a value is an object where each property matches the corresponding schema.

```typescript
import { parse, object, number, string } from "./validate.js";

const schema = object({
  name: string,
  age: number
});

parse(schema, { name: "jake", age: 34 }); // { name: string; age: number }
parse(schema, { name: 34 }); // throws
```

#### `record(schema)`

Validates that all values in an object match the given schema.

```typescript
import { parse, record, number } from "./validate.js";

const schema = record(number);

parse(schema, { a: 1, b: 2 }); // { [key: PropertyKey]: number }
parse(schema, { a: "one" }); // throws
```

#### `array(schema)`

Validates that all elements in an array match the given schema.

```typescript
import { parse, array, number } from "./validate.js";

const schema = array(number);

parse(schema, [1, 2, 3]); // number[]
parse(schema, [1, "two"]); // throws
```

#### `instance(constructor)`

Validates that a value is an instance of the given constructor.

```typescript
import { is, instance } from "./validate.js";

const schema = instance(Date);

is(schema, new Date()); // true
is(schema, {}); // false
```

### Combinators

#### `union(...schemas)`

Matches if the value matches **any** of the given schemas. Narrows to a union type.

```typescript
import { parse, union, number, string } from "./validate.js";

const schema = union(number, string);

parse(schema, 0); // number | string
parse(schema, "one"); // number | string
parse(schema, false); // throws
```

#### `intersect(...schemas)`

Matches if the value matches **all** of the given schemas. Narrows to an intersection type.

```typescript
import { parse, intersect, object, number, string } from "./validate.js";

const schema = intersect(
  object({ a: number }),
  object({ b: string })
);

parse(schema, { a: 1, b: "2" }); // { a: number } & { b: string }
parse(schema, { a: 1 }); // throws
```

#### `optional(schema)`

Matches if the value matches the given schema or is `undefined`.

```typescript
import { parse, optional, number } from "./validate.js";

const schema = optional(number);

parse(schema, 0); // number | undefined
parse(schema, undefined); // number | undefined
parse(schema, "string"); // throws
```

#### `nullable(schema)`

Matches if the value matches the given schema or is `null`.

```typescript
import { parse, nullable, number } from "./validate.js";

const schema = nullable(number);

parse(schema, 0); // number | null
parse(schema, null); // number | null
parse(schema, "string"); // throws
```

#### `custom(predicate, errorMessage)`

Creates a schema from a type predicate and an error message function.

```typescript
import { is, custom } from "./validate.js";

const email = custom(
  (x): x is `${string}@${string}` =>
    typeof x === "string" && x.includes("@"),
  (x) => `Expected email, received \`${JSON.stringify(x)}\``
);

is(email, "user@example.com"); // true
is(email, "not-an-email"); // false
```

### `InferOutput`

TypeScript utility type that extracts the output type from a schema.

```typescript
import { object, number, string, InferOutput } from "./validate.js";

const schema = object({
  name: string,
  age: number
});

type Person = InferOutput<typeof schema>; // { name: string; age: number }
```
