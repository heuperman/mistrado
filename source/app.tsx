import React, {useEffect, useState} from 'react';
import {Box, Text} from 'ink';
import TextInput from 'ink-text-input';
import {deleteSecret, getSecret} from './services/secretsService.js';
import ApiKeyInput from './components/ApiKeyInput.js';
import {
	getResponse,
	initializeMistralClient,
} from './services/mistralService.js';
import Hero from './components/Hero.js';
import {MistralMessage} from './types/mistral.js';

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
			try {
				initializeMistralClient(apiKey);
			} catch (err) {
				setError(
					`Error initializing Mistral client: ${
						err instanceof Error ? err.message : String(err)
					}`,
				);
			}
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
			const updatedMessages: MistralMessage[] = [...messages, {role: 'user', content: prompt}];
			setMessages(updatedMessages);

			try {
				// Use updated messages for API call
				const result = await getResponse(updatedMessages);
				let accumulatedResponse = '';
				
				for await (const chunk of result) {
					const streamText = chunk.data.choices[0]?.delta.content;
					if (streamText) {
						accumulatedResponse += streamText;
						setResponse(prev => prev + streamText);
					}
				}

				// Add assistant response to history
				const assistantMessage: MistralMessage = {
					role: 'assistant',
					content: accumulatedResponse,
				};
				setMessages(prev => [...prev, assistantMessage]);
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
			<Box width="100%" gap={1} borderColor="grey" borderStyle="round">
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
