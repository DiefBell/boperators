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

	// Binary Vec2 + Vec2, and prefix unary +Vec2 (copy), combined on one method
	static "+"(a: Vec2, b: Vec2): Vec2;
	static "+"(a: Vec2): Vec2;
	static "+"(a: Vec2, b?: Vec2): Vec2 {
		if (b) return new Vec2(a.x + b.x, a.y + b.y);
		return new Vec2(a.x, a.y);
	}

	// Binary Vec2 - Vec2, and prefix unary -Vec2 (negate), combined on one method
	static "-"(a: Vec2, b: Vec2): Vec2;
	static "-"(a: Vec2): Vec2;
	static "-"(a: Vec2, b?: Vec2): Vec2 {
		if (b) return new Vec2(a.x - b.x, a.y - b.y);
		return new Vec2(-a.x, -a.y);
	}

	// Scalar operations
	static "*"(a: Vec2, b: number): Vec2 {
		return new Vec2(a.x * b, a.y * b);
	}

	static "/"(a: Vec2, b: number): Vec2 {
		return new Vec2(a.x / b, a.y / b);
	}

	static "%"(a: Vec2, b: number): Vec2 {
		return new Vec2(a.x % b, a.y % b);
	}

	// Component-wise exponentiation
	static "**"(a: Vec2, b: number): Vec2 {
		return new Vec2(a.x ** b, a.y ** b);
	}

	// ── Comparison (by component equality) ────────────────────────────────────

	static "=="(a: Vec2, b: Vec2): boolean {
		return a.x === b.x && a.y === b.y;
	}

	static "==="(a: Vec2, b: Vec2): boolean {
		return a.x === b.x && a.y === b.y;
	}

	static "!="(a: Vec2, b: Vec2): boolean {
		return a.x !== b.x || a.y !== b.y;
	}

	static "!=="(a: Vec2, b: Vec2): boolean {
		return a.x !== b.x || a.y !== b.y;
	}

	// Ordered comparison by squared magnitude: |a|² vs |b|²
	static "<"(a: Vec2, b: Vec2): boolean {
		return a.x * a.x + a.y * a.y < b.x * b.x + b.y * b.y;
	}

	static "<="(a: Vec2, b: Vec2): boolean {
		return a.x * a.x + a.y * a.y <= b.x * b.x + b.y * b.y;
	}

	static ">"(a: Vec2, b: Vec2): boolean {
		return a.x * a.x + a.y * a.y > b.x * b.x + b.y * b.y;
	}

	static ">="(a: Vec2, b: Vec2): boolean {
		return a.x * a.x + a.y * a.y >= b.x * b.x + b.y * b.y;
	}

	// ── Prefix unary ───────────────────────────────────────────────────────────

	// Returns true if this is the zero vector
	static "!"(a: Vec2): boolean {
		return a.x === 0 && a.y === 0;
	}

	// Left-hand perpendicular: (x, y) → (-y, x)  (90° CCW rotation)
	static "~"(a: Vec2): Vec2 {
		return new Vec2(-a.y, a.x);
	}

	// ── Compound assignment (instance methods, return void) ───────────────────

	"+="(b: Vec2): void {
		this.x += b.x;
		this.y += b.y;
	}

	"-="(b: Vec2): void {
		this.x -= b.x;
		this.y -= b.y;
	}

	"*="(b: number): void {
		this.x *= b;
		this.y *= b;
	}

	"/="(b: number): void {
		this.x /= b;
		this.y /= b;
	}

	"%="(b: number): void {
		this.x %= b;
		this.y %= b;
	}

	"**="(b: number): void {
		this.x **= b;
		this.y **= b;
	}

	// ── Postfix unary (instance methods, return void) ─────────────────────────

	"++"(): void {
		this.x++;
		this.y++;
	}

	"--"(): void {
		this.x--;
		this.y--;
	}
}
