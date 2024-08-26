
export type OperatorOverride = {
	leftType: new (...args: unknown[]) => unknown;
	rightType: new (...args: unknown[]) => unknown;
	func: (a: unknown, b: unknown) => unknown;
};
