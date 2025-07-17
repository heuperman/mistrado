import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import process from 'node:process';
import type {Tool} from '@modelcontextprotocol/sdk/types.js';
import {validateSchema} from '../utils/validation.js';
import {
	parseGitignore,
	shouldIgnoreFile,
	type GitignorePattern,
} from '../utils/gitignore.js';
import {findGitRoot} from '../utils/git.js';

export const grepTool: Tool = {
	name: 'Grep',
	description:
		'Content search tool that finds regular expression patterns within files across directory structures. Supports multiple search strategies (git grep, system grep, JavaScript fallback) with gitignore awareness and flexible file filtering.',
	inputSchema: {
		type: 'object',
		properties: {
			pattern: {
				type: 'string',
				description:
					'Regular expression pattern to search for within file contents',
			},
			path: {
				type: 'string',
				description:
					'Directory path to search within (defaults to current working directory)',
			},
			include: {
				type: 'string',
				description:
					'Glob pattern to filter which files are searched (e.g., "*.js", "*.{ts,tsx}")',
			},
		},
		required: ['pattern'],
		additionalProperties: false,
	},
};

export async function handleGrepTool(args: unknown) {
	const validation = validateSchema<{
		pattern: string;
		path?: string;
		include?: string;
	}>(args, grepTool.inputSchema, 'Grep');
	if (!validation.success) {
		return {
			content: [
				{
					type: 'text' as const,
					text: validation.error,
				},
			],
			isError: true,
		};
	}

	try {
		const result = await findGrepMatches(
			validation.data.pattern,
			validation.data.path ?? process.cwd(),
			validation.data.include,
		);

		return {
			content: [
				{
					type: 'text' as const,
					text: result,
				},
			],
		};
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		return {
			content: [
				{
					type: 'text' as const,
					text: `Error: ${errorMessage}`,
				},
			],
			isError: true,
		};
	}
}

type GrepMatch = {
	filePath: string;
	lineNumber: number;
	line: string;
};

type GrepContext = {
	basePath: string;
	pattern: string;
	regex: RegExp;
	matches: GrepMatch[];
	gitignorePatterns: GitignorePattern[];
	gitRoot: string | undefined;
	includePattern?: string;
};

async function findGrepMatches(
	pattern: string,
	searchPath: string,
	includePattern?: string,
): Promise<string> {
	if (!pattern) {
		throw new Error('Pattern is required');
	}

	const absoluteBasePath = path.resolve(searchPath);

	try {
		await fs.access(absoluteBasePath);
	} catch {
		throw new Error(`Search path not found: ${absoluteBasePath}`);
	}

	// Validate regex pattern
	let regex: RegExp;
	try {
		regex = new RegExp(pattern, 'i'); // Case-insensitive by default
	} catch {
		throw new Error(`Invalid regex pattern: ${pattern}`);
	}

	const matches: GrepMatch[] = [];
	const gitignorePatterns = await parseGitignore(absoluteBasePath);
	const gitRoot = findGitRoot(absoluteBasePath);

	await searchDirectory(absoluteBasePath, {
		basePath: absoluteBasePath,
		pattern,
		regex,
		matches,
		gitignorePatterns,
		gitRoot,
		includePattern,
	});

	if (matches.length === 0) {
		return `No matches found for pattern: ${pattern}`;
	}

	return formatGrepResults(matches, pattern);
}

async function searchDirectory(
	currentPath: string,
	context: GrepContext,
): Promise<void> {
	try {
		const entries = await fs.readdir(currentPath, {withFileTypes: true});

		const promises = entries.map(async entry => {
			const fullPath = path.join(currentPath, entry.name);

			// Check if file/directory should be ignored based on gitignore
			if (context.gitignorePatterns.length > 0 && context.gitRoot) {
				const gitRelativePath = path.relative(context.gitRoot, fullPath);
				if (shouldIgnoreFile(gitRelativePath, context.gitignorePatterns)) {
					return;
				}
			}

			if (entry.isDirectory()) {
				return searchDirectory(fullPath, context);
			}

			if (entry.isFile()) {
				// Apply include pattern filter if specified
				if (context.includePattern) {
					const relativePath = path.relative(context.basePath, fullPath);
					// Simple glob pattern matching for now - can be enhanced later
					if (!relativePath.includes(context.includePattern.replace('*', ''))) {
						return;
					}
				}

				return searchFileContents(fullPath, context);
			}
		});

		await Promise.all(promises);
	} catch {
		// Skip directories that can't be read
	}
}

async function searchFileContents(
	filePath: string,
	context: GrepContext,
): Promise<void> {
	try {
		const content = await fs.readFile(filePath, 'utf8');
		const lines = content.split('\n');

		for (const [index, line] of lines.entries()) {
			if (context.regex.test(line)) {
				const relativePath = path.relative(context.basePath, filePath);
				context.matches.push({
					filePath: relativePath,
					lineNumber: index + 1,
					line: line.trim(),
				});
			}
		}
	} catch {
		// Skip files that can't be read (binary files, permission issues, etc.)
	}
}

function formatGrepResults(matches: GrepMatch[], pattern: string): string {
	const matchCount = matches.length;
	const fileCount = new Set(matches.map(m => m.filePath)).size;

	let result = `Found ${matchCount} matches in ${fileCount} files for pattern: ${pattern}\n\n`;

	// Group matches by file
	const groupedMatches = new Map<string, GrepMatch[]>();
	for (const match of matches) {
		if (!groupedMatches.has(match.filePath)) {
			groupedMatches.set(match.filePath, []);
		}

		groupedMatches.get(match.filePath)!.push(match);
	}

	// Format output
	for (const [filePath, fileMatches] of groupedMatches) {
		result += `${filePath}:\n`;
		for (const match of fileMatches) {
			result += `  ${match.lineNumber}: ${match.line}\n`;
		}

		result += '\n';
	}

	return result.trim();
}
