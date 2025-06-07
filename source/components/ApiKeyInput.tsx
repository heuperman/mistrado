import React, {useState} from 'react';
import {Box, Text} from 'ink';
import {UncontrolledTextInput} from 'ink-text-input';
import {setSecret} from '../services/secretsService.js';

type ApiKeyInputProps = {
	setApiKey: React.Dispatch<React.SetStateAction<string | null>>;
};

export default function ApiKeyInput({setApiKey}: ApiKeyInputProps) {
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const handleSubmit = async (apiKeyInput: string) => {
		setLoading(true);
		setError(null);

		const apiKey = apiKeyInput.trim();
		if (!apiKey) {
			setError('API Key cannot be empty.');
		} else {
			try {
				await setSecret({key: 'MISTRAL_API_KEY', value: apiKey});
				setApiKey(apiKey);
			} catch (err) {
				setError(
					`Error saving API Key: ${
						err instanceof Error ? err.message : String(err)
					}`,
				);
			}
		}
		setLoading(false);
	};

	return (
		<Box flexDirection="column" paddingX={2} gap={1}>
			<Text color="blue">Welcome to Mistrado!</Text>
			<Text>Please enter your Mistral API Key to get started:</Text>
			{loading && <Text color="blue">Storing key...</Text>}
			{error && <Text color="red">{error}</Text>}
			<Box width="100%" gap={1} borderColor="grey" borderStyle="round">
				<Text>&gt;</Text>
				<UncontrolledTextInput mask="*" onSubmit={handleSubmit} />
			</Box>
		</Box>
	);
}
