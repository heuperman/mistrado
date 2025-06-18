#!/usr/bin/env node

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import {Server} from '@modelcontextprotocol/sdk/server/index.js';
import {StdioServerTransport} from '@modelcontextprotocol/sdk/server/stdio.js';
import {
	CallToolRequestSchema,
	ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

type EditOperation = {
	old_string: string;
	new_string: string;
	replace_all?: boolean;
};

type MultiEditArgs = {
	file_path: string;
	edits: EditOperation[];
};

class MultiEditServer {
	private readonly server: Server;

	constructor() {
		this.server = new Server(
			{
				name: 'multiedit-server',
				version: '0.1.0',
			},
			{
				capabilities: {
					tools: {},
				},
			},
		);

		this.setupToolHandlers();
	}

	private setupToolHandlers(): void {
		this.server.setRequestHandler(ListToolsRequestSchema, async () => {
			return {
				tools: [
					{
						name: 'MultiEdit',
						description:
							"This is a tool for making multiple edits to a single file in one operation. It is built on top of the Edit tool and allows you to perform multiple find-and-replace operations efficiently. Prefer this tool over the Edit tool when you need to make multiple edits to the same file.\n\nBefore using this tool:\n\n1. Use the Read tool to understand the file's contents and context\n2. Verify the directory path is correct\n\nTo make multiple file edits, provide the following:\n1. file_path: The absolute path to the file to modify (must be absolute, not relative)\n2. edits: An array of edit operations to perform, where each edit contains:\n   - old_string: The text to replace (must match the file contents exactly, including all whitespace and indentation)\n   - new_string: The edited text to replace the old_string\n   - replace_all: Replace all occurrences of old_string. This parameter is optional and defaults to false.\n\nIMPORTANT:\n- All edits are applied in sequence, in the order they are provided\n- Each edit operates on the result of the previous edit\n- All edits must be valid for the operation to succeed - if any edit fails, none will be applied\n- This tool is ideal when you need to make several changes to different parts of the same file\n\nCRITICAL REQUIREMENTS:\n1. All edits follow the same requirements as the single Edit tool\n2. The edits are atomic - either all succeed or none are applied\n3. Plan your edits carefully to avoid conflicts between sequential operations\n\nWARNING:\n- The tool will fail if edits.old_string doesn't match the file contents exactly (including whitespace)\n- The tool will fail if edits.old_string and edits.new_string are the same\n- Since edits are applied in sequence, ensure that earlier edits don't affect the text that later edits are trying to find\n\nWhen making edits:\n- Ensure all edits result in idiomatic, correct code\n- Do not leave the code in a broken state\n- Always use absolute file paths (starting with /)\n- Only use emojis if the user explicitly requests it. Avoid adding emojis to files unless asked.\n- Use replace_all for replacing and renaming strings across the file. This parameter is useful if you want to rename a variable for instance.\n\nIf you want to create a new file, use:\n- A new file path, including dir name if needed\n- First edit: empty old_string and the new file's contents as new_string\n- Subsequent edits: normal edit operations on the created content",
						inputSchema: {
							type: 'object',
							properties: {
								file_path: {
									type: 'string',
									description: 'The absolute path to the file to modify',
								},
								edits: {
									type: 'array',
									items: {
										type: 'object',
										properties: {
											old_string: {
												type: 'string',
												description: 'The text to replace',
											},
											new_string: {
												type: 'string',
												description: 'The text to replace it with',
											},
											replace_all: {
												type: 'boolean',
												default: false,
												description:
													'Replace all occurences of old_string (default false).',
											},
										},
										required: ['old_string', 'new_string'],
										additionalProperties: false,
									},
									minItems: 1,
									description:
										'Array of edit operations to perform sequentially on the file',
								},
							},
							required: ['file_path', 'edits'],
							additionalProperties: false,
						},
					},
				],
			};
		});

		this.server.setRequestHandler(CallToolRequestSchema, async request => {
			if (request.params.name !== 'MultiEdit') {
				throw new Error(`Unknown tool: ${request.params.name}`);
			}

			const args = request.params.arguments as unknown as MultiEditArgs;
			return this.handleMultiEdit(args);
		});
	}

	private async handleMultiEdit(args: MultiEditArgs) {
		try {
			// Validate arguments
			this.validateArgs(args);

			const {file_path, edits} = args;

			// Check if file path is absolute
			if (!path.isAbsolute(file_path)) {
				throw new Error('File path must be absolute (starting with /)');
			}

			// Read the current file content (or create empty content for new files)
			let currentContent: string;
			try {
				currentContent = await fs.readFile(file_path, 'utf8');
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

				// Validate that old_string and new_string are different
				if (edit.old_string === edit.new_string) {
					throw new Error(
						`Edit ${i + 1}: old_string and new_string cannot be the same`,
					);
				}

				if (edit.replace_all) {
					// Replace all occurrences
					if (!modifiedContent.includes(edit.old_string)) {
						throw new Error(
							`Edit ${i + 1}: old_string not found in file content`,
						);
					}

					modifiedContent = modifiedContent
						.split(edit.old_string)
						.join(edit.new_string);
				} else {
					// Replace first occurrence only
					const index = modifiedContent.indexOf(edit.old_string);
					if (index === -1) {
						throw new Error(
							`Edit ${i + 1}: old_string not found in file content`,
						);
					}

					modifiedContent =
						modifiedContent.slice(0, Math.max(0, index)) +
						edit.new_string +
						modifiedContent.slice(Math.max(0, index + edit.old_string.length));
				}

				appliedEdits.push(
					`Edit ${i + 1}: ${edit.replace_all ? 'Replaced all' : 'Replaced first'} occurrence of "${edit.old_string.slice(0, 50)}${edit.old_string.length > 50 ? '...' : ''}" with "${edit.new_string.slice(0, 50)}${edit.new_string.length > 50 ? '...' : ''}"`,
				);
			}

			// Ensure the directory exists
			const dir = path.dirname(file_path);
			await fs.mkdir(dir, {recursive: true});

			// Write the modified content back to the file
			await fs.writeFile(file_path, modifiedContent, 'utf-8');

			return {
				content: [
					{
						type: 'text',
						text: `Successfully applied ${edits.length} edit(s) to ${file_path}:\n\n${appliedEdits.join('\n')}`,
					},
				],
			};
		} catch (error: any) {
			return {
				content: [
					{
						type: 'text',
						text: `Error: ${error.message}`,
					},
				],
				isError: true,
			};
		}
	}

	private validateArgs(args: any): asserts args is MultiEditArgs {
		if (!args || typeof args !== 'object') {
			throw new Error('Invalid arguments: must be an object');
		}

		if (!args.file_path || typeof args.file_path !== 'string') {
			throw new Error('Invalid file_path: must be a non-empty string');
		}

		if (!Array.isArray(args.edits) || args.edits.length === 0) {
			throw new Error('Invalid edits: must be a non-empty array');
		}

		for (let i = 0; i < args.edits.length; i++) {
			const edit = args.edits[i];
			if (!edit || typeof edit !== 'object') {
				throw new Error(`Invalid edit ${i + 1}: must be an object`);
			}

			if (typeof edit.old_string !== 'string') {
				throw new TypeError(
					`Invalid edit ${i + 1}: old_string must be a string`,
				);
			}

			if (typeof edit.new_string !== 'string') {
				throw new TypeError(
					`Invalid edit ${i + 1}: new_string must be a string`,
				);
			}

			if (
				edit.replace_all !== undefined &&
				typeof edit.replace_all !== 'boolean'
			) {
				throw new Error(`Invalid edit ${i + 1}: replace_all must be a boolean`);
			}
		}
	}

	async run(): Promise<void> {
		const transport = new StdioServerTransport();
		await this.server.connect(transport);
	}
}

// Start the server
const server = new MultiEditServer();
server.run().catch(() => {
	process.exit(1);
});
