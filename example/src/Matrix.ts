export class Matrix {
	public readonly rows: number;
	public readonly cols: number;
	public data: number[][];

	constructor(rows: number, cols: number, data?: number[][]) {
		this.rows = rows;
		this.cols = cols;

		if (!data) {
			this.data = Array.from({ length: rows }, () => Array(cols).fill(0));
			return;
		}

		if (data.length !== rows || data[0].length !== cols) {
			throw new Error("Matrix dimensions do not match data dimensions");
		}
		this.data = data;
	}
}
