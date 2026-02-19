import { describe, expect, it } from "bun:test";
import { SyntaxKind } from "ts-morph";
import { Operator } from "../lib/operatorSymbols";
import {
	comparisonOperators,
	instanceOperators,
	isOperatorSyntaxKind,
	isPostfixUnaryOperatorSyntaxKind,
	isPrefixUnaryOperatorSyntaxKind,
	operatorMap,
} from "./operatorMap";

describe("isOperatorSyntaxKind", () => {
	it("returns true for binary operator syntax kinds", () => {
		expect(isOperatorSyntaxKind(SyntaxKind.PlusToken)).toBe(true);
		expect(isOperatorSyntaxKind(SyntaxKind.MinusToken)).toBe(true);
		expect(isOperatorSyntaxKind(SyntaxKind.AsteriskToken)).toBe(true);
		expect(isOperatorSyntaxKind(SyntaxKind.SlashToken)).toBe(true);
		expect(isOperatorSyntaxKind(SyntaxKind.GreaterThanToken)).toBe(true);
		expect(isOperatorSyntaxKind(SyntaxKind.EqualsEqualsEqualsToken)).toBe(true);
		expect(isOperatorSyntaxKind(SyntaxKind.AmpersandAmpersandToken)).toBe(true);
		expect(isOperatorSyntaxKind(SyntaxKind.QuestionQuestionToken)).toBe(true);
	});

	it("returns false for non-binary-operator syntax kinds", () => {
		expect(isOperatorSyntaxKind(SyntaxKind.OpenParenToken)).toBe(false);
		expect(isOperatorSyntaxKind(SyntaxKind.Identifier)).toBe(false);
		expect(isOperatorSyntaxKind(SyntaxKind.SemicolonToken)).toBe(false);
		expect(isOperatorSyntaxKind(SyntaxKind.ExclamationToken)).toBe(false);
	});
});

describe("isPrefixUnaryOperatorSyntaxKind", () => {
	it("returns true for prefix unary operator syntax kinds", () => {
		expect(isPrefixUnaryOperatorSyntaxKind(SyntaxKind.MinusToken)).toBe(true);
		expect(isPrefixUnaryOperatorSyntaxKind(SyntaxKind.PlusToken)).toBe(true);
		expect(isPrefixUnaryOperatorSyntaxKind(SyntaxKind.ExclamationToken)).toBe(
			true,
		);
		expect(isPrefixUnaryOperatorSyntaxKind(SyntaxKind.TildeToken)).toBe(true);
	});

	it("returns false for non-prefix-unary operator syntax kinds", () => {
		expect(isPrefixUnaryOperatorSyntaxKind(SyntaxKind.PlusPlusToken)).toBe(
			false,
		);
		expect(isPrefixUnaryOperatorSyntaxKind(SyntaxKind.OpenParenToken)).toBe(
			false,
		);
		expect(isPrefixUnaryOperatorSyntaxKind(SyntaxKind.SemicolonToken)).toBe(
			false,
		);
	});
});

describe("isPostfixUnaryOperatorSyntaxKind", () => {
	it("returns true for postfix unary operator syntax kinds", () => {
		expect(isPostfixUnaryOperatorSyntaxKind(SyntaxKind.PlusPlusToken)).toBe(
			true,
		);
		expect(isPostfixUnaryOperatorSyntaxKind(SyntaxKind.MinusMinusToken)).toBe(
			true,
		);
	});

	it("returns false for non-postfix-unary operator syntax kinds", () => {
		expect(isPostfixUnaryOperatorSyntaxKind(SyntaxKind.PlusToken)).toBe(false);
		expect(isPostfixUnaryOperatorSyntaxKind(SyntaxKind.MinusToken)).toBe(false);
		expect(isPostfixUnaryOperatorSyntaxKind(SyntaxKind.OpenParenToken)).toBe(
			false,
		);
	});
});

describe("instanceOperators", () => {
	it("includes all compound assignment operators", () => {
		expect(instanceOperators.has(operatorMap[Operator.PLUS_EQUALS])).toBe(true);
		expect(instanceOperators.has(operatorMap[Operator.MINUS_EQUALS])).toBe(
			true,
		);
		expect(instanceOperators.has(operatorMap[Operator.MULTIPLY_EQUALS])).toBe(
			true,
		);
		expect(instanceOperators.has(operatorMap[Operator.DIVIDE_EQUALS])).toBe(
			true,
		);
		expect(instanceOperators.has(operatorMap[Operator.MODULO_EQUALS])).toBe(
			true,
		);
		expect(instanceOperators.has(operatorMap[Operator.EXPONENT_EQUALS])).toBe(
			true,
		);
		expect(instanceOperators.has(operatorMap[Operator.AND_EQUALS])).toBe(true);
		expect(instanceOperators.has(operatorMap[Operator.OR_EQUALS])).toBe(true);
	});

	it("does not include regular binary operators", () => {
		expect(instanceOperators.has(operatorMap[Operator.PLUS])).toBe(false);
		expect(instanceOperators.has(operatorMap[Operator.MINUS])).toBe(false);
		expect(instanceOperators.has(operatorMap[Operator.MULTIPLY])).toBe(false);
	});
});

describe("comparisonOperators", () => {
	it("includes all comparison and equality operators", () => {
		expect(comparisonOperators.has(operatorMap[Operator.EQUALS])).toBe(true);
		expect(comparisonOperators.has(operatorMap[Operator.STRICT_EQUALS])).toBe(
			true,
		);
		expect(comparisonOperators.has(operatorMap[Operator.NOT_EQUALS])).toBe(
			true,
		);
		expect(
			comparisonOperators.has(operatorMap[Operator.STRICT_NOT_EQUALS]),
		).toBe(true);
		expect(comparisonOperators.has(operatorMap[Operator.GREATER_THAN])).toBe(
			true,
		);
		expect(
			comparisonOperators.has(operatorMap[Operator.GREATER_THAN_EQUAL_TO]),
		).toBe(true);
		expect(comparisonOperators.has(operatorMap[Operator.LESS_THAN])).toBe(true);
		expect(
			comparisonOperators.has(operatorMap[Operator.LESS_THAN_EQUAL_TO]),
		).toBe(true);
	});

	it("does not include arithmetic operators", () => {
		expect(comparisonOperators.has(operatorMap[Operator.PLUS])).toBe(false);
		expect(comparisonOperators.has(operatorMap[Operator.MINUS])).toBe(false);
		expect(comparisonOperators.has(operatorMap[Operator.MULTIPLY])).toBe(false);
	});
});
