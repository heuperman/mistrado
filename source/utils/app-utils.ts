import process from 'node:process';
import {makePathRelative, shortenPathForDisplay} from './paths.js';

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
	const toolNameToDisplay = `**${toolName}**`;

	try {
		const args =
			typeof toolArguments === 'string'
				? (JSON.parse(toolArguments) as Record<string, unknown>)
				: toolArguments;

		if (!args || typeof args !== 'object') {
			return toolNameToDisplay;
		}

		const pathArgumentMap: Record<string, string> = {
			read: 'filePath',
			write: 'filePath',
			edit: 'filePath',
			list: 'path',
			'multi-edit': 'filePath',
			glob: 'pattern',
			grep: 'pattern',
		};

		const pathKey = pathArgumentMap[toolName.toLowerCase()];
		if (!pathKey || !(pathKey in args)) {
			return toolNameToDisplay;
		}

		const absolutePath = args[pathKey] as string;
		if (typeof absolutePath !== 'string') {
			return toolNameToDisplay;
		}

		const pathToDisplay = shortenPathForDisplay(
			makePathRelative(absolutePath, process.cwd()),
		);
		return `${toolNameToDisplay}(${pathToDisplay})`;
	} catch {
		return toolNameToDisplay;
	}
}
