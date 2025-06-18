import React, {useEffect, useState} from 'react';
import {Box, Text, useApp} from 'ink';
import TextInput from 'ink-text-input';
import {deleteSecret, getSecret} from './services/secretsService.js';
import ApiKeyInput from './components/ApiKeyInput.js';
import {MistralService, TokenUsage} from './services/mistralService.js';
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

function formatUsage(usage: Record<string, TokenUsage> | null): string {
	if (!usage) return 'No usage data available.';
	return Object.entries(usage)
		.map(
			([model, data]) =>
				`Model: ${model}\nPrompt Tokens: ${data.promptTokens}\nCompletion Tokens: ${data.completionTokens}\nTotal Tokens: ${data.totalTokens}`,
		)
		.join('\n\n');
}

const COMMANDS = ['exit', 'help', 'usage', 'logout'] as const;
const COMMAND_ALIASES: Partial<Record<Command, string>> = {
	exit: 'quit',
} as const;
const COMMAND_DESCRIPTIONS: Record<Command, string> = {
	exit: 'Exit the application',
	help: 'Show available commands',
	usage: 'Show token usage statistics',
	logout: 'Logout and clear API key',
} as const;

type Command = (typeof COMMANDS)[number];

function generateCommandHelp(command: Command): string {
	return `/${command}${
		COMMAND_ALIASES[command] ? ` (/${COMMAND_ALIASES[command]})` : ''
	} - ${COMMAND_DESCRIPTIONS[command]}`;
}

const commandRegister: Record<
	Command,
	({
		setOutput,
		logAndExit,
		usage,
	}: {
		setOutput: React.Dispatch<React.SetStateAction<string>>;
		logAndExit: (message: string) => void;
		usage: Record<string, TokenUsage> | null;
	}) => void
> = {
	exit: ({logAndExit, usage}) => {
		logAndExit(formatUsage(usage));
	},
	help: ({setOutput}) => {
		const commandLines = COMMANDS.map(command => generateCommandHelp(command));
		setOutput(`Available commands: \n${commandLines.join('\n')}`);
	},
	usage: ({setOutput, usage}) => setOutput(formatUsage(usage)),
	logout: ({setOutput}) => {
		deleteSecret('MISTRAL_API_KEY');
		setOutput(
			'Logged out successfully. Please restart the app to enter a new API Key.',
		);
	},
};

const handleCommand = (
	commandInput: string,
	setOutput: React.Dispatch<React.SetStateAction<string>>,
	logAndExit: (message: string) => void,
	usage: Record<string, TokenUsage> | null,
) => {
	const command = commandInput.trim().toLowerCase();

	if (!command || !commandRegister[command as Command]) {
		return `Unknown command: ${commandInput}. Type /help for available commands.`;
	}

	return commandRegister[command as Command]({setOutput, logAndExit, usage});
};

export default function App() {
	const {exit} = useApp();
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
	const [shouldExit, setShouldExit] = useState(false);

	const logAndExit = (message: string) => {
		setOutput(message);
		setShouldExit(true);
	};

	useEffect(() => {
		if (shouldExit) {
			exit();
			process.exit(0);
		}
	}, [shouldExit, exit]);

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
			handleCommand(prompt.slice(1), setOutput, logAndExit, sessionUsage);
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
