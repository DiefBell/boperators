import path from "path";

/**
 * Stores information about an error or warning for later use.
 */
export class ErrorDescription
{
	/**
	 * The base filename where the error occurred,
	 * so we don't need the entire filepath.
	 */
	public readonly fileName: string;

	/**
	 * Create an ErrorDescription.
	 *
	 * @param errorMessage Custom message text describing the error.
	 * @param filePath Error file path.
	 * @param lineNumber Error line number in its file.
	 * @param codeText Code relevant to the error.q
	 */
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

/**
 * Stores errors and warnings in a way that means
 * they can be logged or thrown at a later point.
 */
export class ErrorManager
{
	/**
	 * Array of warnings.
	 */
	private _warnings: (ErrorDescription | string)[] = [];

	/**
	 * Array of errors.
	 */
	private _errors: (ErrorDescription | string)[] = [];

	/**
	 * Whether or not warnings will cause this to throw.
	 */
	private readonly _errorOnWarning: boolean;

	constructor(errorOnWarning: boolean)
	{
		this._errorOnWarning = errorOnWarning;
	}

	/**
	 * Add an ErrorDescription or a string as a "warning",
	 * meaning it will not throw unless `errorOnWarning` is true.
	 * @param description Either a string describing the error or a {@link ErrorDescription} instance.
	 */
	public addWarning(description: ErrorDescription | string): void
	{
		this._warnings.push(description);
	}

	/**
	 * Add an ErrorDescription or a string as an "error",
	 * meaning it will throw when checked.
	 * @param description Either a string describing the error or a {@link ErrorDescription} instance.
	 */
	public addError(description: ErrorDescription | string): void
	{
		this._errors.push(description);
	}

	/**
	 * Gets all warnings as a single string, separated by newlines.
	 * @returns String of all warnings.
	 */
	public getWarningString(): string
	{
		return this._warnings.map((warning) => warning.toString()).join("\n");
	}

	/**
	 * Gets all errors as a single string, separated by newlines.
	 * @returns String of all errors.
	 */
	public getErrorsString(): string
	{
		return this._errors.map((error) => error.toString()).join("\n");
	}

	/**
	 * Throws if there are any errors currently registered in the ErrorManager.
	 * If `errorOnWarning` is true then it will also throw if there are warnings.
	 */
	public throwIfErrors(): void
	{
		const shouldThrow = this._errors.length > 0 || (this._errorOnWarning && this._warnings.length > 0);
		if (!shouldThrow) return;

		const errorString = this.getErrorsString() + (this._errorOnWarning ? this.getWarningString() : "");
		throw new Error(errorString);
	}

	/**
	 * Will throw if there are any errors, or if there are warnings and `errorOnWarning` is true.
	 * If it does not throw then it will log all wanrnings to the console.
	 * @param clearSelf If true, all warnings will be cleared after logging.
	 */
	public throwIfErrorsElseLogWarnings(clearSelf: boolean = true): void
	{
		this.throwIfErrors();
		if (this._warnings.length > 0)
		{
			console.warn(this.getWarningString());
		}

		if (clearSelf)
		{
			this.clearWarnings();
		}
	}

	/**
	 * Clear out registered warnings to prevent duplicate logging.
	 */
	public clearWarnings(): void
	{
		this._warnings = [];
	}
}
