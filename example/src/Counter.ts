export class Counter {
	public value: number;

	constructor(value: number = 0) {
		this.value = value;
	}

	public static readonly "+" = [
		/**
		 * Add two counters.
		 */
		(a: Counter, b: Counter) => new Counter(a.value + b.value),
	] as const;

	public readonly "++" = [
		/**
		 * Increment this counter's value.
		 */
		function (this: Counter): void {
			this.value++;
		},
	] as const;

	public readonly "--" = [
		/**
		 * Decrement this counter's value.
		 */
		function (this: Counter): void {
			this.value--;
		},
	] as const;

	public toString(): string {
		return `Counter(${this.value})`;
	}
}
