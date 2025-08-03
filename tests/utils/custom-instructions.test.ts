import {tmpdir} from 'node:os';
import {writeFileSync, unlinkSync, mkdirSync, rmSync} from 'node:fs';
import {join} from 'node:path';
import test from 'ava';
import {loadCustomInstruction} from '../../source/utils/custom-instructions.js';

test('loadCustomInstruction returns undefined when AGENTS.md does not exist', t => {
	const temporaryDir = join(tmpdir(), `test-${Date.now()}-${Math.random()}`);
	mkdirSync(temporaryDir, {recursive: true});

	try {
		const result = loadCustomInstruction(temporaryDir);
		t.is(result, undefined);
	} finally {
		rmSync(temporaryDir, {recursive: true, force: true});
	}
});

test('loadCustomInstruction returns content when AGENTS.md exists', t => {
	const temporaryDir = join(tmpdir(), `test-${Date.now()}-${Math.random()}`);
	mkdirSync(temporaryDir, {recursive: true});
	const agentsPath = join(temporaryDir, 'AGENTS.md');
	const content = '# Custom Instructions\n\nBe extra helpful!';

	try {
		writeFileSync(agentsPath, content);
		const result = loadCustomInstruction(temporaryDir);
		t.is(result, content);
	} finally {
		rmSync(temporaryDir, {recursive: true, force: true});
	}
});

test('loadCustomInstruction returns undefined for empty AGENTS.md', t => {
	const temporaryDir = join(tmpdir(), `test-${Date.now()}-${Math.random()}`);
	mkdirSync(temporaryDir, {recursive: true});
	const agentsPath = join(temporaryDir, 'AGENTS.md');

	try {
		writeFileSync(agentsPath, '');
		const result = loadCustomInstruction(temporaryDir);
		t.is(result, undefined);
	} finally {
		rmSync(temporaryDir, {recursive: true, force: true});
	}
});

test('loadCustomInstruction returns undefined for whitespace-only AGENTS.md', t => {
	const temporaryDir = join(tmpdir(), `test-${Date.now()}-${Math.random()}`);
	mkdirSync(temporaryDir, {recursive: true});
	const agentsPath = join(temporaryDir, 'AGENTS.md');

	try {
		writeFileSync(agentsPath, '   \n\t  \n  ');
		const result = loadCustomInstruction(temporaryDir);
		t.is(result, undefined);
	} finally {
		rmSync(temporaryDir, {recursive: true, force: true});
	}
});

test('loadCustomInstruction trims whitespace from content', t => {
	const temporaryDir = join(tmpdir(), `test-${Date.now()}-${Math.random()}`);
	mkdirSync(temporaryDir, {recursive: true});
	const agentsPath = join(temporaryDir, 'AGENTS.md');
	const content = '  \n# Custom Instructions\n\nBe extra helpful!\n  ';

	try {
		writeFileSync(agentsPath, content);
		const result = loadCustomInstruction(temporaryDir);
		t.is(result, '# Custom Instructions\n\nBe extra helpful!');
	} finally {
		rmSync(temporaryDir, {recursive: true, force: true});
	}
});

test('loadCustomInstruction returns undefined when file read fails', t => {
	// Test with a directory that doesn't exist or can't be accessed
	const result = loadCustomInstruction('/nonexistent/directory/path');
	t.is(result, undefined);
});
