import process from 'node:process';
import React, {useState} from 'react';
import {Box, Text} from 'ink';
import {UncontrolledTextInput} from 'ink-text-input';
import {setSecret} from '../services/secrets-service.js';
import {colors} from '../utils/colors.js';

type ApiKeyInputProps = {
	readonly setApiKey: React.Dispatch<React.SetStateAction<string | undefined>>;
};

export default function Login({setApiKey}: ApiKeyInputProps) {
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | undefined>();

	const handleSubmit = async (input: string) => {
		setIsLoading(true);
		setError(undefined);

		const cleanedInput = input.trim();
		if (!cleanedInput) {
			setError('API Key cannot be empty.');
		} else if (cleanedInput === '/exit' || cleanedInput === '/quit') {
			// eslint-disable-next-line unicorn/no-process-exit
			process.exit(0);
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

		setIsLoading(false);
	};

	return (
		<Box width="100%" flexDirection="column" gap={1}>
			<Box
				width={60}
				borderColor={colors.blue}
				borderStyle="round"
				flexDirection="column"
				gap={1}
				paddingX={2}
				paddingY={1}
			>
				<Text color="white">Welcome to Mistrado!</Text>
				<Text color="white">
					Please enter your Mistral API Key to get started
				</Text>
				{isLoading ? (
					<Text color={colors.brightBlue}>Storing key...</Text>
				) : null}
				{error ? <Text color={colors.red}>{error}</Text> : null}
			</Box>
			<Box
				width="100%"
				gap={1}
				paddingX={1}
				borderColor={colors.brightBlack}
				borderStyle="round"
			>
				<Text>&gt;</Text>
				<UncontrolledTextInput mask="*" onSubmit={handleSubmit} />
			</Box>
		</Box>
	);
}
