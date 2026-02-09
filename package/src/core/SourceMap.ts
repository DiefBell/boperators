export type EditRecord = {
	/** Start position in the original source */
	origStart: number;
	/** End position (exclusive) in the original source */
	origEnd: number;
	/** Start position in the transformed source */
	transStart: number;
	/** End position (exclusive) in the transformed source */
	transEnd: number;
};

/**
 * Bidirectional position mapping between original and transformed source text.
 *
 * Computes a list of edit records by diffing the two texts, then provides
 * O(edits) position and span mapping in both directions.
 */
export class SourceMap {
	public readonly edits: readonly EditRecord[];

	constructor(original: string, transformed: string) {
		this.edits = computeEdits(original, transformed);
	}

	/** Returns true if no edits were detected (original === transformed). */
	public get isEmpty(): boolean {
		return this.edits.length === 0;
	}

	/** Map a position from original source to transformed source. */
	public originalToTransformed(pos: number): number {
		let delta = 0;
		for (const edit of this.edits) {
			if (pos < edit.origStart) {
				// Before this edit — just apply accumulated delta
				break;
			}

			if (pos < edit.origEnd) {
				// Inside an edited region — map to start of the transformed replacement
				return edit.transStart;
			}

			// Past this edit — accumulate the delta
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
				// Inside a transformed region — map to start of the original span
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

/**
 * Compute edit records by scanning both texts for mismatches.
 *
 * Uses character-level comparison with anchor-based convergence:
 * identical characters are skipped, mismatches start an edit region,
 * and convergence is found by searching for a matching anchor substring
 * in the remaining text.
 */
function computeEdits(original: string, transformed: string): EditRecord[] {
	if (original === transformed) return [];

	const edits: EditRecord[] = [];
	let i = 0; // index in original
	let j = 0; // index in transformed

	while (i < original.length && j < transformed.length) {
		// Skip matching characters
		if (original[i] === transformed[j]) {
			i++;
			j++;
			continue;
		}

		// Mismatch — start of an edit
		const origEditStart = i;
		const transEditStart = j;

		// Find where the texts converge again.
		// Search for an anchor: a substring from `original` that also
		// appears at the corresponding position in `transformed`.
		const ANCHOR_LEN = 8;
		let found = false;

		// Scan ahead in original from the mismatch point
		for (let oi = origEditStart + 1; oi <= original.length - ANCHOR_LEN; oi++) {
			const anchor = original.substring(oi, oi + ANCHOR_LEN);
			const transPos = transformed.indexOf(anchor, transEditStart);
			if (transPos >= 0) {
				// Verify the anchor actually converges by checking a few more chars
				let valid = true;
				const verifyLen = Math.min(
					ANCHOR_LEN * 2,
					original.length - oi,
					transformed.length - transPos,
				);
				for (let k = ANCHOR_LEN; k < verifyLen; k++) {
					if (original[oi + k] !== transformed[transPos + k]) {
						valid = false;
						break;
					}
				}

				if (valid) {
					edits.push({
						origStart: origEditStart,
						origEnd: oi,
						transStart: transEditStart,
						transEnd: transPos,
					});
					i = oi;
					j = transPos;
					found = true;
					break;
				}
			}
		}

		if (!found) {
			// No convergence — remaining text is all part of the edit.
			// Use common suffix to tighten the bounds.
			let suffixLen = 0;
			while (
				suffixLen < original.length - origEditStart &&
				suffixLen < transformed.length - transEditStart &&
				original[original.length - 1 - suffixLen] ===
					transformed[transformed.length - 1 - suffixLen]
			) {
				suffixLen++;
			}

			edits.push({
				origStart: origEditStart,
				origEnd: original.length - suffixLen,
				transStart: transEditStart,
				transEnd: transformed.length - suffixLen,
			});
			i = original.length;
			j = transformed.length;
		}
	}

	// Handle remaining text at the end
	if (i < original.length || j < transformed.length) {
		edits.push({
			origStart: i,
			origEnd: original.length,
			transStart: j,
			transEnd: transformed.length,
		});
	}

	return edits;
}
