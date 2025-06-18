import type {
	McpCallToolRequest,
	McpListToolsResult,
	McpCallToolResult,
} from '../types/mcp.js';
import type {
	MistralTool,
	MistralToolCall,
	MistralToolMessage,
} from '../types/mistral.js';

export function toMistralTools(
	listToolResult: McpListToolsResult,
): MistralTool[] {
	return listToolResult.tools.map(tool => ({
		type: 'function',
		function: {
			name: tool.name,
			description: tool.description,
			parameters: tool.inputSchema,
		},
	}));
}

export function toMcpToolCall(toolCall: MistralToolCall): McpCallToolRequest {
	const call = toolCall.function;
	const toolCallArguments =
		typeof call.arguments === 'string'
			? (JSON.parse(call.arguments) as Record<string, unknown>)
			: call.arguments;

	return {
		name: call.name,
		arguments: toolCallArguments,
	};
}

export function toMistralMessage(
	toolCallId: string,
	callToolResult: McpCallToolResult,
): MistralToolMessage {
	let content: MistralToolMessage['content'];

	if ('content' in callToolResult && callToolResult.content) {
		content = callToolResult.content.map(item => {
			if (item.type === 'text') {
				return {
					type: 'text',
					text: item.text,
				} as const;
			}

			if (item.type === 'image') {
				return {
					type: 'text',
					text: `[Image: ${item.mimeType}]`,
				} as const;
			}

			if (item.type === 'audio') {
				return {
					type: 'text',
					text: `[Audio: ${item.mimeType}]`,
				} as const;
			}

			if (item.type === 'resource') {
				return {
					type: 'text',
					text: `[Resource: ${item.resource.uri}]`,
				} as const;
			}

			throw new Error(`Unsupported content type: ${(item as any).type}`);
		});
	} else if ('toolResult' in callToolResult && callToolResult.toolResult) {
		// Handle case where content is not provided and toolResult is used instead
		content = JSON.stringify(callToolResult.toolResult);
	} else {
		throw new Error('No tool result found');
	}

	return {
		content,
		toolCallId,
		role: 'tool',
	};
}
