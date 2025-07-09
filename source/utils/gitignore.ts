import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import {minimatch} from 'minimatch';
import {findGitRoot} from './git.js';

export type GitignorePattern = {
	pattern: string;
	negated: boolean;
};

/**
 * Parse .gitignore file from the git repository root
 * @param basePath - The base path to start searching for git repo
 * @returns Array of gitignore patterns
 */
export async function parseGitignore(
	basePath: string,
): Promise<GitignorePattern[]> {
	// Find git repository root using the corrected findGitRoot function
	const gitRoot = findGitRoot(basePath);

	// If no git repo found, return empty patterns
	if (!gitRoot) {
		return [];
	}

	const gitignorePath = path.join(gitRoot, '.gitignore');

	try {
		const content = await fs.readFile(gitignorePath, 'utf8');
		return parseGitignoreContent(content);
	} catch {
		// If .gitignore doesn't exist, return empty patterns
		return [];
	}
}

/**
 * Parse gitignore file content into structured patterns
 * @param content - Raw gitignore file content
 * @returns Array of parsed gitignore patterns
 */
function parseGitignoreContent(content: string): GitignorePattern[] {
	const patterns: GitignorePattern[] = [];

	for (const line of content.split('\n')) {
		const trimmed = line.trim();

		// Skip empty lines and comments
		if (!trimmed || trimmed.startsWith('#')) {
			continue;
		}

		// Handle negation patterns
		const negated = trimmed.startsWith('!');
		const pattern = negated ? trimmed.slice(1) : trimmed;

		patterns.push({pattern, negated});
	}

	return patterns;
}

/**
 * Check if a file should be ignored based on gitignore patterns
 * @param relativePath - Path relative to git repository root
 * @param patterns - Array of gitignore patterns
 * @returns True if file should be ignored, false otherwise
 */
export function shouldIgnoreFile(
	relativePath: string,
	patterns: GitignorePattern[],
): boolean {
	let ignored = false;

	for (const {pattern, negated} of patterns) {
		const normalizedPath = relativePath.replaceAll('\\', '/');

		// Test multiple pattern variations to match gitignore behavior
		let testPatterns = [];

		if (pattern.endsWith('/')) {
			// Directory pattern: match directory and all its contents
			testPatterns = [pattern.slice(0, -1), pattern + '**'];
		} else if (pattern.includes('/')) {
			// Path pattern: match exactly as specified
			testPatterns = [pattern];
			// For patterns like 'src/**/temp', also match files inside temp directories
			if (!pattern.endsWith('**')) {
				testPatterns.push(pattern + '/**');
			}
		} else {
			// File pattern: match at any level
			// Also match as directory pattern (gitignore patterns without / can match directories and their contents)
			testPatterns = [pattern, '**/' + pattern, pattern + '/**'];
		}

		// Test each pattern variant
		for (const testPattern of testPatterns) {
			const matches = minimatch(normalizedPath, testPattern, {
				dot: true,
				matchBase: false,
			});

			if (matches) {
				ignored = !negated;
				break; // Stop testing other variants once we have a match
			}
		}
	}

	return ignored;
}
