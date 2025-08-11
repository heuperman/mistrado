import React from 'react';
import {Box, Text} from 'ink';
import type {
	ConversationEntry,
	ToolCallStatus,
} from '../services/conversation-service.js';
import Loading from './loading.js';
import Markdown from './markdown.js';

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
		if (status === 'error') return 'red';
		if (status === 'success') return 'green';
		if (status === 'running') return 'blue';
		return 'white';
	};

	return (
		<>
			{history.map(entry => (
				<Box key={entry.id}>
					{entry.type === 'user' && (
						<Box flexDirection="row" paddingLeft={0}>
							<Text color="gray">&gt; </Text>
							<Box flexGrow={1}>
								<Text color="gray">{entry.content}</Text>
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
			{errorOutput ? <Text color="red">Error: {errorOutput}</Text> : null}
		</>
	);
}
