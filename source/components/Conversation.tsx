import React from 'react';
import {Box, Text} from 'ink';
import type {ConversationEntry, ToolCallStatus} from '../types/callbacks.js';
import {colors} from '../utils/colors.js';
import Loading from './Loading.js';
import Markdown from './Markdown.js';

type ConversationProps = {
	readonly history: readonly ConversationEntry[];
	readonly isLoading: boolean;
	readonly errorOutput?: string;
	readonly currentTokenCount?: number;
};

export default function Conversation({
	history,
	isLoading,
	errorOutput,
	currentTokenCount,
}: ConversationProps) {
	const getStatusColor = (status: ToolCallStatus | undefined) => {
		if (status === 'error') return colors.red;
		if (status === 'success') return colors.green;
		if (status === 'running') return colors.magenta;
		return 'white';
	};

	return (
		<>
			{history.map(entry => (
				<Box key={entry.id}>
					{entry.type === 'user' && (
						<Box flexDirection="row" paddingLeft={0}>
							<Text color={colors.white}>&gt; </Text>
							<Box flexGrow={1}>
								<Text color={colors.white}>{entry.content}</Text>
							</Box>
						</Box>
					)}
					{entry.type === 'assistant' && (
						<Box flexDirection="row" gap={1}>
							<Text color={getStatusColor(entry.status)}>●</Text>
							<Markdown>{entry.content}</Markdown>
						</Box>
					)}
					{entry.type === 'command' && <Markdown>{entry.content}</Markdown>}
					{entry.type === 'tool' && (
						<Box flexDirection="row" gap={1}>
							<Text color={getStatusColor(entry.status)}>●</Text>
							<Markdown>{entry.content}</Markdown>
						</Box>
					)}
				</Box>
			))}
			{isLoading ? <Loading completionTokens={currentTokenCount} /> : null}
			{errorOutput ? (
				<Text color={colors.red}>Error: {errorOutput}</Text>
			) : null}
		</>
	);
}
