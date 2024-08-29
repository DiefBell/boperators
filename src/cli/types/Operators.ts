export enum Operators
{
	ADD = "ADD",
	SUBTRACT = "SUBTRACT",
	MULTIPLY = "MULTIPLY",
	DIVIDE = "DIVIDE",
}

export type OperatorName = keyof typeof Operators;
export const operators = Object.keys(Operators);
