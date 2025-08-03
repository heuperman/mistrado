import test from 'ava';
import {toMistralTools} from '../../source/utils/converters.ts';
import type {McpListToolsResult} from '../../source/types/mcp.ts';

test('toMistralTools converts MCP tools to Mistral tools format', t => {
	const mcpTools: McpListToolsResult = {
		tools: [
			{
				name: 'testTool',
				description: 'A test tool',
				inputSchema: {type: 'object', properties: {param: {type: 'string'}}},
			},
		],
	};

	const result = toMistralTools(mcpTools);

	t.is(result.length, 1);
	t.deepEqual(result[0], {
		type: 'function',
		function: {
			name: 'testTool',
			description: 'A test tool',
			parameters: {type: 'object', properties: {param: {type: 'string'}}},
		},
	});
});
