import {Mistral} from '@mistralai/mistralai';
import {EventStream} from '@mistralai/mistralai/lib/event-streams.js';
import {
	CompletionEvent,
	Tool,
} from '@mistralai/mistralai/models/components/index.js';
import {MistralMessage} from '../types/mistral.js';
import {MCPManager} from './mcpManager.js';

let client: Mistral | null = null;
let mcpManager: MCPManager | null = null;

export async function initializeMistralClient(apiKey: string): Promise<void> {
	if (!apiKey) {
		throw new Error('API key is required to initialize Mistral client.');
	}
	client = new Mistral({apiKey});

	// Initialize MCP manager with built-in servers
	mcpManager = new MCPManager();
	await mcpManager.initializeBuiltinServers();
}

export async function getResponse(
	messages: MistralMessage[],
	tools: Tool[] = [],
): Promise<EventStream<CompletionEvent>> {
	if (!client) {
		throw new Error(
			'Mistral client not initialized. Please ensure API key is set.',
		);
	}

	// Get available MCP tools and merge with provided tools
	const mcpTools = mcpManager?.getAvailableTools() || [];
	const allTools = [...tools, ...mcpTools];

	return client.chat.stream({
		model: 'devstral-small-2505',
		messages,
		tools: allTools,
	});
}

export function getMCPManager(): MCPManager | null {
	return mcpManager;
}
