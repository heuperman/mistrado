import {Mistral} from '@mistralai/mistralai';
import {EventStream} from '@mistralai/mistralai/lib/event-streams.js';
import {
	CompletionEvent,
	Tool,
} from '@mistralai/mistralai/models/components/index.js';
import {MistralMessage} from '../types/mistral.js';

let client: Mistral | null = null;

export function initializeMistralClient(apiKey: string): void {
	if (!apiKey) {
		throw new Error('API key is required to initialize Mistral client.');
	}
	client = new Mistral({apiKey});
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

	return client.chat.stream({
		model: 'devstral-small-2505',
		messages,
		tools,
	});
}
