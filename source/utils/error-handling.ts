import process from 'node:process';

export function setupErrorHandling(): void {
	// Handle SIGPIPE gracefully (when output is piped to another command that closes)
	process.on('SIGPIPE', () => {
		process.exit(0);
	});

	// Handle other common signals
	process.on('SIGINT', () => {
		process.exit(1);
	});

	process.on('SIGTERM', () => {
		process.exit(1);
	});

	// Handle uncaught exceptions
	process.on('uncaughtException', (error: Error) => {
		console.error(`Uncaught exception: ${error.message}`);

		process.exit(1);
	});

	process.on('unhandledRejection', (reason: string) => {
		console.error(`Unhandled rejection: ${reason}`);

		process.exit(1);
	});
}
