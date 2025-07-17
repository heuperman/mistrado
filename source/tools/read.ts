import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type {Tool} from '@modelcontextprotocol/sdk/types.js';
import {validateSchema} from '../utils/validation.js';

export const readTool: Tool = {
	name: 'Read',
	description:
		"Reads a file from the local filesystem. You can access any file directly by using this tool.\nAssume this tool is able to read all files on the machine. If the User provides a path to a file assume that path is valid. It is okay to read a file that does not exist; an error will be returned.\n\nUsage:\n- The file_path parameter must be an absolute path, not a relative path\n- By default, it reads up to 2000 lines starting from the beginning of the file\n- You can optionally specify a line offset and limit (especially handy for long files), but it's recommended to read the whole file by not providing these parameters\n- Any lines longer than 2000 characters will be truncated\n- Results are returned using cat -n format, with line numbers starting at 1\n- This tool allows Claude to read images (eg PNG, JPG, etc). When reading an image file the contents are presented visually as Claude is a multimodal LLM.\n- You have the capability to call multiple tools in a single response. It is always better to speculatively read multiple files as a batch that are potentially useful. \n- You will regularly be asked to read screenshots. If the user provides a path to a screenshot ALWAYS use this tool to view the file at the path. This tool will work with all temporary file paths like /var/folders/123/abc/T/TemporaryItems/NSIRD_screencaptureui_ZfB1tD/Screenshot.png\n- If you read a file that exists but has empty contents you will receive a system reminder warning in place of file contents.",
	inputSchema: {
		type: 'object',
		properties: {
			filePath: {
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
		required: ['filePath'],
		additionalProperties: false,
	},
};

export async function handleReadTool(args: unknown) {
	const validation = validateSchema<{
		filePath: string;
		offset?: number;
		limit?: number;
	}>(args, readTool.inputSchema, 'Read');

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
		// Validate that the path is absolute
		if (!path.isAbsolute(validation.data.filePath)) {
			throw new Error('File path must be absolute');
		}

		const result = await readFile(
			validation.data.filePath,
			validation.data.offset,
			validation.data.limit,
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
					text: `Error reading file: ${errorMessage}`,
				},
			],
			isError: true,
		};
	}
}

async function readFile(
	filePath: string,
	offset?: number,
	limit?: number,
): Promise<string> {
	try {
		// Check if file exists and get stats
		const stats = await fs.stat(filePath);

		// Handle binary files (images, etc.) - for now, just indicate they're binary
		if (isBinaryFile(filePath)) {
			return `[Binary file detected: ${filePath}]\nFile type: ${getFileType(filePath)}\nSize: ${stats.size} bytes\n\nNote: This tool can read binary files like images, but content display depends on the client's multimodal capabilities.`;
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
		if (offset ?? limit) {
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

function isBinaryFile(filePath: string): boolean {
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

function getFileType(filePath: string): string {
	const ext = path.extname(filePath).toLowerCase().slice(1); // Remove the dot
	const typeMap: Record<string, string> = {
		png: 'PNG Image',
		jpg: 'JPEG Image',
		jpeg: 'JPEG Image',
		gif: 'GIF Image',
		bmp: 'Bitmap Image',
		tiff: 'TIFF Image',
		webp: 'WebP Image',
		ico: 'Icon file',
		pdf: 'PDF Document',
		doc: 'Word Document',
		docx: 'Word Document',
		xls: 'Excel Spreadsheet',
		xlsx: 'Excel Spreadsheet',
		ppt: 'PowerPoint Presentation',
		pptx: 'PowerPoint Presentation',
	};
	return typeMap[ext] ?? 'Binary file';
}
