import process from 'node:process';
import type {TodoItem} from '../tools/todo-write.js';
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

	// Special handling for TodoWrite tool
	if (toolName.toLowerCase() === 'todowrite') {
		try {
			const args =
				typeof toolArguments === 'string'
					? (JSON.parse(toolArguments) as Record<string, unknown>)
					: toolArguments;

			if (
				args &&
				typeof args === 'object' &&
				'todos' in args &&
				Array.isArray(args['todos'])
			) {
				const todos = args['todos'] as TodoItem[];
				const todoList = formatTodosForDisplay(todos);

				return `${toolNameToDisplay}\n${todoList}`;
			}
		} catch {
			// Fallback to basic display if parsing fails
		}

		return toolNameToDisplay;
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

/**
 * Formats todos for injection as context in user messages
 * @param todos Array of todo items
 * @returns Formatted string for system reminder context
 */
export function formatTodoContext(todos: TodoItem[]): string {
	const formattedTodos = formatTodosForDisplay(todos);

	return todos.length === 0
		? `<system-reminder>\n${formattedTodos}\n</system-reminder>`
		: `<system-reminder>\nCurrent todos:\n${formattedTodos}\n</system-reminder>`;
}

/**
 * Formats todos for display in the conversation
 * @param todos Array of todo items
 * @returns Formatted string for displaying todos
 */
export function formatTodosForDisplay(todos: TodoItem[]): string {
	if (todos.length === 0) {
		return 'Todo list is empty.';
	}

	return todos
		.map(todo => {
			if (todo.status === 'completed') {
				return `☑ ~${todo.content}~`;
			}

			if (todo.status === 'in_progress') {
				return `☐ **${todo.content}** (in progress)`;
			}

			return `☐ ${todo.content}`;
		})
		.join('\n');
}
