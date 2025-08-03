import test from 'ava';
import {formatToolCallDisplay} from '../../source/utils/app-utils.js';

test('formatToolCallDisplay handles WebFetch URLs correctly', t => {
	const result = formatToolCallDisplay('WebFetch', {
		url: 'https://api.github.com/users/octocat',
	});

	t.is(result, '**WebFetch**(api.github.com/users/octocat)');
});

test('formatToolCallDisplay handles WebFetch HTTP URLs correctly', t => {
	const result = formatToolCallDisplay('WebFetch', {
		url: 'http://example.com/api/data',
	});

	t.is(result, '**WebFetch**(example.com/api/data)');
});

test('formatToolCallDisplay handles read file paths correctly', t => {
	const result = formatToolCallDisplay('read', {
		filePath: '/absolute/path/to/file.txt',
	});

	// Should show relative path processing
	t.true(result.startsWith('**read**'));
	t.true(result.includes('file.txt'));
});

test('formatToolCallDisplay handles glob patterns correctly', t => {
	const result = formatToolCallDisplay('glob', {
		pattern: '**/*.ts',
	});

	t.is(result, '**glob**(**/*.ts)');
});

test('formatToolCallDisplay handles missing arguments', t => {
	const result = formatToolCallDisplay('WebFetch', {});

	t.is(result, '**WebFetch**');
});

test('formatToolCallDisplay handles unknown tools', t => {
	const result = formatToolCallDisplay('unknown-tool', {
		someArg: 'value',
	});

	t.is(result, '**unknown-tool**');
});

test('formatToolCallDisplay handles string arguments', t => {
	const result = formatToolCallDisplay(
		'WebFetch',
		'{"url": "https://example.com"}',
	);

	t.is(result, '**WebFetch**(example.com)');
});

test('formatToolCallDisplay handles invalid JSON string arguments', t => {
	const result = formatToolCallDisplay('WebFetch', 'invalid-json');

	t.is(result, '**WebFetch**');
});
