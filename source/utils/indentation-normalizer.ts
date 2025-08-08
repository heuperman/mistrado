export type IndentationType = {
	type: 'spaces' | 'tabs' | 'mixed' | 'none';
	size: number; // For spaces, typically 2, 4, or 8
};

export type NormalizationResult = {
	normalizedOldString: string;
	normalizedNewString: string;
	wasNormalized: boolean;
	details?: string;
};

/**
 * Detects the indentation method used in a file's content
 * @param content - The file content to analyze
 * @returns IndentationType with detected method and size
 */
export function detectIndentation(content: string): IndentationType {
	if (!content || content.trim() === '') {
		return {type: 'none', size: 0};
	}

	const lines = content.split('\n');
	const spaceCounts: number[] = [];
	const tabCounts: number[] = [];
	let mixedLines = 0;

	// Analyze first 100 lines or all lines if fewer
	const linesToAnalyze = Math.min(lines.length, 100);

	for (let i = 0; i < linesToAnalyze; i++) {
		const line = lines[i];
		if (!line || line.trim() === '') continue; // Skip empty lines

		const spacesMatch = /^( *)/.exec(line);
		const tabsMatch = /^(\t*)/.exec(line);
		const leadingSpaces = spacesMatch?.[1]?.length ?? 0;
		const leadingTabs = tabsMatch?.[1]?.length ?? 0;

		// Check if line has mixed indentation
		if (leadingSpaces > 0 && leadingTabs > 0) {
			mixedLines++;
		} else if (leadingSpaces > 0) {
			spaceCounts.push(leadingSpaces);
		} else if (leadingTabs > 0) {
			tabCounts.push(leadingTabs);
		}
	}

	// If significant mixed indentation, return mixed type
	if (mixedLines > linesToAnalyze * 0.1) {
		return {type: 'mixed', size: 0};
	}

	// Determine predominant indentation type
	if (tabCounts.length > spaceCounts.length) {
		return {type: 'tabs', size: 1}; // Tab size is always 1
	}

	if (spaceCounts.length === 0) {
		return {type: 'none', size: 0};
	}

	// For spaces, detect the most common indentation size
	const spaceSize = detectSpaceSize(spaceCounts);
	return {type: 'spaces', size: spaceSize};
}

/**
 * Detects the most common space indentation size
 * @param spaceCounts - Array of leading space counts
 * @returns The detected space size (2, 4, 8, or calculated)
 */
function detectSpaceSize(spaceCounts: number[]): number {
	if (spaceCounts.length === 0) return 4; // Default fallback

	// Find the GCD of non-zero space counts to detect unit size
	const nonZeroCounts = spaceCounts.filter(count => count > 0);
	if (nonZeroCounts.length === 0) return 4;

	let gcd = nonZeroCounts[0]!;
	for (let i = 1; i < nonZeroCounts.length; i++) {
		gcd = calculateGcd(gcd, nonZeroCounts[i]!);
		if (gcd === 1) break; // No common divisor, likely mixed
	}

	// Prefer common indentation sizes
	if (gcd === 2 || gcd === 4 || gcd === 8) {
		return gcd;
	}

	// Fallback: check for common patterns
	const commonSizes = [2, 4, 8];
	for (const size of commonSizes) {
		const matches = spaceCounts.filter(count => count % size === 0).length;
		if (matches > spaceCounts.length * 0.7) {
			return size;
		}
	}

	return gcd && gcd > 0 ? gcd : 4; // Final fallback
}

/**
 * Calculates the Greatest Common Divisor of two numbers
 */
function calculateGcd(a: number, b: number): number {
	return b === 0 ? a : calculateGcd(b, a % b);
}

/**
 * Normalizes indentation in oldString and newString to match the target file
 * @param oldString - The string to find in the file
 * @param newString - The string to replace it with
 * @param fileContent - The target file's content
 * @returns NormalizationResult with normalized strings and metadata
 */
export function normalizeIndentation(
	oldString: string,
	newString: string,
	fileContent: string,
): NormalizationResult {
	// Detect indentation types
	const fileIndentation = detectIndentation(fileContent);
	const oldStringIndentation = detectIndentation(oldString);
	const newStringIndentation = detectIndentation(newString);

	// If file has no indentation, return unchanged
	if (fileIndentation.type === 'none') {
		return {
			normalizedOldString: oldString,
			normalizedNewString: newString,
			wasNormalized: false,
		};
	}

	let normalizedOld = oldString;
	let normalizedNew = newString;
	let wasNormalized = false;
	const details: string[] = [];

	// Normalize oldString if needed
	if (needsNormalization(oldStringIndentation, fileIndentation)) {
		normalizedOld = convertIndentation(
			oldString,
			oldStringIndentation,
			fileIndentation,
		);
		wasNormalized = true;
		details.push(
			`oldString: converted from ${oldStringIndentation.type}(${oldStringIndentation.size}) to ${fileIndentation.type}(${fileIndentation.size})`,
		);
	}

	// Normalize newString if needed
	if (needsNormalization(newStringIndentation, fileIndentation)) {
		normalizedNew = convertIndentation(
			newString,
			newStringIndentation,
			fileIndentation,
		);
		wasNormalized = true;
		details.push(
			`newString: converted from ${newStringIndentation.type}(${newStringIndentation.size}) to ${fileIndentation.type}(${fileIndentation.size})`,
		);
	}

	return {
		normalizedOldString: normalizedOld,
		normalizedNewString: normalizedNew,
		wasNormalized,
		details: details.length > 0 ? details.join('; ') : undefined,
	};
}

/**
 * Determines if normalization is needed between two indentation types
 */
function needsNormalization(
	sourceType: IndentationType,
	targetType: IndentationType,
): boolean {
	// No normalization needed if source has no indentation
	if (sourceType.type === 'none') return false;

	// Normalization needed if types differ
	if (sourceType.type !== targetType.type) return true;

	// For spaces, normalization needed if sizes differ
	if (sourceType.type === 'spaces' && sourceType.size !== targetType.size)
		return true;

	return false;
}

/**
 * Converts text from one indentation type to another
 * @param text - The text to convert
 * @param fromType - Source indentation type
 * @param toType - Target indentation type
 * @returns Converted text
 */
export function convertIndentation(
	text: string,
	fromType: IndentationType,
	toType: IndentationType,
): string {
	if (!needsNormalization(fromType, toType)) {
		return text;
	}

	const lines = text.split('\n');
	const convertedLines = lines.map(line => {
		if (line.trim() === '') return line; // Preserve empty lines

		// Extract leading indentation and rest of line
		const leadingMatch = /^(\s*)(.*)/.exec(line);
		if (!leadingMatch) return line;

		const [, leadingWhitespace, restOfLine] = leadingMatch;
		if (leadingWhitespace === undefined || restOfLine === undefined)
			return line;
		const convertedIndentation = convertIndentationString(
			leadingWhitespace,
			fromType,
			toType,
		);

		return convertedIndentation + restOfLine;
	});

	return convertedLines.join('\n');
}

/**
 * Converts a whitespace string from one indentation type to another
 */
function convertIndentationString(
	whitespace: string,
	fromType: IndentationType,
	toType: IndentationType,
): string {
	if (fromType.type === 'none' || toType.type === 'none') {
		return whitespace;
	}

	// Calculate indentation level based on source type
	let indentationLevel = 0;

	if (fromType.type === 'tabs') {
		const tabCount = (whitespace.match(/\t/g) ?? []).length;
		indentationLevel = tabCount;
	} else if (fromType.type === 'spaces' && fromType.size > 0) {
		const spaceCount = (whitespace.match(/ /g) ?? []).length;
		indentationLevel = Math.round(spaceCount / fromType.size);
	} else {
		// For mixed or unknown, try to preserve original
		return whitespace;
	}

	// Convert to target type
	if (toType.type === 'tabs') {
		return '\t'.repeat(indentationLevel);
	}

	if (toType.type === 'spaces' && toType.size > 0) {
		return ' '.repeat(indentationLevel * toType.size);
	}

	// Fallback: return original
	return whitespace;
}
