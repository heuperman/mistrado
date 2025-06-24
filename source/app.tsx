import React from 'react';
import {Box, Text} from 'ink';
import TextInput from 'ink-text-input';
import Login from './components/login.js';
import Hero from './components/hero.js';
import Conversation from './components/conversation.js';
import {useAppState} from './hooks/use-app-state.js';
import {useSignalHandler} from './hooks/use-signal-handler.js';
import {CommandHandler} from './commands/command-handler.js';
import {ConversationService} from './services/conversation-service.js';

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
		setApiKey,
		setPrompt,
		setIsLoading,
		setErrorOutput,
		setSessionMessages,
		setShouldExit,
		addToHistory,
		logAndExit,
		updateUsage,
	} = useAppState();

	useSignalHandler(mcpManager, shouldExit, setShouldExit);

	const handleSubmit = async (promptInput: string) => {
		setIsLoading(true);
		setPrompt('');
		setErrorOutput(undefined);

		const trimmedPrompt = promptInput.trim();

		addToHistory({
			id: Date.now(),
			type: 'user',
			content: trimmedPrompt,
		});

		if (commandHandler.isCommand(trimmedPrompt)) {
			const addToHistoryCommand = (content: string) => {
				addToHistory({
					id: Date.now(),
					type: 'command',
					content,
				});
			};

			await commandHandler.handleCommand(
				commandHandler.extractCommand(trimmedPrompt),
				addToHistoryCommand,
				logAndExit,
				sessionUsage,
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

			try {
				await conversationService.handleRequest(
					{
						service: mistralService,
						messages: updatedMessages,
						tools,
						mcpManager,
					},
					{
						onUsageUpdate: updateUsage,
						onError: setErrorOutput,
						onHistoryUpdate: addToHistory,
						onMessagesUpdate: setSessionMessages,
						onLoadingChange: setIsLoading,
					},
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

	return (
		<Box width="100%" flexDirection="column" gap={1}>
			<Hero />
			<Conversation
				history={conversationHistory}
				isLoading={isLoading}
				errorOutput={errorOutput}
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
