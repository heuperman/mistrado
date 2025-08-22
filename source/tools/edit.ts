import type {Tool} from '@modelcontextprotocol/sdk/types.js';
import {validateSchema} from '../utils/validation.js';
import {performFileEdit, type EditOperation} from '../utils/file-operations.js';

export const editTool: Tool = {
	name: 'Edit',
	description:
		'Performs exact string replacements in files. \n\nUsage:\n- You must use your `Read` tool at least once in the conversation before editing. \n- When editing text from Read tool output, ensure you preserve the exact indentation (tabs/spaces) as it appears AFTER the line number prefix. The line number prefix format is: spaces + line number + tab. Everything after that tab is the actual file content to match. Never include any part of the line number prefix in the old_string or new_string.\n- Pay close attention to the exact indentation (spaces vs tabs) when editing the file..\n- ALWAYS prefer editing existing files in the codebase. NEVER write new files unless explicitly required.\n- Only use emojis if the user explicitly requests it. Avoid adding emojis to files unless asked.\n- The edit will FAIL if `old_string` is not unique in the file. Either provide a larger string with more surrounding context to make it unique or use `replace_all` to change every instance of `old_string`. \n- Use `replace_all` for replacing and renaming strings across the file. This parameter is useful if you want to rename a variable for instance.\n- IMPORTANT: If this tool fails, do not retry with identical arguments. Try a different approach such as: using more surrounding context in old_string, using replace_all=true, or reading the file first to understand the exact format.',
	inputSchema: {
		type: 'object',
		properties: {
			filePath: {
				type: 'string',
				description: 'The absolute path to the file to modify',
			},
			oldString: {
				type: 'string',
				description: 'The text to replace',
			},
			newString: {
				type: 'string',
				description:
					'The text to replace it with (must be different from old_string)',
			},
			replaceAll: {
				type: 'boolean',
				default: false,
				description: 'Replace all occurrences of old_string (default false)',
			},
		},
		required: ['filePath', 'oldString', 'newString'],
		additionalProperties: false,
	},
};

export async function handleEditTool(args: unknown) {
	const validation = validateSchema<{
		filePath: string;
		oldString: string;
		newString: string;
		replaceAll?: boolean;
	}>(args, editTool.inputSchema, 'Edit');

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
		const operation: EditOperation = {
			oldString: validation.data.oldString,
			newString: validation.data.newString,
			replaceAll: validation.data.replaceAll ?? false,
		};

		const result = await performFileEdit(
			validation.data.filePath,
			operation,
			true, // Require unique for edit tool
		);

		return {
			content: [
				{
					type: 'text' as const,
					text: result.message,
				},
			],
			isError: false,
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
