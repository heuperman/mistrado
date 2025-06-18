#!/usr/bin/env node

import * as fs from 'node:fs';
import * as path from 'node:path';
import {Server} from '@modelcontextprotocol/sdk/server/index.js';
import {StdioServerTransport} from '@modelcontextprotocol/sdk/server/stdio.js';
import {
	CallToolRequestSchema,
	ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import {minimatch} from 'minimatch';

class LSToolServer {
	private readonly server: Server;

	constructor() {
		this.server = new Server(
			{
				name: 'ls-tool-server',
				version: '0.1.0',
			},
			{
				capabilities: {
					tools: {},
				},
			},
		);

		this.setupToolHandlers();
	}

	private setupToolHandlers() {
		this.server.setRequestHandler(ListToolsRequestSchema, async () => {
			return {
				tools: [
					{
						name: 'LS',
						description:
							'Lists files and directories in a given path. The path parameter must be an absolute path, not a relative path. You can optionally provide an array of glob patterns to ignore with the ignore parameter. You should generally prefer the Glob and Grep tools, if you know which directories to search.',
						inputSchema: {
							type: 'object',
							properties: {
								path: {
									type: 'string',
									description:
										'The absolute path to the directory to list (must be absolute, not relative)',
								},
								ignore: {
									type: 'array',
									items: {
										type: 'string',
									},
									description: 'List of glob patterns to ignore',
								},
							},
							required: ['path'],
							additionalProperties: false,
							$schema: 'http://json-schema.org/draft-07/schema#',
						},
					},
				],
			};
		});

		this.server.setRequestHandler(CallToolRequestSchema, async request => {
			if (request.params.name !== 'LS') {
				throw new Error(`Unknown tool: ${request.params.name}`);
			}

			return this.handleLS(request.params.arguments);
		});
	}

	private async handleLS(args: any) {
		try {
			// Validate arguments
			if (!args || typeof args !== 'object') {
				throw new Error('Invalid arguments: expected an object');
			}

			const {path: targetPath, ignore = []} = args;

			// Validate path
			if (!targetPath || typeof targetPath !== 'string') {
				throw new Error('Invalid path: must be a non-empty string');
			}

			if (!path.isAbsolute(targetPath)) {
				throw new Error('Invalid path: must be an absolute path, not relative');
			}

			// Validate ignore patterns
			if (!Array.isArray(ignore)) {
				throw new TypeError('Invalid ignore parameter: must be an array');
			}

			for (const pattern of ignore) {
				if (typeof pattern !== 'string') {
					throw new TypeError(
						'Invalid ignore pattern: all patterns must be strings',
					);
				}
			}

			// Check if path exists
			if (!fs.existsSync(targetPath)) {
				throw new Error(`Path does not exist: ${targetPath}`);
			}

			// Check if path is a directory
			const stats = fs.statSync(targetPath);
			if (!stats.isDirectory()) {
				throw new Error(`Path is not a directory: ${targetPath}`);
			}

			// Read directory contents
			const entries = fs.readdirSync(targetPath, {withFileTypes: true});

			// Process entries and apply ignore patterns
			const results = [];

			for (const entry of entries) {
				const entryPath = path.join(targetPath, entry.name);
				const relativePath = entry.name;

				// Check if entry should be ignored
				let shouldIgnore = false;
				for (const pattern of ignore) {
					if (
						minimatch(relativePath, pattern) ||
						minimatch(entryPath, pattern)
					) {
						shouldIgnore = true;
						break;
					}
				}

				if (shouldIgnore) {
					continue;
				}

				// Get entry type and additional info
				const entryStats = fs.statSync(entryPath);
				const entryInfo = {
					name: entry.name,
					path: entryPath,
					type: entry.isDirectory()
						? 'directory'
						: entry.isFile()
							? 'file'
							: entry.isSymbolicLink()
								? 'symlink'
								: 'other',
					size: entryStats.size,
					modified: entryStats.mtime.toISOString(),
					permissions: '0' + (entryStats.mode & 0o777).toString(8),
				};

				results.push(entryInfo);
			}

			// Sort results: directories first, then files, both alphabetically
			results.sort((a, b) => {
				if (a.type === 'directory' && b.type !== 'directory') return -1;
				if (a.type !== 'directory' && b.type === 'directory') return 1;
				return a.name.localeCompare(b.name);
			});

			const summary = `Listed ${results.length} items in ${targetPath}`;
			const content =
				results.length > 0
					? results
							.map(
								item =>
									`${item.type.padEnd(9)} ${item.name.padEnd(30)} ${item.size.toString().padStart(10)} bytes  ${item.modified}  ${item.permissions}`,
							)
							.join('\n')
					: 'Directory is empty';

			return {
				content: [
					{
						type: 'text',
						text: `${summary}\n\n${'Type'.padEnd(9)} ${'Name'.padEnd(30)} ${'Size'.padStart(10)}        ${'Modified'.padEnd(24)} Perms\n${'-'.repeat(80)}\n${content}`,
					},
				],
			};
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : 'Unknown error occurred';
			return {
				content: [
					{
						type: 'text',
						text: `Error: ${errorMessage}`,
					},
				],
				isError: true,
			};
		}
	}

	async run() {
		const transport = new StdioServerTransport();
		await this.server.connect(transport);
	}
}

const server = new LSToolServer();
server.run().catch(() => {
	process.exit(1);
});
