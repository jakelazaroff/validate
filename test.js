import assert from "node:assert/strict"
import {describe, test} from "node:test"

import * as v from "./jsparse.js"

describe("primitives", () => {
	/** @type {Record<string, [unknown, import("./jsparse.js").StandardSchemaV1]>} */
	const PRIMITIVES = {
		bigint: [1n, v.bigint],
		boolean: [true, v.boolean],
		number: [1, v.number],
		string: ["test", v.string],
		symbol: [Symbol(), v.symbol],
		null: [null, v.null],
		undefined: [undefined, v.undefined]
	}

	for (const [type, [value, schema]] of Object.entries(PRIMITIVES)) {
		describe(type, () => {
			test(`parses ${type}s`, () => {
				assert.doesNotThrow(() => v.parse(schema, value))
			})

			test("doesn't parse other types", () => {
				const values = Object.entries(PRIMITIVES)
					.filter(([key]) => key !== type)
					.map(([, [value]]) => value)
				for (const value of values) {
					assert.throws(() => v.parse(schema, value))
				}
			})
		})
	}
})

describe("literal", () => {
	test("parses if value is the same as the literal", () => {
		const schema = v.literal("test")
		assert.doesNotThrow(() => v.parse(schema, "test"))
	})

	test("doesn't parse if value is not the same as the literal", () => {
		const schema = v.literal("test")
		assert.throws(() => v.parse(schema, "other"))
	})
})

describe("instance", () => {
	test("parses if value is an instance of the given class", () => {
		class Test {}
		const schema = v.instance(Test)
		assert.doesNotThrow(() => v.parse(schema, new Test()))
	})

	test("doesn't parse if value is not an instance of the given class", () => {
		class Test {}
		const schema = v.instance(Test)
		assert.throws(() => v.parse(schema, {}))
	})
})

describe("array", () => {
	test("parses if all elements match the given schema", () => {
		const schema = v.array(v.string)
		assert.doesNotThrow(() => v.parse(schema, ["one", "two"]))
	})

	test("doesn't parse if any element doesn't match the given schema", () => {
		const schema = v.array(v.string)
		assert.throws(() => v.parse(schema, ["one", 2]))
	})

	test("doesn't parse if not passed an array", () => {
		const schema = v.array(v.string)
		assert.throws(() => v.parse(schema, {0: "one", 1: "two"}))
	})
})

describe("record", () => {
	test("parses if all properties match the given schema", () => {
		const schema = v.record(v.string)
		assert.doesNotThrow(() => v.parse(schema, {a: "one", b: "two"}))
	})

	test("doesn't parse if any property doesn't match the given schema", () => {
		const schema = v.record(v.string)
		assert.throws(() => v.parse(schema, {a: "one", b: 2}))
	})

	test("doesn't parse if not passed an object", () => {
		const schema = v.record(v.string)
		assert.throws(() => v.parse(schema, ["one", "two"]))
	})
})

describe("object", () => {
	test("parses if each property matches the corresponding schema", () => {
		const schema = v.object({name: v.string, age: v.number})
		assert.doesNotThrow(() => v.parse(schema, {name: "jake", age: 34}))
	})

	test("doesn't parse if any property doesn't match the corresponding schema", () => {
		const schema = v.object({name: v.string, age: v.number})
		assert.throws(() => v.parse(schema, {name: 34, age: 34}))
		assert.throws(() => v.parse(schema, {name: "jake", age: "jake"}))
		assert.throws(() => v.parse(schema, {name: "jake"}))
	})

	test("doesn't parse if not passed an object", () => {
		const schema = v.record(v.string)
		assert.throws(() => v.parse(schema, ["one", "two"]))
	})
})

describe("custom", () => {
	test("parses if the validation function returns true", () => {
		const schema = v.custom(
			/** @returns {v is `${string}@${string}`} */
			v => typeof v === "string" && v.includes("@"),
			() => "error"
		)
		assert.doesNotThrow(() => v.parse(schema, "email@example.com"))
	})

	test("doesn't parse if the validation function returns false", () => {
		const schema = v.custom(
			/** @returns {v is `${string}@${string}`} */
			v => typeof v === "string" && v.includes("@"),
			() => "error"
		)
		assert.throws(() => v.parse(schema, "notanemail"))
	})
})

describe("union", () => {
	test("parses if value matches any of the schemas", () => {
		const schema = v.union(v.string, v.number)
		assert.doesNotThrow(() => v.parse(schema, "test"))
		assert.doesNotThrow(() => v.parse(schema, 123))
	})

	test("doesn't parse if value doesn't match any schema", () => {
		const schema = v.union(v.string, v.number)
		assert.throws(() => v.parse(schema, true))
	})

	test("works with more than two schemas", () => {
		const schema = v.union(v.string, v.number, v.boolean)
		assert.doesNotThrow(() => v.parse(schema, "test"))
		assert.doesNotThrow(() => v.parse(schema, 123))
		assert.doesNotThrow(() => v.parse(schema, true))
		assert.throws(() => v.parse(schema, null))
	})

	test("works with literal types", () => {
		const schema = v.union(v.literal("red"), v.literal("green"), v.literal("blue"))
		assert.doesNotThrow(() => v.parse(schema, "red"))
		assert.doesNotThrow(() => v.parse(schema, "green"))
		assert.doesNotThrow(() => v.parse(schema, "blue"))
		assert.throws(() => v.parse(schema, "yellow"))
	})

	test("works with complex types", () => {
		const schema = v.union(
			v.object({type: v.literal("user"), name: v.string}),
			v.object({type: v.literal("admin"), name: v.string, level: v.number})
		)
		assert.doesNotThrow(() => v.parse(schema, {type: "user", name: "jake"}))
		assert.doesNotThrow(() => v.parse(schema, {type: "admin", name: "jake", level: 5}))
	})
})

describe("intersect", () => {
	test("merges object properties", () => {
		const schema = v.intersect(v.object({name: v.string}), v.object({age: v.number}))
		const result = v.parse(schema, {name: "jake", age: 34})
		assert.equal(result.name, "jake")
		assert.equal(result.age, 34)
	})

	test("works with more than two schemas", () => {
		const schema = v.intersect(
			v.object({name: v.string}),
			v.object({age: v.number}),
			v.object({email: v.string})
		)
		const result = v.parse(schema, {name: "jake", age: 34, email: "j@e.com"})
		assert.equal(result.name, "jake")
		assert.equal(result.age, 34)
		assert.equal(result.email, "j@e.com")
	})

	test("fails if any schema in intersection fails", () => {
		const schema = v.intersect(v.object({name: v.string}), v.object({age: v.number}))
		assert.throws(() => v.parse(schema, {name: "jake"}))
		assert.throws(() => v.parse(schema, {age: 34}))
		assert.throws(() => v.parse(schema, {name: 123, age: "test"}))
	})
})

describe("optional", () => {
	test("works if the given type is undefined", () => {
		const schema = v.optional(v.string)
		assert.throws(() => v.parse(schema, 123))
		assert.doesNotThrow(() => v.parse(schema, "jake"))
		assert.doesNotThrow(() => v.parse(schema, undefined))
	})
})
