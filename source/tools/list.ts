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

type LsToolArgs = {
	path: string;
	ignore?: string[];
};

class LsToolServer {
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

	async run() {
		const transport = new StdioServerTransport();
		await this.server.connect(transport);
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

			return this.handleLs(request.params.arguments as LsToolArgs);
		});
	}

	private async handleLs(args: LsToolArgs) {
		try {
			this.validateArguments(args);
			const {path: targetPath, ignore = []} = args;
			this.validatePath(targetPath);
			this.validateIgnorePatterns(ignore);

			const entries = this.readDirectory(targetPath);
			const results = this.processEntries(entries, targetPath, ignore);

			return this.formatResults(results, targetPath);
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

	private validateArguments(args: LsToolArgs) {
		if (!args || typeof args !== 'object') {
			throw new Error('Invalid arguments: expected an object');
		}
	}

	private validatePath(targetPath: string) {
		if (!targetPath || typeof targetPath !== 'string') {
			throw new Error('Invalid path: must be a non-empty string');
		}

		if (!path.isAbsolute(targetPath)) {
			throw new Error('Invalid path: must be an absolute path, not relative');
		}

		if (!fs.existsSync(targetPath)) {
			throw new Error(`Path does not exist: ${targetPath}`);
		}

		const stats = fs.statSync(targetPath);
		if (!stats.isDirectory()) {
			throw new Error(`Path is not a directory: ${targetPath}`);
		}
	}

	private validateIgnorePatterns(ignore: string[]) {
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
	}

	private readDirectory(targetPath: string) {
		return fs.readdirSync(targetPath, {withFileTypes: true});
	}

	private processEntries(
		entries: fs.Dirent[],
		targetPath: string,
		ignore: string[],
	) {
		const results = [];

		for (const entry of entries) {
			const entryPath = path.join(targetPath, entry.name);

			if (this.shouldIgnoreEntry(entry.name, entryPath, ignore)) {
				continue;
			}

			const entryInfo = this.getEntryInfo(entry, entryPath);
			results.push(entryInfo);
		}

		// Sort results: directories first, then files, both alphabetically
		results.sort((a, b) => {
			if (a.type === 'directory' && b.type !== 'directory') return -1;
			if (a.type !== 'directory' && b.type === 'directory') return 1;
			return a.name.localeCompare(b.name);
		});

		return results;
	}

	private shouldIgnoreEntry(
		relativePath: string,
		entryPath: string,
		ignore: string[],
	): boolean {
		for (const pattern of ignore) {
			if (minimatch(relativePath, pattern) || minimatch(entryPath, pattern)) {
				return true;
			}
		}

		return false;
	}

	private getEntryInfo(entry: fs.Dirent, entryPath: string) {
		const entryStats = fs.statSync(entryPath);

		return {
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
			// eslint-disable-next-line no-bitwise
			permissions: '0' + (entryStats.mode & 0o777).toString(8),
		};
	}

	private formatResults(
		results: Array<{
			name: string;
			type: string;
			size: number;
			modified: string;
			permissions: string;
		}>,
		targetPath: string,
	) {
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
	}
}

const server = new LsToolServer();
void server.run();
