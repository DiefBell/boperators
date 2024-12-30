import * as path from "path";

export class ErrorDescription
{
	public readonly fileName: string;

	constructor(
		public readonly errorMessage: string,
		public readonly filePath: string,
		public readonly lineNumber: number,
		public readonly codeText: string,
	)
	{
		this.fileName = path.basename(filePath);
	}

	public toString()
	{
		return `${this.fileName}:${this.lineNumber}: ${this.errorMessage}\n${this.codeText}\n`;
	}
}

export class ErrorManager
{
	private _warnings: (ErrorDescription | string)[] = [];
	private _errors: (ErrorDescription | string)[] = [];
	private readonly _errorOnWarning: boolean;

	constructor(errorOnWarning: boolean)
	{
		this._errorOnWarning = errorOnWarning;
	}

	public addWarning(description: ErrorDescription | string): void
	{
		this._warnings.push(description);
	}

	public addError(description: ErrorDescription | string): void
	{
		this._errors.push(description);
	}

	public getWarningString(): string
	{
		return this._warnings.map((warning) => warning.toString()).join("\n");
	}

	public getErrorsString(): string
	{
		return this._errors.map((error) => error.toString()).join("\n");
	}

	public throwIfErrors(): void
	{
		const shouldThrow = this._errors.length > 0 || (this._errorOnWarning && this._warnings.length > 0);
		if (!shouldThrow) return;

		const errorString = this.getErrorsString() + this._errorOnWarning ? this.getWarningString() : "";
		throw new Error(errorString);
	}

	public throwIfErrorsElseLogWarnings(): void
	{
		this.throwIfErrors();
		if (this._warnings.length > 0)
		{
			console.warn(this.getWarningString());
		}
	}
}
