import type {MistralMessage, MistralToolCall} from '../types/mistral.js';
import type {
	ConversationCallbacks,
	ToolPermissionRequest,
} from '../types/callbacks.js';
import {formatToolCallDisplay} from '../utils/app-utils.js';
import type {McpManager} from './mcp-manager.js';

export type ToolExecutionResult = {
	success: boolean;
	toolResults: MistralMessage[];
	error?: string;
};

/**
 * Manages the complete tool execution lifecycle including validation,
 * execution, and result collection. Provides clean hooks for future
 * permission checking integration.
 */
export class ToolExecutionManager {
	/**
	 * Validates that all tool calls have the required properties
	 */
	validateToolCalls(toolCalls: MistralToolCall[]): string | undefined {
		for (const toolCall of toolCalls) {
			if (!toolCall?.function?.name) {
				return 'Tool call missing function name';
			}

			if (!toolCall.id) {
				return 'Tool call missing ID';
			}
		}

		return undefined;
	}

	/**
	 * Executes a batch of tool calls and collects all results.
	 * Returns success flag and all tool result messages.
	 */
	async executeToolBatch(
		toolCalls: MistralToolCall[],
		mcpManager: McpManager,
		callbacks: ConversationCallbacks,
	): Promise<ToolExecutionResult> {
		const toolResults: MistralMessage[] = [];

		// Validate all tool calls first
		const validationError = this.validateToolCalls(toolCalls);
		if (validationError) {
			return {
				success: false,
				toolResults: [],
				error: validationError,
			};
		}

		// Request permissions for all tools (if permission callback exists)
		if (callbacks.onToolPermissionRequest) {
			// Sequential permission checking is required for fail-fast behavior
			for (const toolCall of toolCalls) {
				const permissionRequest = this.createPermissionRequest(
					toolCall,
					mcpManager,
				);

				const approved =
					// eslint-disable-next-line no-await-in-loop
					await callbacks.onToolPermissionRequest(permissionRequest);

				if (!approved) {
					// If any tool is denied, reject all tools in the batch (fail-fast)
					const rejectionMessages = this.generateRejectionMessages(toolCalls);
					return {
						success: false,
						toolResults: rejectionMessages,
						error: 'Tool permissions denied by user',
					};
				}
			}
		}

		// Execute all tool calls
		const toolCallResults = await Promise.allSettled(
			toolCalls.map(async toolCall => {
				let toolEntryId: string | undefined;

				try {
					// Display tool execution in UI
					toolEntryId = callbacks.onHistoryUpdate({
						type: 'tool',
						content: formatToolCallDisplay(
							toolCall.function.name,
							toolCall.function.arguments,
						),
						status: 'running',
						toolCallId: toolCall.id,
					});

					// Execute the tool
					const result = await mcpManager.callTool(toolCall);

					if (!result) {
						throw new Error('Tool call returned empty result');
					}

					// Update UI status to success
					if (callbacks.onHistoryStatusUpdate) {
						callbacks.onHistoryStatusUpdate(toolEntryId, 'success');
					}

					return {success: true, result: result as MistralMessage};
				} catch (toolError) {
					const errorMessage =
						toolError instanceof Error ? toolError.message : String(toolError);

					// Update UI status to error
					if (callbacks.onHistoryStatusUpdate && toolEntryId !== undefined) {
						callbacks.onHistoryStatusUpdate(toolEntryId, 'error');
					}

					// Report error to user
					callbacks.onError(
						`Tool ${toolCall.function?.name || 'unknown'} failed: ${errorMessage}`,
					);

					// Create error tool message for API
					const errorToolMessage: MistralMessage = {
						role: 'tool',
						content: `Error: ${errorMessage}`,
						toolCallId: toolCall.id ?? '',
					};

					return {success: false, result: errorToolMessage};
				}
			}),
		);

		// Collect all results
		let hasValidResults = false;
		for (const result of toolCallResults) {
			if (result.status === 'fulfilled' && result.value.result) {
				toolResults.push(result.value.result);
				if (result.value.success) {
					hasValidResults = true;
				}
			} else if (result.status === 'rejected') {
				callbacks.onError(
					`Tool call promise rejected: ${String(result.reason)}`,
				);
			}
		}

		if (!hasValidResults) {
			return {
				success: false,
				toolResults,
				error: 'All tool calls failed - unable to continue conversation',
			};
		}

		return {
			success: true,
			toolResults,
		};
	}

	/**
	 * Generates synthetic tool result messages for interrupted tool calls.
	 * Used when tool execution is interrupted by user or system.
	 */
	generateInterruptedToolMessages(
		toolCalls: MistralToolCall[],
	): MistralMessage[] {
		return toolCalls.map(toolCall => ({
			role: 'tool' as const,
			content: 'Interrupted by user',
			toolCallId: toolCall.id,
		}));
	}

	/**
	 * Creates a permission request for a tool call by finding its description
	 * from the available tools.
	 */
	private createPermissionRequest(
		toolCall: MistralToolCall,
		mcpManager: McpManager,
	): ToolPermissionRequest {
		const availableTools = mcpManager.getAvailableTools();
		const tool = availableTools.find(
			t => t.function.name === toolCall.function.name,
		);

		return {
			toolCall,
			toolName: toolCall.function.name,
			description:
				tool?.function.description ?? `Execute ${toolCall.function.name} tool`,
		};
	}

	/**
	 * Generates synthetic rejection messages for all tool calls in a batch.
	 * This is used when any tool in the batch is denied by the user.
	 */
	private generateRejectionMessages(
		toolCalls: MistralToolCall[],
	): MistralMessage[] {
		return toolCalls.map(toolCall => ({
			role: 'tool' as const,
			content: `User rejected ${toolCall.function.name}`,
			toolCallId: toolCall.id ?? '',
		}));
	}
}
