import process from 'node:process';
import {readStdin} from '../utils/stdin.js';
import {ConversationService} from '../services/conversation-service.js';
import {MistralService} from '../services/mistral-service.js';
import {McpManager} from '../services/mcp-manager.js';
import {getMainSystemPrompt} from '../prompts/system.js';
import {isGitRepo} from '../utils/git.js';
import {loadCustomInstruction} from '../utils/custom-instructions.js';
import {setupErrorHandling} from '../utils/error-handling.js';
import {createPrintModeCallbacks} from '../adapters/print-callbacks.js';
import type {MistralMessage} from '../types/mistral.js';

export async function handlePrintMode(promptArg?: string): Promise<void> {
	setupErrorHandling();

	try {
		// Get prompt from argument or stdin
		const prompt = promptArg ?? (await readStdin());

		if (!prompt.trim()) {
			console.error('Error: No prompt provided');
			// eslint-disable-next-line unicorn/no-process-exit
			process.exit(1);
		}

		// Get API key from environment (print mode only uses env var)
		const apiKey = process.env['MISTRAL_API_KEY']?.trim();
		if (!apiKey) {
			console.error(
				'Error: No API key found. Set MISTRAL_API_KEY environment variable.',
			);
			// eslint-disable-next-line unicorn/no-process-exit
			process.exit(1);
		}

		// Initialize services using existing constructors
		const mistralService = new MistralService(apiKey);
		const conversationService = new ConversationService();

		// Initialize MCP manager for tools (graceful fallback if unavailable)
		let mcpManager: McpManager | undefined;
		try {
			mcpManager = new McpManager();
			await mcpManager.initializeBuiltinServers();
		} catch {
			// Continue without tools if MCP initialization fails
			mcpManager = undefined;
		}

		// Prepare system prompt using existing logic
		const workingDirectoryPath = process.cwd();
		const systemMessage = getMainSystemPrompt({
			workingDirectoryPath,
			isGitRepo: isGitRepo(workingDirectoryPath),
			platform: process.platform,
			todayDate: new Date(),
			customInstruction: loadCustomInstruction(workingDirectoryPath),
		});

		// Build messages array with system prompt + user message
		const messages: MistralMessage[] = [
			systemMessage,
			{
				role: 'user',
				content: prompt,
			},
		];

		// Get available tools
		const tools = mcpManager ? mcpManager.getAvailableTools() : [];

		// Set up print mode callbacks that capture output
		const printModeCallbacks = createPrintModeCallbacks();

		// Handle the conversation using existing ConversationService
		await conversationService.handleRequest(
			{
				service: mistralService,
				messages,
				tools,
				mcpManager,
			},
			printModeCallbacks,
		);

		// Output the captured result
		if (printModeCallbacks.hasError()) {
			// eslint-disable-next-line unicorn/no-process-exit
			process.exit(1);
		}

		const outputContent = printModeCallbacks.getOutputContent();
		if (outputContent.trim()) {
			console.log(outputContent.trim());
		}

		// eslint-disable-next-line unicorn/no-process-exit
		process.exit(0);
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		console.error(`Error: ${errorMessage}`);
		// eslint-disable-next-line unicorn/no-process-exit
		process.exit(1);
	}
}
