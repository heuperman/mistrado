import process from 'node:process';
import {useEffect, useState} from 'react';
import type {UsageInfo} from '@mistralai/mistralai/models/components/usageinfo.js';
import {getSecret} from '../services/secrets-service.js';
import {MistralService} from '../services/mistral-service.js';
import {McpManager} from '../services/mcp-manager.js';
import {getMainSystemPrompt} from '../prompts/system.js';
import {isGitRepo} from '../utils/git.js';
import {loadCustomInstruction} from '../utils/custom-instructions.js';
import type {MistralMessage} from '../types/mistral.js';
import type {ConversationEntry} from '../services/conversation-service.js';

export function useAppState() {
	const [mistralService, setMistralService] = useState<
		MistralService | undefined
	>();
	const [mcpManager, setMcpManager] = useState<McpManager | undefined>();
	const [apiKey, setApiKey] = useState<string | undefined>();
	const [prompt, setPrompt] = useState('');
	const [conversationHistory, setConversationHistory] = useState<
		ConversationEntry[]
	>([]);
	const [isLoading, setIsLoading] = useState(false);
	const [errorOutput, setErrorOutput] = useState<string | undefined>();
	const [sessionMessages, setSessionMessages] = useState<MistralMessage[]>([]);
	const [sessionUsage, setSessionUsage] = useState<
		Record<string, UsageInfo> | undefined
	>();
	const [shouldExit, setShouldExit] = useState(false);
	const [currentTokenCount, setCurrentTokenCount] = useState(0);
	const [showSettings, setShowSettings] = useState(false);

	// Initialize Mistral client
	useEffect(() => {
		async function initializeClient() {
			try {
				const secretKey = await getSecret('MISTRAL_API_KEY');
				if (secretKey) {
					try {
						setApiKey(secretKey);
						const service = new MistralService(secretKey);
						setMistralService(service);
					} catch (error) {
						setErrorOutput(
							`Error initializing Mistral client: ${
								error instanceof Error ? error.message : String(error)
							}`,
						);
					}
				}
			} catch (error) {
				setErrorOutput(
					`Error fetching API Key: ${
						error instanceof Error ? error.message : String(error)
					}`,
				);
			}
		}

		void initializeClient();
	}, []);

	// Initialize MCP Manager
	useEffect(() => {
		async function initializeMcpManager() {
			try {
				const manager = new McpManager();
				await manager.initializeBuiltinServers();
				setMcpManager(manager);
			} catch (error) {
				setErrorOutput(
					`Error initializing MCP Manager: ${
						error instanceof Error ? error.message : String(error)
					}`,
				);
			}
		}

		void initializeMcpManager();
	}, []);

	// Initialize system prompt
	useEffect(() => {
		if (sessionMessages.length === 0) {
			const workingDirectoryPath = process.cwd();
			const customInstruction = loadCustomInstruction(workingDirectoryPath);

			setSessionMessages([
				getMainSystemPrompt({
					workingDirectoryPath,
					isGitRepo: isGitRepo(workingDirectoryPath),
					platform: process.platform,
					todayDate: new Date(),
					customInstruction,
				}),
			]);
		}
	}, [sessionMessages.length]);

	const addToHistory = (entry: Omit<ConversationEntry, 'id'>): string => {
		const id = crypto.randomUUID();
		setConversationHistory(previous => [...previous, {id, ...entry}]);
		return id;
	};

	const updateHistoryStatus = (id: string, status: 'success' | 'error') => {
		setConversationHistory(previous =>
			previous.map(entry => (entry.id === id ? {...entry, status} : entry)),
		);
	};

	const logAndExit = (message: string) => {
		addToHistory({type: 'command', content: message});
		setShouldExit(true);
	};

	const updateUsage = (usage: UsageInfo, model: string) => {
		setSessionUsage(previousUsage => {
			if (!previousUsage) {
				return {[model]: usage};
			}

			if (previousUsage[model]) {
				return {
					...previousUsage,
					[model]: {
						promptTokens:
							previousUsage[model].promptTokens + usage.promptTokens,
						completionTokens:
							previousUsage[model].completionTokens + usage.completionTokens,
						totalTokens: previousUsage[model].totalTokens + usage.totalTokens,
					},
				};
			}

			return {
				...previousUsage,
				[model]: usage,
			};
		});
	};

	const updateTokenCount = (tokens: number) => {
		setCurrentTokenCount(tokens);
	};

	const resetTokenCount = () => {
		setCurrentTokenCount(0);
	};

	const openSettings = () => {
		setShowSettings(true);
	};

	const closeSettings = () => {
		setShowSettings(false);
	};

	return {
		// State
		mistralService,
		mcpManager,
		apiKey,
		prompt,
		conversationHistory,
		isLoading,
		errorOutput,
		sessionMessages,
		sessionUsage,
		shouldExit,
		currentTokenCount,
		showSettings,
		// Setters
		setApiKey,
		setPrompt,
		setIsLoading,
		setErrorOutput,
		setSessionMessages,
		setShouldExit,
		// Helpers
		addToHistory,
		updateHistoryStatus,
		logAndExit,
		updateUsage,
		updateTokenCount,
		resetTokenCount,
		openSettings,
		closeSettings,
	};
}
