import {promisify} from 'node:util';
import {exec, spawn} from 'node:child_process';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import process from 'node:process';
import type {Tool} from '@modelcontextprotocol/sdk/types.js';
import {validateSchema} from '../utils/validation.js';

const execAsync = promisify(exec);

export const bashTool: Tool = {
	name: 'Bash',
	description:
		'Executes bash commands in a shell environment. Supports command execution with optional working directory, timeout handling, and background process management. Returns command output, exit codes, and process information.',
	inputSchema: {
		type: 'object',
		properties: {
			command: {
				type: 'string',
				description: 'The bash command to execute',
			},
			description: {
				type: 'string',
				description:
					'Brief description of what the command does (optional, for user clarity)',
			},
			directory: {
				type: 'string',
				description:
					'Working directory to execute the command in (optional, defaults to current directory)',
			},
			timeout: {
				type: 'number',
				description: 'Timeout in milliseconds (optional, defaults to 30000)',
				minimum: 1000,
				maximum: 300_000,
			},
			runInBackground: {
				type: 'boolean',
				description:
					'Whether to run the command in the background (optional, defaults to false)',
				default: false,
			},
		},
		required: ['command'],
		additionalProperties: false,
	},
};

async function validateDirectory(
	directoryPath: string | undefined,
): Promise<string> {
	if (!directoryPath) return process.cwd();

	try {
		await fs.access(directoryPath);
		const stats = await fs.stat(directoryPath);
		if (!stats.isDirectory()) {
			throw new Error(`Path is not a directory: ${directoryPath}`);
		}

		return directoryPath;
	} catch (error) {
		throw new Error(
			`Invalid directory: ${directoryPath}. ${error instanceof Error ? error.message : String(error)}`,
		);
	}
}

async function executeBackgroundCommand(
	command: string,
	options: {cwd?: string},
): Promise<{
	stdout: string;
	stderr: string;
	exitCode: number | undefined;
	timedOut: boolean;
	backgroundPids: number[];
}> {
	const {cwd} = options;
	// Handle background processes using spawn for better control
	const shell = os.platform() === 'win32' ? 'cmd.exe' : '/bin/bash';
	const args = os.platform() === 'win32' ? ['/c', command] : ['-c', command];

	const childProcess = spawn(shell, args, {
		cwd,
		detached: true,
		stdio: 'ignore',
		windowsHide: true, // Hide console window on Windows
	});

	childProcess.unref();

	// On Unix systems, create a new process group
	if (os.platform() !== 'win32' && childProcess.pid) {
		try {
			process.kill(-childProcess.pid, 0); // Check if process group exists
		} catch {
			// Process group might not exist yet, that's okay
		}
	}

	return {
		stdout: `Background process started with PID: ${childProcess.pid}`,
		stderr: '',
		exitCode: 0,
		timedOut: false,
		backgroundPids: [childProcess.pid ?? 0],
	};
}

async function executeForegroundCommand(
	command: string,
	options: {cwd?: string; timeout: number},
): Promise<{
	stdout: string;
	stderr: string;
	exitCode: number | undefined;
	timedOut: boolean;
	signal?: string;
	isBinaryOutput?: boolean;
}> {
	const {cwd, timeout} = options;

	try {
		const childProcess = execAsync(command, {
			cwd,
			timeout,
			maxBuffer: 10 * 1024 * 1024, // 10MB buffer for large outputs
			encoding: null, // Get buffer to detect binary content
			windowsHide: true, // Hide console window on Windows
		});

		const result = await childProcess;

		// Check for binary content
		const stdout = result.stdout as Uint8Array;
		const stderr = result.stderr as Uint8Array;

		const isBinaryStdout = detectBinaryContent(stdout);
		const isBinaryStderr = detectBinaryContent(stderr);
		const isBinaryOutput = isBinaryStdout || isBinaryStderr;

		return {
			stdout: isBinaryStdout
				? `[Binary output detected - ${stdout.length} bytes]`
				: stdout.toString(),
			stderr: isBinaryStderr
				? `[Binary error output detected - ${stderr.length} bytes]`
				: stderr.toString(),
			exitCode: 0, // Success case
			timedOut: false,
			isBinaryOutput,
		};
	} catch (error) {
		return handleExecutionError(error as ExecError, timeout);
	}
}

type ExecError = {
	code?: string | number;
	message?: string;
	signal?: string;
	stdout?: string | Uint8Array;
	stderr?: string | Uint8Array;
};

function handleExecutionError(
	error: ExecError,
	timeout: number,
): {
	stdout: string;
	stderr: string;
	exitCode: number | undefined;
	timedOut: boolean;
	signal?: string;
} {
	if (error.code === 'ETIMEDOUT') {
		return {
			stdout: error.stdout ? bufferToString(error.stdout) : '',
			stderr: error.stderr
				? bufferToString(error.stderr)
				: `Command timed out after ${timeout}ms`,
			exitCode: undefined,
			timedOut: true,
		};
	}

	// Preserve stdout/stderr even on failure
	return {
		stdout: error.stdout ? bufferToString(error.stdout) : '',
		stderr: error.stderr
			? bufferToString(error.stderr)
			: (error.message ?? 'Unknown error occurred'),
		exitCode: getExitCode(error),
		timedOut: false,
		signal: error.signal ?? undefined,
	};
}

async function executeCommand(
	command: string,
	options: {
		cwd?: string;
		timeout?: number;
		runInBackground?: boolean;
		description?: string;
	},
): Promise<{
	stdout: string;
	stderr: string;
	exitCode: number | undefined;
	timedOut: boolean;
	signal?: string;
	backgroundPids?: number[];
	isBinaryOutput?: boolean;
}> {
	const {cwd, timeout = 30_000, runInBackground = false} = options;

	if (runInBackground) {
		return executeBackgroundCommand(command, {cwd});
	}

	return executeForegroundCommand(command, {cwd, timeout});
}

function getExitCode(error: ExecError): number | undefined {
	// Handle different error types and extract exit code
	if (typeof error.code === 'number') {
		return error.code;
	}

	// Parse exit code from error message for some error types
	if (typeof error.message === 'string') {
		const exitCodeMatch = /exit code (\d+)/.exec(error.message);
		if (exitCodeMatch?.[1]) {
			return Number.parseInt(exitCodeMatch[1], 10);
		}
	}

	// Common shell exit codes
	if (error.code === 'ENOENT') {
		return 127; // Command not found
	}

	return 1; // Generic failure
}

function detectBinaryContent(buffer: Uint8Array): boolean {
	if (!buffer || buffer.length === 0) return false;

	// Check for null bytes (common in binary files)
	if (buffer.includes(0)) return true;

	// Check for high percentage of non-printable characters
	let nonPrintableCount = 0;
	const sampleSize = Math.min(buffer.length, 8192); // Check first 8KB

	for (let i = 0; i < sampleSize; i++) {
		const byte = buffer[i];
		// Consider bytes outside printable ASCII range (excluding common whitespace)
		if (byte && byte < 32 && ![9, 10, 13].includes(byte)) {
			// Tab, LF, CR are ok
			nonPrintableCount++;
		} else if (byte && byte > 126) {
			nonPrintableCount++;
		}
	}

	// If more than 30% non-printable, consider it binary
	return nonPrintableCount / sampleSize > 0.3;
}

function bufferToString(buffer: Uint8Array | string): string {
	if (typeof buffer === 'string') return buffer;
	if (!buffer) return '';

	if (detectBinaryContent(buffer)) {
		return `[Binary content detected - ${buffer.length} bytes]`;
	}

	return buffer.toString();
}

export async function handleBashTool(args: unknown) {
	const validation = validateSchema<{
		command: string;
		description?: string;
		directory?: string;
		timeout?: number;
		runInBackground?: boolean;
	}>(args, bashTool.inputSchema, 'Bash');

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
		const {
			command,
			description,
			directory,
			timeout = 30_000,
			runInBackground = false,
		} = validation.data;

		// Validate directory if provided
		const workingDirectory = await validateDirectory(directory);

		// Execute the command
		const {stdout, stderr, exitCode, timedOut, signal, backgroundPids} =
			await executeCommand(command, {
				cwd: workingDirectory,
				timeout,
				runInBackground,
				description,
			});

		// Format the output
		const outputLines = [
			`Command: ${command}`,
			`Directory: ${workingDirectory}`,
			description ? `Description: ${description}` : '',
			stdout ? `Output:\n${stdout}` : 'Output: (empty)',
			stderr ? `Error:\n${stderr}` : '',
			timedOut ? `Timeout: Command timed out after ${timeout}ms` : '',
			exitCode === undefined ? '' : `Exit Code: ${exitCode}`,
			signal ? `Signal: ${signal}` : '',
			backgroundPids && backgroundPids.length > 0
				? `Background PIDs: ${backgroundPids.join(', ')}`
				: '',
		].filter(line => line !== '');

		return {
			content: [
				{
					type: 'text' as const,
					text: outputLines.join('\n\n'),
				},
			],
			isError: false,
		};
	} catch (error) {
		return {
			content: [
				{
					type: 'text' as const,
					text: `Bash execution error: ${error instanceof Error ? error.message : String(error)}`,
				},
			],
			isError: true,
		};
	}
}
