import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import test from 'ava';
import {handleBashTool} from '../../source/tools/bash.js';

// Test helper to create temporary directories
async function createTemporaryDir(): Promise<string> {
	return fs.mkdtemp(path.join(os.tmpdir(), 'bash-test-'));
}

async function cleanup(dirPath: string): Promise<void> {
	try {
		await fs.rm(dirPath, {recursive: true, force: true});
	} catch {
		// Ignore cleanup errors
	}
}

// Basic validation tests
test('handleBashTool validates required parameters', async t => {
	// Missing command
	const result = await handleBashTool({});

	t.true(result.isError);
	t.is(
		result.content[0].text,
		"Bash validation failed: root: missing required property 'command'",
	);
});

test('handleBashTool rejects invalid schema types', async t => {
	// Invalid command type
	let result = await handleBashTool({
		command: 123,
	});

	t.true(result.isError);
	t.is(
		result.content[0].text,
		'Bash validation failed: command: expected string, got number',
	);

	// Invalid timeout type
	result = await handleBashTool({
		command: 'echo test',
		timeout: 'invalid',
	});

	t.true(result.isError);
	t.is(
		result.content[0].text,
		'Bash validation failed: timeout: expected number, got string',
	);

	// Invalid directory type
	result = await handleBashTool({
		command: 'echo test',
		directory: 123,
	});

	t.true(result.isError);
	t.is(
		result.content[0].text,
		'Bash validation failed: directory: expected string, got number',
	);

	// Invalid runInBackground type
	result = await handleBashTool({
		command: 'echo test',
		runInBackground: 'yes',
	});

	t.true(result.isError);
	t.is(
		result.content[0].text,
		'Bash validation failed: runInBackground: expected boolean, got string',
	);
});

test('handleBashTool validates timeout bounds', async t => {
	// Timeout too small
	let result = await handleBashTool({
		command: 'echo test',
		timeout: 500,
	});

	t.true(result.isError);

	// Timeout too large
	result = await handleBashTool({
		command: 'echo test',
		timeout: 400_000,
	});

	t.true(result.isError);
	t.is(
		result.content[0].text,
		'Bash validation failed: timeout: number must be at most 300000',
	);
});

test('handleBashTool rejects additional properties', async t => {
	const result = await handleBashTool({
		command: 'echo test',
		invalidProperty: 'should not be allowed',
	});

	t.true(result.isError);
	t.is(
		result.content[0].text,
		"Bash validation failed: root: unexpected property 'invalidProperty'",
	);
});

// Basic command execution tests
test('handleBashTool executes simple command', async t => {
	const result = await handleBashTool({
		command: 'echo "Hello, World!"',
	});

	t.false(result.isError);
	t.true(result.content[0].text.includes('Hello, World!'));
	t.true(result.content[0].text.includes('Exit Code: 0'));
});

test('handleBashTool executes command with working directory', async t => {
	const temporaryDir = await createTemporaryDir();

	try {
		// Create a test file in temp directory
		const testFile = path.join(temporaryDir, 'test.txt');
		await fs.writeFile(testFile, 'test content', 'utf8');

		const result = await handleBashTool({
			command: 'ls -la',
			directory: temporaryDir,
		});

		t.false(result.isError);
		t.true(result.content[0].text.includes('test.txt'));
	} finally {
		await cleanup(temporaryDir);
	}
});

test('handleBashTool handles command with timeout', async t => {
	const result = await handleBashTool({
		command: 'echo "quick command"',
		timeout: 5000,
	});

	t.false(result.isError);
	t.true(result.content[0].text.includes('quick command'));
	t.true(result.content[0].text.includes('Exit Code: 0'));
});

test('handleBashTool handles background command execution', async t => {
	const result = await handleBashTool({
		command: 'echo "background task" &',
		runInBackground: true,
	});

	// Should handle background execution appropriately
	t.false(result.isError);
	t.true(result.content[0].text.includes('Exit Code: 0'));
	t.true(
		result.content[0].text.includes('Background process started with PID:'),
	);
	t.true(result.content[0].text.includes('Background PIDs:'));
});

test('handleBashTool includes optional description', async t => {
	const result = await handleBashTool({
		command: 'echo test',
		description: 'Testing echo command',
	});

	// Should execute successfully, description is for user clarity
	t.false(result.isError);
	t.true(result.content[0].text.includes('Testing echo command'));
});

// Error handling tests
test('handleBashTool handles command that fails', async t => {
	const result = await handleBashTool({
		command: 'exit 1',
	});

	// Tool execution succeeded, but command failed
	t.false(result.isError);
	t.true(result.content[0].text.includes('Exit Code: 1'));
});

test('handleBashTool handles non-existent command', async t => {
	const result = await handleBashTool({
		command: 'nonexistentcommand123',
	});

	// Tool execution succeeded, but command not found
	t.false(result.isError);
	t.true(
		result.content[0].text.includes('nonexistentcommand123: command not found'),
	);
});

test('handleBashTool handles command timeout', async t => {
	const result = await handleBashTool({
		command: 'sleep 10',
		timeout: 1000,
	});

	// Tool execution succeeded, but command timed out
	t.false(result.isError);
	t.true(result.content[0].text.includes('Exit Code: 1'));
	t.true(result.content[0].text.includes('Signal: SIGTERM'));
});

test('handleBashTool handles invalid working directory', async t => {
	const result = await handleBashTool({
		command: 'echo test',
		directory: '/nonexistent/directory',
	});

	// Should fail due to invalid directory
	t.true(result.isError);
	t.is(
		result.content[0].text,
		"Bash execution error: Invalid directory: /nonexistent/directory. ENOENT: no such file or directory, access '/nonexistent/directory'",
	);
});

// Output format tests
test('handleBashTool returns structured output', async t => {
	const result = await handleBashTool({
		command: 'echo "test output"',
	});

	// Should return structured output with key information
	t.false(result.isError);
	const output = result.content[0].text;

	t.true(output.includes('test output'));
	t.true(output.includes('Exit Code: 0'));
});

test('handleBashTool handles multi-line output', async t => {
	const result = await handleBashTool({
		command: String.raw`echo -e "line1\nline2\nline3"`,
	});

	// Should preserve multi-line output
	t.false(result.isError);
	t.true(result.content[0].text.includes('-e line1'));
	t.true(result.content[0].text.includes('line2'));
	t.true(result.content[0].text.includes('line3'));
});

test('handleBashTool handles commands with special characters', async t => {
	const result = await handleBashTool({
		command: 'echo "Special: $PATH && test | grep"',
	});

	// Should handle shell special characters
	t.false(result.isError);
	t.true(result.content[0].text.includes('Special:'));
	t.true(result.content[0].text.includes('test | grep'));
});

test('handleBashTool handles empty command output', async t => {
	const result = await handleBashTool({
		command: 'true', // Command that succeeds but produces no output
	});

	// Should handle empty output gracefully
	t.false(result.isError);
	t.true(result.content[0].text.includes('Exit Code: 0'));
	t.true(result.content[0].text.includes('Output: (empty)'));
});

// Security and safety tests
test('handleBashTool safely handles potentially dangerous commands', async t => {
	const result = await handleBashTool({
		command: 'rm -rf /tmp/nonexistent',
	});

	// Should execute safely in controlled environment
	// or have appropriate safety checks
	t.false(result.isError);
	// Command should either succeed (safe target) or fail safely
	t.true(result.content[0].text.length > 0);
});

test('handleBashTool handles commands with pipe operations', async t => {
	const result = await handleBashTool({
		command: 'echo "hello world" | grep "world"',
	});

	// Should handle pipe operations
	t.false(result.isError);
	t.true(result.content[0].text.includes('hello world'));
});

test('handleBashTool handles commands with redirections', async t => {
	const temporaryDir = await createTemporaryDir();

	try {
		const outputFile = path.join(temporaryDir, 'output.txt');
		const result = await handleBashTool({
			command: `echo "test content" > ${outputFile}`,
			directory: temporaryDir,
		});

		// Should handle output redirection
		t.false(result.isError);
		// Verify file was created with correct content
		const fileContent = await fs.readFile(outputFile, 'utf8');
		t.is(fileContent.trim(), 'test content');
	} finally {
		await cleanup(temporaryDir);
	}
});

test('handleBashTool handles environment variables', async t => {
	// Set a custom environment variable and test its expansion
	const result = await handleBashTool({
		command: 'TEST_VAR="test value"; echo "Custom var: $TEST_VAR"',
	});

	// Should expand environment variables
	t.false(result.isError);
	t.true(result.content[0].text.includes('Custom var: test value'));
	t.true(result.content[0].text.includes('Exit Code: 0'));
});
