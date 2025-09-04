import type {Tool} from '@modelcontextprotocol/sdk/types.js';
import type {
	MistralTool,
	MistralToolCall,
	MistralToolMessage,
} from '../types/mistral.js';
import type {McpCallToolResult} from '../types/mcp.js';
import {editTool, handleEditTool} from '../tools/edit.js';
import {lsTool, handleLsTool} from '../tools/list.js';
import {writeTool, handleWriteTool} from '../tools/write.js';
import {readTool, handleReadTool} from '../tools/read.js';
import {multiEditTool, handleMultiEditTool} from '../tools/multi-edit.js';
import {globTool, handleGlobTool} from '../tools/glob.js';
import {grepTool, handleGrepTool} from '../tools/grep.js';
import {webFetchTool, handleWebFetchTool} from '../tools/web-fetch.js';
import {
	todoWriteTool,
	handleTodoWriteTool,
	type TodoItem,
} from '../tools/todo-write.js';
import {bashTool, handleBashTool} from '../tools/bash.js';

export class ToolManager {
	private readonly tools = new Map<string, MistralTool>();
	private readonly handlers = new Map<
		string,
		(args: unknown) => Promise<MistralToolMessage>
	>();

	private readonly todoStorage = new Map<string, TodoItem[]>();

	constructor() {
		this.registerTool(editTool, handleEditTool);
		this.registerTool(lsTool, handleLsTool);
		this.registerTool(writeTool, handleWriteTool);
		this.registerTool(readTool, handleReadTool);
		this.registerTool(multiEditTool, handleMultiEditTool);
		this.registerTool(globTool, handleGlobTool);
		this.registerTool(grepTool, handleGrepTool);
		this.registerTool(webFetchTool, handleWebFetchTool);
		this.registerTool(bashTool, handleBashTool);
		this.registerTodoWriteTool();
	}

	getAvailableTools(): MistralTool[] {
		return [...this.tools.values()];
	}

	getCurrentTodos(): TodoItem[] {
		return this.todoStorage.get('session') ?? [];
	}

	async callTool(toolCall: MistralToolCall): Promise<MistralToolMessage> {
		const toolName = toolCall.function.name.toLowerCase();
		const handler = this.handlers.get(toolName);

		if (!handler) {
			throw new Error(`Tool ${toolName} not found`);
		}

		const args: Record<string, unknown> =
			typeof toolCall.function.arguments === 'string'
				? (JSON.parse(toolCall.function.arguments) as Record<string, unknown>)
				: toolCall.function.arguments;

		try {
			const result = await handler(args);
			// Add the tool call ID to the response
			return {
				...result,
				toolCallId: toolCall.id,
			};
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : String(error);
			return {
				role: 'tool',
				toolCallId: toolCall.id,
				content: [
					{
						type: 'text',
						text: `Error: ${errorMessage}`,
					},
				],
			};
		}
	}

	private registerTool(
		tool: Tool,
		handler: (args: unknown) => Promise<McpCallToolResult>,
	): void {
		// Convert MCP tool format to Mistral format
		const mistralTool: MistralTool = {
			type: 'function',
			function: {
				name: tool.name,
				description: tool.description,
				parameters: tool.inputSchema,
			},
		};

		const name = tool.name.toLowerCase();

		this.tools.set(name, mistralTool);
		this.handlers.set(name, this.wrapHandler(handler));
	}

	private wrapHandler(
		handler: (args: unknown) => Promise<McpCallToolResult>,
	): (args: unknown) => Promise<MistralToolMessage> {
		return async (args: unknown): Promise<MistralToolMessage> => {
			const result = await handler(args);

			// Convert MCP result format to Mistral format
			if ('content' in result && result.content) {
				return {
					role: 'tool',
					content: result.content.map(item => ({
						type: 'text',
						text: item.type === 'text' ? item.text : JSON.stringify(item),
					})),
				};
			}

			// Fallback for any other format
			return {
				role: 'tool',
				content: [
					{
						type: 'text',
						text: typeof result === 'string' ? result : JSON.stringify(result),
					},
				],
			};
		};
	}

	private registerTodoWriteTool(): void {
		// Convert MCP tool format to Mistral format
		const mistralTool: MistralTool = {
			type: 'function',
			function: {
				name: todoWriteTool.name,
				description: todoWriteTool.description,
				parameters: todoWriteTool.inputSchema,
			},
		};

		const name = todoWriteTool.name.toLowerCase();

		this.tools.set(name, mistralTool);
		this.handlers.set(
			name,
			async (args: unknown): Promise<MistralToolMessage> => {
				const result = await handleTodoWriteTool(args, this.todoStorage);

				// Convert MCP result format to Mistral format
				if ('content' in result && result.content) {
					return {
						role: 'tool',
						content: result.content.map(item => ({
							type: 'text',
							text: item.type === 'text' ? item.text : JSON.stringify(item),
						})),
					};
				}

				// Fallback for any other format
				return {
					role: 'tool',
					content: [
						{
							type: 'text',
							text:
								typeof result === 'string' ? result : JSON.stringify(result),
						},
					],
				};
			},
		);
	}
}
