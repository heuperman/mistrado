import React, {useCallback} from 'react';
import {Box, Text} from 'ink';
import SelectInput from 'ink-select-input';
import type {
	ToolPermissionRequest,
	PermissionDecision,
} from '../types/callbacks.js';

type ToolPermissionProps = {
	readonly request: ToolPermissionRequest;
	readonly onDecision: (decision: PermissionDecision) => void;
};

const formatToolContext = (
	toolCall: ToolPermissionRequest['toolCall'],
): {context: string; details: string} => {
	try {
		const rawArgs = toolCall.function.arguments;
		const args =
			typeof rawArgs === 'string'
				? (JSON.parse(rawArgs) as Record<string, unknown>)
				: rawArgs;

		const toolName = toolCall.function.name.toLowerCase();

		switch (toolName) {
			case 'edit':
			case 'multiedit': {
				const filePath = args['filePath'] as string;
				return {
					context: `File: ${filePath}`,
					details: 'This tool will modify file contents',
				};
			}

			case 'webfetch': {
				const url = args['url'] as string;
				try {
					const domain = new URL(url).hostname;
					return {
						context: `Domain: ${domain}`,
						details: `URL: ${url}`,
					};
				} catch {
					return {
						context: `URL: ${url}`,
						details: 'This tool will fetch web content',
					};
				}
			}

			case 'bash': {
				const command = args['command'] as string;
				const firstCommand = command.split(/\s+/)[0];
				return {
					context: `Command: ${firstCommand}`,
					details: `Full command: ${command}`,
				};
			}

			case 'write': {
				const filePath = args['filePath'] as string;
				return {
					context: `File: ${filePath}`,
					details: 'This tool will create or overwrite a file',
				};
			}

			default: {
				// Format key arguments for display
				const keyArgs = Object.entries(args)
					.filter(
						([key]) => !['content', 'new_string', 'old_string'].includes(key),
					)
					.map(([key, value]) => `${key}: ${String(value)}`)
					.join(', ');

				return {
					context: keyArgs || 'No parameters',
					details: '',
				};
			}
		}
	} catch {
		return {
			context: 'Unable to parse arguments',
			details: '',
		};
	}
};

export default function ToolPermission({
	request,
	onDecision,
}: ToolPermissionProps) {
	const {toolName} = request;
	const {context, details} = formatToolContext(request.toolCall);

	const items = [
		{
			label: 'Allow once',
			value: 'once' as PermissionDecision,
		},
		{
			label: 'Allow for this session',
			value: 'session' as PermissionDecision,
		},
		{
			label: 'Deny',
			value: 'deny' as PermissionDecision,
		},
	];

	const handleSelect = useCallback(
		(item: {label: string; value: PermissionDecision}) => {
			onDecision(item.value);
		},
		[onDecision],
	);

	return (
		<Box flexDirection="column" paddingX={2} gap={1}>
			<Box
				flexDirection="column"
				borderStyle="round"
				borderColor="yellow"
				padding={1}
			>
				<Text bold color="yellow">
					🔒 Permission Request: {toolName}
				</Text>
				<Box flexDirection="column" gap={1}>
					<Text color="cyan">{context}</Text>
					{details ? <Text color="grey">{details}</Text> : null}
				</Box>
				<Box flexDirection="column" gap={1}>
					<Text>Options:</Text>
					<SelectInput items={items} onSelect={handleSelect} />
				</Box>
			</Box>
		</Box>
	);
}
