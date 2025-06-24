import React, {useEffect, useState} from 'react';
import {Box, Text} from 'ink';

export default function Loading() {
	const [secondsPassed, setSecondsPassed] = useState<number>(0);

	useEffect(() => {
		const timer = setInterval(() => {
			setSecondsPassed(previousCount => previousCount + 1);
		}, 1000);

		return () => {
			clearInterval(timer);
		};
	}, []);

	return (
		<Box gap={1}>
			<Text color="blue">Pondering...</Text>
			<Text color="grey">({secondsPassed}s)</Text>
		</Box>
	);
}
