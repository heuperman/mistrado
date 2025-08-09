import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import test from 'ava';
import {handleLsTool} from '../../source/tools/list.js';

// Test helper to create temporary directories
async function createTemporaryDir(): Promise<string> {
	return fs.mkdtemp(path.join(os.tmpdir(), 'list-test-'));
}

async function cleanup(dirPath: string): Promise<void> {
	try {
		await fs.rm(dirPath, {recursive: true, force: true});
	} catch {
		// Ignore cleanup errors
	}
}

test('handleLsTool lists directory contents successfully', async t => {
	const temporaryDir = await createTemporaryDir();

	try {
		// Create test files and directories
		await fs.writeFile(path.join(temporaryDir, 'file1.txt'), 'content1');
		await fs.writeFile(path.join(temporaryDir, 'file2.txt'), 'content2');
		await fs.mkdir(path.join(temporaryDir, 'subdir'));
		await fs.writeFile(
			path.join(temporaryDir, 'subdir', 'file3.txt'),
			'content3',
		);

		const result = await handleLsTool({
			path: temporaryDir,
		});

		t.false(result.isError);
		const output = result.content[0].text;
		t.true(output.includes(`Listed 3 items in ${temporaryDir}`));
		t.true(output.includes('directory subdir'));
		t.true(output.includes('file      file1.txt'));
		t.true(output.includes('file      file2.txt'));
	} finally {
		await cleanup(temporaryDir);
	}
});

test('handleLsTool ignores patterns correctly', async t => {
	const temporaryDir = await createTemporaryDir();

	try {
		// Create test files
		await fs.writeFile(path.join(temporaryDir, 'file1.txt'), 'content1');
		await fs.writeFile(path.join(temporaryDir, 'file2.txt'), 'content2');
		await fs.writeFile(path.join(temporaryDir, 'temp.txt'), 'temp content');

		const result = await handleLsTool({
			path: temporaryDir,
			ignore: ['*temp*'],
		});

		t.false(result.isError);
		const output = result.content[0].text;

		t.true(output.includes(`Listed 2 items in ${temporaryDir}`));
		t.true(output.includes('file      file1.txt'));
		t.true(output.includes('file      file2.txt'));
		t.false(output.includes('temp.txt'));
	} finally {
		await cleanup(temporaryDir);
	}
});

test('handleLsTool handles empty directory', async t => {
	const temporaryDir = await createTemporaryDir();

	try {
		const result = await handleLsTool({
			path: temporaryDir,
		});

		t.false(result.isError);
		const output = result.content[0].text;
		t.true(output.includes('Listed 0 items in'));
		t.true(output.includes('Directory is empty'));
	} finally {
		await cleanup(temporaryDir);
	}
});

test('handleLsTool validates absolute path requirement', async t => {
	const result = await handleLsTool({
		path: 'relative/path',
	});

	t.true(result.isError);
	t.true(
		result.content[0].text.includes(
			'Invalid path: must be an absolute path, not relative',
		),
	);
});

test('handleLsTool validates directory existence', async t => {
	const result = await handleLsTool({
		path: '/non/existent/path',
	});

	t.true(result.isError);
	t.true(result.content[0].text.includes('Path does not exist'));
});

test('handleLsTool validates path is a directory', async t => {
	const temporaryDir = await createTemporaryDir();

	try {
		const filePath = path.join(temporaryDir, 'file.txt');
		await fs.writeFile(filePath, 'content1');

		const result = await handleLsTool({path: filePath});

		t.true(result.isError);
		t.true(result.content[0].text.includes('Path is not a directory'));
	} finally {
		await cleanup(temporaryDir);
	}
});

test('handleLsTool sorts results correctly', async t => {
	const temporaryDir = await createTemporaryDir();

	try {
		// Create files and directories in specific order
		await fs.writeFile(path.join(temporaryDir, 'z_file.txt'), 'content');
		await fs.writeFile(path.join(temporaryDir, 'a_file.txt'), 'content');
		await fs.mkdir(path.join(temporaryDir, 'b_dir'));
		await fs.mkdir(path.join(temporaryDir, 'A_Dir'));

		const result = await handleLsTool({
			path: temporaryDir,
		});

		t.false(result.isError);
		const output = result.content[0].text;

		// Check that directories come first, then files, both sorted alphabetically
		const lines = output.split('\n');
		const directoryLines = lines.filter(line => line.includes('directory'));
		const fileLines = lines.filter(line => line.includes('file'));

		t.true(directoryLines[0].includes('A_Dir')); // First directory
		t.true(directoryLines[1].includes('b_dir')); // Second directory
		t.true(fileLines[0].includes('a_file.txt')); // First file
		t.true(fileLines[1].includes('z_file.txt')); // Second file
	} finally {
		await cleanup(temporaryDir);
	}
});

test('handleLsTool handles symlinks', async t => {
	const temporaryDir = await createTemporaryDir();

	try {
		// Create a symlink
		const targetFile = path.join(temporaryDir, 'target.txt');
		await fs.writeFile(targetFile, 'target content');
		const symlinkPath = path.join(temporaryDir, 'symlink.txt');
		await fs.symlink(targetFile, symlinkPath);

		const result = await handleLsTool({
			path: temporaryDir,
		});

		t.false(result.isError);
		const output = result.content[0].text;
		t.true(output.includes('symlink   symlink.txt'));
		t.true(output.includes('file      target.txt'));
	} finally {
		await cleanup(temporaryDir);
	}
});

test('handleLsTool validates schema correctly', async t => {
	// Missing path
	const result = await handleLsTool({});
	t.true(result.isError);
	t.true(result.content[0].text.includes("missing required property 'path'"));

	// Invalid path type
	const result2 = await handleLsTool({
		path: 123,
	} as any);
	t.true(result2.isError);
	t.true(result2.content[0].text.includes('expected string, got number'));

	// Invalid ignore type
	const result3 = await handleLsTool({
		path: '/valid/path',
		ignore: 'not an array',
	} as any);
	t.true(result3.isError);
	t.true(result3.content[0].text.includes('expected array, got string'));
});
