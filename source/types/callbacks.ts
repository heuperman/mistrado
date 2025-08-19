import type {UsageInfo} from '@mistralai/mistralai/models/components/index.js';
import type {MistralMessage} from './mistral.js';

export type ToolCallStatus = 'running' | 'success' | 'error';

export type ConversationEntry = {
	id: string;
	type: 'user' | 'assistant' | 'command' | 'tool';
	content: string;
	status?: ToolCallStatus;
	toolCallId?: string;
};

/**
 * Generic callback interface for conversation handling.
 * This interface is framework-agnostic and can be implemented
 * for React, print mode, or any other environment.
 */
export type ConversationCallbacks = {
	onError: (error: string | undefined) => void;
	onHistoryUpdate: (entry: Omit<ConversationEntry, 'id'>) => string;
	onAbortControllerCreate: () => AbortController;
	onInterruptionCheck?: () => boolean;
	onMessagesUpdate?: (
		updater: (messages: MistralMessage[]) => MistralMessage[],
	) => void;
	onHistoryStatusUpdate?: (id: string, status: 'success' | 'error') => void;
	onUsageUpdate?: (usage: UsageInfo, model: string) => void;
	onLoadingChange?: (loading: boolean) => void;
	onTokenProgress?: (tokens: number) => void;
};

/**
 * Generic callback interface for command handling.
 * This interface is framework-agnostic and can be implemented
 * for React, print mode, or any other environment.
 */
export type CommandCallbacks = {
	addToHistory: (content: string) => void;
	updateMessages: (
		updater: (messages: MistralMessage[]) => MistralMessage[],
	) => void;
	logAndExit: (message: string) => void;
	usage: Record<string, UsageInfo> | undefined;
	openSettings?: () => void;
	deleteSecret: (key: string) => Promise<void>;
};
