import type {MistralMessage, MistralToolCall} from '../types/mistral.js';
import type {
	ConversationCallbacks,
	ToolPermissionRequest,
} from '../types/callbacks.js';
import {formatToolCallDisplay} from '../utils/app-utils.js';
import type {McpManager} from './mcp-manager.js';
import {PermissionStorage} from './permission-storage.js';

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
	 * Tools that are considered safe and don't require permission prompts.
	 * These tools only read data or manage internal state without external effects.
	 */
	private readonly safeTools = new Set([
		'Glob',
		'Grep',
		'List',
		'Read',
		'TodoWrite',
	]);

	private readonly permissionStorage = new PermissionStorage();

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

		// Request permissions for unsafe tools only (if permission callback exists)
		if (callbacks.onToolPermissionRequest) {
			const unsafeToolCalls = toolCalls.filter(
				toolCall => !this.safeTools.has(toolCall.function.name),
			);

			// Filter out tools that already have session or persistent permissions
			const toolsNeedingPermission =
				await this.filterToolsNeedingPermission(unsafeToolCalls);

			// Sequential permission checking is required for fail-fast behavior
			const permissionResult = await this.requestPermissions(
				toolsNeedingPermission,
				toolCalls,
				mcpManager,
				callbacks,
			);

			if (!permissionResult.success) {
				return permissionResult;
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
	 * Clears all session permissions. Called when session ends.
	 */
	clearSessionPermissions(): void {
		this.permissionStorage.clearSessionPermissions();
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

	/**
	 * Filters tools to find those that need permission requests.
	 */
	private async filterToolsNeedingPermission(
		toolCalls: MistralToolCall[],
	): Promise<MistralToolCall[]> {
		const permissionChecks = await Promise.all(
			toolCalls.map(async toolCall => ({
				toolCall,
				hasPermission: await this.permissionStorage.hasPermission(toolCall),
			})),
		);

		return permissionChecks
			.filter(check => !check.hasPermission)
			.map(check => check.toolCall);
	}

	/**
	 * Requests permissions for tools and handles responses.
	 */
	private async requestPermissions(
		toolsNeedingPermission: MistralToolCall[],
		allToolCalls: MistralToolCall[],
		mcpManager: McpManager,
		callbacks: ConversationCallbacks,
	): Promise<ToolExecutionResult> {
		// Sequential processing is required for fail-fast behavior on denial
		for (const toolCall of toolsNeedingPermission) {
			const permissionRequest = this.createPermissionRequest(
				toolCall,
				mcpManager,
			);

			const result =
				// eslint-disable-next-line no-await-in-loop
				await callbacks.onToolPermissionRequest!(permissionRequest);

			if (result === 'deny') {
				const rejectionMessages = this.generateRejectionMessages(allToolCalls);
				return {
					success: false,
					toolResults: rejectionMessages,
					error: 'Tool permissions denied by user',
				};
			}

			// eslint-disable-next-line no-await-in-loop
			await this.storePermissionDecision(toolCall, result);
		}

		return {success: true, toolResults: []};
	}

	/**
	 * Stores permission decision based on user choice.
	 */
	private async storePermissionDecision(
		toolCall: MistralToolCall,
		decision: 'once' | 'session',
	): Promise<void> {
		if (decision === 'session') {
			this.permissionStorage.storeSessionPermission(toolCall, true);
		}
	}
}
