import {MCPClient} from './mcpClient.js';
import {MCPServer} from '../types/mcp.js';
import {
	MistralTool,
	MistralToolCall,
	MistralToolMessage,
} from '../types/mistral.js';
import {
	toMistralTools,
	toMCPToolCall,
	toMistralMessage,
} from '../utils/converters.js';

export class MCPManager {
	private clients = new Map<string, MCPClient>();
	private availableTools: MistralTool[] = [];

	async addServer(server: MCPServer): Promise<void> {
		const client = new MCPClient(server);
		await client.connect();
		this.clients.set(server.name, client);

		// Get tools from this server and add to available tools
		const toolsResult = await client.listTools();
		const mistralTools = toMistralTools(toolsResult);
		this.availableTools.push(...mistralTools);
	}

	async initializeBuiltinServers(): Promise<void> {
		const servers: MCPServer[] = [
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
		];

		Promise.all(servers.map(server => this.addServer(server)));
	}

	getAvailableTools(): MistralTool[] {
		return this.availableTools;
	}

	async callTool(toolCall: MistralToolCall): Promise<MistralToolMessage> {
		const mcpRequest = toMCPToolCall(toolCall);

		// Find which server has this tool by iterating through clients
		for (const [, client] of this.clients) {
			try {
				const result = await client.callTool(mcpRequest);
				const message = toMistralMessage(toolCall.id || '', result);
				return message;
			} catch (error) {
				// If tool not found in this server, try next one
				if (error instanceof Error && error.message.includes('Unknown tool')) {
					continue;
				}
				// If it's a different error, throw it
				throw error;
			}
		}

		throw new Error(
			`Tool ${mcpRequest.name} not found in any connected servers`,
		);
	}

	async disconnect(): Promise<void> {
		await Promise.all(
			Array.from(this.clients.values()).map(client => client.disconnect()),
		);
		this.clients.clear();
		this.availableTools = [];
	}
}
