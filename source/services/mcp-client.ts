import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';
import {
	type McpServer,
	type McpListToolsResult,
	type McpCallToolRequest,
	type McpCallToolResult,
} from '../types/mcp.js';

export class McpClient {
	private readonly client: Client;
	private transport: StdioClientTransport | undefined = undefined;
	private connected = false;

	constructor(private readonly server: McpServer) {
		this.client = new Client({
			name: 'mistrado',
			version: '0.1.0',
		});
	}

	async connect(): Promise<void> {
		if (this.connected) return;

		this.transport = new StdioClientTransport({
			command: this.server.command,
			args: this.server.args,
		});

		await this.client.connect(this.transport);
		this.connected = true;
	}

	async listTools(): Promise<McpListToolsResult> {
		if (!this.connected) {
			throw new Error('MCP client not connected');
		}

		const result = await this.client.listTools();
		return result as McpListToolsResult;
	}

	async callTool(request: McpCallToolRequest): Promise<McpCallToolResult> {
		if (!this.connected) {
			throw new Error('MCP client not connected');
		}

		const result = await this.client.callTool(request);
		return result as McpCallToolResult;
	}

	async disconnect(): Promise<void> {
		if (!this.connected || !this.transport) return;

		await this.client.close();
		this.connected = false;
		this.transport = undefined;
	}

	isConnected(): boolean {
		return this.connected;
	}
}
