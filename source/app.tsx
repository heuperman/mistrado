import React, {useEffect, useState} from 'react';
import {Box, Text} from 'ink';
import TextInput from 'ink-text-input';
import {deleteSecret, getSecret} from './services/secretsService.js';
import ApiKeyInput from './components/ApiKeyInput.js';
import {
	getResponse,
	initializeMistralClient,
	getMCPManager,
} from './services/mistralService.js';
import Hero from './components/Hero.js';
import {MistralMessage, MistralToolCall} from './types/mistral.js';
import {toMistralMessage} from './utils/converters.js';

const handleCommand = (commandInput: string) => {
	const command = commandInput.trim().toLowerCase();

	switch (command) {
		case 'exit':
		case 'quit':
			process.exit(0);
		case 'help':
			return 'Available commands: /exit, /quit, /help, /logout';
		case 'logout':
			deleteSecret('MISTRAL_API_KEY');
			return 'Logged out successfully. Please restart the app to enter a new API Key.';
		case 'clear':
		default:
			return `Unknown command: ${command}`;
	}
};

export default function App() {
	const [prompt, setPrompt] = useState('');
	const [response, setResponse] = useState('');
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [apiKey, setApiKey] = useState<string | null>(null);
	const [messages, setMessages] = useState<MistralMessage[]>([]);

	useEffect(() => {
		async function fetchApiKey() {
			try {
				const key = await getSecret('MISTRAL_API_KEY');
				setApiKey(key);
			} catch (err) {
				setError(
					`Error fetching API Key: ${
						err instanceof Error ? err.message : String(err)
					}`,
				);
			}
		}
		fetchApiKey();
	}, []);

	useEffect(() => {
		if (apiKey) {
			const initializeClient = async () => {
				try {
					await initializeMistralClient(apiKey);
				} catch (err) {
					setError(
						`Error initializing Mistral client: ${
							err instanceof Error ? err.message : String(err)
						}`,
					);
				}
			};
			initializeClient();
		}
	}, [apiKey]);

	const handleSubmit = async (promptInput: string) => {
		setLoading(true);
		setResponse('');
		setPrompt('');
		setError(null);

		const prompt = promptInput.trim();

		if (prompt.startsWith('/')) {
			const result = handleCommand(prompt.slice(1));
			setResponse(result);
			setLoading(false);
			return;
		} else {
			// Add user message to history
			const updatedMessages: MistralMessage[] = [
				...messages,
				{role: 'user', content: prompt},
			];
			setMessages(updatedMessages);

			try {
				// Use updated messages for API call
				const result = await getResponse(updatedMessages);
				let accumulatedResponse = '';
				let toolCalls: MistralToolCall[] = [];

				for await (const chunk of result) {
					const choice = chunk.data.choices[0];
					
					// Handle text content
					const streamText = choice?.delta.content;
					if (streamText) {
						accumulatedResponse += streamText;
						setResponse(prev => prev + streamText);
					}

					// Handle tool calls
					if (choice?.delta.toolCalls) {
						for (const toolCallDelta of choice.delta.toolCalls) {
							if (toolCallDelta.index !== undefined) {
								// Initialize tool call if it doesn't exist
								if (!toolCalls[toolCallDelta.index]) {
									toolCalls[toolCallDelta.index] = {
										id: toolCallDelta.id || '',
										type: 'function',
										function: {
											name: '',
											arguments: '',
										},
									};
								}

								const toolCall = toolCalls[toolCallDelta.index];
								if (toolCall) {
									// Update tool call with delta
									if (toolCallDelta.id) {
										toolCall.id = toolCallDelta.id;
									}
									if (toolCallDelta.function?.name) {
										toolCall.function.name += toolCallDelta.function.name;
									}
									if (toolCallDelta.function?.arguments) {
										if (typeof toolCall.function.arguments === 'string') {
											toolCall.function.arguments += toolCallDelta.function.arguments;
										}
									}
								}
							}
						}
					}
				}

				// Execute tool calls if any
				const mcpManager = getMCPManager();
				if (toolCalls.length > 0 && mcpManager) {
					setResponse(prev => prev + '\n\n[Executing tools...]');

					const toolMessages: MistralMessage[] = [];
					for (const toolCall of toolCalls) {
						try {
							// Parse arguments if they're a string
							if (typeof toolCall.function.arguments === 'string') {
								toolCall.function.arguments = JSON.parse(toolCall.function.arguments);
							}

							const toolResult = await mcpManager.callTool(toolCall);
							const toolMessage = toMistralMessage(toolCall.id || '', toolResult);
							toolMessages.push(toolMessage);

							// Display tool execution result
							if (Array.isArray(toolMessage.content)) {
								const textContent = toolMessage.content
									.filter(item => item.type === 'text')
									.map(item => (item as any).text)
									.join('\n');
								setResponse(prev => prev + `\n\n**${toolCall.function.name}:**\n${textContent}`);
							} else if (typeof toolMessage.content === 'string') {
								setResponse(prev => prev + `\n\n**${toolCall.function.name}:**\n${toolMessage.content}`);
							}
						} catch (toolError) {
							const errorMsg = toolError instanceof Error ? toolError.message : String(toolError);
							setResponse(prev => prev + `\n\n**${toolCall.function.name} Error:**\n${errorMsg}`);
						}
					}

					// Add assistant message with tool calls and tool responses to history
					const assistantWithTools: MistralMessage = {
						role: 'assistant',
						content: accumulatedResponse,
					};

					setMessages(prev => [...prev, assistantWithTools, ...toolMessages]);
				} else {
					// Add regular assistant response to history
					const assistantMessage: MistralMessage = {
						role: 'assistant',
						content: accumulatedResponse,
					};
					setMessages(prev => [...prev, assistantMessage]);
				}
			} catch (err) {
				setError(
					`Error getting response: ${
						err instanceof Error ? err.message : String(err)
					}`,
				);
			}

			setLoading(false);
		}
	};

	if (!apiKey) return <ApiKeyInput setApiKey={setApiKey} />;

	return (
		<Box width="100%" flexDirection="column" gap={1}>
			<Hero />
			{!response && !error && loading && <Text color="blue">Pondering...</Text>}
			{error && <Text color="red">Error: {error}</Text>}
			{response && <Text>{response}</Text>}
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