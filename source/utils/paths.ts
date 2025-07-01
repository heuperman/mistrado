import {resolve, relative, sep} from 'node:path';

export function makePathRelative(path: string, rootDirectory: string): string {
	const resolvedPath = resolve(path);
	const resolvedRoot = resolve(rootDirectory);

	return relative(resolvedRoot, resolvedPath) || '.';
}

export function shortenPathForDisplay(path: string, maxLength = 32): string {
	if (path.length <= maxLength) return path;

	const parts = path.split(sep).filter(part => part.length > 0);

	if (parts.length <= 2) return path;

	const startParts = [parts[0]!];
	const endParts = [parts.at(-1)!];
	const truncation = sep + '...' + sep;
	let shortenedPath =
		sep + startParts.join(sep) + truncation + endParts.join(sep);

	while (shortenedPath.length < maxLength) {
		if (startParts.length + endParts.length >= parts.length)
			return shortenedPath;

		if (startParts.length < endParts.length) {
			startParts.push(parts[startParts.length + 1]!);
		} else {
			endParts.unshift(parts[parts.length - 1 - endParts.length]!);
		}

		const longerPath =
			sep + startParts.join(sep) + truncation + endParts.join(sep);
		if (longerPath.length > maxLength) return shortenedPath;

		shortenedPath = longerPath;
	}

	return shortenedPath;
}
