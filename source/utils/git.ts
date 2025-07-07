import {execSync} from 'node:child_process';

export function isGitRepo(directory: string): boolean {
	try {
		execSync('git rev-parse --show-toplevel', {
			stdio: 'ignore',
			cwd: directory,
		});
		return true;
	} catch {
		return false;
	}
}
