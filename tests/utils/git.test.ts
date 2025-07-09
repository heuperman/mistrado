import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import test from 'ava';
import {findGitRoot} from '../../source/utils/git.js';

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

async function cleanup(dirPath: string): Promise<void> {
	try {
		await fs.rm(dirPath, {recursive: true, force: true});
	} catch {
		// Ignore cleanup errors
	}
}

test('findGitRoot finds git root in current directory', async t => {
	const temporaryDir = await createTemporaryDir();

	try {
		await createGitRepo(temporaryDir);

		const gitRoot = findGitRoot(temporaryDir);

		t.is(gitRoot, temporaryDir);
	} finally {
		await cleanup(temporaryDir);
	}
});

test('findGitRoot finds git root in parent directory', async t => {
	const temporaryDir = await createTemporaryDir();

	try {
		await createGitRepo(temporaryDir);

		const subDir = path.join(temporaryDir, 'src', 'components');
		await fs.mkdir(subDir, {recursive: true});

		const gitRoot = findGitRoot(subDir);

		t.is(gitRoot, temporaryDir);
	} finally {
		await cleanup(temporaryDir);
	}
});

test('findGitRoot returns undefined when no git repo found', async t => {
	const temporaryDir = await createTemporaryDir();

	try {
		// No .git directory created
		const gitRoot = findGitRoot(temporaryDir);

		t.is(gitRoot, undefined);
	} finally {
		await cleanup(temporaryDir);
	}
});

test('findGitRoot handles nested git repositories', async t => {
	const temporaryDir = await createTemporaryDir();

	try {
		// Create outer git repo
		await createGitRepo(temporaryDir);

		// Create inner git repo
		const innerDir = path.join(temporaryDir, 'inner');
		await fs.mkdir(innerDir, {recursive: true});
		await createGitRepo(innerDir);

		// Test from inner directory
		const gitRoot = findGitRoot(innerDir);
		t.is(gitRoot, innerDir);

		// Test from outer directory
		const outerGitRoot = findGitRoot(temporaryDir);
		t.is(outerGitRoot, temporaryDir);
	} finally {
		await cleanup(temporaryDir);
	}
});
