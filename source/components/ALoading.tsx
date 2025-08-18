import React, {useEffect, useState} from 'react';
import {Box, Text} from 'ink';

type LoadingProps = {
	readonly completionTokens?: number;
};

export default function Loading({completionTokens = 0}: LoadingProps) {
	const [secondsPassed, setSecondsPassed] = useState<number>(0);
	const [displayedTokens, setDisplayedTokens] = useState<number>(0);
	const [loadingIndicator, setLoadingIndicator] = useState<string>('~');

	useEffect(() => {
		const timer = setInterval(() => {
			setSecondsPassed(previousCount => previousCount + 1);
		}, 1000);

		return () => {
			clearInterval(timer);
		};
	}, []);

	useEffect(() => {
		const loadingIndicators = ['~', '≈', '∿', '∼', '~', '≋'];

		const timer = setInterval(() => {
			const randomIndex = Math.round(Math.random() * loadingIndicators.length);
			setLoadingIndicator(loadingIndicators[randomIndex] ?? '~');
		}, 200);

		return () => {
			clearInterval(timer);
		};
	}, [setLoadingIndicator]);

	// Animate token count changes
	useEffect(() => {
		if (completionTokens <= displayedTokens) {
			return;
		}

		const targetTokens = completionTokens;
		const startTokens = displayedTokens;
		const difference = targetTokens - startTokens;
		const steps = 20; // Number of animation steps over 2 seconds
		const stepSize = Math.ceil(difference / steps);
		const stepInterval = 100; // 100ms between steps (2000ms / 20 steps)

		const timer = setInterval(() => {
			setDisplayedTokens(current => {
				const next = current + stepSize;
				if (next >= targetTokens) {
					clearInterval(timer);
					return targetTokens;
				}

				return next;
			});
		}, stepInterval);

		return () => {
			clearInterval(timer);
		};
	}, [completionTokens, displayedTokens]);

	const formatProgress = () => {
		if (displayedTokens > 0) {
			return `(${secondsPassed}s · ${displayedTokens} tokens)`;
		}

		return `(${secondsPassed}s)`;
	};

	return (
		<Box gap={1}>
			<Text color="blue">{loadingIndicator}</Text>
			<Text color="blue">Pondering...</Text>
			<Text color="grey">{formatProgress()}</Text>
		</Box>
	);
}
