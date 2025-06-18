import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import {Server} from '@modelcontextprotocol/sdk/server/index.js';
import {StdioServerTransport} from '@modelcontextprotocol/sdk/server/stdio.js';
import {
	CallToolRequestSchema,
	ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

class ReadToolServer {
	private readonly server: Server;

	constructor() {
		this.server = new Server(
			{
				name: 'read-tool-server',
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

	private setupToolHandlers(): void {
		this.server.setRequestHandler(ListToolsRequestSchema, async () => {
			return {
				tools: [
					{
						name: 'read',
						description:
							"Reads a file from the local filesystem. You can access any file directly by using this tool.\nAssume this tool is able to read all files on the machine. If the User provides a path to a file assume that path is valid. It is okay to read a file that does not exist; an error will be returned.\n\nUsage:\n- The file_path parameter must be an absolute path, not a relative path\n- By default, it reads up to 2000 lines starting from the beginning of the file\n- You can optionally specify a line offset and limit (especially handy for long files), but it's recommended to read the whole file by not providing these parameters\n- Any lines longer than 2000 characters will be truncated\n- Results are returned using cat -n format, with line numbers starting at 1\n- This tool allows Mistrado to read images (eg PNG, JPG, etc). When reading an image file the contents are presented visually as Mistrado is a multimodal LLM.\n- You have the capability to call multiple tools in a single response. It is always better to speculatively read multiple files as a batch that are potentially useful. \n- You will regularly be asked to read screenshots. If the user provides a path to a screenshot ALWAYS use this tool to view the file at the path. This tool will work with all temporary file paths like /var/folders/123/abc/T/TemporaryItems/NSIRD_screencaptureui_ZfB1tD/Screenshot.png\n- If you read a file that exists but has empty contents you will receive a system reminder warning in place of file contents.",
						inputSchema: {
							type: 'object',
							properties: {
								file_path: {
									type: 'string',
									description: 'The absolute path to the file to read',
								},
								offset: {
									type: 'number',
									description:
										'The line number to start reading from. Only provide if the file is too large to read at once',
								},
								limit: {
									type: 'number',
									description:
										'The number of lines to read. Only provide if the file is too large to read at once.',
								},
							},
							required: ['file_path'],
							additionalProperties: false,
						},
					},
				],
			};
		});

		this.server.setRequestHandler(CallToolRequestSchema, async request => {
			if (request.params.name !== 'read') {
				throw new Error(`Unknown tool: ${request.params.name}`);
			}

			const {file_path, offset, limit} = request.params.arguments as {
				file_path: string;
				offset?: number;
				limit?: number;
			};

			try {
				// Validate that the path is absolute
				if (!path.isAbsolute(file_path)) {
					throw new Error('File path must be absolute');
				}

				const result = await this.readFile(file_path, offset, limit);

				return {
					content: [
						{
							type: 'text',
							text: result,
						},
					],
				};
			} catch (error) {
				const errorMessage =
					error instanceof Error ? error.message : String(error);
				return {
					content: [
						{
							type: 'text',
							text: `Error reading file: ${errorMessage}`,
						},
					],
					isError: true,
				};
			}
		});
	}

	private async readFile(
		filePath: string,
		offset?: number,
		limit?: number,
	): Promise<string> {
		try {
			// Check if file exists and get stats
			const stats = await fs.stat(filePath);

			// Handle binary files (images, etc.) - for now, just indicate they're binary
			if (this.isBinaryFile(filePath)) {
				return `[Binary file detected: ${filePath}]\nFile type: ${this.getFileType(filePath)}\nSize: ${stats.size} bytes\n\nNote: This tool can read binary files like images, but content display depends on the client's multimodal capabilities.`;
			}

			// Read the file content
			const content = await fs.readFile(filePath, 'utf8');

			// Check for empty file
			if (content.length === 0) {
				return 'SYSTEM REMINDER: This file exists but contains no content (empty file).';
			}

			// Split into lines
			const lines = content.split('\n');

			// Apply offset and limit
			const startLine = offset ? Math.max(0, offset - 1) : 0; // Convert to 0-based index
			const endLine = limit ? startLine + limit : lines.length;
			const selectedLines = lines.slice(startLine, endLine);

			// Format with line numbers (cat -n format) and truncate long lines
			const formattedLines = selectedLines.map((line, index) => {
				const lineNumber = startLine + index + 1; // Convert back to 1-based
				const truncatedLine =
					line.length > 2000 ? line.slice(0, 2000) + '...[truncated]' : line;
				return `${lineNumber.toString().padStart(6, ' ')}\t${truncatedLine}`;
			});

			// Add metadata if offset/limit was used
			let result = formattedLines.join('\n');
			if (offset || limit) {
				const totalLines = lines.length;
				const showingLines = selectedLines.length;
				result = `[Showing lines ${startLine + 1}-${startLine + showingLines} of ${totalLines} total lines]\n\n${result}`;
			}

			return result;
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
				throw new Error(`File not found: ${filePath}`);
			} else if ((error as NodeJS.ErrnoException).code === 'EACCES') {
				throw new Error(`Permission denied: ${filePath}`);
			} else if ((error as NodeJS.ErrnoException).code === 'EISDIR') {
				throw new Error(`Path is a directory, not a file: ${filePath}`);
			} else {
				throw error;
			}
		}
	}

	private isBinaryFile(filePath: string): boolean {
		const ext = path.extname(filePath).toLowerCase();
		const binaryExtensions = [
			'.png',
			'.jpg',
			'.jpeg',
			'.gif',
			'.bmp',
			'.tiff',
			'.webp',
			'.ico',
			'.pdf',
			'.doc',
			'.docx',
			'.xls',
			'.xlsx',
			'.ppt',
			'.pptx',
			'.zip',
			'.rar',
			'.tar',
			'.gz',
			'.7z',
			'.exe',
			'.dll',
			'.so',
			'.dylib',
			'.mp3',
			'.mp4',
			'.avi',
			'.mov',
			'.wmv',
			'.flv',
			'.bin',
			'.dat',
			'.db',
			'.sqlite',
		];
		return binaryExtensions.includes(ext);
	}

	private getFileType(filePath: string): string {
		const ext = path.extname(filePath).toLowerCase();
		const typeMap: Record<string, string> = {
			'.png': 'PNG Image',
			'.jpg': 'JPEG Image',
			'.jpeg': 'JPEG Image',
			'.gif': 'GIF Image',
			'.bmp': 'Bitmap Image',
			'.tiff': 'TIFF Image',
			'.webp': 'WebP Image',
			'.ico': 'Icon file',
			'.pdf': 'PDF Document',
			'.doc': 'Word Document',
			'.docx': 'Word Document',
			'.xls': 'Excel Spreadsheet',
			'.xlsx': 'Excel Spreadsheet',
			'.ppt': 'PowerPoint Presentation',
			'.pptx': 'PowerPoint Presentation',
		};
		return typeMap[ext] || 'Binary file';
	}

	async run(): Promise<void> {
		const transport = new StdioServerTransport();
		await this.server.connect(transport);
	}
}

const server = new ReadToolServer();
server.run().catch(() => process.exit(1));
