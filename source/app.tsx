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
		COMMAND_ALIASES[command] ? ` (${COMMAND_ALIASES[command]})` : ''
	} - ${COMMAND_DESCRIPTIONS[command]}`;
}

const commandRegister: Record<
	Command,
	({
		addToHistory,
		logAndExit,
		usage,
	}: {
		addToHistory: (content: string) => void;
		logAndExit: (message: string) => void;
		usage: Record<string, TokenUsage> | null;
	}) => void
> = {
	exit: ({logAndExit, usage}) => {
		logAndExit(formatUsage(usage));
	},
	help: ({addToHistory}) => {
		const commandLines = COMMANDS.map(command => generateCommandHelp(command));
		addToHistory(`Available commands: \n${commandLines.join('\n')}`);
	},
	usage: ({addToHistory, usage}) => addToHistory(formatUsage(usage)),
	logout: ({addToHistory}) => {
		deleteSecret('MISTRAL_API_KEY');
		addToHistory(
			'Logged out successfully. Please restart the app to enter a new API Key.',
		);
	},
};

const handleCommand = (
	commandInput: string,
	addToHistory: (content: string) => void,
	logAndExit: (message: string) => void,
	usage: Record<string, TokenUsage> | null,
) => {
	const command = commandInput.trim().toLowerCase();

	if (!command || !commandRegister[command as Command]) {
		addToHistory(
			`Unknown command: ${commandInput}. Type /help for available commands.`,
		);
		return;
	}

	return commandRegister[command as Command]({addToHistory, logAndExit, usage});
};

export default function App() {
	const {exit} = useApp();
	const [mistralService, setMistralService] = useState<MistralService | null>(
		null,
	);
	const [mcpManager, setMcpManager] = useState<MCPManager | null>(null);
	const [apiKey, setApiKey] = useState<string | null>(null);
	const [prompt, setPrompt] = useState('');
	const [conversationHistory, setConversationHistory] = useState<
		Array<{type: 'user' | 'assistant' | 'command' | 'tool'; content: string}>
	>([]);
	const [loading, setLoading] = useState(false);
	const [errorOutput, setErrorOutput] = useState<string | null>(null);
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

	const handleGracefulExit = async () => {
		if (mcpManager) {
			await mcpManager.disconnect();
		}
		exit();
		process.exit(0);
	};

	const logAndExit = (message: string) => {
		setConversationHistory(prev => [
			...prev,
			{type: 'command', content: message},
		]);
		setShouldExit(true);
	};

	useEffect(() => {
		if (shouldExit) {
			handleGracefulExit().catch(() => process.exit(1));
		}
	}, [shouldExit, exit, mcpManager]);

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
			setConversationHistory(prev => [
				...prev,
				{type: 'assistant', content: assistantTextOutputs.join('\n')},
			]);
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
				setConversationHistory(prev => [
					...prev,
					{type: 'tool', content: `Calling tool: ${toolCall.function.name}`},
				]);

				try {
					const toolCallResult = await mcpManager.callTool(toolCall);
					updatedMessages.push(toolCallResult);
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
		setPrompt('');
		setErrorOutput(null);

		const prompt = promptInput.trim();

		setConversationHistory(prev => [...prev, {type: 'user', content: prompt}]);

		if (prompt.startsWith('/')) {
			const addToHistory = (content: string) => {
				setConversationHistory(prev => [...prev, {type: 'command', content}]);
			};
			handleCommand(prompt.slice(1), addToHistory, logAndExit, sessionUsage);
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
			{conversationHistory.map((entry, index) => (
				<Box key={index} marginBottom={1}>
					{entry.type === 'user' && (
						<Box flexDirection="row" paddingLeft={0}>
							<Text color="gray">&gt; </Text>
							<Box flexGrow={1}>
								<Text color="gray">{entry.content}</Text>
							</Box>
						</Box>
					)}
					{entry.type === 'assistant' && <Text>{entry.content}</Text>}
					{entry.type === 'command' && (
						<Text color="yellow">{entry.content}</Text>
					)}
					{entry.type === 'tool' && <Text>{entry.content}</Text>}
				</Box>
			))}
			{loading && <Text color="blue">Pondering...</Text>}
			{errorOutput && <Text color="red">Error: {errorOutput}</Text>}
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
