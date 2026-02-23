export class Vec2 {
	constructor(
		public x: number,
		public y: number,
	) {}

	static "+"(a: Vec2, b: Vec2): Vec2 {
		return new Vec2(a.x + b.x, a.y + b.y);
	}

	// Multiple type overloads for the same operator:
	// boperators dispatches Vec2 * Vec2 and Vec2 * number to separate implementations.
	static "*"(a: Vec2, b: Vec2): Vec2;
	static "*"(a: Vec2, b: number): Vec2;
	static "*"(a: Vec2, b: Vec2 | number): Vec2 {
		if (b instanceof Vec2) return new Vec2(a.x * b.x, a.y * b.y);
		return new Vec2(a.x * b, a.y * b);
	}

	toString(): string {
		return `Vec2(${this.x}, ${this.y})`;
	}
}
