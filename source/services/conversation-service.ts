import type {AssistantMessage} from '@mistralai/mistralai/models/components/index.js';
import type {
	MistralContentChunk,
	MistralMessage,
	MistralTool,
	MistralToolCall,
} from '../types/mistral.js';
import type {ConversationCallbacks} from '../types/callbacks.js';
import {formatTodoContext} from '../utils/app-utils.js';
import type {MistralService} from './mistral-service.js';
import type {McpManager} from './mcp-manager.js';
import {ToolExecutionManager} from './tool-execution-manager.js';

type HandleRequestParameters = {
	service: MistralService;
	messages: MistralMessage[];
	tools: MistralTool[];
	mcpManager: McpManager | undefined;
};

export class ConversationService {
	private readonly toolExecutionManager = new ToolExecutionManager();

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
				if (callbacks.onLoadingChange) {
					callbacks.onLoadingChange(false);
				}

				return;
			}

			if (callbacks.onUsageUpdate && usage) {
				callbacks.onUsageUpdate(usage, model);
			}

			const processResult = this.processAssistantMessages(
				assistantMessages,
				callbacks,
			);
			if (!processResult.success) {
				callbacks.onError(processResult.error);
				if (callbacks.onLoadingChange) {
					callbacks.onLoadingChange(false);
				}

				return;
			}

			const {updatedMessages, toolCalls} = processResult;

			if (callbacks.onMessagesUpdate) {
				// Update session messages with assistant messages
				callbacks.onMessagesUpdate(currentMessages => [
					...currentMessages,
					...updatedMessages,
				]);
			}

			if (toolCalls.length > 0) {
				await this.handleToolCalls(
					toolCalls,
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

			if (callbacks.onLoadingChange) {
				callbacks.onLoadingChange(false);
			}
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
		parameters: HandleRequestParameters,
		callbacks: ConversationCallbacks,
	): Promise<void> {
		try {
			const {mcpManager} = parameters;

			if (!mcpManager) {
				callbacks.onError(
					'MCP Manager not initialized. Please wait or restart if problem persists.',
				);

				if (callbacks.onLoadingChange) {
					callbacks.onLoadingChange(false);
				}

				return;
			}

			// Execute tool batch using the dedicated manager
			const executionResult = await this.toolExecutionManager.executeToolBatch(
				toolCalls,
				mcpManager,
				callbacks,
			);

			if (!executionResult.success) {
				// Add synthetic rejection messages to maintain proper API conversation structure
				const {toolResults} = executionResult;
				if (callbacks.onMessagesUpdate && toolResults.length > 0) {
					callbacks.onMessagesUpdate(messages => [...messages, ...toolResults]);
				}

				// Add synthetic assistant acknowledgment
				const assistantMessage: MistralMessage = {
					role: 'assistant',
					content: 'Tool permissions denied by user.',
				};

				if (callbacks.onMessagesUpdate) {
					callbacks.onMessagesUpdate(messages => [
						...messages,
						assistantMessage,
					]);
				}

				callbacks.onError(executionResult.error ?? 'Tool execution failed');

				if (callbacks.onLoadingChange) {
					callbacks.onLoadingChange(false);
				}

				return;
			}

			// Check for interruption before continuing the conversation
			if (callbacks.onInterruptionCheck?.()) {
				this.handleInterruption(callbacks, toolCalls);
				return;
			}

			// Batch update session messages atomically
			const {toolResults} = executionResult;
			if (callbacks.onMessagesUpdate) {
				callbacks.onMessagesUpdate(messages => [...messages, ...toolResults]);
			}

			// Continue conversation with tool results
			await this.handleRequest(
				{...parameters, messages: [...parameters.messages, ...toolResults]},
				callbacks,
			);
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : String(error);
			callbacks.onError(`Error handling tool calls: ${errorMessage}`);
			if (callbacks.onLoadingChange) {
				callbacks.onLoadingChange(false);
			}
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

		if (callbacks.onMessagesUpdate) {
			// Add synthetic messages to maintain proper API conversation flow
			callbacks.onMessagesUpdate(messages => [
				...messages,
				...interruptedMessages,
			]);
		}

		// Add visual interruption acknowledgment to conversation history
		callbacks.onHistoryUpdate({
			type: 'assistant',
			content: 'Process interrupted by user.',
			status: 'error',
		});

		if (callbacks.onLoadingChange) {
			callbacks.onLoadingChange(false);
		}
	}

	private generateInterruptedToolMessages(
		toolCalls: MistralToolCall[],
	): MistralMessage[] {
		return this.toolExecutionManager.generateInterruptedToolMessages(toolCalls);
	}
}
