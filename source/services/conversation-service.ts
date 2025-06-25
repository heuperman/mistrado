import type {
	AssistantMessage,
	UsageInfo,
} from '@mistralai/mistralai/models/components/index.js';
import type {
	MistralMessage,
	MistralTool,
	MistralToolCall,
} from '../types/mistral.js';
import type {MistralService} from './mistral-service.js';
import type {McpManager} from './mcp-manager.js';

export type ToolCallStatus = 'running' | 'success' | 'error';

export type ConversationEntry = {
	id: string;
	type: 'user' | 'assistant' | 'command' | 'tool';
	content: string;
	status?: ToolCallStatus;
	toolCallId?: string;
};

type ConversationCallbacks = {
	onUsageUpdate: (usage: UsageInfo, model: string) => void;
	onError: React.Dispatch<React.SetStateAction<string | undefined>>;
	onHistoryUpdate: (entry: Omit<ConversationEntry, 'id'>) => string;
	onHistoryStatusUpdate: (id: string, status: 'success' | 'error') => void;
	onMessagesUpdate: React.Dispatch<React.SetStateAction<MistralMessage[]>>;
	onLoadingChange: (loading: boolean) => void;
	onTokenProgress: (tokens: number) => void;
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
		try {
			const {service, messages, tools, mcpManager} = parameters;
			const {error, assistantMessages, usage, model} =
				await service.getResponse(messages, tools, callbacks.onTokenProgress);

			if (error) {
				callbacks.onError(error);
				callbacks.onLoadingChange(false);
				return;
			}

			if (usage) {
				callbacks.onUsageUpdate(usage, model);
			}

			const processResult = this.processAssistantMessages(
				assistantMessages,
				callbacks,
			);
			if (!processResult.success) {
				callbacks.onError(processResult.error);
				callbacks.onLoadingChange(false);
				return;
			}

			const {updatedMessages, toolCalls} = processResult;

			// Update session messages with assistant messages
			callbacks.onMessagesUpdate(currentMessages => [
				...currentMessages,
				...updatedMessages,
			]);

			if (toolCalls.length > 0) {
				await this.handleToolCalls(
					toolCalls,
					[], // Start with empty array for tool results
					{
						service,
						messages: [...messages, ...updatedMessages],
						tools,
						mcpManager,
					},
					callbacks,
				);
			}
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : String(error);
			callbacks.onError(
				`Unexpected error in conversation handling: ${errorMessage}`,
			);
			callbacks.onLoadingChange(false);
		}
	}

	private processAssistantMessages(
		assistantMessages: AssistantMessage[] | never[],
		callbacks: ConversationCallbacks,
	):
		| {
				success: true;
				updatedMessages: MistralMessage[];
				toolCalls: MistralToolCall[];
		  }
		| {success: false; error: string} {
		try {
			const updatedMessages: MistralMessage[] = [];
			const assistantTextOutputs: string[] = [];
			const toolCalls: MistralToolCall[] = [];

			for (const message of assistantMessages) {
				if (!message || typeof message !== 'object') {
					return {
						success: false,
						error: 'Invalid message format received from AI',
					};
				}

				updatedMessages.push(message as MistralMessage);

				// Extract text content
				if (typeof message.content === 'string') {
					assistantTextOutputs.push(message.content);
				} else if (Array.isArray(message.content)) {
					this.extractTextFromContentArray(
						message.content,
						assistantTextOutputs,
					);
				}

				// Extract tool calls
				if (message.toolCalls?.length) {
					for (const toolCall of message.toolCalls) {
						if (!this.isValidToolCall(toolCall)) {
							return {
								success: false,
								error: 'Invalid tool call format: missing function name or ID',
							};
						}

						toolCalls.push(toolCall);
					}
				}
			}

			// Display assistant text output
			if (assistantTextOutputs.some(output => output.length > 0)) {
				callbacks.onHistoryUpdate({
					type: 'assistant',
					content: assistantTextOutputs.join('\n'),
				});
			}

			return {success: true, updatedMessages, toolCalls};
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : String(error);

			return {
				success: false,
				error: `Error processing assistant messages: ${errorMessage}`,
			};
		}
	}

	private extractTextFromContentArray(
		content: unknown[],
		outputs: string[],
	): void {
		for (const chunk of content) {
			if (
				chunk &&
				typeof chunk === 'object' &&
				'type' in chunk &&
				chunk.type === 'text' &&
				'text' in chunk &&
				typeof chunk.text === 'string'
			) {
				outputs.push(chunk.text);
			}
		}
	}

	private isValidToolCall(toolCall: unknown): toolCall is MistralToolCall {
		return (
			typeof toolCall === 'object' &&
			toolCall !== null &&
			'function' in toolCall &&
			typeof toolCall.function === 'object' &&
			toolCall.function !== null &&
			'name' in toolCall.function &&
			typeof toolCall.function.name === 'string' &&
			'id' in toolCall &&
			typeof toolCall.id === 'string'
		);
	}

	private async handleToolCalls(
		toolCalls: MistralToolCall[],
		updatedMessages: MistralMessage[],
		parameters: HandleRequestParameters,
		callbacks: ConversationCallbacks,
	): Promise<void> {
		try {
			const {mcpManager} = parameters;

			if (!mcpManager) {
				callbacks.onError(
					'MCP Manager not initialized. Please wait or restart if problem persists.',
				);
				callbacks.onLoadingChange(false);
				return;
			}

			const toolCallResults = await Promise.allSettled(
				toolCalls.map(async toolCall => {
					let toolEntryId: string | undefined;

					try {
						if (!toolCall?.function?.name) {
							throw new Error('Tool call missing function name');
						}

						toolEntryId = callbacks.onHistoryUpdate({
							type: 'tool',
							content: `**${toolCall.function.name}**`,
							status: 'running',
							toolCallId: toolCall.id,
						});

						const result = await mcpManager.callTool(toolCall);

						if (!result) {
							throw new Error('Tool call returned empty result');
						}

						callbacks.onHistoryStatusUpdate(toolEntryId, 'success');
						return {success: true, result: result as MistralMessage};
					} catch (toolError) {
						const errorMessage =
							toolError instanceof Error
								? toolError.message
								: String(toolError);

						if (toolEntryId !== undefined) {
							callbacks.onHistoryStatusUpdate(toolEntryId, 'error');
						}

						callbacks.onError(
							`Tool ${toolCall.function?.name || 'unknown'} failed: ${errorMessage}`,
						);

						const errorToolMessage: MistralMessage = {
							role: 'tool',
							content: `Error: ${errorMessage}`,
							toolCallId: toolCall.id ?? '',
						};
						return {success: false, result: errorToolMessage};
					}
				}),
			);

			// Process tool call results
			let hasValidResults = false;
			for (const result of toolCallResults) {
				if (result.status === 'fulfilled' && result.value.result) {
					updatedMessages.push(result.value.result);
					hasValidResults = true;
				} else if (result.status === 'rejected') {
					callbacks.onError(
						`Tool call promise rejected: ${String(result.reason)}`,
					);
				}
			}

			if (!hasValidResults) {
				callbacks.onError(
					'All tool calls failed - unable to continue conversation',
				);
				callbacks.onLoadingChange(false);
				return;
			}

			// Add tool results to the message chain
			const newMessages = [...updatedMessages];
			callbacks.onMessagesUpdate(messages => [...messages, ...newMessages]);

			// Continue conversation with tool results
			await this.handleRequest(
				{...parameters, messages: [...parameters.messages, ...newMessages]},
				callbacks,
			);
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : String(error);
			callbacks.onError(`Error handling tool calls: ${errorMessage}`);
			callbacks.onLoadingChange(false);
		}
	}
}
