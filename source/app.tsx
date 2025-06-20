import {execSync} from 'node:child_process';
import {exit as processExit, cwd, platform} from 'node:process';
import React, {useEffect, useState} from 'react';
import {Box, Text, useApp} from 'ink';
import TextInput from 'ink-text-input';
import {deleteSecret, getSecret} from './services/secrets-service.js';
import Login from './components/login.js';
import {MistralService, type TokenUsage} from './services/mistral-service.js';
import Hero from './components/hero.js';
import {
	type MistralMessage,
	type MistralTool,
	type MistralToolCall,
} from './types/mistral.js';
import {McpManager} from './services/mcp-manager.js';
import {getMainSystemPrompt} from './prompts/system.js';

function isGitRepo() {
	try {
		execSync('git rev-parse --git-dir', {stdio: 'ignore'});
		return true;
	} catch {
		return false;
	}
}

function formatUsage(usage: Record<string, TokenUsage> | undefined): string {
	if (!usage) return 'No usage data available.';
	return Object.entries(usage)
		.map(
			([model, data]) =>
				`Model: ${model}\nPrompt Tokens: ${data.promptTokens}\nCompletion Tokens: ${data.completionTokens}\nTotal Tokens: ${data.totalTokens}`,
		)
		.join('\n\n');
}

const commands = ['exit', 'help', 'usage', 'logout'] as const;
const commandAliases: Partial<Record<Command, string>> = {
	exit: 'quit',
} as const;
const CommandDescriptions: Record<Command, string> = {
	exit: 'Exit the application',
	help: 'Show available commands',
	usage: 'Show token usage statistics',
	logout: 'Logout and clear API key',
} as const;

type Command = (typeof commands)[number];

function generateCommandHelp(command: Command): string {
	return `/${command}${
		commandAliases[command] ? ` (${commandAliases[command]})` : ''
	} - ${CommandDescriptions[command]}`;
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
		usage: Record<string, TokenUsage> | undefined;
	}) => void
> = {
	exit({logAndExit, usage}) {
		logAndExit(formatUsage(usage));
	},
	help({addToHistory}) {
		const commandLines = commands.map(command => generateCommandHelp(command));
		addToHistory(`Available commands: \n${commandLines.join('\n')}`);
	},
	usage({addToHistory, usage}) {
		addToHistory(formatUsage(usage));
	},
	logout({addToHistory}) {
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
	usage: Record<string, TokenUsage> | undefined,
) => {
	const command = commandInput.trim().toLowerCase();

	if (!command || !commandRegister[command as Command]) {
		addToHistory(
			`Unknown command: ${commandInput}. Type /help for available commands.`,
		);
		return;
	}

	commandRegister[command as Command]({addToHistory, logAndExit, usage});
};

export default function App() {
	const {exit} = useApp();
	const [mistralService, setMistralService] = useState<
		MistralService | undefined
	>();
	const [mcpManager, setMcpManager] = useState<McpManager | undefined>();
	const [apiKey, setApiKey] = useState<string | undefined>();
	const [prompt, setPrompt] = useState('');
	const [conversationHistory, setConversationHistory] = useState<
		Array<{
			id: number;
			type: 'user' | 'assistant' | 'command' | 'tool';
			content: string;
		}>
	>([]);
	const [loading, setLoading] = useState(false);
	const [errorOutput, setErrorOutput] = useState<string | undefined>();
	const [sessionMessages, setSessionMessages] = useState<MistralMessage[]>([]);
	const [sessionUsage, setSessionUsage] = useState<
		Record<string, TokenUsage> | undefined
	>();
	const [shouldExit, setShouldExit] = useState(false);

	const logAndExit = (message: string) => {
		setConversationHistory(previous => [
			...previous,
			{id: previous.length, type: 'command', content: message},
		]);
		setShouldExit(true);
	};

	useEffect(() => {
		const handleGracefulExit = async () => {
			if (mcpManager) {
				await mcpManager.disconnect();
			}

			exit();
			processExit(0);
		};

		if (shouldExit) {
			handleGracefulExit().catch(() => processExit(1));
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
			setSessionUsage(previousUsage => {
				if (!previousUsage) {
					return {[model]: usage};
				}

				if (previousUsage[model]) {
					return {
						...previousUsage,
						[model]: {
							promptTokens:
								previousUsage[model].promptTokens + usage.promptTokens,
							completionTokens:
								previousUsage[model].completionTokens + usage.completionTokens,
							totalTokens: previousUsage[model].totalTokens + usage.totalTokens,
						},
					};
				}

				return {
					...previousUsage,
					[model]: usage,
				};
			});
		}

		const updatedMessages: MistralMessage[] = messages;

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
						// Handle other chunk types if needed
					}
				}
			}

			if (message.toolCalls?.length) {
				toolCalls.push(...message.toolCalls);
			}
		}

		if (assistantTextOutputs.length > 0) {
			setConversationHistory(previous => [
				...previous,
				{
					id: previous.length,
					type: 'assistant',
					content: assistantTextOutputs.join('\n'),
				},
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
				setConversationHistory(previous => [
					...previous,
					{
						id: previous.length,
						type: 'tool',
						content: `Calling tool: ${toolCall.function.name}`,
					},
				]);

				try {
					const toolCallResult = await mcpManager.callTool(toolCall);
					updatedMessages.push(toolCallResult as MistralMessage);
				} catch (toolError) {
					const errorMessage =
						toolError instanceof Error ? toolError.message : String(toolError);
					setErrorOutput(`${toolCall.function.name} - ${errorMessage}`);

					// Create error tool message
					const errorToolMessage: MistralMessage = {
						role: 'tool',
						content: `Error: ${errorMessage}`,
						toolCallId: toolCall.id ?? '',
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
					} catch (error) {
						setErrorOutput(
							`Error initializing Mistral client: ${
								error instanceof Error ? error.message : String(error)
							}`,
						);
					}
				}
			} catch (error) {
				setErrorOutput(
					`Error fetching API Key: ${
						error instanceof Error ? error.message : String(error)
					}`,
				);
			}
		}

		initializeClient();
	}, []);

	useEffect(() => {
		async function initializeMcpManager() {
			try {
				const manager = new McpManager();
				await manager.initializeBuiltinServers();
				setMcpManager(manager);
			} catch (error) {
				setErrorOutput(
					`Error initializing MCP Manager: ${
						error instanceof Error ? error.message : String(error)
					}`,
				);
			}
		}

		initializeMcpManager();
	}, []);

	useEffect(() => {
		if (sessionMessages.length === 0) {
			setSessionMessages([
				getMainSystemPrompt({
					workingDirectoryPath: cwd(),
					isGitRepo: isGitRepo(),
					platform,
					todayDate: new Date(),
				}),
			]);
		}
	}, [sessionMessages.length]);

	const handleSubmit = async (promptInput: string) => {
		setLoading(true);
		setPrompt('');
		setErrorOutput(undefined);

		const prompt = promptInput.trim();

		setConversationHistory(previous => [
			...previous,
			{id: previous.length, type: 'user', content: prompt},
		]);

		if (prompt.startsWith('/')) {
			const addToHistory = (content: string) => {
				setConversationHistory(previous => [
					...previous,
					{id: previous.length, type: 'command', content},
				]);
			};

			handleCommand(prompt.slice(1), addToHistory, logAndExit, sessionUsage);
			setLoading(false);
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
			} catch (error) {
				setErrorOutput(
					`Error getting response: ${
						error instanceof Error ? error.message : String(error)
					}`,
				);
			}

			setLoading(false);
		}
	};

	if (!apiKey) return <Login setApiKey={setApiKey} />;

	return (
		<Box width="100%" flexDirection="column" gap={1}>
			<Hero />
			{conversationHistory.map(entry => (
				<Box key={entry.id} marginBottom={1}>
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
			{loading ? <Text color="blue">Pondering...</Text> : null}
			{errorOutput ? <Text color="red">Error: {errorOutput}</Text> : null}
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
