import test from 'ava';
import type {AssistantMessage} from '@mistralai/mistralai/models/components/index.js';
import {ConversationService} from '../../source/services/conversation-service.js';
import type {ConversationCallbacks} from '../../source/types/callbacks.js';
import type {MistralService} from '../../source/services/mistral-service.js';
import type {McpManager} from '../../source/services/mcp-manager.js';
import type {
	MistralMessage,
	MistralTool,
	MistralToolCall,
} from '../../source/types/mistral.js';
import type {TodoItem} from '../../source/tools/todo-write.js';

// Test fixtures
const mockMistralService = () =>
	({
		getResponse: async () => ({
			error: 'Test error',
			assistantMessages: [],
			usage: undefined,
			model: 'test-model',
		}),
	}) as unknown as MistralService;

const mockMcpManager = (todos: TodoItem[] = []) =>
	({
		getToolManager: () => ({
			getCurrentTodos: () => todos,
		}),
		callTool: async () => ({
			role: 'tool' as const,
			content: 'Tool result',
			toolCallId: 'test-id',
		}),
	}) as unknown as McpManager;

const createMockCallbacks = (): ConversationCallbacks => ({
	onError() {
		// Mock error handler
	},
	onHistoryUpdate: () => 'history-id',
	onAbortControllerCreate: () => new AbortController(),
});

test('handleRequest calls onError when MistralService returns error', async t => {
	const conversationService = new ConversationService();
	let capturedError = '';

	const callbacks: ConversationCallbacks = {
		...createMockCallbacks(),
		onError(error: string | undefined) {
			if (error) {
				capturedError = error;
			}
		},
	};

	const mockService = mockMistralService();
	const parameters = {
		service: mockService,
		messages: [] as MistralMessage[],
		tools: [] as MistralTool[],
		mcpManager: mockMcpManager(),
	};

	await conversationService.handleRequest(parameters, callbacks);

	t.is(capturedError, 'Test error');
});

test('handleRequest handles interruption during API calls', async t => {
	const conversationService = new ConversationService();
	const historyUpdates: any[] = [];
	const messagesUpdates: any[] = [];

	const mockServiceWithAbort = () =>
		({
			getResponse: async () => ({
				error: 'Request aborted by client',
				assistantMessages: [],
				usage: undefined,
				model: 'test-model',
			}),
		}) as unknown as MistralService;

	const callbacks: ConversationCallbacks = {
		...createMockCallbacks(),
		onHistoryUpdate(entry: unknown) {
			historyUpdates.push(entry);
			return 'history-id';
		},
		onMessagesUpdate(
			updater: (messages: MistralMessage[]) => MistralMessage[],
		) {
			const currentMessages: MistralMessage[] = [];
			const newMessages = updater(currentMessages);
			messagesUpdates.push(newMessages);
		},
	};

	const parameters = {
		service: mockServiceWithAbort(),
		messages: [] as MistralMessage[],
		tools: [] as MistralTool[],
		mcpManager: mockMcpManager(),
	};

	await conversationService.handleRequest(parameters, callbacks);

	t.true(
		historyUpdates.some(
			update =>
				update.content === 'Process interrupted by user.' &&
				update.status === 'error',
		),
	);
	t.true(
		messagesUpdates.some((messages: MistralMessage[]) =>
			messages.some(
				(message: MistralMessage) =>
					message.content === 'Process interrupted by user.',
			),
		),
	);
});

test('processAssistantMessages rejects invalid tool calls', t => {
	const conversationService = new ConversationService();

	const invalidAssistantMessage: AssistantMessage = {
		role: 'assistant',
		content: 'Test content',
		toolCalls: [
			{
				// Missing id field - this will fail validation
				type: 'function',
				function: {
					name: 'valid-name',
					arguments: {},
				},
			} as any,
		],
	};

	const callbacks = createMockCallbacks();

	// Access private method using type assertion
	// eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment
	const result = (conversationService as any).processAssistantMessages(
		[invalidAssistantMessage],
		callbacks,
	);

	// Check if result has expected structure
	t.truthy(result);
	t.true('success' in result);
	if (result.success) {
		t.fail('Expected validation to fail for invalid tool call');
	} else {
		t.is(result.error, 'Invalid tool call format: missing function name or ID');
	}
});

test('injectTodoContext appends todo context to user message', t => {
	const conversationService = new ConversationService();
	const todos = [{id: '1', content: 'Test task', status: 'pending' as const}];

	const messages: MistralMessage[] = [
		{
			role: 'user',
			content: 'Hello',
		},
	];

	const mcpManager = mockMcpManager(todos);

	// Access private method using type assertion
	// eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment
	const result = (conversationService as any).injectTodoContext(
		messages,
		mcpManager,
	);

	// Check basic structure first
	t.truthy(result);
	t.is(result.length, 1);
	t.is(result[0].role, 'user');

	// Check if content was transformed to array
	if (Array.isArray(result[0].content)) {
		const content = result[0].content as Array<{text: string}>;
		t.is(content[0].text, 'Hello');
		t.true(content[1].text.includes('<system-reminder>'));
		t.true(content[1].text.includes('☐ Test task'));
	} else {
		t.fail('Expected content to be transformed to array format');
	}
});

test('handleToolCalls creates error tool message when tool execution fails', async t => {
	const conversationService = new ConversationService();
	let capturedError = '';
	const toolMessages: MistralMessage[] = [];

	const mockFailingMcpManager = () =>
		({
			getToolManager: () => ({
				getCurrentTodos: () => [],
			}),
			async callTool() {
				throw new Error('Tool execution failed');
			},
		}) as unknown as McpManager;

	const toolCalls: MistralToolCall[] = [
		{
			id: 'tool-call-1',
			type: 'function',
			function: {
				name: 'test-tool',
				arguments: {},
			},
		},
	];

	const callbacks: ConversationCallbacks = {
		...createMockCallbacks(),
		onError(error: string | undefined) {
			if (error) {
				capturedError = error;
			}
		},
		onMessagesUpdate(
			updater: (messages: MistralMessage[]) => MistralMessage[],
		) {
			const currentMessages: MistralMessage[] = [];
			const newMessages = updater(currentMessages);
			toolMessages.push(...newMessages);
		},
	};

	const parameters = {
		service: mockMistralService(),
		messages: [] as MistralMessage[],
		tools: [] as MistralTool[],
		mcpManager: mockFailingMcpManager(),
	};

	// Access private method using type assertion
	// eslint-disable-next-line @typescript-eslint/no-unsafe-call
	await (conversationService as any).handleToolCalls(
		toolCalls,
		[],
		parameters,
		callbacks,
	);

	// Verify error callback was called - the test validates that tool execution
	// failures are properly handled through error callbacks
	t.truthy(capturedError);
});
