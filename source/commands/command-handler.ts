import type {UsageInfo} from '@mistralai/mistralai/models/components/usageinfo.js';
import {deleteSecret} from '../services/secrets-service.js';

const commands = ['exit', 'help', 'usage', 'logout', 'settings'] as const;
const commandAliases: Partial<Record<string, Command>> = {
	quit: 'exit',
} as const;
const commandDescriptions: Record<Command, string> = {
	exit: 'Exit the application',
	help: 'Show available commands',
	usage: 'Show token usage statistics',
	logout: 'Logout and clear API key',
	settings: 'Configure application settings',
} as const;

export type Command = (typeof commands)[number];

function formatUsage(usage: Record<string, UsageInfo> | undefined): string {
	if (!usage) return 'No usage data available.';
	return Object.entries(usage)
		.map(
			([model, data]) =>
				`Model: ${model}\nPrompt Tokens: ${data.promptTokens}\nCompletion Tokens: ${data.completionTokens}\nTotal Tokens: ${data.totalTokens}`,
		)
		.join('\n\n');
}

function generateCommandHelp(command: Command): string {
	const commandAlias = Object.keys(commandAliases).find(
		alias => commandAliases[alias] === command,
	);
	return `/**${command}** ${commandAlias ? `(**${commandAlias}**)` : ''} - ${commandDescriptions[command]}`;
}

const commandRegister: Record<
	Command,
	({
		addToHistory,
		logAndExit,
		usage,
		openSettings,
	}: {
		addToHistory: (content: string) => void;
		logAndExit: (message: string) => void;
		usage: Record<string, UsageInfo> | undefined;
		openSettings?: () => void;
	}) => Promise<void>
> = {
	async exit({logAndExit, usage}) {
		logAndExit(formatUsage(usage));
	},
	async help({addToHistory}) {
		const commandLines = commands.map(command => generateCommandHelp(command));
		addToHistory(`**Available commands**: \n${commandLines.join('\n')}`);
	},
	async usage({addToHistory, usage}) {
		addToHistory(formatUsage(usage));
	},
	async logout({addToHistory}) {
		await deleteSecret('MISTRAL_API_KEY');
		addToHistory(
			'Logged out successfully. Please restart the app to enter a new API Key.',
		);
	},
	async settings({openSettings}) {
		if (openSettings) {
			openSettings();
		}
	},
};

export class CommandHandler {
	async handleCommand(
		commandInput: string,
		handlers: {
			addToHistory: (content: string) => void;
			logAndExit: (message: string) => void;
			usage: Record<string, UsageInfo> | undefined;
			openSettings?: () => void;
		},
	): Promise<void> {
		const input = commandInput.trim().toLowerCase();
		const command: Command = commandAliases[input] ?? (input as Command);

		if (!command && commands.includes(command as Command)) {
			handlers.addToHistory(
				`Unknown command: ${input}. Type /help for available commands.`,
			);
			return;
		}

		await commandRegister[command](handlers);
	}

	isCommand(input: string): boolean {
		return input.trim().startsWith('/');
	}

	extractCommand(input: string): string {
		return input.slice(1);
	}
}
