import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import test from 'ava';
import {handleEditTool} from '../../source/tools/edit.js';

// Test helper to create temporary directories
async function createTemporaryDir(): Promise<string> {
	return fs.mkdtemp(path.join(os.tmpdir(), 'edit-test-'));
}

async function cleanup(dirPath: string): Promise<void> {
	try {
		await fs.rm(dirPath, {recursive: true, force: true});
	} catch {
		// Ignore cleanup errors
	}
}

test('handleEditTool performs basic string replacement', async t => {
	const temporaryDir = await createTemporaryDir();

	try {
		const filePath = path.join(temporaryDir, 'test.txt');
		const originalContent = 'Hello, World!\nThis is a test file.';
		const oldString = 'World';
		const newString = 'Universe';

		// Create test file
		await fs.writeFile(filePath, originalContent, 'utf8');

		const result = await handleEditTool({
			filePath,
			oldString,
			newString,
		});

		t.false(result.isError);
		t.true(result.content[0].text.includes('Successfully made 1 replacement'));

		// Verify file was edited correctly
		const fileContent = await fs.readFile(filePath, 'utf8');
		t.is(fileContent, 'Hello, Universe!\nThis is a test file.');
	} finally {
		await cleanup(temporaryDir);
	}
});

test('handleEditTool replaces all occurrences with replaceAll=true', async t => {
	const temporaryDir = await createTemporaryDir();

	try {
		const filePath = path.join(temporaryDir, 'test.txt');
		const originalContent = 'foo bar foo baz foo';
		const oldString = 'foo';
		const newString = 'qux';

		// Create test file
		await fs.writeFile(filePath, originalContent, 'utf8');

		const result = await handleEditTool({
			filePath,
			oldString,
			newString,
			replaceAll: true,
		});

		t.false(result.isError);
		t.true(result.content[0].text.includes('Successfully made 3 replacements'));

		// Verify all occurrences were replaced
		const fileContent = await fs.readFile(filePath, 'utf8');
		t.is(fileContent, 'qux bar qux baz qux');
	} finally {
		await cleanup(temporaryDir);
	}
});

test('handleEditTool fails on duplicate strings without replaceAll', async t => {
	const temporaryDir = await createTemporaryDir();

	try {
		const filePath = path.join(temporaryDir, 'test.txt');
		const originalContent = 'foo bar foo baz';
		const oldString = 'foo';
		const newString = 'qux';

		// Create test file
		await fs.writeFile(filePath, originalContent, 'utf8');

		const result = await handleEditTool({
			filePath,
			oldString,
			newString,
		});

		t.true(result.isError);
		t.true(result.content[0].text.includes('appears multiple times'));
		t.true(result.content[0].text.includes('Use replace_all=true'));
	} finally {
		await cleanup(temporaryDir);
	}
});

test('handleEditTool handles multi-line replacements', async t => {
	const temporaryDir = await createTemporaryDir();

	try {
		const filePath = path.join(temporaryDir, 'test.txt');
		const originalContent = 'function test() {\n  return "old";\n}';
		const oldString = 'function test() {\n  return "old";\n}';
		const newString = 'function test() {\n  return "new";\n}';

		// Create test file
		await fs.writeFile(filePath, originalContent, 'utf8');

		const result = await handleEditTool({
			filePath,
			oldString,
			newString,
		});

		t.false(result.isError);
		t.true(result.content[0].text.includes('Successfully made 1 replacement'));

		// Verify multi-line replacement worked
		const fileContent = await fs.readFile(filePath, 'utf8');
		t.is(fileContent, 'function test() {\n  return "new";\n}');
	} finally {
		await cleanup(temporaryDir);
	}
});

test('handleEditTool handles indentation normalization', async t => {
	const temporaryDir = await createTemporaryDir();

	try {
		const filePath = path.join(temporaryDir, 'test.ts');
		// File uses tabs for indentation
		const originalContent = 'function test() {\n\treturn "value";\n}';
		// User provides spaces (common AI model behavior)
		const oldString = 'function test() {\n    return "value";\n}';
		const newString = 'function test() {\n    return "updated";\n}';

		// Create test file with tab indentation
		await fs.writeFile(filePath, originalContent, 'utf8');

		const result = await handleEditTool({
			filePath,
			oldString,
			newString,
		});

		t.false(result.isError);
		t.true(result.content[0].text.includes('Successfully made 1 replacement'));
		t.true(result.content[0].text.includes('Indentation normalized'));

		// Verify indentation was normalized and replacement worked
		const fileContent = await fs.readFile(filePath, 'utf8');
		t.is(fileContent, 'function test() {\n\treturn "updated";\n}');
	} finally {
		await cleanup(temporaryDir);
	}
});

test('handleEditTool handles empty string replacement', async t => {
	const temporaryDir = await createTemporaryDir();

	try {
		const filePath = path.join(temporaryDir, 'test.txt');
		const originalContent = 'Hello, World!';
		const oldString = 'Hello, ';
		const newString = '';

		// Create test file
		await fs.writeFile(filePath, originalContent, 'utf8');

		const result = await handleEditTool({
			filePath,
			oldString,
			newString,
		});

		t.false(result.isError);
		t.true(result.content[0].text.includes('Successfully made 1 replacement'));

		// Verify string was removed
		const fileContent = await fs.readFile(filePath, 'utf8');
		t.is(fileContent, 'World!');
	} finally {
		await cleanup(temporaryDir);
	}
});

test('handleEditTool handles special characters and regex patterns', async t => {
	const temporaryDir = await createTemporaryDir();

	try {
		const filePath = path.join(temporaryDir, 'test.txt');
		const originalContent = 'Pattern: $test.match(/[a-z]+/)';
		const oldString = '$test.match(/[a-z]+/)';
		const newString = '$test.match(/[A-Z]+/)';

		// Create test file
		await fs.writeFile(filePath, originalContent, 'utf8');

		const result = await handleEditTool({
			filePath,
			oldString,
			newString,
		});

		t.false(result.isError);
		t.true(result.content[0].text.includes('Successfully made 1 replacement'));

		// Verify regex characters were handled literally
		const fileContent = await fs.readFile(filePath, 'utf8');
		t.is(fileContent, 'Pattern: $test.match(/[A-Z]+/)');
	} finally {
		await cleanup(temporaryDir);
	}
});

test('handleEditTool fails when file does not exist', async t => {
	const result = await handleEditTool({
		filePath: '/non/existent/file.txt',
		oldString: 'old',
		newString: 'new',
	});

	t.true(result.isError);
	t.true(result.content[0].text.includes('File not found'));
});

test('handleEditTool fails when string not found', async t => {
	const temporaryDir = await createTemporaryDir();

	try {
		const filePath = path.join(temporaryDir, 'test.txt');
		const originalContent = 'Hello, World!';
		const oldString = 'nonexistent';
		const newString = 'replacement';

		// Create test file
		await fs.writeFile(filePath, originalContent, 'utf8');

		const result = await handleEditTool({
			filePath,
			oldString,
			newString,
		});

		t.true(result.isError);
		t.true(result.content[0].text.includes('String not found in file'));
	} finally {
		await cleanup(temporaryDir);
	}
});

test('handleEditTool rejects identical old and new strings', async t => {
	const temporaryDir = await createTemporaryDir();

	try {
		const filePath = path.join(temporaryDir, 'test.txt');
		const originalContent = 'Hello, World!';
		const sameString = 'World';

		// Create test file
		await fs.writeFile(filePath, originalContent, 'utf8');

		const result = await handleEditTool({
			filePath,
			oldString: sameString,
			newString: sameString,
		});

		t.true(result.isError);
		t.true(
			result.content[0].text.includes('must be different from old_string'),
		);
	} finally {
		await cleanup(temporaryDir);
	}
});

test('handleEditTool validates required parameters', async t => {
	// Missing filePath
	let result = await handleEditTool({
		oldString: 'old',
		newString: 'new',
	});

	t.true(result.isError);
	t.is(
		result.content[0].text,
		"Edit validation failed: root: missing required property 'filePath'",
	);

	// Missing oldString
	result = await handleEditTool({
		filePath: '/tmp/test.txt',
		newString: 'new',
	});

	t.true(result.isError);
	t.is(
		result.content[0].text,
		"Edit validation failed: root: missing required property 'oldString'",
	);

	// Missing newString
	result = await handleEditTool({
		filePath: '/tmp/test.txt',
		oldString: 'old',
	});

	t.true(result.isError);
	t.is(
		result.content[0].text,
		"Edit validation failed: root: missing required property 'newString'",
	);
});

test('handleEditTool rejects invalid schema types', async t => {
	const result = await handleEditTool({
		filePath: 123,
		oldString: 'old',
		newString: 'new',
	});

	t.true(result.isError);
	t.is(
		result.content[0].text,
		'Edit validation failed: filePath: expected string, got number',
	);
});

test('handleEditTool handles Unicode and special characters', async t => {
	const temporaryDir = await createTemporaryDir();

	try {
		const filePath = path.join(temporaryDir, 'unicode.txt');
		const originalContent = '特殊字符 🚀 "quotes" \n newline';
		const oldString = '特殊字符 🚀';
		const newString = 'Unicode 🌟';

		// Create test file
		await fs.writeFile(filePath, originalContent, 'utf8');

		const result = await handleEditTool({
			filePath,
			oldString,
			newString,
		});

		t.false(result.isError);
		t.true(result.content[0].text.includes('Successfully made 1 replacement'));

		// Verify Unicode handling
		const fileContent = await fs.readFile(filePath, 'utf8');
		t.is(fileContent, 'Unicode 🌟 "quotes" \n newline');
	} finally {
		await cleanup(temporaryDir);
	}
});
