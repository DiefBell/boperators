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
 * Compute edit records by scanning both texts for mismatches.
 * @public
 *
 * Uses character-level comparison with anchor-based convergence:
 * identical characters are skipped, mismatches start an edit region,
 * and convergence is found by searching for a matching anchor substring
 * in the remaining text.
 */
export function computeEdits(
	original: string,
	transformed: string,
): EditRecord[] {
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
