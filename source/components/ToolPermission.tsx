import path from 'node:path';
import process from 'node:process';
import React, {useCallback} from 'react';
import {Box, Text} from 'ink';
import SelectInput from 'ink-select-input';
import type {
	ToolPermissionRequest,
	PermissionDecision,
} from '../types/callbacks.js';
import Markdown from './Markdown.js';

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
			case 'multiedit':
			case 'write': {
				const filePath = args['filePath'] as string;
				if (filePath) {
					const relativePath = path.relative(process.cwd(), filePath);
					const action = toolName === 'write' ? 'create or overwrite' : 'edit';
					return {
						context: relativePath,
						details: `Do you want to allow Mistrado to ${action} **${relativePath}**?`,
					};
				}

				return {
					context: 'No file path provided',
					details: 'Do you want to allow Mistrado to modify files?',
				};
			}

			case 'webfetch': {
				const url = args['url'] as string;
				try {
					const domain = new URL(url).hostname;
					return {
						context: url,
						details: `Do you want to allow Mistrado to fetch content from **${domain}**?`,
					};
				} catch {
					return {
						context: url || 'No URL provided',
						details:
							'Do you want to allow Mistrado to fetch content from this URL?',
					};
				}
			}

			case 'bash': {
				const command = args['command'] as string;
				const firstTwoCommands = command
					? command.split(/\s+/).slice(0, 2).join(' ')
					: undefined;
				return {
					context: command ?? 'No command provided',
					details: `Do you want to allow Mistrado to run **${firstTwoCommands}**`,
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
					details: `Do you want to allow Mistrado to use the tool **${toolName}**?`,
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

	const isFileOperation = ['edit', 'multiedit', 'write'].includes(
		toolName.toLowerCase(),
	);
	const sessionLabel = isFileOperation
		? 'Yes, allow all file edits for this session'
		: `Yes, allow ${toolName} requests for this session`;

	const items = [
		{
			label: 'Yes, allow once',
			value: 'once' as PermissionDecision,
		},
		{
			label: sessionLabel,
			value: 'session' as PermissionDecision,
		},
		{
			label: 'No',
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
		<Box
			flexDirection="column"
			borderStyle="round"
			borderColor="yellow"
			paddingX={1}
		>
			<Text bold color="yellow">
				{toolName}
			</Text>
			<Box flexDirection="column" padding={1}>
				<Text>{context}</Text>
			</Box>
			<Box flexDirection="column">
				{details ? <Markdown>{details}</Markdown> : null}
				<SelectInput items={items} onSelect={handleSelect} />
			</Box>
		</Box>
	);
}
