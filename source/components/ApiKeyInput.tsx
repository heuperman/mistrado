import {exit} from 'node:process';
import React, {useState} from 'react';
import {Box, Text} from 'ink';
import {UncontrolledTextInput} from 'ink-text-input';
import {setSecret} from '../services/secretsService.js';

type ApiKeyInputProps = {
	readonly setApiKey: React.Dispatch<React.SetStateAction<string | undefined>>;
};

export default function ApiKeyInput({setApiKey}: ApiKeyInputProps) {
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | undefined>();

	const handleSubmit = async (input: string) => {
		setLoading(true);
		setError(undefined);

		const cleanedInput = input.trim();
		if (!cleanedInput) {
			setError('API Key cannot be empty.');
		} else if (cleanedInput === '/exit' || cleanedInput === '/quit') {
			exit(0);
		} else {
			try {
				await setSecret({key: 'MISTRAL_API_KEY', value: cleanedInput});
				setApiKey(cleanedInput);
			} catch (error_) {
				setError(
					`Error saving API Key: ${
						error_ instanceof Error ? error_.message : String(error_)
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
			{loading ? <Text color="blue">Storing key...</Text> : null}
			{error ? <Text color="red">{error}</Text> : null}
			<Box width="100%" gap={1} borderColor="grey" borderStyle="round">
				<Text>&gt;</Text>
				<UncontrolledTextInput mask="*" onSubmit={handleSubmit} />
			</Box>
		</Box>
	);
}
