import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import process from 'node:process';
import type {Tool} from '@modelcontextprotocol/sdk/types.js';
import {validateSchema} from '../utils/validation.js';
import {globToRegex} from '../utils/regex.js';
import {
	parseGitignore,
	shouldIgnoreFile,
	type GitignorePattern,
} from '../utils/gitignore.js';
import {findGitRoot} from '../utils/git.js';

export const globTool: Tool = {
	name: 'Glob',
	description:
		'Fast file pattern matching tool that efficiently finds files matching specific glob patterns (e.g., `src/**/*.ts`, `**/*.md`), returning absolute paths sorted by modification time (newest first). Supports glob patterns with wildcards, directory traversal, and file extensions. Automatically excludes files listed in .gitignore unless includeIgnored is true. IMPORTANT: If this tool fails or returns no results, do not retry with identical arguments. Try a different approach such as: adjusting the glob pattern, trying a different basePath, using includeIgnored=true, or using the Grep tool to search file contents instead.',
	inputSchema: {
		type: 'object',
		properties: {
			pattern: {
				type: 'string',
				description:
					'The glob pattern to match files against (e.g., "src/**/*.ts", "**/*.md")',
			},
			basePath: {
				type: 'string',
				description:
					'The base directory to search from (defaults to current working directory)',
			},
			includeIgnored: {
				type: 'boolean',
				default: false,
				description:
					'Include files and directories listed in .gitignore (defaults to false)',
			},
		},
		required: ['pattern'],
		additionalProperties: false,
	},
};

export async function handleGlobTool(args: unknown) {
	const validation = validateSchema<{
		pattern: string;
		basePath?: string;
		includeIgnored?: boolean;
	}>(args, globTool.inputSchema, 'Glob');
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
		const result = await findGlobMatches(
			validation.data.pattern,
			validation.data.basePath ?? process.cwd(),
			validation.data.includeIgnored ?? false,
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

type FileMatch = {
	absolutePath: string;
	modifiedTime: Date;
};

type WalkContext = {
	basePath: string;
	regex: RegExp;
	matches: FileMatch[];
	gitignorePatterns: GitignorePattern[];
	gitRoot: string | undefined;
};

async function findGlobMatches(
	pattern: string,
	basePath: string,
	includeIgnored: boolean,
): Promise<string> {
	if (!pattern) {
		throw new Error('Pattern is required');
	}

	const absoluteBasePath = path.resolve(basePath);

	try {
		await fs.access(absoluteBasePath);
	} catch {
		throw new Error(`Base path not found: ${absoluteBasePath}`);
	}

	const regex = globToRegex(pattern, {extended: true, globstar: true});
	const matches: FileMatch[] = [];

	// Load gitignore patterns if not including ignored files
	const gitignorePatterns = includeIgnored
		? []
		: await parseGitignore(absoluteBasePath);
	const gitRoot = findGitRoot(absoluteBasePath);

	await walkDirectory(absoluteBasePath, {
		basePath: absoluteBasePath,
		regex,
		matches,
		gitignorePatterns,
		gitRoot,
	});

	// Sort by modification time (newest first)
	matches.sort((a, b) => b.modifiedTime.getTime() - a.modifiedTime.getTime());

	if (matches.length === 0) {
		return `No files found matching pattern: ${pattern}`;
	}

	const paths = matches.map(match => match.absolutePath);
	return `Found ${matches.length} files matching pattern "${pattern}":\n${paths.join('\n')}`;
}

async function walkDirectory(
	currentPath: string,
	context: WalkContext,
): Promise<void> {
	try {
		const entries = await fs.readdir(currentPath, {withFileTypes: true});

		const promises = entries.map(async entry => {
			const fullPath = path.join(currentPath, entry.name);
			const relativePath = path.relative(context.basePath, fullPath);

			// Check if file/directory should be ignored based on gitignore
			if (context.gitignorePatterns.length > 0 && context.gitRoot) {
				const gitRelativePath = path.relative(context.gitRoot, fullPath);
				if (shouldIgnoreFile(gitRelativePath, context.gitignorePatterns)) {
					return;
				}
			}

			if (entry.isDirectory()) {
				return walkDirectory(fullPath, context);
			}

			if (entry.isFile() && context.regex.test(relativePath)) {
				try {
					const stats = await fs.stat(fullPath);
					context.matches.push({
						absolutePath: fullPath,
						modifiedTime: stats.mtime,
					});
				} catch {
					// Skip files that can't be stat'd
				}
			}
		});

		await Promise.all(promises);
	} catch {
		// Skip directories that can't be read
	}
}
