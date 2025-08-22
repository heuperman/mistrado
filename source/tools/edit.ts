import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type {Tool} from '@modelcontextprotocol/sdk/types.js';
import {validateSchema} from '../utils/validation.js';

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
		const result = await editFile(
			validation.data.filePath,
			validation.data.oldString,
			validation.data.newString,
			validation.data.replaceAll ?? false,
		);

		return {
			content: [
				{
					type: 'text' as const,
					text: result,
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

async function editFile(
	filePath: string,
	oldString: string,
	newString: string,
	replaceAll: boolean,
): Promise<string> {
	// Resolve absolute path
	const absolutePath = path.resolve(filePath);

	try {
		await fs.access(absolutePath);
	} catch {
		throw new Error(`File not found: ${absolutePath}`);
	}

	try {
		const content = await fs.readFile(absolutePath, 'utf8');

		let newContent: string;
		let replacementCount = 0;

		if (replaceAll) {
			// Replace all occurrences
			const regex = new RegExp(escapeRegExp(oldString), 'g');
			const matches = content.match(regex);
			replacementCount = matches ? matches.length : 0;

			if (replacementCount === 0) {
				throw new Error(`String not found in file: "${oldString}"`);
			}

			newContent = content.replace(regex, newString);
		} else {
			// Replace single occurrence - must be unique
			const firstIndex = content.indexOf(oldString);
			if (firstIndex === -1) {
				throw new Error(`String not found in file: "${oldString}"`);
			}

			const lastIndex = content.lastIndexOf(oldString);
			if (firstIndex !== lastIndex) {
				throw new Error(
					`String "${oldString}" appears multiple times in the file. Use replace_all=true or provide a more specific string with surrounding context to make it unique.`,
				);
			}

			newContent = content.replace(oldString, newString);
			replacementCount = 1;
		}

		// Write the modified content back to the file
		await fs.writeFile(absolutePath, newContent, 'utf8');

		const action = replaceAll ? 'replacements' : 'replacement';
		return `Successfully made ${replacementCount} ${action} in ${absolutePath}`;
	} catch (error) {
		if (error instanceof Error) {
			throw error;
		}

		throw new Error(`Failed to edit file: ${String(error)}`);
	}
}

function escapeRegExp(string: string): string {
	return string.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
}
