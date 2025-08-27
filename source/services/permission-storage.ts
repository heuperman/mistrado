import path from 'node:path';
import type {MistralToolCall} from '../types/mistral.js';

export type PermissionLevel = 'once' | 'session' | 'deny';

/**
 * Manages tool permissions with session-level storage and persistent file operations.
 */
export class PermissionStorage {
	private readonly sessionPermissions = new Map<string, boolean>();

	/**
	 * Checks if a tool call has a stored session permission.
	 */
	hasSessionPermission(toolCall: MistralToolCall): boolean {
		const key = this.generatePermissionKey(toolCall);
		return this.sessionPermissions.get(key) === true;
	}

	/**
	 * Stores a session permission for a tool call.
	 */
	storeSessionPermission(toolCall: MistralToolCall, allowed: boolean): void {
		const key = this.generatePermissionKey(toolCall);
		this.sessionPermissions.set(key, allowed);
	}

	/**
	 * Clears all session permissions. Called when session ends.
	 */
	clearSessionPermissions(): void {
		this.sessionPermissions.clear();
	}

	/**
	 * Gets count of stored session permissions (for debugging/testing).
	 */
	getSessionPermissionCount(): number {
		return this.sessionPermissions.size;
	}

	/**
	 * Checks if a tool call has session permission.
	 */
	async hasPermission(toolCall: MistralToolCall): Promise<boolean> {
		// First check session permissions
		if (this.hasSessionPermission(toolCall)) {
			return true;
		}

		return false;
	}

	/**
	 * Generates a unique permission key for a tool call.
	 */
	private generatePermissionKey(toolCall: MistralToolCall): string {
		const toolName = toolCall.function.name.toLowerCase();
		const args = this.parseToolArguments(toolCall.function.arguments);

		switch (toolName) {
			case 'edit':
			case 'multiedit':
			case 'write': {
				const filePath = args['filePath'] as string;
				if (filePath) {
					const directory = path.dirname(path.resolve(filePath));
					return `fileops:${directory}`;
				}

				return `${toolName}:unknown`;
			}

			case 'webfetch': {
				// Permission based on domain only (ignore path/query)
				const url = args['url'] as string;
				try {
					const domain = new URL(url).hostname;
					return `webfetch:${domain}`;
				} catch {
					// Fallback to full URL if parsing fails
					return `webfetch:${url}`;
				}
			}

			case 'bash': {
				// Permission based on base command + first argument
				const command = args['command'] as string;
				const parts = command.split(/\s+/);
				const commandKey =
					parts.length >= 2 ? `${parts[0]} ${parts[1]}` : parts[0];
				return `bash:${commandKey}`;
			}

			default: {
				// Generic permission key for other tools
				return `${toolName}:generic`;
			}
		}
	}

	/**
	 * Safely parses tool arguments from string or object format.
	 */
	private parseToolArguments(
		args: string | Record<string, unknown>,
	): Record<string, unknown> {
		try {
			return typeof args === 'string'
				? (JSON.parse(args) as Record<string, unknown>)
				: args;
		} catch {
			return {};
		}
	}
}
