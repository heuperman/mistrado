import type {
	ConversationCallbacks,
	ConversationEntry,
	ToolPermissionRequest,
} from '../types/callbacks.js';

/**
 * Creates print mode callbacks that capture output for the Unix tool.
 * This adapter allows the framework-agnostic ConversationService to work
 * in a non-interactive environment.
 */
export function createPrintModeCallbacks(): ConversationCallbacks & {
	getOutputContent: () => string;
	hasError: () => boolean;
} {
	const state = {
		outputContent: '',
		hasError: false,
	};

	return {
		getOutputContent: () => state.outputContent,
		hasError: () => state.hasError,
		onError(error: string | undefined) {
			if (error) {
				console.error(`Error: ${error}`);
				state.hasError = true;
			}
		},
		onHistoryUpdate(entry: Omit<ConversationEntry, 'id'>) {
			if (entry.type === 'assistant') {
				state.outputContent += entry.content;
			}

			// Ignore other entry types in print mode
			return crypto.randomUUID(); // Return dummy ID
		},
		onAbortControllerCreate: () => new AbortController(),
		// Optional callbacks - not needed in print mode
		onMessagesUpdate: undefined,
		onHistoryStatusUpdate: undefined,
		onUsageUpdate: undefined,
		onLoadingChange: undefined,
		onTokenProgress: undefined,
		onInterruptionCheck: () => false, // Never interrupt in print mode
		onToolPermissionRequest: async (_request: ToolPermissionRequest) => true, // Auto-approve all tools in print mode
	};
}
