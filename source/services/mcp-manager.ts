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
import {ToolManager} from './tool-manager.js';

export class McpManager {
	private readonly clients = new Map<string, McpClient>();
	private availableTools: MistralTool[] = [];
	private readonly toolToServer = new Map<string, string>();
	private readonly toolManager = new ToolManager();

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
		// Add built-in tools from ToolManager
		const builtinTools = this.toolManager.getAvailableTools();
		this.availableTools.push(...builtinTools);

		// Map each built-in tool to 'builtin' server
		for (const tool of builtinTools) {
			this.toolToServer.set(tool.function.name, 'builtin');
		}
	}

	getAvailableTools(): MistralTool[] {
		return this.availableTools;
	}

	getToolManager(): ToolManager {
		return this.toolManager;
	}

	async callTool(toolCall: MistralToolCall): Promise<MistralToolMessage> {
		const toolName = toolCall.function.name;

		// Find which server has this tool using the mapping
		const serverName = this.toolToServer.get(toolName);
		if (!serverName) {
			throw new Error(`Tool ${toolName} not found in any connected servers`);
		}

		// Handle built-in tools
		if (serverName === 'builtin') {
			return this.toolManager.callTool(toolCall);
		}

		// Handle external MCP tools
		const client = this.clients.get(serverName);
		if (!client) {
			throw new Error(`Server ${serverName} not found`);
		}

		const mcpRequest = toMcpToolCall(toolCall);
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
