import type {
	AssistantMessage,
	UsageInfo,
} from '@mistralai/mistralai/models/components/index.js';
import type {
	MistralContentChunk,
	MistralMessage,
	MistralTool,
	MistralToolCall,
} from '../types/mistral.js';
import {formatToolCallDisplay, formatTodoContext} from '../utils/app-utils.js';
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
	onInterruptionCheck: () => boolean;
	onAbortControllerCreate: () => AbortController;
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
		// Create AbortController for this request
		const abortController = callbacks.onAbortControllerCreate();

		try {
			const {service, messages, tools, mcpManager} = parameters;

			// Inject todo context into the last user message
			const messagesWithTodoContext = this.injectTodoContext(
				messages,
				mcpManager,
			);

			const {error, assistantMessages, usage, model} =
				await service.getResponse(
					messagesWithTodoContext,
					tools,
					callbacks.onTokenProgress,
					abortController,
				);

			if (error) {
				if (error.includes('Request aborted by client')) {
					// Handle AbortError specifically (user interruption)
					this.handleInterruption(callbacks);
					return;
				}

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

				// Extract text content and tool calls from content array
				if (typeof message.content === 'string') {
					assistantTextOutputs.push(message.content);
				} else if (Array.isArray(message.content)) {
					this.extractTextFromContentArray(
						message.content as MistralContentChunk[],
						assistantTextOutputs,
						toolCalls,
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
		content: MistralContentChunk[],
		outputs: string[],
		toolCalls: MistralToolCall[],
	): void {
		for (const chunk of content) {
			if (chunk && typeof chunk === 'object' && 'type' in chunk) {
				if (
					chunk.type === 'text' &&
					'text' in chunk &&
					typeof chunk.text === 'string'
				) {
					outputs.push(chunk.text);
				} else if (chunk.type === 'function') {
					// Extract tool call from function-type content
					const toolCall = this.extractToolCallFromFunctionChunk(chunk);
					if (toolCall && this.isValidToolCall(toolCall)) {
						toolCalls.push(toolCall);
					}
				}
			}
		}
	}

	private extractToolCallFromFunctionChunk(
		chunk: MistralContentChunk,
	): MistralToolCall | undefined {
		if (
			chunk === null ||
			typeof chunk !== 'object' ||
			!('function' in chunk) ||
			chunk.function === null ||
			typeof chunk.function !== 'object' ||
			typeof chunk.function.name !== 'string'
		) {
			return undefined;
		}

		const toolCall: MistralToolCall = {
			id: typeof chunk?.id === 'string' ? chunk.id : crypto.randomUUID(),
			type: 'function',
			function: {
				name: chunk.function.name,
				arguments:
					typeof chunk.function.arguments === 'string' ||
					(typeof chunk.function.arguments === 'object' &&
						chunk.function.arguments !== null)
						? chunk.function.arguments
						: {},
			},
		};

		return toolCall;
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
							content: formatToolCallDisplay(
								toolCall.function.name,
								toolCall.function.arguments,
							),
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

			// Check for interruption before continuing the conversation
			if (callbacks.onInterruptionCheck()) {
				this.handleInterruption(callbacks, toolCalls);
				return;
			}

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

	private injectTodoContext(
		messages: MistralMessage[],
		mcpManager: McpManager | undefined,
	): MistralMessage[] {
		if (!mcpManager) {
			return messages;
		}

		const todos = mcpManager.getToolManager().getCurrentTodos();
		const todoContext = formatTodoContext(todos);

		const modifiedMessages = [...messages];
		const latestMessage = modifiedMessages.at(-1);

		// Only modify the last user message to include todo context and only do so once
		if (latestMessage?.role === 'user') {
			if (typeof latestMessage.content === 'string') {
				const updatedMessage: MistralMessage = {
					...latestMessage,
					content: [
						{
							type: 'text' as const,
							text: latestMessage.content,
						},
						{
							type: 'text' as const,
							text: todoContext,
						},
					],
				};
				modifiedMessages[modifiedMessages.length - 1] = updatedMessage;
			} else if (
				Array.isArray(latestMessage.content) &&
				latestMessage.content
			) {
				const updatedMessage: MistralMessage = {
					...latestMessage,
					content: [
						...latestMessage.content,
						{
							type: 'text' as const,
							text: todoContext,
						},
					],
				};
				modifiedMessages[modifiedMessages.length - 1] = updatedMessage;
			}
		}

		return modifiedMessages;
	}

	private handleInterruption(
		callbacks: ConversationCallbacks,
		toolCalls?: MistralToolCall[],
	): void {
		const interruptedMessages: MistralMessage[] = [];

		if (toolCalls?.length && toolCalls.length > 0) {
			// Generate synthetic tool result messages for any interrupted tool calls
			const interruptedToolMessages =
				this.generateInterruptedToolMessages(toolCalls);

			interruptedMessages.push(...interruptedToolMessages);
		}

		// Generate synthetic assistant acknowledgment message
		const assistantMessage: MistralMessage = {
			role: 'assistant',
			content: 'Process interrupted by user.',
		};

		interruptedMessages.push(assistantMessage);

		// Add synthetic messages to maintain proper API conversation flow
		callbacks.onMessagesUpdate(messages => [
			...messages,
			...interruptedMessages,
		]);

		// Add visual interruption acknowledgment to conversation history
		callbacks.onHistoryUpdate({
			type: 'assistant',
			content: 'Process interrupted by user.',
			status: 'error',
		});

		// End loading state
		callbacks.onLoadingChange(false);
	}

	private generateInterruptedToolMessages(
		toolCalls: MistralToolCall[],
	): MistralMessage[] {
		return toolCalls.map(toolCall => ({
			role: 'tool' as const,
			content: 'Interrupted by user',
			toolCallId: toolCall.id,
		}));
	}
}
