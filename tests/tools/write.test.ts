import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import {platform} from 'node:process';
import * as os from 'node:os';
import test from 'ava';
import {handleWriteTool} from '../../source/tools/write.js';

// Test helper to create temporary directories
async function createTemporaryDir(): Promise<string> {
	return fs.mkdtemp(path.join(os.tmpdir(), 'write-test-'));
}

async function cleanup(dirPath: string): Promise<void> {
	try {
		await fs.rm(dirPath, {recursive: true, force: true});
	} catch {
		// Ignore cleanup errors
	}
}

test('handleWriteTool writes file successfully', async t => {
	const temporaryDir = await createTemporaryDir();

	try {
		const filePath = path.join(temporaryDir, 'test.txt');
		const content = 'Hello, World!';

		const result = await handleWriteTool({
			filePath,
			content,
		});

		t.false(result.isError);
		t.is(result.content[0].text, `Successfully wrote file: ${filePath}`);

		// Verify file was written
		const fileContent = await fs.readFile(filePath, 'utf8');
		t.is(fileContent, content);
	} finally {
		await cleanup(temporaryDir);
	}
});

test('handleWriteTool creates directory if it does not exist', async t => {
	const temporaryDir = await createTemporaryDir();

	try {
		const nestedPath = path.join(temporaryDir, 'nested', 'deep', 'directory');
		const filePath = path.join(nestedPath, 'test.txt');
		const content = 'Nested content';

		const result = await handleWriteTool({
			filePath,
			content,
		});

		t.false(result.isError);
		t.is(result.content[0].text, `Successfully wrote file: ${filePath}`);

		// Verify directory was created and file was written
		const fileContent = await fs.readFile(filePath, 'utf8');
		t.is(fileContent, content);
	} finally {
		await cleanup(temporaryDir);
	}
});

test('handleWriteTool overwrites existing file', async t => {
	const temporaryDir = await createTemporaryDir();

	try {
		const filePath = path.join(temporaryDir, 'existing.txt');
		const originalContent = 'Original content';
		const newContent = 'New content';

		// Create initial file
		await fs.writeFile(filePath, originalContent, 'utf8');

		// Overwrite with new content
		const result = await handleWriteTool({
			filePath,
			content: newContent,
		});

		t.false(result.isError);
		t.is(result.content[0].text, `Successfully wrote file: ${filePath}`);

		// Verify file was overwritten
		const fileContent = await fs.readFile(filePath, 'utf8');
		t.is(fileContent, newContent);
	} finally {
		await cleanup(temporaryDir);
	}
});

test('handleWriteTool handles empty content', async t => {
	const temporaryDir = await createTemporaryDir();

	try {
		const filePath = path.join(temporaryDir, 'empty.txt');
		const content = '';

		const result = await handleWriteTool({
			filePath,
			content,
		});

		t.false(result.isError);
		t.is(result.content[0].text, `Successfully wrote file: ${filePath}`);

		// Verify empty file was created
		const fileContent = await fs.readFile(filePath, 'utf8');
		t.is(fileContent, '');
	} finally {
		await cleanup(temporaryDir);
	}
});

test('handleWriteTool rejects relative paths', async t => {
	const result = await handleWriteTool({
		filePath: 'relative/path.txt',
		content: 'content',
	});

	t.true(result.isError);
	t.is(
		result.content[0].text,
		'Error writing file: File path must be absolute, not relative',
	);
});

test('handleWriteTool accepts Windows absolute paths', async t => {
	// Skip on non-Windows platforms since we can't actually write to C:\
	if (platform !== 'win32') {
		t.pass('Skipping Windows path test on non-Windows platform');
		return;
	}

	const temporaryDir = await createTemporaryDir();

	try {
		const filePath = path
			.join(temporaryDir, 'windows-test.txt')
			.replaceAll('/', '\\');
		const content = 'Windows content';

		const result = await handleWriteTool({
			filePath,
			content,
		});

		t.false(result.isError);
	} finally {
		await cleanup(temporaryDir);
	}
});

test('handleWriteTool validates required parameters', async t => {
	// Missing filePath
	let result = await handleWriteTool({
		content: 'content',
	});

	t.true(result.isError);
	t.is(
		result.content[0].text,
		"Write validation failed: root: missing required property 'filePath'",
	);

	// Missing content
	result = await handleWriteTool({
		filePath: '/tmp/test.txt',
	});

	t.true(result.isError);
	t.is(
		result.content[0].text,
		"Write validation failed: root: missing required property 'content'",
	);

	// Missing both
	result = await handleWriteTool({});

	t.true(result.isError);
	t.is(
		result.content[0].text,
		"Write validation failed: root: missing required property 'filePath'",
	);
});

test('handleWriteTool rejects invalid schema', async t => {
	const result = await handleWriteTool({
		filePath: 123,
		content: 'content',
	});

	t.true(result.isError);
	t.is(
		result.content[0].text,
		'Write validation failed: filePath: expected string, got number',
	);
});

test('handleWriteTool handles special characters in content', async t => {
	const temporaryDir = await createTemporaryDir();

	try {
		const filePath = path.join(temporaryDir, 'special.txt');
		const content = '特殊字符\n🚀\t"quotes"\n\r\nNewlines\0null';

		const result = await handleWriteTool({
			filePath,
			content,
		});

		t.false(result.isError);
		t.is(result.content[0].text, `Successfully wrote file: ${filePath}`);

		// Verify special characters were preserved
		const fileContent = await fs.readFile(filePath, 'utf8');
		t.is(fileContent, content);
	} finally {
		await cleanup(temporaryDir);
	}
});
