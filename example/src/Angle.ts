export class Angle {
	public radians: number;

	constructor(radians: number) {
		this.radians = (radians % 2) * Math.PI;
	}

	public static readonly "%" = [
		/**
		 * Return a new angle where the radians are the remainder of the division.
		 */
		(angle: Angle, rads: number): Angle => new Angle(angle.radians % rads),
	] as const;

	public readonly "%=" = [
		/**
		 * Set the radians to the remainder of the division.
		 */
		function (this: Angle, rads: number): void {
			this.radians %= rads;
		},
	] as const;

	public get degrees(): number {
		return (this.radians * 180) / Math.PI;
	}
}
