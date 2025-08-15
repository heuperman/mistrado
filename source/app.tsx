import React from 'react';
import {Box, Text, useInput} from 'ink';
import TextInput from 'ink-text-input';
import Login from './components/login.js';
import Hero from './components/hero.js';
import Conversation from './components/conversation.js';
import {Settings} from './components/settings.js';
import {useAppState} from './hooks/use-app-state.js';
import {useSignalHandler} from './hooks/use-signal-handler.js';
import {CommandHandler} from './commands/command-handler.js';
import {ConversationService} from './services/conversation-service.js';
import {
	createReactConversationCallbacks,
	createReactCommandCallbacks,
} from './adapters/react-callbacks.js';

const commandHandler = new CommandHandler();
const conversationService = new ConversationService();

export default function App() {
	const {
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
		setApiKey,
		setPrompt,
		setIsLoading,
		setErrorOutput,
		setSessionMessages,
		setShouldExit,
		addToHistory,
		updateHistoryStatus,
		logAndExit,
		updateUsage,
		updateTokenCount,
		resetTokenCount,
		openSettings,
		closeSettings,
	} = useAppState();

	const isInterruptedRef = React.useRef(false);
	const abortControllerRef = React.useRef<AbortController | undefined>(
		undefined,
	);

	useSignalHandler(mcpManager, shouldExit);

	useInput((input, key) => {
		if (key.ctrl && input === 'c') {
			setShouldExit(true);
		}

		if (key.escape && isLoading) {
			// Abort API call if one is in progress
			if (abortControllerRef.current) {
				abortControllerRef.current.abort();
			}

			// Set interruption flag for tool call loops
			isInterruptedRef.current = true;
		}
	});

	const handleSubmit = async (promptInput: string) => {
		setIsLoading(true);
		setPrompt('');
		setErrorOutput(undefined);
		isInterruptedRef.current = false;
		abortControllerRef.current = undefined;
		resetTokenCount();

		const trimmedPrompt = promptInput.trim();

		addToHistory({
			type: 'user',
			content: trimmedPrompt,
		});

		if (commandHandler.isCommand(trimmedPrompt)) {
			const addToHistoryCommand = (content: string) => {
				addToHistory({type: 'command', content});
			};

			const commandCallbacks = createReactCommandCallbacks({
				addToHistory: addToHistoryCommand,
				setSessionMessages,
				logAndExit,
				usage: sessionUsage,
				openSettings,
			});

			await commandHandler.handleCommand(
				commandHandler.extractCommand(trimmedPrompt),
				commandCallbacks,
			);
			setIsLoading(false);
		} else {
			if (!mistralService) {
				setErrorOutput(
					'Mistral service not initialized. Please wait or restart if problem persists.',
				);
				setIsLoading(false);
				return;
			}

			const updatedMessages = [
				...sessionMessages,
				{role: 'user' as const, content: trimmedPrompt},
			];
			setSessionMessages(updatedMessages);

			const tools = mcpManager ? mcpManager.getAvailableTools() : [];

			const conversationCallbacks = createReactConversationCallbacks({
				setErrorOutput,
				setSessionMessages,
				addToHistory,
				updateHistoryStatus,
				updateUsage,
				setIsLoading,
				updateTokenCount,
				checkInterruption() {
					const interrupted = isInterruptedRef.current;
					if (interrupted) {
						isInterruptedRef.current = false;
					}

					return interrupted;
				},
				createAbortController() {
					const controller = new AbortController();
					abortControllerRef.current = controller;
					return controller;
				},
			});

			try {
				await conversationService.handleRequest(
					{
						service: mistralService,
						messages: updatedMessages,
						tools,
						mcpManager,
					},
					conversationCallbacks,
				);
			} catch (error) {
				setErrorOutput(
					`Error getting response: ${
						error instanceof Error ? error.message : String(error)
					}`,
				);
			}

			setIsLoading(false);
		}
	};

	if (!apiKey) return <Login setApiKey={setApiKey} />;

	if (showSettings) {
		return (
			<Box width="100%" flexDirection="column" gap={1}>
				<Hero />
				<Settings
					onComplete={(message: string) => {
						addToHistory({type: 'command', content: message});
						closeSettings();
					}}
				/>
			</Box>
		);
	}

	return (
		<Box width="100%" flexDirection="column" gap={1}>
			<Hero />
			<Conversation
				history={conversationHistory}
				isLoading={isLoading}
				errorOutput={errorOutput}
				currentTokenCount={currentTokenCount}
			/>
			<Box
				width="100%"
				gap={1}
				paddingX={1}
				borderColor="grey"
				borderStyle="round"
			>
				<Text>&gt;</Text>
				<TextInput
					value={prompt}
					onChange={setPrompt}
					onSubmit={handleSubmit}
				/>
			</Box>
		</Box>
	);
}
