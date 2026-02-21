import { Vec2 } from "./Vec2";

/**
 * Vec2 subclass that carries a color label.
 * Used to test operator overload inheritance:
 *   - `+` is overridden to produce a ColoredVec2 with a blended label
 *   - all other operators fall back to Vec2's overloads via the type chain
 */
export class ColoredVec2 extends Vec2 {
	color: string;

	constructor(x: number, y: number, color: string) {
		super(x, y);
		this.color = color;
	}

	toString(): string {
		return `ColoredVec2(${this.x}, ${this.y}, ${this.color})`;
	}

	// Override + to return a ColoredVec2 with a blended color label
	static readonly "+" = [
		(a: ColoredVec2, b: ColoredVec2): ColoredVec2 =>
			new ColoredVec2(a.x + b.x, a.y + b.y, `${a.color}+${b.color}`),
	] as const;
}
