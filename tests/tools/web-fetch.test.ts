import test from 'ava';
import {handleWebFetchTool} from '../../source/tools/web-fetch.js';

test('webFetch validates URL parameter', async t => {
	const result = await handleWebFetchTool({});

	t.true(result.isError);
	t.true(result.content[0].text.includes('url'));
});

test('webFetch rejects invalid URLs', async t => {
	const result = await handleWebFetchTool({url: 'not-a-url'});

	t.true(result.isError);
	t.true(result.content[0].text.includes('Invalid URL'));
});

test('webFetch rejects non-HTTP protocols', async t => {
	const result = await handleWebFetchTool({url: 'file:///etc/passwd'});

	t.true(result.isError);
	t.true(result.content[0].text.includes('Unsupported protocol'));
});

test('webFetch rejects ftp protocol', async t => {
	const result = await handleWebFetchTool({url: 'ftp://example.com/file.txt'});

	t.true(result.isError);
	t.true(result.content[0].text.includes('Unsupported protocol'));
});

test('webFetch accepts valid HTTP URL format', async t => {
	// Use a non-existent domain to avoid actual network calls in tests
	const result = await handleWebFetchTool({
		url: 'http://thisdomaindoesnotexist12345.com',
	});

	// Should fail due to network error, not validation error
	t.true(result.isError);
	t.false(result.content[0].text.includes('Invalid URL'));
	t.false(result.content[0].text.includes('Unsupported protocol'));
});

test('webFetch accepts valid HTTPS URL format', async t => {
	// Use a non-existent domain to avoid actual network calls in tests
	const result = await handleWebFetchTool({
		url: 'https://thisdomaindoesnotexist12345.com',
	});

	// Should fail due to network error, not validation error
	t.true(result.isError);
	t.false(result.content[0].text.includes('Invalid URL'));
	t.false(result.content[0].text.includes('Unsupported protocol'));
});

test('webFetch handles timeout parameter', async t => {
	const result = await handleWebFetchTool({
		url: 'https://thisdomaindoesnotexist12345.com',
		timeout: 1000,
	});

	// Should fail due to network error, not validation error
	t.true(result.isError);
	t.false(result.content[0].text.includes('Invalid URL'));
});

test('webFetch validates timeout parameter type', async t => {
	const result = await handleWebFetchTool({
		url: 'https://example.com',
		timeout: 'invalid',
	});

	t.true(result.isError);
	t.true(result.content[0].text.includes('timeout'));
});
