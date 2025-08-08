import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import {Mistral} from '@mistralai/mistralai';
import type {
	CompletionEvent,
	AssistantMessage,
	Tool,
	UsageInfo,
	CompletionResponseStreamChoice,
	ToolCall,
} from '@mistralai/mistralai/models/components/index.js';
import type {EventStream} from '@mistralai/mistralai/lib/event-streams.js';
import {type MistralMessage} from '../types/mistral.js';
import {defaultModel} from '../defaults.js';

type Settings = {
	model: string;
};

type SuccessResponse = {
	error: undefined;
	assistantMessages: AssistantMessage[];
	model: string;
	usage: UsageInfo;
};

type ErrorResponse = {
	error: string;
	assistantMessages: never[];
	model: string;
	usage?: never;
};

export type ResponseResult = SuccessResponse | ErrorResponse;

type TokenProgressCallback = (tokens: number) => void;

export class MistralService {
	private readonly client: Mistral | undefined;

	constructor(apiKey: string) {
		if (!apiKey) {
			throw new Error('API key is required to initialize Mistral client.');
		}

		this.client = new Mistral({apiKey});
	}

	async getResponse(
		messages: MistralMessage[],
		tools: Tool[] = [],
		onTokenProgress?: TokenProgressCallback,
	): Promise<ResponseResult> {
		const model = this.getModelFromSettings();

		if (!this.client) {
			throw new Error(
				'Mistral client not initialized. Please ensure API key is set.',
			);
		}

		return this.attemptRequest(messages, tools, model, onTokenProgress, 1);
	}

	private async attemptRequest(
		messages: MistralMessage[],
		tools: Tool[],
		model: string,
		onTokenProgress: TokenProgressCallback | undefined,
		attempt: number,
	): Promise<ResponseResult> {
		const maxRetries = 3;

		try {
			const stream = await this.client!.chat.stream({
				model,
				messages,
				tools,
			});

			return await this.processStream(stream, model, onTokenProgress);
		} catch (error) {
			const lastError =
				error instanceof Error ? error : new Error(String(error));

			if (attempt < maxRetries) {
				// Wait progressively longer between retries: 1s, 2s
				await new Promise(resolve => {
					setTimeout(resolve, attempt * 1000);
				});
				return this.attemptRequest(
					messages,
					tools,
					model,
					onTokenProgress,
					attempt + 1,
				);
			}

			return {
				error: `API request failed after ${maxRetries} attempts: ${lastError.message}`,
				assistantMessages: [],
				model,
			};
		}
	}

	private getModelFromSettings(): string {
		try {
			const settingsPath = path.join(
				process.cwd(),
				'.mistrado',
				'settings.json',
			);
			const settingsContent = fs.readFileSync(settingsPath, 'utf8');
			const settings = JSON.parse(settingsContent) as Settings;
			return settings.model;
		} catch {
			// Fallback to default model if settings file doesn't exist or is invalid
			return defaultModel;
		}
	}

	private async processStream(
		stream: EventStream<CompletionEvent>,
		model: string,
		onTokenProgress?: TokenProgressCallback,
	): Promise<ResponseResult> {
		let assistantMessages: AssistantMessage[] = [];
		let usage: UsageInfo | undefined;
		let hasError = false;
		let cumulativeTokens = 0;

		for await (const chunk of stream) {
			if (chunk.data.choices.length > 0) {
				const result = this.processChunkChoices(
					chunk.data.choices,
					assistantMessages,
				);

				assistantMessages = result.updatedMessages;
				hasError = result.hasError;

				if (hasError) break;
			}

			if (chunk.data.usage) {
				usage = chunk.data.usage;
				// Update cumulative tokens and notify progress
				const newTokenCount = usage.completionTokens;
				if (newTokenCount > cumulativeTokens) {
					cumulativeTokens = newTokenCount;
					if (onTokenProgress) {
						onTokenProgress(cumulativeTokens);
					}
				}
			}
		}

		return this.buildResponse(assistantMessages, usage, model, hasError);
	}

	private processChunkChoices(
		choices: CompletionResponseStreamChoice[],
		messages: AssistantMessage[],
	): {hasError: boolean; updatedMessages: AssistantMessage[]} {
		if (!Array.isArray(choices)) {
			return {hasError: false, updatedMessages: messages};
		}

		let currentMessages = messages;

		for (const choice of choices) {
			if (choice.finishReason === 'error') {
				return {hasError: true, updatedMessages: currentMessages};
			}

			if (choice.delta && typeof choice.index === 'number') {
				currentMessages = this.processChoiceDelta(choice, currentMessages);
			}
		}

		return {hasError: false, updatedMessages: currentMessages};
	}

	private processChoiceDelta(
		choice: CompletionResponseStreamChoice,
		messages: AssistantMessage[],
	): AssistantMessage[] {
		const {index} = choice;
		const updatedMessages = [...messages];

		// Initialize message if it doesn't exist
		updatedMessages[index] ??= {
			role: 'assistant',
			content: '',
			toolCalls: [],
		};

		let message = updatedMessages[index];

		// Update content if present
		if (choice.delta.content && typeof choice.delta.content === 'string') {
			message = this.updateMessageContent(message, choice.delta.content);
			updatedMessages[index] = message;
		}

		// Update tool calls if present
		if (choice.delta.toolCalls) {
			message = this.processToolCallDeltas(message, choice.delta.toolCalls);
			updatedMessages[index] = message;
		}

		return updatedMessages;
	}

	private updateMessageContent(
		message: AssistantMessage,
		content: string,
	): AssistantMessage {
		const updatedContent =
			typeof message.content === 'string' ? message.content + content : content;

		return {
			...message,
			content: updatedContent,
		};
	}

	private processToolCallDeltas(
		message: AssistantMessage,
		toolCallDeltas: ToolCall[],
	): AssistantMessage {
		if (!Array.isArray(toolCallDeltas)) {
			return message;
		}

		let updatedToolCalls = message.toolCalls ? [...message.toolCalls] : [];

		for (const delta of toolCallDeltas) {
			if (typeof delta.index === 'number') {
				updatedToolCalls = this.updateToolCallDelta(updatedToolCalls, delta);
			}
		}

		return {
			...message,
			toolCalls: updatedToolCalls,
		};
	}

	private updateToolCallDelta(
		toolCalls: NonNullable<AssistantMessage['toolCalls']>,
		delta: ToolCall,
	): NonNullable<AssistantMessage['toolCalls']> {
		if (!delta.index && delta.index !== 0) {
			return toolCalls;
		}

		const {index} = delta;
		const updatedToolCalls = [...toolCalls];

		// Initialize tool call if it doesn't exist
		updatedToolCalls[index] ??= {
			id: String(delta.id ?? ''),
			type: 'function',
			function: {
				name: '',
				arguments: '',
			},
		};

		const existingToolCall = updatedToolCalls[index];
		const updatedToolCall = {...existingToolCall};

		// Update tool call ID
		if (delta.id && typeof delta.id === 'string') {
			updatedToolCall.id = delta.id;
		}

		// Update function properties
		if (delta.function) {
			updatedToolCall.function = {...updatedToolCall.function};

			if (delta.function.name && typeof delta.function.name === 'string') {
				updatedToolCall.function.name = delta.function.name;
			}

			if (
				delta.function.arguments &&
				typeof delta.function.arguments === 'string' &&
				typeof updatedToolCall.function.arguments === 'string'
			) {
				updatedToolCall.function.arguments += delta.function.arguments;
			}
		}

		updatedToolCalls[index] = updatedToolCall;
		return updatedToolCalls;
	}

	private buildResponse(
		assistantMessages: AssistantMessage[],
		usage: UsageInfo | undefined,
		model: string,
		hasError: boolean,
	): ResponseResult {
		if (hasError) {
			return {
				error: 'An error occurred during processing.',
				assistantMessages: [],
				model,
			};
		}

		if (assistantMessages.length === 0) {
			return {
				error: 'No response from Mistral API.',
				assistantMessages: [],
				model,
			};
		}

		const validMessages = assistantMessages.filter(Boolean);

		if (validMessages.length > 0) {
			return {
				error: undefined,
				assistantMessages: validMessages,
				model,
				usage: usage ?? {
					promptTokens: 0,
					completionTokens: 0,
					totalTokens: 0,
				},
			};
		}

		return {
			error: 'Unexpected response format from Mistral API.',
			assistantMessages: [],
			model,
		};
	}
}
