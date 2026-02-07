import { IN } from "boperators";

export class Matrix
{
	public readonly rows: number;
	public readonly cols: number;
	public data: number[][];

	constructor(rows: number, cols: number, data?: number[][])
	{
		this.rows = rows;
		this.cols = cols;

		if (!data)
		{
			this.data = Array.from({ length: rows }, () => Array(cols).fill(0));
			return;
		}

		if (data.length !== rows || data[0].length !== cols)
		{
			throw new Error("Matrix dimensions do not match data dimensions");
		}
		this.data = data;
	}

	public readonly [IN] = [
		/**
		 * Check if a value exists in the matrix.
		 */
		(value: number): boolean =>
		{
			for (let row = 0; row < this.rows; row++)
			{
				for (let col = 0; col < this.cols; col++)
				{
					if (this.data[row][col] === value)
					{
						return true;
					}
				}
			}

			return false;
		},
		/**
		 * Check if a row or column exists in the matrix.
		 */
		(rowOrCol: number[]): boolean =>
		{
			if (rowOrCol.length !== this.cols)
			{
				return false;
			}

			// check for matching rows
			for (let rowIndex = 0; rowIndex < this.rows; rowIndex++)
			{
				if (this.data[rowIndex].every((value, colIndex) => value === rowOrCol[colIndex]))
				{
					return true;
				}
			}

			for (let colIndex = 0; colIndex < this.cols; colIndex++)
			{
				if (this.data.every((rowIndex) => rowIndex[colIndex] === rowOrCol[colIndex]))
				{
					return true;
				}
			}

			return false;
		},
	];
}
