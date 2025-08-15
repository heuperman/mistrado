import {readFileSync} from 'node:fs';
import {join, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export function getVersion(): string {
	try {
		const packagePath = join(__dirname, '..', '..', 'package.json');
		const packageJson = JSON.parse(readFileSync(packagePath, 'utf8')) as {
			version: string;
		};
		return packageJson.version;
	} catch {
		return 'unknown';
	}
}
