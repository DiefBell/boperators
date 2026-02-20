export class Vec2 {
	x: number;
	y: number;

	constructor(x: number, y: number) {
		this.x = x;
		this.y = y;
	}

	toString(): string {
		return `Vec2(${this.x}, ${this.y})`;
	}

	// ── Binary arithmetic ──────────────────────────────────────────────────────

	// [0] Vec2 + Vec2  [1] +Vec2 (copy)
	static readonly "+" = [
		(a: Vec2, b: Vec2): Vec2 => new Vec2(a.x + b.x, a.y + b.y),
		(a: Vec2): Vec2 => new Vec2(a.x, a.y),
	] as const;

	// [0] Vec2 - Vec2  [1] -Vec2 (negate)
	static readonly "-" = [
		(a: Vec2, b: Vec2): Vec2 => new Vec2(a.x - b.x, a.y - b.y),
		(a: Vec2): Vec2 => new Vec2(-a.x, -a.y),
	] as const;

	// Scalar operations
	static readonly "*" = [
		(a: Vec2, b: number): Vec2 => new Vec2(a.x * b, a.y * b),
	] as const;

	static readonly "/" = [
		(a: Vec2, b: number): Vec2 => new Vec2(a.x / b, a.y / b),
	] as const;

	static readonly "%" = [
		(a: Vec2, b: number): Vec2 => new Vec2(a.x % b, a.y % b),
	] as const;

	// Component-wise exponentiation
	static readonly "**" = [
		(a: Vec2, b: number): Vec2 => new Vec2(a.x ** b, a.y ** b),
	] as const;

	// ── Comparison (by component equality) ────────────────────────────────────

	static readonly "==" = [
		(a: Vec2, b: Vec2): boolean => a.x === b.x && a.y === b.y,
	] as const;

	static readonly "===" = [
		(a: Vec2, b: Vec2): boolean => a.x === b.x && a.y === b.y,
	] as const;

	static readonly "!=" = [
		(a: Vec2, b: Vec2): boolean => a.x !== b.x || a.y !== b.y,
	] as const;

	static readonly "!==" = [
		(a: Vec2, b: Vec2): boolean => a.x !== b.x || a.y !== b.y,
	] as const;

	// Ordered comparison by squared magnitude: |a|² vs |b|²
	static readonly "<" = [
		(a: Vec2, b: Vec2): boolean =>
			a.x * a.x + a.y * a.y < b.x * b.x + b.y * b.y,
	] as const;

	static readonly "<=" = [
		(a: Vec2, b: Vec2): boolean =>
			a.x * a.x + a.y * a.y <= b.x * b.x + b.y * b.y,
	] as const;

	static readonly ">" = [
		(a: Vec2, b: Vec2): boolean =>
			a.x * a.x + a.y * a.y > b.x * b.x + b.y * b.y,
	] as const;

	static readonly ">=" = [
		(a: Vec2, b: Vec2): boolean =>
			a.x * a.x + a.y * a.y >= b.x * b.x + b.y * b.y,
	] as const;

	// ── Prefix unary ───────────────────────────────────────────────────────────

	// Returns true if this is the zero vector
	static readonly "!" = [(a: Vec2): boolean => a.x === 0 && a.y === 0] as const;

	// Left-hand perpendicular: (x, y) → (-y, x)  (90° CCW rotation)
	static readonly "~" = [(a: Vec2): Vec2 => new Vec2(-a.y, a.x)] as const;

	// ── Compound assignment (instance, function expressions, return void) ──────

	readonly "+=" = [
		function (this: Vec2, b: Vec2): void {
			this.x += b.x;
			this.y += b.y;
		},
	] as const;

	readonly "-=" = [
		function (this: Vec2, b: Vec2): void {
			this.x -= b.x;
			this.y -= b.y;
		},
	] as const;

	readonly "*=" = [
		function (this: Vec2, b: number): void {
			this.x *= b;
			this.y *= b;
		},
	] as const;

	readonly "/=" = [
		function (this: Vec2, b: number): void {
			this.x /= b;
			this.y /= b;
		},
	] as const;

	readonly "%=" = [
		function (this: Vec2, b: number): void {
			this.x %= b;
			this.y %= b;
		},
	] as const;

	readonly "**=" = [
		function (this: Vec2, b: number): void {
			this.x **= b;
			this.y **= b;
		},
	] as const;

	// ── Postfix unary (instance, function expressions, return void) ───────────

	readonly "++" = [
		function (this: Vec2): void {
			this.x++;
			this.y++;
		},
	] as const;

	readonly "--" = [
		function (this: Vec2): void {
			this.x--;
			this.y--;
		},
	] as const;
}
