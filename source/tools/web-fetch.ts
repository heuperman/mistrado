import type {Tool} from '@modelcontextprotocol/sdk/types.js';
import {validateSchema} from '../utils/validation.js';

export const webFetchTool: Tool = {
	name: 'WebFetch',
	description:
		'Fetches content from a URL using HTTP GET request. Use this tool when the user explicitly asks to access a specific URL or retrieve information from a known website. Supports HTTP and HTTPS protocols only.',
	inputSchema: {
		type: 'object',
		properties: {
			url: {
				type: 'string',
				description:
					'The URL to fetch content from. Must include protocol. For example: https://example.com',
			},
			timeout: {
				type: 'number',
				description: 'Request timeout in milliseconds (default: 10000)',
				default: 10_000,
			},
		},
		required: ['url'],
		additionalProperties: false,
	},
};

export async function handleWebFetchTool(args: unknown) {
	const validation = validateSchema<{
		url: string;
		timeout?: number;
	}>(args, webFetchTool.inputSchema, 'WebFetch');

	if (!validation.success) {
		return {
			content: [
				{
					type: 'text' as const,
					text: validation.error,
				},
			],
			isError: true,
		};
	}

	try {
		const result = await fetchUrl(
			validation.data.url,
			validation.data.timeout ?? 10_000,
		);

		return {
			content: [
				{
					type: 'text' as const,
					text: result,
				},
			],
		};
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		return {
			content: [
				{
					type: 'text' as const,
					text: `Error fetching URL: ${errorMessage}`,
				},
			],
			isError: true,
		};
	}
}

async function fetchUrl(url: string, timeout: number): Promise<string> {
	// Validate URL
	let parsedUrl: URL;
	try {
		parsedUrl = new URL(url);
	} catch {
		throw new Error(`Invalid URL: ${url}`);
	}

	// Only allow HTTP and HTTPS protocols
	if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
		throw new Error(
			`Unsupported protocol: ${parsedUrl.protocol}. Only HTTP and HTTPS are allowed.`,
		);
	}

	// Create AbortController for timeout
	const controller = new AbortController();
	const timeoutId = setTimeout(() => {
		controller.abort();
	}, timeout);

	try {
		const response = await fetch(url, {
			method: 'GET',
			signal: controller.signal,
			headers: {
				'User-Agent': 'Mistrado/1.0',
			},
		});

		clearTimeout(timeoutId);

		// Check if response is ok
		if (!response.ok) {
			throw new Error(`HTTP ${response.status}: ${response.statusText}`);
		}

		// Check content length
		const contentLength = response.headers.get('content-length');
		const maxSize = 1024 * 1024; // 1MB limit
		if (contentLength && Number.parseInt(contentLength, 10) > maxSize) {
			throw new Error(
				`Content too large: ${contentLength} bytes (max: ${maxSize})`,
			);
		}

		// Get response body with size check
		const text = await response.text();
		if (text.length > maxSize) {
			throw new Error(
				`Content too large: ${text.length} bytes (max: ${maxSize})`,
			);
		}

		// Format the response
		const displayUrl = url.replace(/^https?:\/\//, '');
		const contentType = response.headers.get('content-type') ?? 'unknown';
		const size = text.length;

		let result = `[Fetched: ${displayUrl}]\n`;
		result += `Status: ${response.status} ${response.statusText}\n`;
		result += `Content-Type: ${contentType}\n`;
		result += `Size: ${size.toLocaleString()} bytes\n\n`;
		result += text;

		return result;
	} catch (error) {
		clearTimeout(timeoutId);

		if (error instanceof Error && error.name === 'AbortError') {
			throw new Error(`Request timeout after ${timeout}ms`);
		}

		throw error;
	}
}
