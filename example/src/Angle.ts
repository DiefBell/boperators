import { MODULO, MODULO_EQUALS } from "boperators";

export class Angle
{
	public radians: number;

	constructor(radians: number)
	{
		this.radians = radians % 2 * Math.PI;
	}

	public static readonly [MODULO] = [
		/**
		 * Return a new angle where the radians are the remainder of the division.
		 */
		function (angle: Angle, rads: number): Angle
		{
			return new Angle(angle.radians % rads);
		},
	];

	public readonly [MODULO_EQUALS] = [
		/**
		 * Set the radians to the remainder of the division.
		 */
		function (this: Angle, rads: number): void
		{
			this.radians %= rads;
		},
	];

	public get degrees(): number
	{
		return this.radians * 180 / Math.PI;
	}
}
