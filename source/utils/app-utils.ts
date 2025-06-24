import {execSync} from 'node:child_process';

export function isGitRepo(): boolean {
	try {
		execSync('git rev-parse --git-dir', {stdio: 'ignore'});
		return true;
	} catch {
		return false;
	}
}
