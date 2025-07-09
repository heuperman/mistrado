import {execSync} from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * Check if directory is anywhere inside a git repository
 */
export function isGitRepo(directory: string): boolean {
	try {
		execSync('git rev-parse --show-toplevel', {
			stdio: 'ignore',
			cwd: directory,
		});
		return true;
	} catch {
		return false;
	}
}

/**
 * Check if directory is the root of a git repository
 */
export function isGitRepoRoot(directory: string): boolean {
	try {
		const result = execSync('git rev-parse --show-toplevel', {
			stdio: 'pipe',
			cwd: directory,
			encoding: 'utf8',
		});
		const gitRoot = result.trim();

		// Use realpath to resolve symlinks (important on macOS where /var -> /private/var)
		const resolvedDirectory = fs.realpathSync(path.resolve(directory));
		const resolvedGitRoot = fs.realpathSync(gitRoot);

		return resolvedDirectory === resolvedGitRoot;
	} catch {
		return false;
	}
}

/**
 * Get git repository root path
 * @param basePath - Starting path to search for git repo
 * @returns Git repository root path, or undefined if not found
 */
export function findGitRoot(basePath: string): string | undefined {
	const absoluteBasePath = path.resolve(basePath);

	let currentPath = absoluteBasePath;
	while (currentPath !== path.dirname(currentPath)) {
		if (isGitRepoRoot(currentPath)) {
			return currentPath;
		}

		currentPath = path.dirname(currentPath);
	}

	return undefined;
}
