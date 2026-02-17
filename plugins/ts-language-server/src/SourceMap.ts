import type { EditRecord } from "boperators";

/**
 * Bidirectional position mapping between original and transformed source text.
 *
 * Wraps pre-computed edit records and provides O(edits) position and span
 * mapping in both directions, for use by the language service proxy.
 */
export class SourceMap {
	constructor(public readonly edits: readonly EditRecord[]) {}

	/** Returns true if no edits were detected (original === transformed). */
	public get isEmpty(): boolean {
		return this.edits.length === 0;
	}

	/** Map a position from original source to transformed source. */
	public originalToTransformed(pos: number): number {
		let delta = 0;
		for (const edit of this.edits) {
			if (pos < edit.origStart) {
				break;
			}

			if (pos < edit.origEnd) {
				return edit.transStart;
			}

			delta = edit.transEnd - edit.origEnd;
		}
		return pos + delta;
	}

	/** Map a position from transformed source to original source. */
	public transformedToOriginal(pos: number): number {
		let delta = 0;
		for (const edit of this.edits) {
			if (pos < edit.transStart) {
				break;
			}

			if (pos < edit.transEnd) {
				return edit.origStart;
			}

			delta = edit.origEnd - edit.transEnd;
		}
		return pos + delta;
	}

	/** Map a text span { start, length } from transformed positions to original positions. */
	public remapSpan(span: { start: number; length: number }): {
		start: number;
		length: number;
	} {
		const origStart = this.transformedToOriginal(span.start);
		const origEnd = this.transformedToOriginal(span.start + span.length);
		return { start: origStart, length: origEnd - origStart };
	}

	/** Check if an original-source position falls inside an edited region. */
	public isInsideEdit(originalPos: number): boolean {
		for (const edit of this.edits) {
			if (originalPos < edit.origStart) return false;
			if (originalPos < edit.origEnd) return true;
		}
		return false;
	}

	/**
	 * For a position inside an edited region (in original coords),
	 * return the EditRecord it falls in, or undefined.
	 */
	public getEditAt(originalPos: number): EditRecord | undefined {
		for (const edit of this.edits) {
			if (originalPos < edit.origStart) return undefined;
			if (originalPos < edit.origEnd) return edit;
		}
		return undefined;
	}
}
