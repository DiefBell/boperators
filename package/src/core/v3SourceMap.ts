import type { EditRecord } from "./SourceMap";

/**
 * Standard V3 source map object.
 * @see https://sourcemaps.info/spec.html
 */
export interface V3SourceMap {
	version: 3;
	sources: string[];
	names: string[];
	sourceRoot?: string;
	sourcesContent?: string[];
	mappings: string;
	file: string;
}

/**
 * Convert boperators EditRecord[] into a V3 source map.
 *
 * Generates line-level mappings: unchanged regions map 1:1, and edit
 * boundaries map back to the start of the original edit region.
 */
export function toV3SourceMap(
	edits: readonly EditRecord[],
	originalText: string,
	transformedText: string,
	fileName: string,
): V3SourceMap {
	const origLineStarts = buildLineStarts(originalText);
	const transLineStarts = buildLineStarts(transformedText);

	// Each segment is [transCol, sourceIndex, origLine, origCol]
	// We only have one source (index 0), so sourceIndex is always 0.
	const mappingLines: number[][][] = [];
	const transLineCount = transLineStarts.length;

	// Initialise empty lines
	for (let i = 0; i < transLineCount; i++) {
		mappingLines.push([]);
	}

	// For positions outside any edit, the mapping is identity + accumulated delta.
	// For positions inside an edit's transformed region, map to the original edit start.
	// We generate one segment per transformed line start.
	for (let transLine = 0; transLine < transLineCount; transLine++) {
		const transOffset = transLineStarts[transLine];
		const origOffset = transformedToOriginal(edits, transOffset);
		const { line: origLine, col: origCol } = offsetToLineCol(
			origLineStarts,
			origOffset,
		);
		mappingLines[transLine].push([0, 0, origLine, origCol]);
	}

	return {
		version: 3,
		file: fileName,
		sources: [fileName],
		sourcesContent: [originalText],
		names: [],
		mappings: encodeMappings(mappingLines),
	};
}

/** Map a transformed-source offset back to the original source. */
function transformedToOriginal(
	edits: readonly EditRecord[],
	pos: number,
): number {
	let delta = 0;
	for (const edit of edits) {
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

/** Build an array where index i is the character offset of line i. */
function buildLineStarts(text: string): number[] {
	const starts = [0];
	for (let i = 0; i < text.length; i++) {
		if (text[i] === "\n") {
			starts.push(i + 1);
		}
	}
	return starts;
}

/** Convert a character offset to 0-based line and column. */
function offsetToLineCol(
	lineStarts: number[],
	offset: number,
): { line: number; col: number } {
	// Binary search for the line containing this offset
	let lo = 0;
	let hi = lineStarts.length - 1;
	while (lo < hi) {
		const mid = (lo + hi + 1) >>> 1;
		if (lineStarts[mid] <= offset) {
			lo = mid;
		} else {
			hi = mid - 1;
		}
	}
	return { line: lo, col: offset - lineStarts[lo] };
}

/** Encode segment arrays into a VLQ mappings string. */
function encodeMappings(lines: number[][][]): string {
	let prevTransCol = 0;
	let prevOrigLine = 0;
	let prevOrigCol = 0;
	let prevSourceIdx = 0;

	const lineStrings: string[] = [];

	for (const segments of lines) {
		prevTransCol = 0; // reset column tracking per line
		const segStrings: string[] = [];

		for (const seg of segments) {
			const [transCol, sourceIdx, origLine, origCol] = seg;
			segStrings.push(
				encodeVLQ(transCol - prevTransCol) +
					encodeVLQ(sourceIdx - prevSourceIdx) +
					encodeVLQ(origLine - prevOrigLine) +
					encodeVLQ(origCol - prevOrigCol),
			);
			prevTransCol = transCol;
			prevSourceIdx = sourceIdx;
			prevOrigLine = origLine;
			prevOrigCol = origCol;
		}

		lineStrings.push(segStrings.join(","));
	}

	return lineStrings.join(";");
}

const VLQ_BASE = 32;
const VLQ_BASE_MASK = VLQ_BASE - 1;
const VLQ_CONTINUATION = VLQ_BASE;
const BASE64_CHARS =
	"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

/** Encode a single integer as a VLQ base64 string. */
function encodeVLQ(value: number): string {
	let vlq = value < 0 ? (-value << 1) | 1 : value << 1;
	let result = "";
	do {
		let digit = vlq & VLQ_BASE_MASK;
		vlq >>>= 5;
		if (vlq > 0) {
			digit |= VLQ_CONTINUATION;
		}
		result += BASE64_CHARS[digit];
	} while (vlq > 0);
	return result;
}
