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

	static "+"(a: Vec3, b: Vec3): Vec3 {
		return new Vec3(a.x + b.x, a.y + b.y, a.z + b.z);
	}

	// Binary Vec3 - Vec3, and prefix unary -Vec3 (negate), combined on one method
	static "-"(a: Vec3, b: Vec3): Vec3;
	static "-"(a: Vec3): Vec3;
	static "-"(a: Vec3, b?: Vec3): Vec3 {
		if (b) return new Vec3(a.x - b.x, a.y - b.y, a.z - b.z);
		return new Vec3(-a.x, -a.y, -a.z);
	}

	static "*"(a: Vec3, b: number): Vec3 {
		return new Vec3(a.x * b, a.y * b, a.z * b);
	}

	// Cross product: a × b
	static "%"(a: Vec3, b: Vec3): Vec3 {
		return new Vec3(
			a.y * b.z - a.z * b.y,
			a.z * b.x - a.x * b.z,
			a.x * b.y - a.y * b.x,
		);
	}

	// ── Comparison ─────────────────────────────────────────────────────────────

	static "=="(a: Vec3, b: Vec3): boolean {
		return a.x === b.x && a.y === b.y && a.z === b.z;
	}

	static "!="(a: Vec3, b: Vec3): boolean {
		return a.x !== b.x || a.y !== b.y || a.z !== b.z;
	}

	// ── Compound assignment (instance methods, return void) ───────────────────

	"+="(b: Vec3): void {
		this.x += b.x;
		this.y += b.y;
		this.z += b.z;
	}

	"-="(b: Vec3): void {
		this.x -= b.x;
		this.y -= b.y;
		this.z -= b.z;
	}

	"*="(b: number): void {
		this.x *= b;
		this.y *= b;
		this.z *= b;
	}

	// ── Postfix unary (instance methods, return void) ─────────────────────────

	"++"(): void {
		this.x++;
		this.y++;
		this.z++;
	}
}
