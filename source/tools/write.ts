import {promises as fs} from 'node:fs';
import {dirname} from 'node:path';
import type {Tool} from '@modelcontextprotocol/sdk/types.js';
import {validateSchema} from '../utils/validation.js';

export const writeTool: Tool = {
	name: 'Write',
	description:
		"Writes a file to the local filesystem.\n\nUsage:\n- This tool will overwrite the existing file if there is one at the provided path.\n- If this is an existing file, you MUST use the Read tool first to read the file's contents.\n- ALWAYS prefer editing existing files in the codebase. NEVER write new files unless explicitly required.\n- NEVER proactively create documentation files (*.md) or README files. Only create documentation files if explicitly requested by the User.\n- Only use emojis if the user explicitly requests it. Avoid writing emojis to files unless asked.",
	inputSchema: {
		type: 'object',
		properties: {
			filePath: {
				type: 'string',
				description:
					'The absolute path to the file to write (must be absolute, not relative)',
			},
			content: {
				type: 'string',
				description: 'The content to write to the file',
			},
		},
		required: ['filePath', 'content'],
		additionalProperties: false,
	},
};

export async function handleWriteTool(args: unknown) {
	const validation = validateSchema<{
		filePath: string;
		content: string;
	}>(args, writeTool.inputSchema, 'Write');

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
		// Validate that the path is absolute
		if (
			!validation.data.filePath.startsWith('/') &&
			!/^[A-Za-z]:\\/.test(validation.data.filePath)
		) {
			throw new Error('File path must be absolute, not relative');
		}

		// Ensure the directory exists
		const dir = dirname(validation.data.filePath);
		await fs.mkdir(dir, {recursive: true});

		// Write the file
		await fs.writeFile(
			validation.data.filePath,
			validation.data.content,
			'utf8',
		);

		return {
			content: [
				{
					type: 'text' as const,
					text: `Successfully wrote file: ${validation.data.filePath}`,
				},
			],
		};
	} catch (error) {
		const errorMessage =
			error instanceof Error ? error.message : 'Unknown error occurred';
		return {
			content: [
				{
					type: 'text' as const,
					text: `Error writing file: ${errorMessage}`,
				},
			],
			isError: true,
		};
	}
}
