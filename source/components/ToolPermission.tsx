import React, {useCallback} from 'react';
import {Box, Text} from 'ink';
import SelectInput from 'ink-select-input';
import type {ToolPermissionRequest} from '../types/callbacks.js';

type ToolPermissionProps = {
	readonly request: ToolPermissionRequest;
	readonly onDecision: (approved: boolean) => void;
};

const formatToolArguments = (
	toolCall: ToolPermissionRequest['toolCall'],
): string => {
	try {
		const rawArgs = toolCall.function.arguments;
		const args =
			typeof rawArgs === 'string'
				? (JSON.parse(rawArgs) as Record<string, unknown>)
				: rawArgs;

		// Format key arguments for display
		const keyArgs = Object.entries(args)
			.filter(([key]) => !['content', 'new_string', 'old_string'].includes(key))
			.map(([key, value]) => `${key}: ${String(value)}`)
			.join(', ');

		return keyArgs ? ` (${keyArgs})` : '';
	} catch {
		return '';
	}
};

export default function ToolPermission({
	request,
	onDecision,
}: ToolPermissionProps) {
	const {toolName} = request;
	const argsDisplay = formatToolArguments(request.toolCall);

	const items = [
		{
			label: 'Yes - Allow this tool',
			value: true,
		},
		{
			label: 'No - Deny this tool',
			value: false,
		},
	];

	const handleSelect = useCallback(
		(item: {label: string; value: boolean}) => {
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
					{toolName}
				</Text>
				<Text>
					{argsDisplay ? <Text color="grey">{argsDisplay}</Text> : null}
				</Text>
				<Box flexDirection="column" gap={1}>
					<Text>Allow this tool to execute?</Text>
					<SelectInput items={items} onSelect={handleSelect} />
				</Box>
			</Box>
		</Box>
	);
}
