import type {Dispatch, SetStateAction} from 'react';
import type {UsageInfo} from '@mistralai/mistralai/models/components/usageinfo.js';
import type {
	ConversationCallbacks,
	CommandCallbacks,
	ConversationEntry,
	ToolPermissionRequest,
} from '../types/callbacks.js';
import type {MistralMessage} from '../types/mistral.js';
import {deleteSecret} from '../services/secrets-service.js';

/**
 * Creates React-compatible conversation callbacks from React state setters.
 * This adapter allows the framework-agnostic ConversationService to work
 * with React state management.
 */
export function createReactConversationCallbacks(reactCallbacks: {
	setErrorOutput: Dispatch<SetStateAction<string | undefined>>;
	setSessionMessages: Dispatch<SetStateAction<MistralMessage[]>>;
	addToHistory: (entry: Omit<ConversationEntry, 'id'>) => string;
	updateHistoryStatus?: (id: string, status: 'success' | 'error') => void;
	updateUsage?: (usage: UsageInfo, model: string) => void;
	setIsLoading?: Dispatch<SetStateAction<boolean>>;
	updateTokenCount?: (tokens: number) => void;
	checkInterruption?: () => boolean;
	createAbortController: () => AbortController;
	requestToolPermission?: (request: ToolPermissionRequest) => Promise<boolean>;
}): ConversationCallbacks {
	return {
		onError(error) {
			reactCallbacks.setErrorOutput(error);
		},
		onHistoryUpdate: reactCallbacks.addToHistory,
		onMessagesUpdate(updater) {
			reactCallbacks.setSessionMessages(updater);
		},
		onAbortControllerCreate: reactCallbacks.createAbortController,
		onHistoryStatusUpdate: reactCallbacks.updateHistoryStatus,
		onUsageUpdate: reactCallbacks.updateUsage,
		onLoadingChange: reactCallbacks.setIsLoading,
		onTokenProgress: reactCallbacks.updateTokenCount,
		onInterruptionCheck: reactCallbacks.checkInterruption,
		onToolPermissionRequest: reactCallbacks.requestToolPermission,
	};
}

/**
 * Creates React-compatible command callbacks from React state setters.
 * This adapter allows the framework-agnostic CommandHandler to work
 * with React state management.
 */
export function createReactCommandCallbacks(reactCallbacks: {
	addToHistory: (content: string) => void;
	setSessionMessages: Dispatch<SetStateAction<MistralMessage[]>>;
	logAndExit: (message: string) => void;
	usage: Record<string, UsageInfo> | undefined;
	openSettings?: () => void;
}): CommandCallbacks {
	return {
		addToHistory: reactCallbacks.addToHistory,
		updateMessages(updater) {
			reactCallbacks.setSessionMessages(updater);
		},
		logAndExit: reactCallbacks.logAndExit,
		usage: reactCallbacks.usage,
		openSettings: reactCallbacks.openSettings,
		deleteSecret,
	};
}
