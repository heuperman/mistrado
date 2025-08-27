import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import process from 'node:process';

export type EditOperation = {
	oldString: string;
	newString: string;
	replaceAll: boolean;
};

export type EditResult =
	| {
			success: true;
			replacementCount: number;
			message: string;
	  }
	| {
			success: false;
			error: string;
	  };

/**
 * Validates that a file path is absolute
 */
export function validateAbsolutePath(filePath: string): void {
	if (!path.isAbsolute(filePath)) {
		throw new Error('File path must be absolute, not relative');
	}
}

/**
 * Checks if a file path is restricted from AI modification
 */
export function validateNotRestrictedFile(filePath: string): void {
	const resolvedPath = path.resolve(filePath);
	const workingDir = process.cwd();

	// Block access to .mistrado/settings.json to prevent AI self-modification
	const settingsPath = path.resolve(workingDir, '.mistrado', 'settings.json');

	if (resolvedPath === settingsPath) {
		throw new Error('Access to Mistrado settings file is restricted');
	}
}

/**
 * Ensures a file exists and is accessible
 */
export async function ensureFileExists(filePath: string): Promise<void> {
	try {
		await fs.access(filePath);
	} catch {
		throw new Error(`File not found: ${filePath}`);
	}
}

/**
 * Reads file content as UTF-8 string
 */
export async function readFileContent(filePath: string): Promise<string> {
	try {
		return await fs.readFile(filePath, 'utf8');
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		throw new Error(`Failed to read file: ${errorMessage}`);
	}
}

/**
 * Writes content to file as UTF-8
 */
export async function writeFileContent(
	filePath: string,
	content: string,
): Promise<void> {
	try {
		await fs.writeFile(filePath, content, 'utf8');
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		throw new Error(`Failed to write file: ${errorMessage}`);
	}
}

/**
 * Performs a single string replacement operation on content
 */
export function performSingleEdit(
	content: string,
	operation: EditOperation,
	requireUnique = false,
): EditResult {
	const {oldString, newString, replaceAll} = operation;

	if (oldString === newString) {
		return {
			success: false,
			error: 'oldString and newString cannot be the same',
		};
	}

	let newContent: string;
	let replacementCount = 0;

	if (replaceAll) {
		// Replace all occurrences
		const regex = new RegExp(escapeRegExp(oldString), 'g');
		const matches = content.match(regex);
		replacementCount = matches ? matches.length : 0;

		if (replacementCount === 0) {
			return {
				success: false,
				error: `String not found in file: "${oldString}"`,
			};
		}

		newContent = content.replace(regex, newString);
	} else {
		// Replace single occurrence
		const firstIndex = content.indexOf(oldString);
		if (firstIndex === -1) {
			return {
				success: false,
				error: `String not found in file: "${oldString}"`,
			};
		}

		if (requireUnique) {
			const lastIndex = content.lastIndexOf(oldString);
			if (firstIndex !== lastIndex) {
				return {
					success: false,
					error: `String "${oldString}" appears multiple times in the file. Use replace_all=true or provide a more specific string with surrounding context to make it unique.`,
				};
			}
		}

		newContent = content.replace(oldString, newString);
		replacementCount = 1;
	}

	return {
		success: true,
		replacementCount,
		message: newContent,
	};
}

/**
 * Escapes special regex characters in a string
 */
export function escapeRegExp(string: string): string {
	return string.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
}

/**
 * Performs a complete file edit operation (read -> edit -> write)
 */
export async function performFileEdit(
	filePath: string,
	operation: EditOperation,
	requireUnique = false,
): Promise<{replacementCount: number; message: string}> {
	validateAbsolutePath(filePath);
	validateNotRestrictedFile(filePath);

	const absolutePath = path.resolve(filePath);

	await ensureFileExists(absolutePath);

	const content = await readFileContent(absolutePath);

	const result = performSingleEdit(content, operation, requireUnique);

	if (!result.success) {
		throw new Error(result.error);
	}

	await writeFileContent(absolutePath, result.message);

	const action = operation.replaceAll ? 'replacements' : 'replacement';
	return {
		replacementCount: result.replacementCount,
		message: `Successfully made ${result.replacementCount} ${action} in ${absolutePath}`,
	};
}
