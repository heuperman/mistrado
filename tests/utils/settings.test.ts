import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import test, {type ExecutionContext} from 'ava';
import {getCurrentModel, updateSettings} from '../../source/utils/settings.js';
import {defaultModel} from '../../source/defaults.js';

type TestContext = ExecutionContext<{
	mockCwd: string;
}>;

// Mock process.cwd() for consistent test environment
const originalCwd = process.cwd;

test.beforeEach(t => {
	// Create unique temporary directory for each test
	const uniqueDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mistral-test-'));
	(t as TestContext).context.mockCwd = uniqueDir;

	// Mock process.cwd to return this test's unique directory
	process.cwd = () => uniqueDir;

	// Ensure the mock directory exists (mkdtempSync already creates it, but being explicit)
	fs.mkdirSync(uniqueDir, {recursive: true});
});

test.afterEach(t => {
	process.cwd = originalCwd;

	// Clean up this test's unique directory
	try {
		if (
			(t as TestContext).context.mockCwd &&
			fs.existsSync((t as TestContext).context.mockCwd)
		) {
			fs.rmSync((t as TestContext).context.mockCwd, {
				recursive: true,
				force: true,
			});
		}
	} catch {
		// Ignore cleanup errors
	}
});

test('getCurrentModel returns default model when settings file does not exist', t => {
	const result = getCurrentModel();
	t.is(result, defaultModel);
});

test('getCurrentModel returns default model when settings directory does not exist', t => {
	// Ensure directory doesn't exist
	const settingsDir = path.join(
		(t as TestContext).context.mockCwd,
		'.mistrado',
	);
	if (fs.existsSync(settingsDir)) {
		fs.rmSync(settingsDir, {recursive: true});
	}

	const result = getCurrentModel(settingsDir);
	t.is(result, defaultModel);
});

test('getCurrentModel returns model from valid settings file', t => {
	const settingsDir = path.join(
		(t as TestContext).context.mockCwd,
		'.mistrado',
	);
	const settingsPath = path.join(settingsDir, 'settings.json');

	// Create directory and settings file
	fs.mkdirSync(settingsDir, {recursive: true});
	fs.writeFileSync(settingsPath, JSON.stringify({model: 'custom-model-name'}));

	const result = getCurrentModel(settingsDir);
	t.is(result, 'custom-model-name');
});

test('getCurrentModel returns default model when settings file contains invalid JSON', t => {
	const settingsDir = path.join(
		(t as TestContext).context.mockCwd,
		'.mistrado',
	);
	const settingsPath = path.join(settingsDir, 'settings.json');

	// Create directory and invalid settings file
	fs.mkdirSync(settingsDir, {recursive: true});
	fs.writeFileSync(settingsPath, 'invalid json content');

	const result = getCurrentModel(settingsDir);
	t.is(result, defaultModel);
});

test('getCurrentModel returns default model when settings file is empty', t => {
	const settingsDir = path.join(
		(t as TestContext).context.mockCwd,
		'.mistrado',
	);
	const settingsPath = path.join(settingsDir, 'settings.json');

	// Create directory and empty settings file
	fs.mkdirSync(settingsDir, {recursive: true});
	fs.writeFileSync(settingsPath, '');

	const result = getCurrentModel(settingsDir);
	t.is(result, defaultModel);
});

test('getCurrentModel returns default model when settings file has no model property', t => {
	const settingsDir = path.join(
		(t as TestContext).context.mockCwd,
		'.mistrado',
	);
	const settingsPath = path.join(settingsDir, 'settings.json');

	// Create directory and settings file without model property
	fs.mkdirSync(settingsDir, {recursive: true});
	fs.writeFileSync(settingsPath, JSON.stringify({otherProperty: 'value'}));

	const result = getCurrentModel(settingsDir);
	// Should return default when model property is missing
	t.is(result, defaultModel);
});

test('updateSettings creates new settings file when none exists', async t => {
	const settingsDir = path.join(
		(t as TestContext).context.mockCwd,
		'.mistrado',
	);
	const settingsPath = path.join(settingsDir, 'settings.json');

	// Ensure directory doesn't exist initially
	if (fs.existsSync(settingsDir)) {
		fs.rmSync(settingsDir, {recursive: true});
	}

	await updateSettings({model: 'new-model'}, settingsDir);

	// Verify directory was created
	t.true(fs.existsSync(settingsDir));

	// Verify file was created with correct content
	t.true(fs.existsSync(settingsPath));
	const content = fs.readFileSync(settingsPath, 'utf8');
	const settings = JSON.parse(content) as {model: string};
	t.is(settings.model, 'new-model');
});

test('updateSettings updates existing settings file', async t => {
	const settingsDir = path.join(
		(t as TestContext).context.mockCwd,
		'.mistrado',
	);
	const settingsPath = path.join(settingsDir, 'settings.json');

	// Create initial settings file
	fs.mkdirSync(settingsDir, {recursive: true});
	fs.writeFileSync(settingsPath, JSON.stringify({model: 'old-model'}));

	await updateSettings({model: 'updated-model'}, settingsDir);

	// Verify file was updated
	const content = fs.readFileSync(settingsPath, 'utf8');
	const settings = JSON.parse(content) as {model: string};
	t.is(settings.model, 'updated-model');
});

test('updateSettings merges with existing settings', async t => {
	const settingsDir = path.join(
		(t as TestContext).context.mockCwd,
		'.mistrado',
	);
	const settingsPath = path.join(settingsDir, 'settings.json');

	// Create initial settings file with additional properties
	fs.mkdirSync(settingsDir, {recursive: true});
	const initialSettings = {model: 'old-model', customProperty: 'preserved'};
	fs.writeFileSync(settingsPath, JSON.stringify(initialSettings));

	await updateSettings({model: 'new-model'}, settingsDir);

	// Verify settings were merged correctly
	const content = fs.readFileSync(settingsPath, 'utf8');
	const settings = JSON.parse(content) as {
		model: string;
		customProperty: string;
	};
	t.is(settings.model, 'new-model');
	t.is(settings.customProperty, 'preserved');
});

test('updateSettings handles partial updates', async t => {
	const settingsDir = path.join(
		(t as TestContext).context.mockCwd,
		'.mistrado',
	);
	const settingsPath = path.join(settingsDir, 'settings.json');

	// Create initial settings file
	fs.mkdirSync(settingsDir, {recursive: true});
	fs.writeFileSync(settingsPath, JSON.stringify({model: 'existing-model'}));

	// Update with empty object (should preserve existing)
	await updateSettings({}, settingsDir);

	const content = fs.readFileSync(settingsPath, 'utf8');
	const settings = JSON.parse(content) as {model: string};
	t.is(settings.model, 'existing-model');
});

test('updateSettings creates default settings when existing file has invalid JSON', async t => {
	const settingsDir = path.join(
		(t as TestContext).context.mockCwd,
		'.mistrado',
	);
	const settingsPath = path.join(settingsDir, 'settings.json');

	// Create directory with invalid settings file
	fs.mkdirSync(settingsDir, {recursive: true});
	fs.writeFileSync(settingsPath, 'invalid json');

	await updateSettings({model: 'recovery-model'}, settingsDir);

	// Should create new valid settings file
	const content = fs.readFileSync(settingsPath, 'utf8');
	const settings = JSON.parse(content) as {model: string};
	t.is(settings.model, 'recovery-model');
});

test('updateSettings formats JSON with proper indentation', async t => {
	const settingsDir = path.join(
		(t as TestContext).context.mockCwd,
		'.mistrado',
	);
	const settingsPath = path.join(settingsDir, 'settings.json');

	await updateSettings({model: 'formatted-model'}, settingsDir);

	const content = fs.readFileSync(settingsPath, 'utf8');

	// Should be formatted with 2-space indentation
	const expectedContent = JSON.stringify({model: 'formatted-model'}, null, 2);
	t.is(content, expectedContent);
});

test('updateSettings handles multiple property updates', async t => {
	const settingsDir = path.join(
		(t as TestContext).context.mockCwd,
		'.mistrado',
	);
	const settingsPath = path.join(settingsDir, 'settings.json');

	// Create initial settings
	fs.mkdirSync(settingsDir, {recursive: true});
	fs.writeFileSync(
		settingsPath,
		JSON.stringify({model: 'old-model', prop1: 'value1'}),
	);

	// Update multiple properties
	await updateSettings({model: 'new-model'}, settingsDir);

	const content = fs.readFileSync(settingsPath, 'utf8');
	const settings = JSON.parse(content) as {model: string; prop1: string};
	t.is(settings.model, 'new-model');
	t.is(settings.prop1, 'value1');
});
