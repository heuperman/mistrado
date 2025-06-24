import process from 'node:process';
import {useEffect} from 'react';
import {useApp} from 'ink';
import type {McpManager} from '../services/mcp-manager.js';

export function useSignalHandler(
	mcpManager: McpManager | undefined,
	shouldExit: boolean,
	setShouldExit: (value: boolean) => void,
) {
	const {exit} = useApp();

	// Handle graceful exit when shouldExit is true
	useEffect(() => {
		const handleGracefulExit = async () => {
			if (mcpManager) {
				await mcpManager.disconnect();
			}

			exit();
			// eslint-disable-next-line unicorn/no-process-exit
			process.exit(0);
		};

		if (shouldExit) {
			void handleGracefulExit();
		}
	}, [shouldExit, exit, mcpManager]);

	// Handle SIGINT and SIGTERM signals
	useEffect(() => {
		const handleSignal = () => {
			if (mcpManager) {
				setShouldExit(true);
			}
		};

		process.on('SIGINT', handleSignal);
		process.on('SIGTERM', handleSignal);

		return () => {
			process.removeListener('SIGINT', handleSignal);
			process.removeListener('SIGTERM', handleSignal);
		};
	}, [mcpManager, setShouldExit]);
}
