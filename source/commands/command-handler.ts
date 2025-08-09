import type {UsageInfo} from '@mistralai/mistralai/models/components/usageinfo.js';
import type {Dispatch, SetStateAction} from 'react';
import {deleteSecret} from '../services/secrets-service.js';
import type {MistralMessage} from '../types/mistral.js';

const commands = [
	'exit',
	'help',
	'usage',
	'logout',
	'settings',
	'clear',
] as const;
const commandAliases: Partial<Record<string, Command>> = {
	quit: 'exit',
} as const;
const commandDescriptions: Record<Command, string> = {
	exit: 'Exit the application',
	help: 'Show available commands',
	usage: 'Show token usage statistics',
	logout: 'Logout and clear API key',
	settings: 'Configure application settings',
	clear: 'Clear the current session history',
} as const;

export type Command = (typeof commands)[number];

type CommandHandlers = {
	addToHistory: (content: string) => void;
	setSessionMessages: Dispatch<SetStateAction<MistralMessage[]>>;
	logAndExit: (message: string) => void;
	usage: Record<string, UsageInfo> | undefined;
	openSettings?: () => void;
};

export function formatUsage(
	usage: Record<string, UsageInfo> | undefined,
): string {
	if (!usage || Object.keys(usage).length === 0)
		return 'No usage data available.';
	return Object.entries(usage)
		.map(
			([model, data]) =>
				`Model: ${model}\nPrompt Tokens: ${data.promptTokens}\nCompletion Tokens: ${data.completionTokens}\nTotal Tokens: ${data.totalTokens}`,
		)
		.join('\n\n');
}

export function generateCommandHelp(command: Command): string {
	const commandAlias = Object.keys(commandAliases).find(
		alias => commandAliases[alias] === command,
	);
	return `**/${command}** ${commandAlias ? `(**/${commandAlias}**) ` : ''}- ${commandDescriptions[command]}`;
}

const commandRegister: Record<
	Command,
	(handlers: CommandHandlers) => Promise<void>
> = {
	async clear({setSessionMessages}) {
		setSessionMessages([]);
	},
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
		handlers: CommandHandlers,
	): Promise<void> {
		const input = commandInput.trim().toLowerCase();
		const command: Command = commandAliases[input] ?? (input as Command);

		if (!commands.includes(command)) {
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
