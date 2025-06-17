import React, {useEffect, useState} from 'react';
import {Box, Text} from 'ink';
import TextInput from 'ink-text-input';
import {deleteSecret, getSecret} from './services/secretsService.js';
import ApiKeyInput from './components/ApiKeyInput.js';
import {MistralService} from './services/mistralService.js';
import Hero from './components/Hero.js';
import {MistralMessage, MistralTool, MistralToolCall} from './types/mistral.js';
import {MCPManager} from './services/mcpManager.js';
import {getMainSystemPrompt} from './prompts/system.js';
import {execSync} from 'child_process';

function isGitRepo() {
	try {
		execSync('git rev-parse --git-dir', {stdio: 'ignore'});
		return true;
	} catch (error) {
		return false;
	}
}

const handleCommand = (
	commandInput: string,
	usage: Record<
		string,
		{
			promptTokens: number;
			completionTokens: number;
			totalTokens: number;
		}
	> | null,
) => {
	const command = commandInput.trim().toLowerCase();

	switch (command) {
		case 'exit':
		case 'quit':
			process.exit(0);
		case 'help':
			return 'Available commands: /exit, /quit, /help, /usage, /logout';
		case 'usage':
			return usage
				? Object.entries(usage)
						.map(
							([model, data]) =>
								`Model: ${model}\nPrompt Tokens: ${data.promptTokens}\nCompletion Tokens: ${data.completionTokens}\nTotal Tokens: ${data.totalTokens}`,
						)
						.join('\n\n')
				: 'No usage data available.';
		case 'logout':
			deleteSecret('MISTRAL_API_KEY');
			return 'Logged out successfully. Please restart the app to enter a new API Key.';
		default:
			return `Unknown command: ${command}`;
	}
};

export default function App() {
	const [mistralService, setMistralService] = useState<MistralService | null>(
		null,
	);
	const [mcpManager, setMcpManager] = useState<MCPManager | null>(null);
	const [apiKey, setApiKey] = useState<string | null>(null);
	const [prompt, setPrompt] = useState('');
	const [output, setOutput] = useState('');
	const [loading, setLoading] = useState(false);
	const [errorOutput, setErrorOutput] = useState<string | null>(null);
	const [statusOutput, setStatusOutput] = useState<string | null>(null);
	const [sessionMessages, setSessionMessages] = useState<MistralMessage[]>([]);
	const [sessionUsage, setSessionUsage] = useState<Record<
		string,
		{
			promptTokens: number;
			completionTokens: number;
			totalTokens: number;
		}
	> | null>(null);

	const handleRequest = async (
		service: MistralService,
		messages: MistralMessage[],
		tools: MistralTool[] = [],
	) => {
		const {error, assistantMessages, usage, model} = await service.getResponse(
			messages,
			tools,
		);

		if (error) {
			setErrorOutput(error);
			setLoading(false);
			return;
		}

		if (usage) {
			setSessionUsage(prevUsage => {
				if (!prevUsage) {
					return {[model]: usage};
				} else if (prevUsage[model]) {
					return {
						...prevUsage,
						[model]: {
							promptTokens: prevUsage[model].promptTokens + usage.promptTokens,
							completionTokens:
								prevUsage[model].completionTokens + usage.completionTokens,
							totalTokens: prevUsage[model].totalTokens + usage.totalTokens,
						},
					};
				}
				return {
					...prevUsage,
					[model]: usage,
				};
			});
		}

		let updatedMessages: MistralMessage[] = messages;

		const assistantTextOutputs: string[] = [];
		const toolCalls: MistralToolCall[] = [];

		for (const message of assistantMessages) {
			updatedMessages.push(message as MistralMessage);

			if (message.content) {
				if (typeof message.content === 'string') {
					assistantTextOutputs.push(message.content);
				} else {
					for (const chunk of message.content) {
						if (chunk.type === 'text') {
							assistantTextOutputs.push(chunk.text);
						}
						// TODO: Handle other chunk types if needed
					}
				}
			}

			if (message.toolCalls?.length) {
				toolCalls.push(...message.toolCalls);
			}
		}

		if (assistantTextOutputs.length) {
			setOutput(assistantTextOutputs.join('\n'));
		}

		if (toolCalls?.length) {
			if (!mcpManager) {
				setErrorOutput(
					'MCP Manager not initialized. Please wait or restart if problem persists.',
				);
				setLoading(false);
				return;
			}

			for (const toolCall of toolCalls) {
				try {
					const toolCallResult = await mcpManager.callTool(toolCall);
					updatedMessages.push(toolCallResult);

					setStatusOutput(`Executed tool: ${toolCall.function.name}`);
				} catch (toolError) {
					const errorMsg =
						toolError instanceof Error ? toolError.message : String(toolError);
					setErrorOutput(`${toolCall.function.name} - ${errorMsg}`);

					// Create error tool message
					const errorToolMessage: MistralMessage = {
						role: 'tool',
						content: `Error: ${errorMsg}`,
						toolCallId: toolCall.id || '',
					};
					updatedMessages.push(errorToolMessage);
				}
			}

			setSessionMessages(updatedMessages);

			// Continue conversation with tool results
			await handleRequest(service, updatedMessages, tools);
		}
	};

	useEffect(() => {
		async function initializeClient() {
			try {
				const secretKey = await getSecret('MISTRAL_API_KEY');
				if (secretKey) {
					try {
						setApiKey(secretKey);
						const service = new MistralService(secretKey);
						setMistralService(service);
					} catch (err) {
						setErrorOutput(
							`Error initializing Mistral client: ${
								err instanceof Error ? err.message : String(err)
							}`,
						);
					}
				}
			} catch (err) {
				setErrorOutput(
					`Error fetching API Key: ${
						err instanceof Error ? err.message : String(err)
					}`,
				);
			}
		}
		initializeClient();
	}, []);

	useEffect(() => {
		async function initializeMCPManager() {
			try {
				const manager = new MCPManager();
				await manager.initializeBuiltinServers();
				setMcpManager(manager);
			} catch (err) {
				setErrorOutput(
					`Error initializing MCP Manager: ${
						err instanceof Error ? err.message : String(err)
					}`,
				);
			}
		}
		initializeMCPManager();
	}, []);

	useEffect(() => {
		if (!sessionMessages.length) {
			setSessionMessages([
				getMainSystemPrompt({
					workingDirectoryPath: process.cwd(),
					isGitRepo: isGitRepo(),
					platform: process.platform,
					todayDate: new Date(),
				}),
			]);
		}
	}, []);

	const handleSubmit = async (promptInput: string) => {
		setLoading(true);
		setOutput('');
		setPrompt('');
		setErrorOutput(null);

		const prompt = promptInput.trim();

		if (prompt.startsWith('/')) {
			const result = handleCommand(prompt.slice(1), sessionUsage);
			setOutput(result);
			setLoading(false);
			return;
		} else {
			if (!mistralService) {
				setErrorOutput(
					'Mistral service not initialized. Please wait or restart if problem persists.',
				);
				setLoading(false);
				return;
			}

			const updatedMessages: MistralMessage[] = [
				...sessionMessages,
				{role: 'user', content: prompt},
			];
			setSessionMessages(updatedMessages);

			let tools: MistralTool[] = [];
			if (mcpManager) {
				tools = mcpManager.getAvailableTools();
			}

			try {
				await handleRequest(mistralService, updatedMessages, tools);
			} catch (err) {
				setErrorOutput(
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
			{!output && !errorOutput && loading && (
				<Text color="blue">Pondering...</Text>
			)}
			{errorOutput && <Text color="red">Error: {errorOutput}</Text>}
			{output && <Text>{output}</Text>}
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
			{statusOutput && <Text color="grey">{statusOutput}</Text>}
		</Box>
	);
}
