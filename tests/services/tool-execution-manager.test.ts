import test from 'ava';
import type {ToolMessage} from '@mistralai/mistralai/models/components/index.js';
import {ToolExecutionManager} from '../../source/services/tool-execution-manager.js';
import type {MistralToolCall} from '../../source/types/mistral.js';

test('validateToolCalls - validates required properties', t => {
	const manager = new ToolExecutionManager();

	// Valid tool calls
	const validToolCalls: MistralToolCall[] = [
		{
			id: 'call-1',
			type: 'function',
			function: {name: 'test-tool', arguments: {}},
		},
	];

	t.is(manager.validateToolCalls(validToolCalls), undefined);

	// Missing function name
	const invalidToolCalls1: MistralToolCall[] = [
		{
			id: 'call-1',
			type: 'function',
			function: {name: '', arguments: {}},
		},
	];

	t.is(
		manager.validateToolCalls(invalidToolCalls1),
		'Tool call missing function name',
	);

	// Missing ID
	const invalidToolCalls2: MistralToolCall[] = [
		{
			id: '',
			type: 'function',
			function: {name: 'test-tool', arguments: {}},
		},
	];

	t.is(manager.validateToolCalls(invalidToolCalls2), 'Tool call missing ID');
});

test('generateInterruptedToolMessages - creates synthetic messages', t => {
	const manager = new ToolExecutionManager();

	const toolCalls: MistralToolCall[] = [
		{
			id: 'call-1',
			type: 'function',
			function: {name: 'read', arguments: {}},
		},
		{
			id: 'call-2',
			type: 'function',
			function: {name: 'write', arguments: {}},
		},
	];

	const result = manager.generateInterruptedToolMessages(
		toolCalls,
	) as ToolMessage[];

	t.is(result.length, 2);
	t.is(result[0].role, 'tool');
	t.is(result[0].content, 'Interrupted by user');
	t.is(result[0].toolCallId, 'call-1');
	t.is(result[1].role, 'tool');
	t.is(result[1].content, 'Interrupted by user');
	t.is(result[1].toolCallId, 'call-2');
});
