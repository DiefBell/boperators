import { Vec3 } from "./Vec3";

/**
 * 4×4 matrix stored in column-major order.
 * m[col * 4 + row], so columns are contiguous in memory.
 *
 * Layout:
 *   col0      col1      col2      col3
 *  [m0  m4  m8   m12]
 *  [m1  m5  m9   m13]
 *  [m2  m6  m10  m14]
 *  [m3  m7  m11  m15]
 */
export class Mat4 {
	m: number[];

	constructor(m: number[]) {
		this.m = m;
	}

	/** Identity matrix. */
	static identity(): Mat4 {
		return new Mat4([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
	}

	/** Pure translation matrix. */
	static translation(tx: number, ty: number, tz: number): Mat4 {
		return new Mat4([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, tx, ty, tz, 1]);
	}

	toString(): string {
		return `Mat4([${this.m.join(",")}])`;
	}

	// ── Binary operators ───────────────────────────────────────────────────────

	static readonly "*" = [
		// [0] Mat4 × Mat4 → Mat4 (matrix multiply)
		(a: Mat4, b: Mat4): Mat4 => {
			const r = new Array<number>(16).fill(0);
			for (let col = 0; col < 4; col++) {
				for (let row = 0; row < 4; row++) {
					let sum = 0;
					for (let k = 0; k < 4; k++) {
						sum += a.m[k * 4 + row] * b.m[col * 4 + k];
					}
					r[col * 4 + row] = sum;
				}
			}
			return new Mat4(r);
		},

		// [1] Mat4 × Vec3 → Vec3 (transform point, implicit w=1)
		(a: Mat4, b: Vec3): Vec3 =>
			new Vec3(
				a.m[0] * b.x + a.m[4] * b.y + a.m[8] * b.z + a.m[12],
				a.m[1] * b.x + a.m[5] * b.y + a.m[9] * b.z + a.m[13],
				a.m[2] * b.x + a.m[6] * b.y + a.m[10] * b.z + a.m[14],
			),
	] as const;

	// ── Comparison ─────────────────────────────────────────────────────────────

	static readonly "==" = [
		(a: Mat4, b: Mat4): boolean => a.m.every((v, i) => v === b.m[i]),
	] as const;

	static readonly "!=" = [
		(a: Mat4, b: Mat4): boolean => !a.m.every((v, i) => v === b.m[i]),
	] as const;
}
