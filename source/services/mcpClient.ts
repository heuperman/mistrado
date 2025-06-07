import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';
import {
	MCPServer,
	MCPListToolsResult,
	MCPCallToolRequest,
	MCPCallToolResult,
} from '../types/mcp.js';

export class MCPClient {
	private client: Client;
	private transport: StdioClientTransport | null = null;
	private connected = false;

	constructor(private server: MCPServer) {
		this.client = new Client({
			name: 'mistral-cli',
			version: '0.0.0',
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

	async listTools(): Promise<MCPListToolsResult> {
		if (!this.connected) {
			throw new Error('MCP client not connected');
		}
		const result = await this.client.listTools();
		return result as MCPListToolsResult;
	}

	async callTool(request: MCPCallToolRequest): Promise<MCPCallToolResult> {
		if (!this.connected) {
			throw new Error('MCP client not connected');
		}
		const result = await this.client.callTool(request);
		return result as MCPCallToolResult;
	}

	async disconnect(): Promise<void> {
		if (!this.connected || !this.transport) return;

		await this.client.close();
		this.connected = false;
		this.transport = null;
	}

	isConnected(): boolean {
		return this.connected;
	}
}