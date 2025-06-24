import React from 'react';
import {Box, Text} from 'ink';
import type {ConversationEntry} from '../services/conversation-service.js';
import Loading from './loading.js';

type ConversationProps = {
	readonly history: readonly ConversationEntry[];
	readonly isLoading: boolean;
	readonly errorOutput?: string;
};

export default function Conversation({
	history,
	isLoading,
	errorOutput,
}: ConversationProps) {
	return (
		<>
			{history.map(entry => (
				<Box key={entry.id} marginBottom={1}>
					{entry.type === 'user' && (
						<Box flexDirection="row" paddingLeft={0}>
							<Text color="gray">&gt; </Text>
							<Box flexGrow={1}>
								<Text color="gray">{entry.content}</Text>
							</Box>
						</Box>
					)}
					{entry.type === 'assistant' && <Text>{entry.content}</Text>}
					{entry.type === 'command' && (
						<Text color="yellow">{entry.content}</Text>
					)}
					{entry.type === 'tool' && <Text>{entry.content}</Text>}
				</Box>
			))}
			{isLoading ? <Loading /> : null}
			{errorOutput ? <Text color="red">Error: {errorOutput}</Text> : null}
		</>
	);
}
