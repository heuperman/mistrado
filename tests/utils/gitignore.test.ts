import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import test from 'ava';
import {
	parseGitignore,
	shouldIgnoreFile,
	type GitignorePattern,
} from '../../source/utils/gitignore.js';

// Test helper to create temporary directories and files
async function createTemporaryDir(): Promise<string> {
	return fs.mkdtemp(path.join(os.tmpdir(), 'gitignore-test-'));
}

async function createGitRepo(dirPath: string): Promise<void> {
	const gitDir = path.join(dirPath, '.git');
	await fs.mkdir(gitDir, {recursive: true});

	// Create minimal git repository structure
	await fs.writeFile(
		path.join(gitDir, 'config'),
		'[core]\n\trepositoryformatversion = 0\n\tfilemode = true\n\tbare = false\n\tlogallrefupdates = true\n',
	);

	await fs.writeFile(path.join(gitDir, 'HEAD'), 'ref: refs/heads/main\n');

	// Create refs directory structure
	await fs.mkdir(path.join(gitDir, 'refs', 'heads'), {recursive: true});
	await fs.mkdir(path.join(gitDir, 'refs', 'tags'), {recursive: true});

	// Create objects directory
	await fs.mkdir(path.join(gitDir, 'objects', 'info'), {recursive: true});
	await fs.mkdir(path.join(gitDir, 'objects', 'pack'), {recursive: true});
}

async function createGitignoreFile(
	dirPath: string,
	content: string,
): Promise<void> {
	await fs.writeFile(path.join(dirPath, '.gitignore'), content);
}

async function cleanup(dirPath: string): Promise<void> {
	try {
		await fs.rm(dirPath, {recursive: true, force: true});
	} catch {
		// Ignore cleanup errors
	}
}

test('shouldIgnoreFile ignores exact file match', t => {
	const patterns: GitignorePattern[] = [{pattern: 'file.txt', negated: false}];

	t.true(shouldIgnoreFile('file.txt', patterns));
	t.false(shouldIgnoreFile('other.txt', patterns));
});

test('shouldIgnoreFile ignores wildcard patterns', t => {
	const patterns: GitignorePattern[] = [{pattern: '*.log', negated: false}];

	t.true(shouldIgnoreFile('debug.log', patterns));
	t.true(shouldIgnoreFile('error.log', patterns));
	t.false(shouldIgnoreFile('debug.txt', patterns));
});

test('shouldIgnoreFile ignores directory patterns', t => {
	const patterns: GitignorePattern[] = [
		{pattern: 'node_modules/', negated: false},
	];

	t.true(shouldIgnoreFile('node_modules/package/index.js', patterns));
	t.true(shouldIgnoreFile('node_modules/other/file.txt', patterns));
	t.false(shouldIgnoreFile('src/index.js', patterns));
});

test('shouldIgnoreFile ignores globstar patterns', t => {
	const patterns: GitignorePattern[] = [{pattern: 'dist/**', negated: false}];

	t.true(shouldIgnoreFile('dist/js/app.js', patterns));
	t.true(shouldIgnoreFile('dist/css/styles.css', patterns));
	t.false(shouldIgnoreFile('src/app.js', patterns));
});

test('shouldIgnoreFile handles nested directory patterns', t => {
	const patterns: GitignorePattern[] = [
		{pattern: 'src/**/temp', negated: false},
	];

	t.true(shouldIgnoreFile('src/components/temp/file.js', patterns));
	t.true(shouldIgnoreFile('src/utils/temp/helper.js', patterns));
	t.false(shouldIgnoreFile('src/components/file.js', patterns));
});

test('shouldIgnoreFile handles negation patterns', t => {
	const patterns: GitignorePattern[] = [
		{pattern: '*.log', negated: false},
		{pattern: 'important.log', negated: true},
	];

	t.true(shouldIgnoreFile('debug.log', patterns));
	t.true(shouldIgnoreFile('error.log', patterns));
	t.false(shouldIgnoreFile('important.log', patterns)); // Negated pattern
});

test('shouldIgnoreFile processes patterns in order', t => {
	const patterns: GitignorePattern[] = [
		{pattern: 'temp/', negated: false},
		{pattern: 'temp/keep/', negated: true},
		{pattern: 'temp/keep/secret.txt', negated: false},
	];

	t.true(shouldIgnoreFile('temp/file.txt', patterns));
	t.false(shouldIgnoreFile('temp/keep/file.txt', patterns));
	t.true(shouldIgnoreFile('temp/keep/secret.txt', patterns));
});

test('shouldIgnoreFile handles complex patterns', t => {
	const patterns: GitignorePattern[] = [
		{pattern: 'build/', negated: false},
		{pattern: '*.tmp', negated: false},
		{pattern: 'src/**/*.test.js', negated: false},
		{pattern: 'src/important.test.js', negated: true},
	];

	t.true(shouldIgnoreFile('build/app.js', patterns));
	t.true(shouldIgnoreFile('cache.tmp', patterns));
	t.true(shouldIgnoreFile('src/utils/helper.test.js', patterns));
	t.false(shouldIgnoreFile('src/important.test.js', patterns));
	t.false(shouldIgnoreFile('src/app.js', patterns));
});

test('shouldIgnoreFile handles empty patterns array', t => {
	const patterns: GitignorePattern[] = [];

	t.false(shouldIgnoreFile('any-file.txt', patterns));
	t.false(shouldIgnoreFile('node_modules/package.json', patterns));
});

test('shouldIgnoreFile handles path separators consistently', t => {
	const patterns: GitignorePattern[] = [{pattern: 'src/temp/', negated: false}];

	t.true(shouldIgnoreFile('src/temp/file.txt', patterns));
	t.true(shouldIgnoreFile(String.raw`src\temp\file.txt`, patterns)); // Windows-style path
});

test('parseGitignore parses basic gitignore content', async t => {
	const temporaryDir = await createTemporaryDir();

	try {
		await createGitRepo(temporaryDir);
		await createGitignoreFile(temporaryDir, 'node_modules\n*.log\ndist/\n');

		const patterns = await parseGitignore(temporaryDir);

		t.is(patterns.length, 3);
		t.deepEqual(patterns[0], {pattern: 'node_modules', negated: false});
		t.deepEqual(patterns[1], {pattern: '*.log', negated: false});
		t.deepEqual(patterns[2], {pattern: 'dist/', negated: false});
	} finally {
		await cleanup(temporaryDir);
	}
});

test('parseGitignore skips comments and empty lines', async t => {
	const temporaryDir = await createTemporaryDir();

	try {
		await createGitRepo(temporaryDir);
		await createGitignoreFile(
			temporaryDir,
			'# This is a comment\n\nnode_modules\n# Another comment\n*.log\n\n',
		);

		const patterns = await parseGitignore(temporaryDir);

		t.is(patterns.length, 2);
		t.deepEqual(patterns[0], {pattern: 'node_modules', negated: false});
		t.deepEqual(patterns[1], {pattern: '*.log', negated: false});
	} finally {
		await cleanup(temporaryDir);
	}
});

test('parseGitignore handles negation patterns', async t => {
	const temporaryDir = await createTemporaryDir();

	try {
		await createGitRepo(temporaryDir);
		await createGitignoreFile(
			temporaryDir,
			'*.log\n!important.log\ntemp/\n!temp/keep/\n',
		);

		const patterns = await parseGitignore(temporaryDir);

		t.is(patterns.length, 4);
		t.deepEqual(patterns[0], {pattern: '*.log', negated: false});
		t.deepEqual(patterns[1], {pattern: 'important.log', negated: true});
		t.deepEqual(patterns[2], {pattern: 'temp/', negated: false});
		t.deepEqual(patterns[3], {pattern: 'temp/keep/', negated: true});
	} finally {
		await cleanup(temporaryDir);
	}
});

test('parseGitignore handles whitespace correctly', async t => {
	const temporaryDir = await createTemporaryDir();

	try {
		await createGitRepo(temporaryDir);
		await createGitignoreFile(
			temporaryDir,
			'  node_modules  \n\t*.log\t\n  # comment with spaces  \n\ndist/\n',
		);

		const patterns = await parseGitignore(temporaryDir);

		t.is(patterns.length, 3);
		t.deepEqual(patterns[0], {pattern: 'node_modules', negated: false});
		t.deepEqual(patterns[1], {pattern: '*.log', negated: false});
		t.deepEqual(patterns[2], {pattern: 'dist/', negated: false});
	} finally {
		await cleanup(temporaryDir);
	}
});

test('parseGitignore returns empty array when no .gitignore exists', async t => {
	const temporaryDir = await createTemporaryDir();

	try {
		await createGitRepo(temporaryDir);
		// No .gitignore file created

		const patterns = await parseGitignore(temporaryDir);

		t.is(patterns.length, 0);
	} finally {
		await cleanup(temporaryDir);
	}
});

test('parseGitignore returns empty array when not in git repo', async t => {
	const temporaryDir = await createTemporaryDir();

	try {
		// No .git directory created
		await createGitignoreFile(temporaryDir, 'node_modules\n*.log\n');

		const patterns = await parseGitignore(temporaryDir);

		t.is(patterns.length, 0);
	} finally {
		await cleanup(temporaryDir);
	}
});

test('parseGitignore finds .gitignore in parent directories', async t => {
	const temporaryDir = await createTemporaryDir();

	try {
		await createGitRepo(temporaryDir);
		await createGitignoreFile(temporaryDir, 'node_modules\n*.log\n');

		// Create a subdirectory
		const subDir = path.join(temporaryDir, 'src', 'components');
		await fs.mkdir(subDir, {recursive: true});

		const patterns = await parseGitignore(subDir);

		t.is(patterns.length, 2);
		t.deepEqual(patterns[0], {pattern: 'node_modules', negated: false});
		t.deepEqual(patterns[1], {pattern: '*.log', negated: false});
	} finally {
		await cleanup(temporaryDir);
	}
});

// Integration tests
test('integration full gitignore parsing and file matching', async t => {
	const temporaryDir = await createTemporaryDir();

	try {
		await createGitRepo(temporaryDir);

		// Create comprehensive .gitignore
		const gitignoreContent = `
# Dependencies
node_modules/
*.log

# Build output
dist/
build/

# Temporary files
*.tmp
*.temp

# Keep important files
!important.log
!dist/assets/critical.css

# Nested patterns
src/**/temp/
**/cache/

# OS files
.DS_Store
Thumbs.db
`;

		await createGitignoreFile(temporaryDir, gitignoreContent);

		const patterns = await parseGitignore(temporaryDir);

		// Test various file paths
		const testCases = [
			{path: 'node_modules/package/index.js', expected: true},
			{path: 'debug.log', expected: true},
			{path: 'important.log', expected: false}, // Negated
			{path: 'dist/js/app.js', expected: true},
			{path: 'dist/assets/critical.css', expected: false}, // Negated
			{path: 'src/components/temp/file.js', expected: true},
			{path: 'cache/data.json', expected: true},
			{path: 'src/cache/file.js', expected: true},
			{path: '.DS_Store', expected: true},
			{path: 'src/app.js', expected: false}, // Not ignored
			{path: 'README.md', expected: false}, // Not ignored
		];

		for (const {path: filePath, expected} of testCases) {
			const result = shouldIgnoreFile(filePath, patterns);
			t.is(
				result,
				expected,
				`File "${filePath}" should ${expected ? 'be ignored' : 'not be ignored'}`,
			);
		}
	} finally {
		await cleanup(temporaryDir);
	}
});

test('integration parseGitignore with complex subdirectory structure', async t => {
	const temporaryDir = await createTemporaryDir();

	try {
		await createGitRepo(temporaryDir);
		await createGitignoreFile(temporaryDir, 'node_modules\n*.log\ndist/\n');

		// Create complex directory structure
		const deepDir = path.join(
			temporaryDir,
			'src',
			'components',
			'ui',
			'buttons',
		);
		await fs.mkdir(deepDir, {recursive: true});

		const patterns = await parseGitignore(deepDir);

		t.is(patterns.length, 3);
		t.deepEqual(patterns[0], {pattern: 'node_modules', negated: false});
		t.deepEqual(patterns[1], {pattern: '*.log', negated: false});
		t.deepEqual(patterns[2], {pattern: 'dist/', negated: false});

		// Test that gitignore patterns work from subdirectory
		t.true(shouldIgnoreFile('node_modules/package.json', patterns));
		t.true(shouldIgnoreFile('debug.log', patterns));
		t.true(shouldIgnoreFile('dist/app.js', patterns));
		t.false(shouldIgnoreFile('src/app.js', patterns));
	} finally {
		await cleanup(temporaryDir);
	}
});
