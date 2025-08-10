import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import {Buffer} from 'node:buffer';
import test from 'ava';
import {handleGrepTool} from '../../source/tools/grep.js';

// Test helper to create temporary directories
async function createTemporaryDir(): Promise<string> {
	return fs.mkdtemp(path.join(os.tmpdir(), 'grep-test-'));
}

async function cleanup(dirPath: string): Promise<void> {
	try {
		await fs.rm(dirPath, {recursive: true, force: true});
	} catch {
		// Ignore cleanup errors
	}
}

// Helper to create test file structure with content
async function createTestFiles(
	baseDir: string,
	files: Array<{path: string; content: string; mtime?: Date}>,
): Promise<void> {
	await Promise.all(
		files.map(async file => {
			const fullPath = path.join(baseDir, file.path);
			const dir = path.dirname(fullPath);

			// Create directory if it doesn't exist
			await fs.mkdir(dir, {recursive: true});

			// Create file with content
			await fs.writeFile(fullPath, file.content, 'utf8');

			// Set modification time if specified
			if (file.mtime) {
				await fs.utimes(fullPath, file.mtime, file.mtime);
			}
		}),
	);
}

test('handleGrepTool finds matches with basic patterns', async t => {
	const temporaryDir = await createTemporaryDir();

	try {
		await createTestFiles(temporaryDir, [
			{
				path: 'file1.js',
				content: 'const x = 10;\nlet y = 20;\nfunction test() {}\n',
			},
			{
				path: 'file2.js',
				content: 'const z = 30;\nlet y = 40;\nfunction test() {}\n',
			},
			{
				path: 'file3.ts',
				content: 'const a = 100;\nlet b = 200;\nfunction test() {}\n',
			},
		]);

		const result = await handleGrepTool({
			pattern: 'const',
			path: temporaryDir,
		});

		t.false(result.isError);
		t.true(
			result.content[0].text.includes(
				'Found 3 matches in 3 files for pattern: const',
			),
		);
		t.true(result.content[0].text.includes('file1.js'));
		t.true(result.content[0].text.includes('file2.js'));
		t.true(result.content[0].text.includes('file3.ts'));
		t.true(result.content[0].text.includes('const x = 10'));
		t.true(result.content[0].text.includes('const z = 30'));
		t.true(result.content[0].text.includes('const a = 100'));
	} finally {
		await cleanup(temporaryDir);
	}
});

test('handleGrepTool finds matches with case-insensitive pattern', async t => {
	const temporaryDir = await createTemporaryDir();

	try {
		await createTestFiles(temporaryDir, [
			{
				path: 'file1.js',
				content: 'const x = 10;\nLET y = 20;\nfunction test() {}\n',
			},
			{
				path: 'file2.js',
				content: 'const z = 30;\nlet Y = 40;\nfunction test() {}\n',
			},
		]);

		const result = await handleGrepTool({
			pattern: 'let',
			path: temporaryDir,
		});

		t.false(result.isError);
		t.true(
			result.content[0].text.includes(
				'Found 2 matches in 2 files for pattern: let',
			),
		);
		t.true(result.content[0].text.includes('LET y = 20'));
		t.true(result.content[0].text.includes('let Y = 40'));
	} finally {
		await cleanup(temporaryDir);
	}
});

test('handleGrepTool respects include pattern', async t => {
	const temporaryDir = await createTemporaryDir();

	try {
		await createTestFiles(temporaryDir, [
			{
				path: 'file1.js',
				content: 'const x = 10;\nlet y = 20;\nfunction test() {}\n',
			},
			{
				path: 'file2.ts',
				content: 'const z = 30;\nlet w = 40;\nfunction test() {}\n',
			},
			{
				path: 'file3.ts',
				content: 'const a = 100;\nlet b = 200;\nfunction test() {}\n',
			},
		]);

		const result = await handleGrepTool({
			pattern: 'const',
			path: temporaryDir,
			include: '*.ts',
		});

		t.false(result.isError);
		t.true(
			result.content[0].text.includes(
				'Found 2 matches in 2 files for pattern: const',
			),
		);
		t.true(result.content[0].text.includes('file2.ts'));
		t.true(result.content[0].text.includes('file3.ts'));
		t.false(result.content[0].text.includes('file1.js'));
	} finally {
		await cleanup(temporaryDir);
	}
});

test('handleGrepTool returns no matches message when none found', async t => {
	const temporaryDir = await createTemporaryDir();

	try {
		await createTestFiles(temporaryDir, [
			{
				path: 'file1.js',
				content: 'const x = 10;\nlet y = 20;\nfunction test() {}\n',
			},
			{
				path: 'file2.ts',
				content: 'const z = 30;\nlet w = 40;\nfunction test() {}\n',
			},
		]);

		const result = await handleGrepTool({
			pattern: 'nonexistent',
			path: temporaryDir,
		});

		t.false(result.isError);
		t.true(
			result.content[0].text.includes(
				'No matches found for pattern: nonexistent',
			),
		);
	} finally {
		await cleanup(temporaryDir);
	}
});

test('handleGrepTool validates required parameters', async t => {
	// Missing pattern
	const result = await handleGrepTool({
		path: '/tmp',
	});

	t.true(result.isError);
	t.is(
		result.content[0].text,
		"Grep validation failed: root: missing required property 'pattern'",
	);
});

test('handleGrepTool validates parameter types', async t => {
	// Invalid pattern type
	let result = await handleGrepTool({
		pattern: 123,
	});

	t.true(result.isError);
	t.is(
		result.content[0].text,
		'Grep validation failed: pattern: expected string, got number',
	);

	// Invalid path type
	result = await handleGrepTool({
		pattern: 'test',
		path: 123,
	});

	t.true(result.isError);
	t.is(
		result.content[0].text,
		'Grep validation failed: path: expected string, got number',
	);

	// Invalid include type
	result = await handleGrepTool({
		pattern: 'test',
		include: 123,
	});

	t.true(result.isError);
	t.is(
		result.content[0].text,
		'Grep validation failed: include: expected string, got number',
	);
});

test('handleGrepTool rejects additional properties', async t => {
	const result = await handleGrepTool({
		pattern: 'test',
		invalidProperty: 'value',
	});

	t.true(result.isError);
	t.is(
		result.content[0].text,
		"Grep validation failed: root: unexpected property 'invalidProperty'",
	);
});

test('handleGrepTool handles invalid regex patterns', async t => {
	const result = await handleGrepTool({
		pattern: '[',
	});

	t.true(result.isError);
	t.true(result.content[0].text.includes('Invalid regex pattern: ['));
});

test('handleGrepTool handles non-existent search paths', async t => {
	const result = await handleGrepTool({
		pattern: 'test',
		path: '/non/existent/path',
	});

	t.true(result.isError);
	t.true(result.content[0].text.includes('Search path not found'));
});

test('handleGrepTool finds matches in nested directories', async t => {
	const temporaryDir = await createTemporaryDir();

	try {
		await createTestFiles(temporaryDir, [
			{
				path: 'src/file1.js',
				content: 'const x = 10;\nlet y = 20;\nfunction test() {}\n',
			},
			{
				path: 'src/nested/file2.js',
				content: 'const z = 30;\nlet w = 40;\nfunction test() {}\n',
			},
			{
				path: 'tests/file3.ts',
				content: 'const a = 100;\nlet b = 200;\nfunction test() {}\n',
			},
		]);

		const result = await handleGrepTool({
			pattern: 'const',
			path: temporaryDir,
		});

		t.false(result.isError);
		t.true(
			result.content[0].text.includes(
				'Found 3 matches in 3 files for pattern: const',
			),
		);
		t.true(result.content[0].text.includes('src/file1.js'));
		t.true(result.content[0].text.includes('src/nested/file2.js'));
		t.true(result.content[0].text.includes('tests/file3.ts'));
	} finally {
		await cleanup(temporaryDir);
	}
});

test('handleGrepTool respects gitignore patterns', async t => {
	const temporaryDir = await createTemporaryDir();

	try {
		// Create .git directory with proper structure to make it a valid git repository
		const gitDir = path.join(temporaryDir, '.git');
		await fs.mkdir(gitDir);

		// Create minimal git repository structure
		await fs.writeFile(path.join(gitDir, 'HEAD'), 'ref: refs/heads/main\n');
		await fs.mkdir(path.join(gitDir, 'refs', 'heads'), {recursive: true});
		await fs.mkdir(path.join(gitDir, 'objects'), {recursive: true});

		await createTestFiles(temporaryDir, [
			{
				path: 'app.js',
				content: 'const x = 10;\nlet y = 20;\nfunction test() {}\n',
			},
			{
				path: 'node_modules/package/index.js',
				content: 'const z = 30;\nlet w = 40;\nfunction test() {}\n',
			},
			{
				path: 'dist/bundle.js',
				content: 'const a = 100;\nlet b = 200;\nfunction test() {}\n',
			},
		]);

		// Create .gitignore
		await fs.writeFile(
			path.join(temporaryDir, '.gitignore'),
			'node_modules/\ndist/',
			'utf8',
		);

		const result = await handleGrepTool({
			pattern: 'const',
			path: temporaryDir,
		});

		t.false(result.isError);
		t.true(
			result.content[0].text.includes(
				'Found 1 matches in 1 files for pattern: const',
			),
		);
		t.true(result.content[0].text.includes('app.js'));
		t.false(result.content[0].text.includes('node_modules/package/index.js'));
		t.false(result.content[0].text.includes('dist/bundle.js'));
	} finally {
		await cleanup(temporaryDir);
	}
});

test('handleGrepTool shows line numbers in results', async t => {
	const temporaryDir = await createTemporaryDir();

	try {
		await createTestFiles(temporaryDir, [
			{
				path: 'file1.js',
				content:
					'const x = 10;\nlet y = 20;\nfunction test() {}\nconst z = 30;\n',
			},
		]);

		const result = await handleGrepTool({
			pattern: 'const',
			path: temporaryDir,
		});

		t.false(result.isError);
		t.true(result.content[0].text.includes('1: const x = 10'));
		t.true(result.content[0].text.includes('4: const z = 30'));
	} finally {
		await cleanup(temporaryDir);
	}
});

test('handleGrepTool handles multiple matches in same file', async t => {
	const temporaryDir = await createTemporaryDir();

	try {
		await createTestFiles(temporaryDir, [
			{
				path: 'file1.js',
				content:
					'const x = 10;\nlet y = 20;\nconst z = 30;\nlet w = 40;\nconst a = 50;\n',
			},
		]);

		const result = await handleGrepTool({
			pattern: 'const',
			path: temporaryDir,
		});

		t.false(result.isError);
		t.true(
			result.content[0].text.includes(
				'Found 3 matches in 1 files for pattern: const',
			),
		);
		t.true(result.content[0].text.includes('file1.js:'));
		t.true(result.content[0].text.includes('1: const x = 10'));
		t.true(result.content[0].text.includes('3: const z = 30'));
		t.true(result.content[0].text.includes('5: const a = 50'));
	} finally {
		await cleanup(temporaryDir);
	}
});

test('handleGrepTool handles binary files gracefully', async t => {
	const temporaryDir = await createTemporaryDir();

	try {
		await createTestFiles(temporaryDir, [
			{
				path: 'file1.js',
				content: 'const x = 10;\nlet y = 20;\nfunction test() {}\n',
			},
		]);

		// Create a binary file
		await fs.writeFile(
			path.join(temporaryDir, 'binary.png'),
			Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
			'binary',
		);

		const result = await handleGrepTool({
			pattern: 'const',
			path: temporaryDir,
		});

		t.false(result.isError);
		t.true(
			result.content[0].text.includes(
				'Found 1 matches in 1 files for pattern: const',
			),
		);
		t.true(result.content[0].text.includes('file1.js'));
		t.false(result.content[0].text.includes('binary.png'));
	} finally {
		await cleanup(temporaryDir);
	}
});
