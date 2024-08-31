export type WithErrorList<T> = {
	// https://eslint.style/rules/ts/member-delimiter-style
	// eslint-disable-next-line
	errorList: string[];

	// https://eslint.style/rules/ts/member-delimiter-style
	// eslint-disable-next-line
	value: T;
};
