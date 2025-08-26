import type {MistralToolCall} from '../types/mistral.js';

export type PermissionLevel = 'once' | 'session' | 'deny';

/**
 * Manages tool permissions with session-level storage.
 * Phase 1: In-memory storage only. Interface designed for easy addition
 * of file-based persistence in future phases.
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
	 * Generates a unique permission key for a tool call.
	 * Different tools use different key generation strategies.
	 */
	private generatePermissionKey(toolCall: MistralToolCall): string {
		const toolName = toolCall.function.name.toLowerCase();
		const args = this.parseToolArguments(toolCall.function.arguments);

		switch (toolName) {
			case 'edit':
			case 'multiedit': {
				// Permission based on absolute file path
				const filePath = args['filePath'] as string;
				return `edit:${filePath}`;
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
				// Permission based on command (first word only for security)
				const command = args['command'] as string;
				const firstCommand = command.split(/\s+/)[0];
				return `bash:${firstCommand}`;
			}

			case 'write': {
				// Permission based on file path
				const filePath = args['filePath'] as string;
				return `write:${filePath}`;
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
