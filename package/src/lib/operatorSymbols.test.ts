import { describe, expect, it } from "bun:test";
import { Operator, operatorSymbols } from "./operatorSymbols";

describe("Operator enum", () => {
	it("has correct string values for arithmetic operators", () => {
		expect(Operator.PLUS).toBe("+");
		expect(Operator.MINUS).toBe("-");
		expect(Operator.MULTIPLY).toBe("*");
		expect(Operator.DIVIDE).toBe("/");
		expect(Operator.MODULO).toBe("%");
		expect(Operator.EXPONENT).toBe("**");
	});

	it("has correct string values for compound assignment operators", () => {
		expect(Operator.PLUS_EQUALS).toBe("+=");
		expect(Operator.MINUS_EQUALS).toBe("-=");
		expect(Operator.MULTIPLY_EQUALS).toBe("*=");
		expect(Operator.DIVIDE_EQUALS).toBe("/=");
		expect(Operator.MODULO_EQUALS).toBe("%=");
		expect(Operator.EXPONENT_EQUALS).toBe("**=");
	});

	it("has correct string values for comparison operators", () => {
		expect(Operator.EQUALS).toBe("==");
		expect(Operator.STRICT_EQUALS).toBe("===");
		expect(Operator.NOT_EQUALS).toBe("!=");
		expect(Operator.STRICT_NOT_EQUALS).toBe("!==");
		expect(Operator.GREATER_THAN).toBe(">");
		expect(Operator.GREATER_THAN_EQUAL_TO).toBe(">=");
		expect(Operator.LESS_THAN).toBe("<");
		expect(Operator.LESS_THAN_EQUAL_TO).toBe("<=");
	});

	it("has correct string values for logical operators", () => {
		expect(Operator.AND).toBe("&&");
		expect(Operator.AND_EQUALS).toBe("&&=");
		expect(Operator.OR).toBe("||");
		expect(Operator.OR_EQUALS).toBe("||=");
		expect(Operator.NULLISH).toBe("??");
	});

	it("has correct string values for unary operators", () => {
		expect(Operator.NOT).toBe("!");
		expect(Operator.BITWISE_NOT).toBe("~");
		expect(Operator.INCREMENT).toBe("++");
		expect(Operator.DECREMENT).toBe("--");
	});
});

describe("operatorSymbols", () => {
	it("contains every Operator enum value", () => {
		for (const value of Object.values(Operator)) {
			expect(operatorSymbols).toContain(value);
		}
	});

	it("has the same length as the number of Operator enum members", () => {
		expect(operatorSymbols).toHaveLength(Object.values(Operator).length);
	});
});
