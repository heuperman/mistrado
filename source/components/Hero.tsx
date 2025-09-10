import React from 'react';
import {Box, Text} from 'ink';
import {colors} from '../utils/colors.js';

export default function Hero() {
	return (
		<Box
			width={60}
			borderColor={colors.blue}
			borderStyle="round"
			flexDirection="column"
			gap={1}
			paddingX={2}
			paddingY={1}
		>
			<Text color="white">Welcome to Mistrado!</Text>
			<Text color="white">
				Describe a task or ask a question to get started
			</Text>
			<Text color={colors.brightBlue}>
				/help for help, /exit or /quit to exit
			</Text>
		</Box>
	);
}
