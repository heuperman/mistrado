import {
	type AssistantMessage,
	type SystemMessage,
	type ToolMessage,
	type UserMessage,
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

type MistralImageUrlChunk = {
	type: 'image_url';
	imageUrl:
		| string
		| {
				url: string;
				detail?: string | undefined;
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

type MistralFunctionChunk = {
	type: 'function';
	id?: string;
	function: {
		name: string;
		arguments: Record<string, unknown> | string;
	};
};

export type MistralContentChunk =
	| MistralTextChunk
	| MistralImageUrlChunk
	| MistralReferenceChunk
	| MistralFunctionChunk;

export type MistralToolMessage = {
	role: 'tool';
	content: string | MistralContentChunk[] | undefined;
	toolCallId?: string | undefined;
	name?: string | undefined;
};
