import React from 'react';
import {Box, Text} from 'ink';
import type {ConversationEntry} from '../services/conversation-service.js';
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
					{entry.type === 'assistant' && <Markdown>{entry.content}</Markdown>}
					{entry.type === 'command' && <Markdown>{entry.content}</Markdown>}
					{entry.type === 'tool' && <Markdown>{entry.content}</Markdown>}
				</Box>
			))}
			{isLoading ? <Loading completionTokens={currentTokenCount} /> : null}
			{errorOutput ? <Text color="red">Error: {errorOutput}</Text> : null}
		</>
	);
}
