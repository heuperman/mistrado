import {Mistral} from '@mistralai/mistralai';
import {
	type AssistantMessage,
	type Tool,
} from '@mistralai/mistralai/models/components/index.js';
import {type MistralMessage} from '../types/mistral.js';

export type TokenUsage = {
	promptTokens: number;
	completionTokens: number;
	totalTokens: number;
};

type SuccessResponse = {
	error: undefined;
	assistantMessages: AssistantMessage[];
	model: string;
	usage: TokenUsage;
};

type ErrorResponse = {
	error: string;
	assistantMessages: never[];
	model: string;
	usage?: never;
};

export type ResponseResult = SuccessResponse | ErrorResponse;

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
	): Promise<ResponseResult> {
		const model = 'devstral-small-2505';

		if (!this.client) {
			throw new Error(
				'Mistral client not initialized. Please ensure API key is set.',
			);
		}

		const response = await this.client.chat.complete({
			model,
			messages,
			tools,
		});

		if (response.choices.length === 0) {
			const error = 'No response from Mistral API.';
			return {error, assistantMessages: [], model};
		}

		const assistantMessages: AssistantMessage[] = [];

		for (const choice of response.choices) {
			if (choice.finishReason === 'error') {
				const error = 'An error occurred during processing.';
				return {error, assistantMessages: [], model};
			}

			assistantMessages.push(choice.message);
		}

		if (assistantMessages.length > 0) {
			return {
				error: undefined,
				assistantMessages,
				model,
				usage: response.usage,
			};
		}

		return {
			error: 'Unexpected response format from Mistral API.',
			assistantMessages: [],
			model,
		};
	}
}
