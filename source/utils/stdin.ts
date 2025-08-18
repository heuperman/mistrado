import process from 'node:process';

export async function readStdin(): Promise<string> {
	return new Promise((resolve, reject) => {
		let data = '';

		if (process.stdin.isTTY) {
			reject(new Error('No input provided via stdin or argument'));
			return;
		}

		// Set encoding to ensure input is received as a string
		process.stdin.setEncoding('utf8');

		process.stdin.on('data', (chunk: string) => {
			data += chunk;
		});

		process.stdin.on('end', () => {
			resolve(data.trim());
		});

		process.stdin.on('error', error => {
			reject(error);
		});
	});
}
