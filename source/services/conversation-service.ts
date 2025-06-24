import type {
	MistralMessage,
	MistralTool,
	MistralToolCall,
} from '../types/mistral.js';
import type {MistralService, TokenUsage} from './mistral-service.js';
import type {McpManager} from './mcp-manager.js';

export type ConversationEntry = {
	id: number;
	type: 'user' | 'assistant' | 'command' | 'tool';
	content: string;
};

type ConversationCallbacks = {
	onUsageUpdate: (usage: TokenUsage, model: string) => void;
	onError: (error: string) => void;
	onHistoryUpdate: (entry: ConversationEntry) => void;
	onMessagesUpdate: (messages: MistralMessage[]) => void;
	onLoadingChange: (loading: boolean) => void;
};

type HandleRequestParameters = {
	service: MistralService;
	messages: MistralMessage[];
	tools: MistralTool[];
	mcpManager: McpManager | undefined;
};

export class ConversationService {
	async handleRequest(
		parameters: HandleRequestParameters,
		callbacks: ConversationCallbacks,
	): Promise<void> {
		const {service, messages, tools, mcpManager} = parameters;
		const {error, assistantMessages, usage, model} = await service.getResponse(
			messages,
			tools,
		);

		if (error) {
			callbacks.onError(error);
			callbacks.onLoadingChange(false);
			return;
		}

		if (usage) {
			callbacks.onUsageUpdate(usage, model);
		}

		const updatedMessages: MistralMessage[] = messages;
		const assistantTextOutputs: string[] = [];
		const toolCalls: MistralToolCall[] = [];

		for (const message of assistantMessages) {
			updatedMessages.push(message as MistralMessage);

			if (typeof message.content === 'string') {
				assistantTextOutputs.push(message.content);
			} else if (Array.isArray(message.content)) {
				for (const chunk of message.content) {
					if (chunk.type === 'text') {
						assistantTextOutputs.push(chunk.text);
					}
				}
			}

			if (message.toolCalls?.length) {
				toolCalls.push(...message.toolCalls);
			}
		}

		if (assistantTextOutputs.length > 0) {
			callbacks.onHistoryUpdate({
				id: Date.now(),
				type: 'assistant',
				content: assistantTextOutputs.join('\n'),
			});
		}

		if (toolCalls?.length) {
			if (!mcpManager) {
				callbacks.onError(
					'MCP Manager not initialized. Please wait or restart if problem persists.',
				);
				callbacks.onLoadingChange(false);
				return;
			}

			const toolCallResults = await Promise.allSettled(
				toolCalls.map(async toolCall => {
					callbacks.onHistoryUpdate({
						id: Date.now(),
						type: 'tool',
						content: `Calling tool: ${toolCall.function.name}`,
					});

					try {
						const result = await mcpManager.callTool(toolCall);
						return {success: true, result: result as MistralMessage};
					} catch (toolError) {
						const errorMessage =
							toolError instanceof Error
								? toolError.message
								: String(toolError);
						callbacks.onError(`${toolCall.function.name} - ${errorMessage}`);

						const errorToolMessage: MistralMessage = {
							role: 'tool',
							content: `Error: ${errorMessage}`,
							toolCallId: toolCall.id ?? '',
						};
						return {success: false, result: errorToolMessage};
					}
				}),
			);

			for (const result of toolCallResults) {
				if (result.status === 'fulfilled') {
					updatedMessages.push(result.value.result);
				}
			}

			callbacks.onMessagesUpdate(updatedMessages);

			await this.handleRequest(
				{service, messages: updatedMessages, tools, mcpManager},
				callbacks,
			);
		}
	}
}
