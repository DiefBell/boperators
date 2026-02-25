/**
 * A minimal generic container used to exercise operator overloads on generic
 * classes. The parameter types are intentionally written as bare `Wrapper`
 * (without `<T>`) — the form users will most commonly write. boperators must
 * match this against the class type `Wrapper<T>` and still register the
 * overload correctly.
 */
export class Wrapper<T> {
	constructor(public readonly value: T) {}

	toString(): string {
		return `Wrapper(${String(this.value)})`;
	}

	static "+"(a: Wrapper<unknown>, b: Wrapper<unknown>): Wrapper<string> {
		return new Wrapper(`${String(a.value)}+${String(b.value)}`);
	}
}
