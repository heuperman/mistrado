import {readFileSync, existsSync} from 'node:fs';
import {join} from 'node:path';

export function loadCustomInstruction(
	workingDirectoryPath: string,
): string | undefined {
	const agentsPath = join(workingDirectoryPath, 'AGENTS.md');

	if (!existsSync(agentsPath)) {
		return undefined;
	}

	try {
		const content = readFileSync(agentsPath, 'utf8').trim();
		return content.length > 0 ? content : undefined;
	} catch {
		return undefined;
	}
}
