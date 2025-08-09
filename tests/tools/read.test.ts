import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import test from 'ava';
import {handleReadTool} from '../../source/tools/read.js';

// Test helper to create temporary directories
async function createTemporaryDir(): Promise<string> {
	return fs.mkdtemp(path.join(os.tmpdir(), 'read-test-'));
}

async function cleanup(dirPath: string): Promise<void> {
	try {
		await fs.rm(dirPath, {recursive: true, force: true});
	} catch {
		// Ignore cleanup errors
	}
}

test('handleReadTool reads file successfully', async t => {
	const temporaryDir = await createTemporaryDir();

	try {
		const filePath = path.join(temporaryDir, 'test.txt');
		const content = 'Hello, World!\nSecond line\nThird line';

		// Create test file
		await fs.writeFile(filePath, content, 'utf8');

		const result = await handleReadTool({
			filePath,
		});

		t.false(result.isError);
		t.true(result.content[0].text.includes('Hello, World!'));
		t.true(result.content[0].text.includes('Second line'));
		t.true(result.content[0].text.includes('Third line'));
	} finally {
		await cleanup(temporaryDir);
	}
});

test('handleReadTool formats output with line numbers', async t => {
	const temporaryDir = await createTemporaryDir();

	try {
		const filePath = path.join(temporaryDir, 'numbered.txt');
		const content = 'Line one\nLine two\nLine three';

		// Create test file
		await fs.writeFile(filePath, content, 'utf8');

		const result = await handleReadTool({
			filePath,
		});

		t.false(result.isError);
		const output = result.content[0].text;
		t.true(output.includes('     1\tLine one'));
		t.true(output.includes('     2\tLine two'));
		t.true(output.includes('     3\tLine three'));
	} finally {
		await cleanup(temporaryDir);
	}
});

test('handleReadTool handles empty file', async t => {
	const temporaryDir = await createTemporaryDir();

	try {
		const filePath = path.join(temporaryDir, 'empty.txt');

		// Create empty file
		await fs.writeFile(filePath, '', 'utf8');

		const result = await handleReadTool({
			filePath,
		});

		t.false(result.isError);
		t.true(result.content[0].text.includes('SYSTEM REMINDER'));
		t.true(result.content[0].text.includes('empty file'));
	} finally {
		await cleanup(temporaryDir);
	}
});

test('handleReadTool handles offset and limit', async t => {
	const temporaryDir = await createTemporaryDir();

	try {
		const filePath = path.join(temporaryDir, 'lines.txt');
		const content = 'Line 1\nLine 2\nLine 3\nLine 4\nLine 5';

		// Create test file
		await fs.writeFile(filePath, content, 'utf8');

		const result = await handleReadTool({
			filePath,
			offset: 2,
			limit: 2,
		});

		t.false(result.isError);
		const output = result.content[0].text;
		t.true(output.includes('Showing lines 2-3 of 5 total lines'));
		t.true(output.includes('     2\tLine 2'));
		t.true(output.includes('     3\tLine 3'));
		t.false(output.includes('Line 1'));
		t.false(output.includes('Line 4'));
	} finally {
		await cleanup(temporaryDir);
	}
});

test('handleReadTool truncates long lines', async t => {
	const temporaryDir = await createTemporaryDir();

	try {
		const filePath = path.join(temporaryDir, 'long.txt');
		const longLine = 'x'.repeat(2500); // Exceeds 2000 character limit

		// Create test file with long line
		await fs.writeFile(filePath, longLine, 'utf8');

		const result = await handleReadTool({
			filePath,
		});

		t.false(result.isError);
		const output = result.content[0].text;
		t.true(output.includes('...[truncated]'));
		const firstLine = output.split('\n')[0];
		t.true(firstLine.length < 2100); // Should be truncated + metadata
	} finally {
		await cleanup(temporaryDir);
	}
});

test('handleReadTool detects binary files', async t => {
	const temporaryDir = await createTemporaryDir();

	try {
		const filePath = path.join(temporaryDir, 'test.png');

		// Create fake binary file with PNG header
		await fs.writeFile(filePath, new Uint8Array([137, 80, 78, 71]));

		const result = await handleReadTool({
			filePath,
		});

		t.false(result.isError);
		const output = result.content[0].text;
		t.true(output.includes('[Binary file detected:'));
		t.true(output.includes('PNG Image'));
		t.true(output.includes('multimodal capabilities'));
	} finally {
		await cleanup(temporaryDir);
	}
});

test('handleReadTool handles non-existent file', async t => {
	const result = await handleReadTool({
		filePath: '/non/existent/file.txt',
	});

	t.true(result.isError);
	t.true(result.content[0].text.includes('File not found'));
});

test('handleReadTool handles directory path', async t => {
	const temporaryDir = await createTemporaryDir();

	try {
		const result = await handleReadTool({
			filePath: temporaryDir,
		});

		t.true(result.isError);
		t.true(result.content[0].text.includes('directory, not a file'));
	} finally {
		await cleanup(temporaryDir);
	}
});

test('handleReadTool rejects relative paths', async t => {
	const result = await handleReadTool({
		filePath: 'relative/path.txt',
	});

	t.true(result.isError);
	t.true(result.content[0].text.includes('File path must be absolute'));
});

test('handleReadTool validates required parameters', async t => {
	// Missing filePath
	const result = await handleReadTool({});

	t.true(result.isError);
	t.is(
		result.content[0].text,
		"Read validation failed: root: missing required property 'filePath'",
	);
});

test('handleReadTool rejects invalid schema', async t => {
	const result = await handleReadTool({
		filePath: 123,
	});

	t.true(result.isError);
	t.is(
		result.content[0].text,
		'Read validation failed: filePath: expected string, got number',
	);
});

test('handleReadTool handles special characters in content', async t => {
	const temporaryDir = await createTemporaryDir();

	try {
		const filePath = path.join(temporaryDir, 'special.txt');
		const content = '特殊字符\n🚀\t"quotes"\nNewlines';

		// Create test file with special characters
		await fs.writeFile(filePath, content, 'utf8');

		const result = await handleReadTool({
			filePath,
		});

		t.false(result.isError);
		const output = result.content[0].text;
		t.true(output.includes('特殊字符'));
		t.true(output.includes('🚀'));
		t.true(output.includes('"quotes"'));
	} finally {
		await cleanup(temporaryDir);
	}
});
