#!/usr/bin/env node

import {Server} from '@modelcontextprotocol/sdk/server/index.js';
import {StdioServerTransport} from '@modelcontextprotocol/sdk/server/stdio.js';
import {
	CallToolRequestSchema,
	ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import * as fs from 'fs/promises';
import * as path from 'path';

class EditToolServer {
	private server: Server;

	constructor() {
		this.server = new Server(
			{
				name: 'edit-tool-server',
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

	private setupToolHandlers() {
		this.server.setRequestHandler(ListToolsRequestSchema, async () => {
			return {
				tools: [
					{
						name: 'Edit',
						description:
							'Performs exact string replacements in files. \n\nUsage:\n- You must use your `Read` tool at least once in the conversation before editing. \n- When editing text from Read tool output, ensure you preserve the exact indentation (tabs/spaces) as it appears AFTER the line number prefix. The line number prefix format is: spaces + line number + tab. Everything after that tab is the actual file content to match. Never include any part of the line number prefix in the old_string or new_string.\n- ALWAYS prefer editing existing files in the codebase. NEVER write new files unless explicitly required.\n- Only use emojis if the user explicitly requests it. Avoid adding emojis to files unless asked.\n- The edit will FAIL if `old_string` is not unique in the file. Either provide a larger string with more surrounding context to make it unique or use `replace_all` to change every instance of `old_string`. \n- Use `replace_all` for replacing and renaming strings across the file. This parameter is useful if you want to rename a variable for instance.',
						inputSchema: {
							type: 'object',
							properties: {
								file_path: {
									type: 'string',
									description: 'The absolute path to the file to modify',
								},
								old_string: {
									type: 'string',
									description: 'The text to replace',
								},
								new_string: {
									type: 'string',
									description:
										'The text to replace it with (must be different from old_string)',
								},
								replace_all: {
									type: 'boolean',
									default: false,
									description:
										'Replace all occurences of old_string (default false)',
								},
							},
							required: ['file_path', 'old_string', 'new_string'],
							additionalProperties: false,
						},
					},
				],
			};
		});

		this.server.setRequestHandler(CallToolRequestSchema, async request => {
			if (request.params.name !== 'Edit') {
				throw new Error(`Unknown tool: ${request.params.name}`);
			}

			const args = request.params.arguments as {
				file_path: string;
				old_string: string;
				new_string: string;
				replace_all?: boolean;
			};

			try {
				const result = await this.editFile(
					args.file_path,
					args.old_string,
					args.new_string,
					args.replace_all || false,
				);

				return {
					content: [
						{
							type: 'text',
							text: result,
						},
					],
				};
			} catch (error) {
				const errorMessage =
					error instanceof Error ? error.message : String(error);
				return {
					content: [
						{
							type: 'text',
							text: `Error: ${errorMessage}`,
						},
					],
					isError: true,
				};
			}
		});
	}

	private async editFile(
		filePath: string,
		oldString: string,
		newString: string,
		replaceAll: boolean,
	): Promise<string> {
		// Validate inputs
		if (!filePath) {
			throw new Error('file_path is required');
		}

		if (!oldString) {
			throw new Error('old_string is required');
		}

		if (oldString === newString) {
			throw new Error('new_string must be different from old_string');
		}

		// Resolve absolute path
		const absolutePath = path.resolve(filePath);

		try {
			// Check if file exists
			await fs.access(absolutePath);
		} catch {
			throw new Error(`File not found: ${absolutePath}`);
		}

		try {
			// Read file content
			const content = await fs.readFile(absolutePath, 'utf-8');

			let newContent: string;
			let replacementCount = 0;

			if (replaceAll) {
				// Replace all occurrences
				const regex = new RegExp(this.escapeRegExp(oldString), 'g');
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
			await fs.writeFile(absolutePath, newContent, 'utf-8');

			const action = replaceAll ? 'replacements' : 'replacement';
			return `Successfully made ${replacementCount} ${action} in ${absolutePath}`;
		} catch (error) {
			if (error instanceof Error) {
				throw error;
			}
			throw new Error(`Failed to edit file: ${String(error)}`);
		}
	}

	private escapeRegExp(string: string): string {
		return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	}

	async run() {
		const transport = new StdioServerTransport();
		await this.server.connect(transport);
	}
}

const server = new EditToolServer();
server.run().catch(() => {
	process.exit(1);
});
