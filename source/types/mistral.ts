import {
	AssistantMessage,
	SystemMessage,
	ToolMessage,
	UserMessage,
} from '@mistralai/mistralai/models/components/index.js';

export type MistralMessage =
	| (SystemMessage & {role: 'system'})
	| (UserMessage & {role: 'user'})
	| (AssistantMessage & {role: 'assistant'})
	| (ToolMessage & {role: 'tool'});

export type MistralTool = {
	type?: 'function';
	function: {
		name: string;
		description?: string;
		strict?: boolean;
		parameters: Record<string, unknown>;
	};
};

export type MistralToolCall = {
	id?: string;
	type?: 'function' | string;
	function: {
		name: string;
		arguments: Record<string, unknown> | string;
	};
	index?: number;
};

type MistralImageURLChunk = {
	type: 'image_url';
	imageUrl:
		| string
		| {
				url: string;
				detail?: string | null;
		  };
};

type MistralTextChunk = {
	type: 'text';
	text: string;
};

type MistralReferenceChunk = {
	type: 'reference';
	referenceIds: number[];
};

type MistralContentChunk =
	| MistralTextChunk
	| MistralImageURLChunk
	| MistralReferenceChunk;

export type MistralToolMessage = {
	role: 'tool';
	content: string | MistralContentChunk[] | null;
	toolCallId?: string | null;
	name?: string | null;
};
