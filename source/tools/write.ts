import {Server} from '@modelcontextprotocol/sdk/server/index.js';
import {StdioServerTransport} from '@modelcontextprotocol/sdk/server/stdio.js';
import {
	CallToolRequestSchema,
	ListToolsRequestSchema,
	Tool,
	CallToolRequest,
	CallToolResult,
} from '@modelcontextprotocol/sdk/types.js';
import {promises as fs} from 'fs';
import {dirname} from 'path';

class WriteToolServer {
	private server: Server;

	constructor() {
		this.server = new Server(
			{
				name: 'write-tool-server',
				version: '1.0.0',
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
		// Handle list_tools requests
		this.server.setRequestHandler(ListToolsRequestSchema, async () => {
			return {
				tools: [
					{
						name: 'Write',
						description:
							"Writes a file to the local filesystem.\n\nUsage:\n- This tool will overwrite the existing file if there is one at the provided path.\n- If this is an existing file, you MUST use the Read tool first to read the file's contents.\n- ALWAYS prefer editing existing files in the codebase. NEVER write new files unless explicitly required.\n- NEVER proactively create documentation files (*.md) or README files. Only create documentation files if explicitly requested by the User.\n- Only use emojis if the user explicitly requests it. Avoid writing emojis to files unless asked.",
						inputSchema: {
							type: 'object',
							properties: {
								file_path: {
									type: 'string',
									description:
										'The absolute path to the file to write (must be absolute, not relative)',
								},
								content: {
									type: 'string',
									description: 'The content to write to the file',
								},
							},
							required: ['file_path', 'content'],
							additionalProperties: false,
							$schema: 'http://json-schema.org/draft-07/schema#',
						},
					} as Tool,
				],
			};
		});

		// Handle call_tool requests
		this.server.setRequestHandler(
			CallToolRequestSchema,
			async (request: CallToolRequest): Promise<CallToolResult> => {
				if (request.params.name !== 'Write') {
					throw new Error(`Unknown tool: ${request.params.name}`);
				}

				const {file_path, content} = request.params.arguments as {
					file_path: string;
					content: string;
				};

				try {
					// Validate that the path is absolute
					if (!file_path.startsWith('/') && !file_path.match(/^[A-Za-z]:\\/)) {
						throw new Error('File path must be absolute, not relative');
					}

					// Ensure the directory exists
					const dir = dirname(file_path);
					await fs.mkdir(dir, {recursive: true});

					// Write the file
					await fs.writeFile(file_path, content, 'utf8');

					return {
						content: [
							{
								type: 'text',
								text: `Successfully wrote file: ${file_path}`,
							},
						],
					};
				} catch (error) {
					const errorMessage =
						error instanceof Error ? error.message : 'Unknown error occurred';
					return {
						content: [
							{
								type: 'text',
								text: `Error writing file: ${errorMessage}`,
							},
						],
						isError: true,
					};
				}
			},
		);
	}

	async run() {
		const transport = new StdioServerTransport();
		await this.server.connect(transport);
	}
}

// Create and run the server
const server = new WriteToolServer();
server.run().catch(() => {
	process.exit(1);
});
