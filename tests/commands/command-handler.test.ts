import test from 'ava';
import {
	type Command,
	generateCommandHelp,
	formatUsage,
	CommandHandler,
} from '../../source/commands/command-handler.js';

test('generateCommandHelp returns correct format for command without alias', t => {
	const result = generateCommandHelp('help');
	t.is(result, '**/help** - Show available commands');
});

test('generateCommandHelp returns correct format for command with alias', t => {
	const result = generateCommandHelp('exit');
	t.is(result, '**/exit** (**/quit**) - Exit the application');
});

test('generateCommandHelp handles all commands', t => {
	const commands: Command[] = [
		'exit',
		'help',
		'usage',
		'logout',
		'settings',
		'clear',
	];
	const expectedResults = [
		'**/exit** (**/quit**) - Exit the application',
		'**/help** - Show available commands',
		'**/usage** - Show token usage statistics',
		'**/logout** - Logout and clear API key',
		'**/settings** - Configure application settings',
		'**/clear** - Clear the current session history',
	];

	for (const [index, command] of commands.entries()) {
		const result = generateCommandHelp(command);
		t.is(result, expectedResults[index]);
	}
});

test('formatUsage returns correct message for undefined usage', t => {
	const result = formatUsage(undefined);
	t.is(result, 'No usage data available.');
});

test('formatUsage formats single model usage correctly', t => {
	const usage = {
		'model-1': {
			promptTokens: 100,
			completionTokens: 50,
			totalTokens: 150,
		},
	};
	const result = formatUsage(usage);
	const expected = `Model: model-1\nPrompt Tokens: 100\nCompletion Tokens: 50\nTotal Tokens: 150`;
	t.is(result, expected);
});

test('formatUsage formats multiple model usage correctly', t => {
	const usage = {
		'model-1': {
			promptTokens: 100,
			completionTokens: 50,
			totalTokens: 150,
		},
		'model-2': {
			promptTokens: 200,
			completionTokens: 100,
			totalTokens: 300,
		},
	};
	const result = formatUsage(usage);
	const expected = `Model: model-1\nPrompt Tokens: 100\nCompletion Tokens: 50\nTotal Tokens: 150\n\nModel: model-2\nPrompt Tokens: 200\nCompletion Tokens: 100\nTotal Tokens: 300`;
	t.is(result, expected);
});

test('formatUsage handles empty usage object', t => {
	const usage = {};
	const result = formatUsage(usage);
	t.is(result, 'No usage data available.');
});

test('CommandHandler.isCommand returns true for slash commands', t => {
	const handler = new CommandHandler();
	t.true(handler.isCommand('/help'));
	t.true(handler.isCommand(' /exit '));
	t.true(handler.isCommand('/clear'));
});

test('CommandHandler.isCommand returns false for non-slash commands', t => {
	const handler = new CommandHandler();
	t.false(handler.isCommand('help'));
	t.false(handler.isCommand('regular message'));
	t.false(handler.isCommand(''));
});

test('CommandHandler.extractCommand removes slash and returns command', t => {
	const handler = new CommandHandler();
	t.is(handler.extractCommand('/help'), 'help');
	t.is(handler.extractCommand('/exit'), 'exit');
	t.is(handler.extractCommand('/usage'), 'usage');
});

test('CommandHandler.handleCommand executes clear command', async t => {
	const handler = new CommandHandler();
	const mockHandlers = {
		// eslint-disable-next-line @typescript-eslint/no-empty-function
		addToHistory() {},
		setSessionMessages(messages: any) {
			t.deepEqual(messages, []);
		},
		// eslint-disable-next-line @typescript-eslint/no-empty-function
		logAndExit() {},
		usage: undefined,
	};

	await handler.handleCommand('clear', mockHandlers);
});

test('CommandHandler.handleCommand executes help command', async t => {
	const handler = new CommandHandler();
	let addedToHistory = '';
	const mockHandlers = {
		addToHistory(content: string) {
			addedToHistory = content;
		},
		// eslint-disable-next-line @typescript-eslint/no-empty-function
		setSessionMessages() {},
		// eslint-disable-next-line @typescript-eslint/no-empty-function
		logAndExit() {},
		usage: undefined,
	};

	await handler.handleCommand('help', mockHandlers);
	t.true(addedToHistory.includes('**Available commands**'));
	t.true(addedToHistory.includes('**/help** - Show available commands'));
});

test('CommandHandler.handleCommand executes usage command', async t => {
	const handler = new CommandHandler();
	let addedToHistory = '';
	const mockHandlers = {
		addToHistory(content: string) {
			addedToHistory = content;
		},
		// eslint-disable-next-line @typescript-eslint/no-empty-function
		setSessionMessages() {},
		// eslint-disable-next-line @typescript-eslint/no-empty-function
		logAndExit() {},
		usage: {
			'test-model': {
				promptTokens: 50,
				completionTokens: 25,
				totalTokens: 75,
			},
		},
	};

	await handler.handleCommand('usage', mockHandlers);
	t.true(addedToHistory.includes('Model: test-model'));
	t.true(addedToHistory.includes('Prompt Tokens: 50'));
});

test('CommandHandler.handleCommand executes logout command', async t => {
	const handler = new CommandHandler();
	let addedToHistory = '';
	const mockHandlers = {
		addToHistory(content: string) {
			addedToHistory = content;
		},
		// eslint-disable-next-line @typescript-eslint/no-empty-function
		setSessionMessages() {},
		// eslint-disable-next-line @typescript-eslint/no-empty-function
		logAndExit() {},
		usage: undefined,
	};

	await handler.handleCommand('logout', mockHandlers);
	t.true(addedToHistory.includes('Logged out successfully'));
});

test('CommandHandler.handleCommand executes exit command', async t => {
	const handler = new CommandHandler();
	let exitMessage = '';
	const mockHandlers = {
		// eslint-disable-next-line @typescript-eslint/no-empty-function
		addToHistory() {},
		// eslint-disable-next-line @typescript-eslint/no-empty-function
		setSessionMessages() {},
		logAndExit(message: string) {
			exitMessage = message;
		},
		usage: {
			'test-model': {
				promptTokens: 100,
				completionTokens: 50,
				totalTokens: 150,
			},
		},
	};

	await handler.handleCommand('exit', mockHandlers);
	t.true(exitMessage.includes('Model: test-model'));
});

test('CommandHandler.handleCommand executes settings command', async t => {
	const handler = new CommandHandler();
	let settingsOpened = false;
	const mockHandlers = {
		// eslint-disable-next-line @typescript-eslint/no-empty-function
		addToHistory() {},
		// eslint-disable-next-line @typescript-eslint/no-empty-function
		setSessionMessages() {},
		// eslint-disable-next-line @typescript-eslint/no-empty-function
		logAndExit() {},
		usage: undefined,
		openSettings() {
			settingsOpened = true;
		},
	};

	await handler.handleCommand('settings', mockHandlers);
	t.true(settingsOpened);
});

test('CommandHandler.handleCommand handles settings command without openSettings handler', async t => {
	const handler = new CommandHandler();
	const mockHandlers = {
		// eslint-disable-next-line @typescript-eslint/no-empty-function
		addToHistory() {},
		// eslint-disable-next-line @typescript-eslint/no-empty-function
		setSessionMessages() {},
		// eslint-disable-next-line @typescript-eslint/no-empty-function
		logAndExit() {},
		usage: undefined,
	};

	// Should not throw error
	await t.notThrowsAsync(handler.handleCommand('settings', mockHandlers));
});

test('CommandHandler.handleCommand handles command aliases', async t => {
	const handler = new CommandHandler();
	let exitCalled = false;
	const mockHandlers = {
		// eslint-disable-next-line @typescript-eslint/no-empty-function
		addToHistory() {},
		// eslint-disable-next-line @typescript-eslint/no-empty-function
		setSessionMessages() {},
		logAndExit() {
			exitCalled = true;
		},
		usage: undefined,
	};

	await handler.handleCommand('quit', mockHandlers);
	t.true(exitCalled);
});

test('CommandHandler.handleCommand handles unknown command', async t => {
	const handler = new CommandHandler();
	let addedToHistory = '';
	const mockHandlers = {
		addToHistory(content: string) {
			addedToHistory = content;
		},
		// eslint-disable-next-line @typescript-eslint/no-empty-function
		setSessionMessages() {},
		// eslint-disable-next-line @typescript-eslint/no-empty-function
		logAndExit() {},
		usage: undefined,
	};

	await handler.handleCommand('unknown', mockHandlers);
	t.true(addedToHistory.includes('Unknown command: unknown'));
	t.true(addedToHistory.includes('Type /help for available commands'));
});

test('CommandHandler.handleCommand handles case insensitive commands', async t => {
	const handler = new CommandHandler();
	let helpCalled = false;
	const mockHandlers = {
		addToHistory() {
			helpCalled = true;
		},
		// eslint-disable-next-line @typescript-eslint/no-empty-function
		setSessionMessages() {},
		// eslint-disable-next-line @typescript-eslint/no-empty-function
		logAndExit() {},
		usage: undefined,
	};

	await handler.handleCommand('HELP', mockHandlers);
	t.true(helpCalled);
});

test('CommandHandler.handleCommand trims whitespace from commands', async t => {
	const handler = new CommandHandler();
	let helpCalled = false;
	const mockHandlers = {
		addToHistory() {
			helpCalled = true;
		},
		// eslint-disable-next-line @typescript-eslint/no-empty-function
		setSessionMessages() {},
		// eslint-disable-next-line @typescript-eslint/no-empty-function
		logAndExit() {},
		usage: undefined,
	};

	await handler.handleCommand('  help  ', mockHandlers);
	t.true(helpCalled);
});
