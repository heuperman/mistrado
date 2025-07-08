import {Server} from '@modelcontextprotocol/sdk/server/index.js';
import {StdioServerTransport} from '@modelcontextprotocol/sdk/server/stdio.js';
import {
	CallToolRequestSchema,
	ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import {editTool, handleEditTool} from './handlers/edit.js';
import {lsTool, handleLsTool} from './handlers/list.js';
import {writeTool, handleWriteTool} from './handlers/write.js';
import {readTool, handleReadTool} from './handlers/read.js';
import {multiEditTool, handleMultiEditTool} from './handlers/multi-edit.js';

class ToolServer {
	private readonly server: Server;

	constructor() {
		this.server = new Server(
			{
				name: 'tool-server',
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

	async run(): Promise<void> {
		const transport = new StdioServerTransport();
		await this.server.connect(transport);
	}

	private setupToolHandlers(): void {
		this.server.setRequestHandler(ListToolsRequestSchema, async () => {
			return {
				tools: [editTool, lsTool, writeTool, readTool, multiEditTool],
			};
		});

		this.server.setRequestHandler(CallToolRequestSchema, async request => {
			const toolName = request.params.name.toLowerCase();

			if (toolName === 'edit') {
				return handleEditTool(request.params.arguments);
			}

			if (toolName === 'list') {
				return handleLsTool(request.params.arguments);
			}

			if (toolName === 'write') {
				return handleWriteTool(request.params.arguments);
			}

			if (toolName === 'read') {
				return handleReadTool(request.params.arguments);
			}

			if (toolName === 'multiedit') {
				return handleMultiEditTool(request.params.arguments);
			}

			throw new Error(`Unknown tool: ${request.params.name}`);
		});
	}
}

const server = new ToolServer();
void server.run();
