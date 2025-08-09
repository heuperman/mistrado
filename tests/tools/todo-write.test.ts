import test from 'ava';
import {
	handleTodoWriteTool,
	type TodoItem,
} from '../../source/tools/todo-write.js';

test('handleTodoWriteTool creates new todo list successfully', async t => {
	const todoStorage = new Map<string, TodoItem[]>();
	const todos: TodoItem[] = [
		{id: '1', content: 'First task', status: 'pending'},
		{id: '2', content: 'Second task', status: 'pending'},
	];

	const result = await handleTodoWriteTool({todos}, todoStorage);

	t.false(result.isError);
	t.true(
		result.content[0].text.includes('Todos have been modified successfully'),
	);
	t.true(result.content[0].text.includes('Progress: 0/2 tasks completed'));

	// Verify todos were stored
	const storedTodos = todoStorage.get('session');
	t.truthy(storedTodos);
	t.is(storedTodos!.length, 2);
	t.is(storedTodos![0].content, 'First task');
	t.is(storedTodos![1].content, 'Second task');
});

test('handleTodoWriteTool updates existing todo list', async t => {
	const todoStorage = new Map<string, TodoItem[]>();
	const initialTodos: TodoItem[] = [
		{id: '1', content: 'First task', status: 'pending'},
	];

	// Set initial todos
	await handleTodoWriteTool({todos: initialTodos}, todoStorage);

	// Update todos
	const updatedTodos: TodoItem[] = [
		{id: '1', content: 'First task', status: 'completed'},
		{id: '2', content: 'New task', status: 'pending'},
	];

	const result = await handleTodoWriteTool({todos: updatedTodos}, todoStorage);

	t.false(result.isError);
	t.true(result.content[0].text.includes('Progress: 1/2 tasks completed'));

	// Verify todos were updated
	const storedTodos = todoStorage.get('session');
	t.truthy(storedTodos);
	t.is(storedTodos!.length, 2);
	t.is(storedTodos![0].status, 'completed');
	t.is(storedTodos![1].content, 'New task');
});

test('handleTodoWriteTool handles in_progress task correctly', async t => {
	const todoStorage = new Map<string, TodoItem[]>();
	const todos: TodoItem[] = [
		{id: '1', content: 'Active task', status: 'in_progress'},
		{id: '2', content: 'Pending task', status: 'pending'},
	];

	const result = await handleTodoWriteTool({todos}, todoStorage);

	t.false(result.isError);
	t.true(
		result.content[0].text.includes('Currently working on: "Active task"'),
	);
	t.true(result.content[0].text.includes('Progress: 0/2 tasks completed'));
});

test('handleTodoWriteTool rejects multiple in_progress tasks', async t => {
	const todoStorage = new Map<string, TodoItem[]>();
	const todos: TodoItem[] = [
		{id: '1', content: 'First active task', status: 'in_progress'},
		{id: '2', content: 'Second active task', status: 'in_progress'},
	];

	const result = await handleTodoWriteTool({todos}, todoStorage);

	t.true(result.isError);
	t.is(
		result.content[0].text,
		'Error: Only one task can be in_progress at a time. Found multiple in_progress tasks.',
	);

	// Verify todos were not stored
	const storedTodos = todoStorage.get('session');
	t.is(storedTodos, undefined);
});

test('handleTodoWriteTool handles empty todo list', async t => {
	const todoStorage = new Map<string, TodoItem[]>();
	const todos: TodoItem[] = [];

	const result = await handleTodoWriteTool({todos}, todoStorage);

	t.false(result.isError);
	t.true(
		result.content[0].text.includes('Todos have been modified successfully'),
	);
	t.false(result.content[0].text.includes('Progress:')); // No progress info for empty list

	// Verify empty todos were stored
	const storedTodos = todoStorage.get('session');
	t.truthy(storedTodos);
	t.is(storedTodos!.length, 0);
});

test('handleTodoWriteTool validates required properties', async t => {
	const todoStorage = new Map<string, TodoItem[]>();

	// Missing todos property
	let result = await handleTodoWriteTool({}, todoStorage);
	t.true(result.isError);
	t.true(result.content[0].text.includes("missing required property 'todos'"));

	// Invalid todo item - missing id
	result = await handleTodoWriteTool(
		{
			todos: [{content: 'Task without id', status: 'pending'}],
		},
		todoStorage,
	);
	t.true(result.isError);
	t.true(result.content[0].text.includes("missing required property 'id'"));

	// Invalid todo item - missing content
	result = await handleTodoWriteTool(
		{
			todos: [{id: '1', status: 'pending'}],
		},
		todoStorage,
	);
	t.true(result.isError);
	t.true(
		result.content[0].text.includes("missing required property 'content'"),
	);

	// Invalid todo item - missing status
	result = await handleTodoWriteTool(
		{
			todos: [{id: '1', content: 'Task without status'}],
		},
		todoStorage,
	);
	t.true(result.isError);
	t.true(result.content[0].text.includes("missing required property 'status'"));
});

test('handleTodoWriteTool validates status enum', async t => {
	const todoStorage = new Map<string, TodoItem[]>();

	const result = await handleTodoWriteTool(
		{
			todos: [
				{
					id: '1',
					content: 'Task with invalid status',
					status: 'invalid_status',
				},
			],
		},
		todoStorage,
	);

	t.true(result.isError);
	t.true(result.content[0].text.includes('TodoWrite validation failed'));
});

test('handleTodoWriteTool validates content minLength', async t => {
	const todoStorage = new Map<string, TodoItem[]>();

	const result = await handleTodoWriteTool(
		{
			todos: [
				{
					id: '1',
					content: '',
					status: 'pending',
				},
			],
		},
		todoStorage,
	);

	t.true(result.isError);
	t.true(result.content[0].text.includes('TodoWrite validation failed'));
});

test('handleTodoWriteTool rejects invalid schema types', async t => {
	const todoStorage = new Map<string, TodoItem[]>();

	// Non-array todos
	let result = await handleTodoWriteTool(
		{
			todos: 'not an array',
		},
		todoStorage,
	);
	t.true(result.isError);
	t.true(result.content[0].text.includes('expected array, got string'));

	// Invalid todo item type
	result = await handleTodoWriteTool(
		{
			todos: ['not an object'],
		},
		todoStorage,
	);
	t.true(result.isError);
	t.true(result.content[0].text.includes('expected object, got string'));
});

test('handleTodoWriteTool handles all status types correctly', async t => {
	const todoStorage = new Map<string, TodoItem[]>();
	const todos: TodoItem[] = [
		{id: '1', content: 'Pending task', status: 'pending'},
		{id: '2', content: 'Active task', status: 'in_progress'},
		{id: '3', content: 'Done task', status: 'completed'},
		{id: '4', content: 'Another done task', status: 'completed'},
	];

	const result = await handleTodoWriteTool({todos}, todoStorage);

	t.false(result.isError);
	t.true(
		result.content[0].text.includes('Currently working on: "Active task"'),
	);
	t.true(result.content[0].text.includes('Progress: 2/4 tasks completed'));

	// Verify all todos were stored with correct status
	const storedTodos = todoStorage.get('session');
	t.truthy(storedTodos);
	t.is(storedTodos!.length, 4);
	t.is(storedTodos![1].status, 'in_progress');
	t.is(storedTodos![2].status, 'completed');
	t.is(storedTodos![3].status, 'completed');
});

test('handleTodoWriteTool preserves todo storage isolation', async t => {
	const todoStorage = new Map<string, TodoItem[]>();
	const todos1: TodoItem[] = [
		{id: '1', content: 'First session task', status: 'pending'},
	];
	const todos2: TodoItem[] = [
		{id: '2', content: 'Different task', status: 'completed'},
	];

	// Store first todos
	await handleTodoWriteTool({todos: todos1}, todoStorage);
	t.is(todoStorage.get('session')!.length, 1);
	t.is(todoStorage.get('session')![0].content, 'First session task');

	// Replace with different todos (simulates normal usage)
	await handleTodoWriteTool({todos: todos2}, todoStorage);
	t.is(todoStorage.get('session')!.length, 1);
	t.is(todoStorage.get('session')![0].content, 'Different task');
	t.is(todoStorage.get('session')![0].status, 'completed');
});
