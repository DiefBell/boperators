export class Vec3 {
	x: number;
	y: number;
	z: number;

	constructor(x: number, y: number, z: number) {
		this.x = x;
		this.y = y;
		this.z = z;
	}

	toString(): string {
		return `Vec3(${this.x}, ${this.y}, ${this.z})`;
	}

	// ── Binary arithmetic ──────────────────────────────────────────────────────

	static readonly "+" = [
		(a: Vec3, b: Vec3): Vec3 => new Vec3(a.x + b.x, a.y + b.y, a.z + b.z),
	] as const;

	// [0] Vec3 - Vec3  [1] -Vec3 (negate)
	static readonly "-" = [
		(a: Vec3, b: Vec3): Vec3 => new Vec3(a.x - b.x, a.y - b.y, a.z - b.z),
		(a: Vec3): Vec3 => new Vec3(-a.x, -a.y, -a.z),
	] as const;

	static readonly "*" = [
		(a: Vec3, b: number): Vec3 => new Vec3(a.x * b, a.y * b, a.z * b),
	] as const;

	// Cross product: a × b
	static readonly "%" = [
		(a: Vec3, b: Vec3): Vec3 =>
			new Vec3(
				a.y * b.z - a.z * b.y,
				a.z * b.x - a.x * b.z,
				a.x * b.y - a.y * b.x,
			),
	] as const;

	// ── Comparison ─────────────────────────────────────────────────────────────

	static readonly "==" = [
		(a: Vec3, b: Vec3): boolean => a.x === b.x && a.y === b.y && a.z === b.z,
	] as const;

	static readonly "!=" = [
		(a: Vec3, b: Vec3): boolean => a.x !== b.x || a.y !== b.y || a.z !== b.z,
	] as const;

	// ── Compound assignment (instance, function expressions, return void) ──────

	readonly "+=" = [
		function (this: Vec3, b: Vec3): void {
			this.x += b.x;
			this.y += b.y;
			this.z += b.z;
		},
	] as const;

	readonly "-=" = [
		function (this: Vec3, b: Vec3): void {
			this.x -= b.x;
			this.y -= b.y;
			this.z -= b.z;
		},
	] as const;

	readonly "*=" = [
		function (this: Vec3, b: number): void {
			this.x *= b;
			this.y *= b;
			this.z *= b;
		},
	] as const;

	// ── Postfix unary (instance, function expressions, return void) ───────────

	readonly "++" = [
		function (this: Vec3): void {
			this.x++;
			this.y++;
			this.z++;
		},
	] as const;
}
