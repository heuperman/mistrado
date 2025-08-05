import process from 'node:process';
import type {ToolManager} from '../services/tool-manager.js';
import {makePathRelative, shortenPathForDisplay} from './paths.js';

/**
 * Formats a tool call with its primary argument for display in the conversation
 * @param toolName The name of the tool being called
 * @param toolArguments The arguments passed to the tool (can be string or object)
 * @param toolManager Optional ToolManager instance for accessing tool context
 * @returns Formatted string like "**ToolName** relative/path/to/file"
 */
export function formatToolCallDisplay(
	toolName: string,
	toolArguments: Record<string, unknown> | string,
	toolManager?: ToolManager,
): string {
	const toolNameToDisplay = `**${toolName}**`;

	// Special handling for TodoWrite tool
	if (toolName.toLowerCase() === 'todowrite' && toolManager) {
		const todos = toolManager.getCurrentTodos();
		if (todos.length === 0) {
			return `${toolNameToDisplay}\n*Todo list is empty*`;
		}

		const todoList = todos
			.map(todo => {
				if (todo.status === 'completed') {
					return `☑ ~${todo.content}~`;
				}

				return `☐ ${todo.content}`;
			})
			.join('\n');

		return `${toolNameToDisplay}\n${todoList}`;
	}

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
			multiedit: 'filePath',
			glob: 'pattern',
			grep: 'pattern',
			webfetch: 'url',
		};

		const pathKey = pathArgumentMap[toolName.toLowerCase()];
		if (!pathKey || !(pathKey in args)) {
			return toolNameToDisplay;
		}

		const argumentValue = args[pathKey] as string;
		if (typeof argumentValue !== 'string') {
			return toolNameToDisplay;
		}

		// Handle URLs differently from file paths
		if (toolName.toLowerCase() === 'webfetch') {
			// For URLs, strip the protocol and show the clean URL
			const displayUrl = argumentValue.replace(/^https?:\/\//, '');
			return `${toolNameToDisplay}(${displayUrl})`;
		}

		// For file paths, apply path transformations
		const pathToDisplay = shortenPathForDisplay(
			makePathRelative(argumentValue, process.cwd()),
		);
		return `${toolNameToDisplay}(${pathToDisplay})`;
	} catch {
		return toolNameToDisplay;
	}
}
