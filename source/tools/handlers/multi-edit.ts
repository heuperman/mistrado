import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type {Tool} from '@modelcontextprotocol/sdk/types.js';
import {validateSchema} from '../../utils/validation.js';

type EditOperation = {
	oldString: string;
	newString: string;
	replaceAll?: boolean;
};

type MultiEditArgs = {
	filePath: string;
	edits: EditOperation[];
};

export const multiEditTool: Tool = {
	name: 'MultiEdit',
	description:
		"This is a tool for making multiple edits to a single file in one operation. It is built on top of the Edit tool and allows you to perform multiple find-and-replace operations efficiently. Prefer this tool over the Edit tool when you need to make multiple edits to the same file.\n\nBefore using this tool:\n\n1. Use the Read tool to understand the file's contents and context\n2. Verify the directory path is correct\n\nTo make multiple file edits, provide the following:\n1. filePath: The absolute path to the file to modify (must be absolute, not relative)\n2. edits: An array of edit operations to perform, where each edit contains:\n   - oldString: The text to replace (must match the file contents exactly, including all whitespace and indentation)\n   - newString: The edited text to replace the oldString\n   - replaceAll: Replace all occurrences of oldString. This parameter is optional and defaults to false.\n\nIMPORTANT:\n- All edits are applied in sequence, in the order they are provided\n- Each edit operates on the result of the previous edit\n- All edits must be valid for the operation to succeed - if any edit fails, none will be applied\n- This tool is ideal when you need to make several changes to different parts of the same file\n\nCRITICAL REQUIREMENTS:\n1. All edits follow the same requirements as the single Edit tool\n2. The edits are atomic - either all succeed or none are applied\n3. Plan your edits carefully to avoid conflicts between sequential operations\n\nWARNING:\n- The tool will fail if edits.oldString doesn't match the file contents exactly (including whitespace)\n- The tool will fail if edits.oldString and edits.newString are the same\n- Since edits are applied in sequence, ensure that earlier edits don't affect the text that later edits are trying to find\n\nWhen making edits:\n- Ensure all edits result in idiomatic, correct code\n- Do not leave the code in a broken state\n- Always use absolute file paths (starting with /)\n- Only use emojis if the user explicitly requests it. Avoid adding emojis to files unless asked.\n- Use replaceAll for replacing and renaming strings across the file. This parameter is useful if you want to rename a variable for instance.\n\nIf you want to create a new file, use:\n- A new file path, including dir name if needed\n- First edit: empty oldString and the new file's contents as newString\n- Subsequent edits: normal edit operations on the created content",
	inputSchema: {
		type: 'object',
		properties: {
			filePath: {
				type: 'string',
				description: 'The absolute path to the file to modify',
			},
			edits: {
				type: 'array',
				items: {
					type: 'object',
					properties: {
						oldString: {
							type: 'string',
							description: 'The text to replace',
						},
						newString: {
							type: 'string',
							description: 'The text to replace it with',
						},
						replaceAll: {
							type: 'boolean',
							default: false,
							description:
								'Replace all occurrences of oldString (default false).',
						},
					},
					required: ['oldString', 'newString'],
					additionalProperties: false,
				},
				minItems: 1,
				description:
					'Array of edit operations to perform sequentially on the file',
			},
		},
		required: ['filePath', 'edits'],
		additionalProperties: false,
	},
};

export async function handleMultiEditTool(args: unknown) {
	const validation = validateSchema<MultiEditArgs>(
		args,
		multiEditTool.inputSchema,
		'MultiEdit',
	);

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
		const {filePath, edits} = validation.data;

		// Check if file path is absolute
		if (!path.isAbsolute(filePath)) {
			throw new Error('File path must be absolute (starting with /)');
		}

		// Read the current file content (or create empty content for new files)
		let currentContent: string;
		try {
			currentContent = await fs.readFile(filePath, 'utf8');
		} catch (error: any) {
			if (error.code === 'ENOENT') {
				// File doesn't exist - this is okay if the first edit creates the file
				currentContent = '';
			} else {
				throw new Error(`Failed to read file: ${error.message}`);
			}
		}

		// Apply edits sequentially
		let modifiedContent = currentContent;
		const appliedEdits: string[] = [];

		for (const [i, edit_] of edits.entries()) {
			const edit = edit_;

			// Validate that oldString and newString are different
			if (edit.oldString === edit.newString) {
				throw new Error(
					`Edit ${i + 1}: oldString and newString cannot be the same`,
				);
			}

			if (edit.replaceAll) {
				// Replace all occurrences
				if (!modifiedContent.includes(edit.oldString)) {
					throw new Error(`Edit ${i + 1}: oldString not found in file content`);
				}

				modifiedContent = modifiedContent
					.split(edit.oldString)
					.join(edit.newString);
			} else {
				// Replace first occurrence only
				const index = modifiedContent.indexOf(edit.oldString);
				if (index === -1) {
					throw new Error(`Edit ${i + 1}: oldString not found in file content`);
				}

				modifiedContent =
					modifiedContent.slice(0, Math.max(0, index)) +
					edit.newString +
					modifiedContent.slice(Math.max(0, index + edit.oldString.length));
			}

			appliedEdits.push(
				`Edit ${i + 1}: ${edit.replaceAll ? 'Replaced all' : 'Replaced first'} occurrence of "${edit.oldString.slice(0, 50)}${edit.oldString.length > 50 ? '...' : ''}" with "${edit.newString.slice(0, 50)}${edit.newString.length > 50 ? '...' : ''}"`,
			);
		}

		// Ensure the directory exists
		const dir = path.dirname(filePath);
		await fs.mkdir(dir, {recursive: true});

		// Write the modified content back to the file
		await fs.writeFile(filePath, modifiedContent, 'utf8');

		return {
			content: [
				{
					type: 'text' as const,
					text: `Successfully applied ${edits.length} edit(s) to ${filePath}:\n\n${appliedEdits.join('\n')}`,
				},
			],
		};
	} catch (error: any) {
		return {
			content: [
				{
					type: 'text' as const,
					text: `Error: ${error.message}`,
				},
			],
			isError: true,
		};
	}
}
