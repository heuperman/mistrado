import {type McpServer} from '../types/mcp.js';
import {
	type MistralTool,
	type MistralToolCall,
	type MistralToolMessage,
} from '../types/mistral.js';
import {
	toMistralTools,
	toMcpToolCall,
	toMistralMessage,
} from '../utils/converters.js';
import {McpClient} from './mcp-client.js';

export class McpManager {
	private readonly clients = new Map<string, McpClient>();
	private availableTools: MistralTool[] = [];
	private readonly toolToServer = new Map<string, string>();

	async addServer(server: McpServer): Promise<void> {
		const client = new McpClient(server);
		await client.connect();
		this.clients.set(server.name, client);

		// Get tools from this server and add to available tools
		const toolsResult = await client.listTools();
		const mistralTools = toMistralTools(toolsResult);
		this.availableTools.push(...mistralTools);

		// Map each tool to this server
		for (const tool of mistralTools) {
			this.toolToServer.set(tool.function.name, server.name);
		}
	}

	async initializeBuiltinServers(): Promise<void> {
		const servers: McpServer[] = [
			{
				name: 'readServer',
				command: 'node',
				args: ['dist/tools/read.js'],
			},
			{
				name: 'listServer',
				command: 'node',
				args: ['dist/tools/list.js'],
			},
			{
				name: 'writeServer',
				command: 'node',
				args: ['dist/tools/write.js'],
			},
			{
				name: 'editServer',
				command: 'node',
				args: ['dist/tools/edit.js'],
			},
			{
				name: 'multiEditServer',
				command: 'node',
				args: ['dist/tools/multiEdit.js'],
			},
		];

		await Promise.all(servers.map(async server => this.addServer(server)));
	}

	getAvailableTools(): MistralTool[] {
		return this.availableTools;
	}

	async callTool(toolCall: MistralToolCall): Promise<MistralToolMessage> {
		const mcpRequest = toMcpToolCall(toolCall);

		// Find which server has this tool using the mapping
		const serverName = this.toolToServer.get(mcpRequest.name);
		if (!serverName) {
			throw new Error(
				`Tool ${mcpRequest.name} not found in any connected servers`,
			);
		}

		const client = this.clients.get(serverName);
		if (!client) {
			throw new Error(`Server ${serverName} not found`);
		}

		const result = await client.callTool(mcpRequest);
		const message = toMistralMessage(toolCall.id ?? '', result);
		return message;
	}

	async disconnect(): Promise<void> {
		await Promise.all(
			[...this.clients.values()].map(async client => client.disconnect()),
		);
		this.clients.clear();
		this.availableTools = [];
		this.toolToServer.clear();
	}
}
