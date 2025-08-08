import {stdout} from 'node:process';

export function setTerminalTitle(title: string) {
	if (stdout.isTTY) {
		stdout.write(`\u001B]2;${title}\u0007`);
	}
}
