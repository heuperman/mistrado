import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import test from 'ava';
import {handleMultiEditTool} from '../../source/tools/multi-edit.js';

// Test helper to create temporary directories
async function createTemporaryDir(): Promise<string> {
	return fs.mkdtemp(path.join(os.tmpdir(), 'multi-edit-test-'));
}

async function cleanup(dirPath: string): Promise<void> {
	try {
		await fs.rm(dirPath, {recursive: true, force: true});
	} catch {
		// Ignore cleanup errors
	}
}

test('handleMultiEditTool performs basic multiple string replacements', async t => {
	const temporaryDir = await createTemporaryDir();

	try {
		const filePath = path.join(temporaryDir, 'test.txt');
		const originalContent =
			'Hello, World!\nThis is a test file.\nGoodbye, World!';

		// Create test file
		await fs.writeFile(filePath, originalContent, 'utf8');

		const result = await handleMultiEditTool({
			filePath,
			edits: [
				{
					oldString: 'World',
					newString: 'Universe',
				},
				{
					oldString: 'test',
					newString: 'sample',
				},
			],
		});

		t.false(result.isError);
		t.true(result.content[0].text.includes('Successfully applied 2 edit(s)'));
		t.true(
			result.content[0].text.includes('Edit 1: Replaced first occurrence'),
		);
		t.true(
			result.content[0].text.includes('Edit 2: Replaced first occurrence'),
		);

		// Verify file was edited correctly
		const fileContent = await fs.readFile(filePath, 'utf8');
		t.is(
			fileContent,
			'Hello, Universe!\nThis is a sample file.\nGoodbye, World!',
		);
	} finally {
		await cleanup(temporaryDir);
	}
});

test('handleMultiEditTool handles sequential edits where later edits depend on earlier ones', async t => {
	const temporaryDir = await createTemporaryDir();

	try {
		const filePath = path.join(temporaryDir, 'test.txt');
		const originalContent = 'function oldName() {\n  return "oldValue";\n}';

		// Create test file
		await fs.writeFile(filePath, originalContent, 'utf8');

		const result = await handleMultiEditTool({
			filePath,
			edits: [
				{
					oldString: 'oldName',
					newString: 'newName',
				},
				{
					oldString: 'function newName() {\n  return "oldValue";\n}',
					newString: 'function newName() {\n  return "newValue";\n}',
				},
			],
		});

		t.false(result.isError);
		t.true(result.content[0].text.includes('Successfully applied 2 edit(s)'));

		// Verify sequential edits worked
		const fileContent = await fs.readFile(filePath, 'utf8');
		t.is(fileContent, 'function newName() {\n  return "newValue";\n}');
	} finally {
		await cleanup(temporaryDir);
	}
});

test('handleMultiEditTool replaces all occurrences with replaceAll=true', async t => {
	const temporaryDir = await createTemporaryDir();

	try {
		const filePath = path.join(temporaryDir, 'test.txt');
		const originalContent = 'foo bar foo baz foo\ntest foo again';

		// Create test file
		await fs.writeFile(filePath, originalContent, 'utf8');

		const result = await handleMultiEditTool({
			filePath,
			edits: [
				{
					oldString: 'foo',
					newString: 'qux',
					replaceAll: true,
				},
				{
					oldString: 'test',
					newString: 'example',
				},
			],
		});

		t.false(result.isError);
		t.true(result.content[0].text.includes('Successfully applied 2 edit(s)'));
		t.true(result.content[0].text.includes('Edit 1: Replaced all occurrence'));
		t.true(
			result.content[0].text.includes('Edit 2: Replaced first occurrence'),
		);

		// Verify all occurrences of 'foo' were replaced and 'test' was replaced once
		const fileContent = await fs.readFile(filePath, 'utf8');
		t.is(fileContent, 'qux bar qux baz qux\nexample qux again');
	} finally {
		await cleanup(temporaryDir);
	}
});

test('handleMultiEditTool handles multi-line replacements', async t => {
	const temporaryDir = await createTemporaryDir();

	try {
		const filePath = path.join(temporaryDir, 'test.js');
		const originalContent =
			'function oldFunc() {\n  console.log("old");\n}\n\nfunction anotherFunc() {\n  return true;\n}';

		// Create test file
		await fs.writeFile(filePath, originalContent, 'utf8');

		const result = await handleMultiEditTool({
			filePath,
			edits: [
				{
					oldString: 'function oldFunc() {\n  console.log("old");\n}',
					newString: 'function newFunc() {\n  console.log("new");\n}',
				},
				{
					oldString: 'return true;',
					newString: 'return false;',
				},
			],
		});

		t.false(result.isError);
		t.true(result.content[0].text.includes('Successfully applied 2 edit(s)'));

		// Verify multi-line replacements worked
		const fileContent = await fs.readFile(filePath, 'utf8');
		t.is(
			fileContent,
			'function newFunc() {\n  console.log("new");\n}\n\nfunction anotherFunc() {\n  return false;\n}',
		);
	} finally {
		await cleanup(temporaryDir);
	}
});

test('handleMultiEditTool handles empty string replacements', async t => {
	const temporaryDir = await createTemporaryDir();

	try {
		const filePath = path.join(temporaryDir, 'test.txt');
		const originalContent =
			'Hello, World!\nRemove this part: [REMOVE]\nGoodbye!';

		// Create test file
		await fs.writeFile(filePath, originalContent, 'utf8');

		const result = await handleMultiEditTool({
			filePath,
			edits: [
				{
					oldString: 'Remove this part: [REMOVE]\n',
					newString: '',
				},
				{
					oldString: 'Hello, ',
					newString: '',
				},
			],
		});

		t.false(result.isError);
		t.true(result.content[0].text.includes('Successfully applied 2 edit(s)'));

		// Verify strings were removed
		const fileContent = await fs.readFile(filePath, 'utf8');
		t.is(fileContent, 'World!\nGoodbye!');
	} finally {
		await cleanup(temporaryDir);
	}
});

test('handleMultiEditTool handles Unicode and special characters', async t => {
	const temporaryDir = await createTemporaryDir();

	try {
		const filePath = path.join(temporaryDir, 'unicode.txt');
		const originalContent =
			'特殊字符 🚀 "quotes"\nRegex: $test.match(/[a-z]+/)';

		// Create test file
		await fs.writeFile(filePath, originalContent, 'utf8');

		const result = await handleMultiEditTool({
			filePath,
			edits: [
				{
					oldString: '特殊字符 🚀',
					newString: 'Unicode 🌟',
				},
				{
					oldString: '$test.match(/[a-z]+/)',
					newString: '$test.match(/[A-Z]+/)',
				},
			],
		});

		t.false(result.isError);
		t.true(result.content[0].text.includes('Successfully applied 2 edit(s)'));

		// Verify Unicode and regex characters were handled
		const fileContent = await fs.readFile(filePath, 'utf8');
		t.is(fileContent, 'Unicode 🌟 "quotes"\nRegex: $test.match(/[A-Z]+/)');
	} finally {
		await cleanup(temporaryDir);
	}
});

test('handleMultiEditTool fails when file does not exist', async t => {
	const result = await handleMultiEditTool({
		filePath: '/non/existent/file.txt',
		edits: [
			{
				oldString: 'old',
				newString: 'new',
			},
		],
	});

	t.true(result.isError);
	t.true(result.content[0].text.includes('File not found'));
});

test('handleMultiEditTool fails when file path is not absolute', async t => {
	const result = await handleMultiEditTool({
		filePath: 'relative/path.txt',
		edits: [
			{
				oldString: 'old',
				newString: 'new',
			},
		],
	});

	t.true(result.isError);
	t.true(result.content[0].text.includes('File path must be absolute'));
});

test('handleMultiEditTool fails when string not found in any edit', async t => {
	const temporaryDir = await createTemporaryDir();

	try {
		const filePath = path.join(temporaryDir, 'test.txt');
		const originalContent = 'Hello, World!';

		// Create test file
		await fs.writeFile(filePath, originalContent, 'utf8');

		const result = await handleMultiEditTool({
			filePath,
			edits: [
				{
					oldString: 'World',
					newString: 'Universe',
				},
				{
					oldString: 'nonexistent',
					newString: 'replacement',
				},
			],
		});

		t.true(result.isError);
		t.true(
			result.content[0].text.includes(
				'Edit 2: String not found in file: "nonexistent"',
			),
		);
	} finally {
		await cleanup(temporaryDir);
	}
});

test('handleMultiEditTool rejects identical old and new strings', async t => {
	const temporaryDir = await createTemporaryDir();

	try {
		const filePath = path.join(temporaryDir, 'test.txt');
		const originalContent = 'Hello, World!';

		// Create test file
		await fs.writeFile(filePath, originalContent, 'utf8');

		const result = await handleMultiEditTool({
			filePath,
			edits: [
				{
					oldString: 'World',
					newString: 'World',
				},
			],
		});

		t.true(result.isError);
		t.true(
			result.content[0].text.includes(
				'Edit 1: oldString and newString cannot be the same',
			),
		);
	} finally {
		await cleanup(temporaryDir);
	}
});

test('handleMultiEditTool validates required parameters', async t => {
	// Missing filePath
	let result = await handleMultiEditTool({
		edits: [
			{
				oldString: 'old',
				newString: 'new',
			},
		],
	});

	t.true(result.isError);
	t.is(
		result.content[0].text,
		"MultiEdit validation failed: root: missing required property 'filePath'",
	);

	// Missing edits array
	result = await handleMultiEditTool({
		filePath: '/tmp/test.txt',
	});

	t.true(result.isError);
	t.is(
		result.content[0].text,
		"MultiEdit validation failed: root: missing required property 'edits'",
	);

	// Empty edits array
	result = await handleMultiEditTool({
		filePath: '/tmp/test.txt',
		edits: [],
	});

	t.true(result.isError);
	t.is(
		result.content[0].text,
		'MultiEdit validation failed: edits: array must have at least 1 items',
	);

	// Missing oldString in edit
	result = await handleMultiEditTool({
		filePath: '/tmp/test.txt',
		edits: [
			{
				newString: 'new',
			},
		],
	});

	t.true(result.isError);
	t.is(
		result.content[0].text,
		"MultiEdit validation failed: edits.0: missing required property 'oldString'",
	);

	// Missing newString in edit
	result = await handleMultiEditTool({
		filePath: '/tmp/test.txt',
		edits: [
			{
				oldString: 'old',
			},
		],
	});

	t.true(result.isError);
	t.is(
		result.content[0].text,
		"MultiEdit validation failed: edits.0: missing required property 'newString'",
	);
});

test('handleMultiEditTool rejects invalid schema types', async t => {
	const result = await handleMultiEditTool({
		filePath: 123,
		edits: [
			{
				oldString: 'old',
				newString: 'new',
			},
		],
	});

	t.true(result.isError);
	t.is(
		result.content[0].text,
		'MultiEdit validation failed: filePath: expected string, got number',
	);
});

test('handleMultiEditTool handles complex sequential edits with mixed replaceAll', async t => {
	const temporaryDir = await createTemporaryDir();

	try {
		const filePath = path.join(temporaryDir, 'complex.txt');
		const originalContent = 'foo bar foo baz foo\ntest foo test\nfoo end';

		// Create test file
		await fs.writeFile(filePath, originalContent, 'utf8');

		const result = await handleMultiEditTool({
			filePath,
			edits: [
				{
					oldString: 'foo',
					newString: 'FOO',
					replaceAll: true,
				},
				{
					oldString: 'test',
					newString: 'TEST',
				},
				{
					oldString: 'FOO bar FOO baz FOO\nTEST FOO test\nFOO end',
					newString: 'Updated content with FOO',
				},
			],
		});

		t.false(result.isError);
		t.true(result.content[0].text.includes('Successfully applied 3 edit(s)'));

		// Verify complex sequential edits worked
		const fileContent = await fs.readFile(filePath, 'utf8');
		t.is(fileContent, 'Updated content with FOO');
	} finally {
		await cleanup(temporaryDir);
	}
});
