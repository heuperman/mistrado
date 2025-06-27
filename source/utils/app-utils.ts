import {execSync} from 'node:child_process';
import * as path from 'node:path';
import process from 'node:process';

export function isGitRepo(): boolean {
	try {
		execSync('git rev-parse --git-dir', {stdio: 'ignore'});
		return true;
	} catch {
		return false;
	}
}

/**
 * Formats a tool call with its primary argument for display in the conversation
 * @param toolName The name of the tool being called
 * @param toolArguments The arguments passed to the tool (can be string or object)
 * @returns Formatted string like "**ToolName** relative/path/to/file"
 */
export function formatToolCallDisplay(
	toolName: string,
	toolArguments: Record<string, unknown> | string,
): string {
	const baseDisplay = `**${toolName}**`;

	try {
		const args =
			typeof toolArguments === 'string'
				? (JSON.parse(toolArguments) as Record<string, unknown>)
				: toolArguments;

		if (!args || typeof args !== 'object') {
			return baseDisplay;
		}

		const pathArgumentMap: Record<string, string> = {
			read: 'filePath',
			write: 'filePath',
			edit: 'filePath',
			list: 'path',
			'multi-edit': 'filePath',
		};

		const pathKey = pathArgumentMap[toolName.toLowerCase()];
		if (!pathKey || !(pathKey in args)) {
			return baseDisplay;
		}

		const absolutePath = args[pathKey] as string;
		if (typeof absolutePath !== 'string') {
			return baseDisplay;
		}

		const relativePath = formatPathForDisplay(absolutePath);
		return `${baseDisplay}(${relativePath})`;
	} catch {
		return baseDisplay;
	}
}

/**
 * Converts an absolute path to a relative path and truncates if too long
 * @param absolutePath The absolute file path
 * @returns Formatted relative path, truncated if necessary
 */
function formatPathForDisplay(absolutePath: string): string {
	try {
		const relativePath = path.relative(process.cwd(), absolutePath);

		const displayPath =
			relativePath.length < absolutePath.length &&
			!relativePath.startsWith('../')
				? relativePath
				: absolutePath;

		const maxLength = 50;
		if (displayPath.length > maxLength) {
			return `...${displayPath.slice(-(maxLength - 3))}`;
		}

		return displayPath;
	} catch {
		return absolutePath;
	}
}
