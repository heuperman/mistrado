import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import test from 'ava';
import {
	validateAbsolutePath,
	ensureFileExists,
	readFileContent,
	writeFileContent,
	performSingleEdit,
	escapeRegExp,
	performFileEdit,
	type EditOperation,
} from '../../source/utils/file-operations.js';

// Test helper to create temporary directories
async function createTemporaryDir(): Promise<string> {
	return fs.mkdtemp(path.join(os.tmpdir(), 'file-ops-test-'));
}

async function cleanup(dirPath: string): Promise<void> {
	try {
		await fs.rm(dirPath, {recursive: true, force: true});
	} catch {
		// Ignore cleanup errors
	}
}

// ValidateAbsolutePath tests
test('validateAbsolutePath accepts absolute paths', t => {
	t.notThrows(() => {
		validateAbsolutePath('/absolute/path');
	});
	t.notThrows(() => {
		validateAbsolutePath(path.resolve('relative'));
	});
});

test('validateAbsolutePath rejects relative paths', t => {
	const error = t.throws(
		() => {
			validateAbsolutePath('relative/path');
		},
		{
			message: 'File path must be absolute, not relative',
		},
	);
	t.truthy(error);
});

// EnsureFileExists tests
test('ensureFileExists succeeds for existing file', async t => {
	const temporaryDir = await createTemporaryDir();

	try {
		const filePath = path.join(temporaryDir, 'existing.txt');
		await fs.writeFile(filePath, 'content', 'utf8');

		await t.notThrowsAsync(async () => ensureFileExists(filePath));
	} finally {
		await cleanup(temporaryDir);
	}
});

test('ensureFileExists throws for non-existent file', async t => {
	const temporaryDir = await createTemporaryDir();

	try {
		const filePath = path.join(temporaryDir, 'nonexistent.txt');

		const error = await t.throwsAsync(async () => ensureFileExists(filePath), {
			message: `File not found: ${filePath}`,
		});
		t.truthy(error);
	} finally {
		await cleanup(temporaryDir);
	}
});

// ReadFileContent tests
test('readFileContent reads file successfully', async t => {
	const temporaryDir = await createTemporaryDir();

	try {
		const filePath = path.join(temporaryDir, 'test.txt');
		const content = 'Hello, World!';
		await fs.writeFile(filePath, content, 'utf8');

		const result = await readFileContent(filePath);
		t.is(result, content);
	} finally {
		await cleanup(temporaryDir);
	}
});

test('readFileContent handles special characters', async t => {
	const temporaryDir = await createTemporaryDir();

	try {
		const filePath = path.join(temporaryDir, 'special.txt');
		const content = '特殊字符\n🚀\t"quotes"\n\r\nNewlines';
		await fs.writeFile(filePath, content, 'utf8');

		const result = await readFileContent(filePath);
		t.is(result, content);
	} finally {
		await cleanup(temporaryDir);
	}
});

test('readFileContent throws for non-existent file', async t => {
	const temporaryDir = await createTemporaryDir();

	try {
		const filePath = path.join(temporaryDir, 'nonexistent.txt');

		const error = await t.throwsAsync(async () => readFileContent(filePath));
		t.true(error.message.includes('Failed to read file'));
	} finally {
		await cleanup(temporaryDir);
	}
});

// WriteFileContent tests
test('writeFileContent writes file successfully', async t => {
	const temporaryDir = await createTemporaryDir();

	try {
		const filePath = path.join(temporaryDir, 'test.txt');
		const content = 'Hello, World!';

		await t.notThrowsAsync(async () => writeFileContent(filePath, content));

		const result = await fs.readFile(filePath, 'utf8');
		t.is(result, content);
	} finally {
		await cleanup(temporaryDir);
	}
});

test('writeFileContent overwrites existing file', async t => {
	const temporaryDir = await createTemporaryDir();

	try {
		const filePath = path.join(temporaryDir, 'existing.txt');
		await fs.writeFile(filePath, 'original', 'utf8');

		const newContent = 'overwritten';
		await writeFileContent(filePath, newContent);

		const result = await fs.readFile(filePath, 'utf8');
		t.is(result, newContent);
	} finally {
		await cleanup(temporaryDir);
	}
});

// PerformSingleEdit tests
test('performSingleEdit replaces single occurrence', t => {
	const content = 'Hello World Hello';
	const operation: EditOperation = {
		oldString: 'Hello',
		newString: 'Hi',
		replaceAll: false,
	};

	const result = performSingleEdit(content, operation, false);

	t.true(result.success);
	if (result.success) {
		t.is(result.replacementCount, 1);
		t.is(result.message, 'Hi World Hello');
	}
});

test('performSingleEdit replaces all occurrences', t => {
	const content = 'Hello World Hello';
	const operation: EditOperation = {
		oldString: 'Hello',
		newString: 'Hi',
		replaceAll: true,
	};

	const result = performSingleEdit(content, operation, false);

	t.true(result.success);
	if (result.success) {
		t.is(result.replacementCount, 2);
		t.is(result.message, 'Hi World Hi');
	}
});

test('performSingleEdit requires unique string when specified', t => {
	const content = 'Hello World Hello';
	const operation: EditOperation = {
		oldString: 'Hello',
		newString: 'Hi',
		replaceAll: false,
	};

	const result = performSingleEdit(content, operation, true);

	t.false(result.success);
	if (!result.success) {
		t.true(result.error.includes('appears multiple times'));
	}
});

test('performSingleEdit handles string not found', t => {
	const content = 'Hello World';
	const operation: EditOperation = {
		oldString: 'NotFound',
		newString: 'Hi',
		replaceAll: false,
	};

	const result = performSingleEdit(content, operation, false);

	t.false(result.success);
	if (!result.success) {
		t.is(result.error, 'String not found in file: "NotFound"');
	}
});

test('performSingleEdit rejects identical strings', t => {
	const content = 'Hello World';
	const operation: EditOperation = {
		oldString: 'Hello',
		newString: 'Hello',
		replaceAll: false,
	};

	const result = performSingleEdit(content, operation, false);

	t.false(result.success);
	if (!result.success) {
		t.is(result.error, 'oldString and newString cannot be the same');
	}
});

// EscapeRegExp tests
test('escapeRegExp escapes regex special characters', t => {
	t.is(escapeRegExp('hello'), 'hello');
	t.is(
		escapeRegExp('.*+?^${}()|[]\\'),
		'\\.\\*\\+\\?\\^\\$\\{\\}\\(\\)\\|\\[\\]\\\\',
	);
	t.is(escapeRegExp('function()'), String.raw`function\(\)`);
});

// PerformFileEdit integration tests
test('performFileEdit performs complete edit operation', async t => {
	const temporaryDir = await createTemporaryDir();

	try {
		const filePath = path.join(temporaryDir, 'test.txt');
		const originalContent = 'Hello World Hello';
		await fs.writeFile(filePath, originalContent, 'utf8');

		const operation: EditOperation = {
			oldString: 'Hello',
			newString: 'Hi',
			replaceAll: true,
		};

		const result = await performFileEdit(filePath, operation, false);

		t.is(result.replacementCount, 2);
		t.true(result.message.includes('Successfully made 2 replacements'));

		const newContent = await fs.readFile(filePath, 'utf8');
		t.is(newContent, 'Hi World Hi');
	} finally {
		await cleanup(temporaryDir);
	}
});

test('performFileEdit throws for non-existent file', async t => {
	const temporaryDir = await createTemporaryDir();

	try {
		const filePath = path.join(temporaryDir, 'nonexistent.txt');
		const operation: EditOperation = {
			oldString: 'Hello',
			newString: 'Hi',
			replaceAll: false,
		};

		const error = await t.throwsAsync(async () =>
			performFileEdit(filePath, operation, false),
		);
		t.true(error.message.includes('File not found'));
	} finally {
		await cleanup(temporaryDir);
	}
});

test('performFileEdit throws for relative path', async t => {
	const operation: EditOperation = {
		oldString: 'Hello',
		newString: 'Hi',
		replaceAll: false,
	};

	const error = await t.throwsAsync(async () =>
		performFileEdit('relative/path.txt', operation, false),
	);
	t.is(error.message, 'File path must be absolute, not relative');
});
