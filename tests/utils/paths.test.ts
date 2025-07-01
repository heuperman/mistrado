import {resolve, join} from 'node:path';
import test from 'ava';
import {
	makePathRelative,
	shortenPathForDisplay,
} from '../../source/utils/paths.js';

test('makePathRelative returns "." when target path equals root directory', t => {
	const path = '/some/directory';
	const result = makePathRelative(path, path);
	t.is(result, '.');
});

test('makePathRelative returns "." when resolved paths are equal', t => {
	const root = '/some/directory';
	const path = '/some/directory/';
	const result = makePathRelative(path, root);
	t.is(result, '.');
});

test('makePathRelative returns relative path for subdirectory', t => {
	const root = '/some/directory';
	const path = '/some/directory/subdir';
	const result = makePathRelative(path, root);
	t.is(result, 'subdir');
});

test('makePathRelative returns relative path for nested subdirectory', t => {
	const root = '/some/directory';
	const path = '/some/directory/subdir/nested';
	const result = makePathRelative(path, root);
	t.is(result, join('subdir', 'nested'));
});

test('makePathRelative returns relative path for parent directory', t => {
	const root = '/some/directory/subdir';
	const path = '/some/directory';
	const result = makePathRelative(path, root);
	t.is(result, '..');
});

test('makePathRelative returns relative path for sibling directory', t => {
	const root = '/some/directory/subdir1';
	const path = '/some/directory/subdir2';
	const result = makePathRelative(path, root);
	t.is(result, join('..', 'subdir2'));
});

test('makePathRelative handles relative input paths by resolving them first', t => {
	const root = resolve('.');
	const path = './subdir';
	const result = makePathRelative(path, root);
	t.is(result, 'subdir');
});

test('makePathRelative handles complex relative paths', t => {
	const root = '/some/directory';
	const path = '/some/other/directory';
	const result = makePathRelative(path, root);
	t.is(result, join('..', 'other', 'directory'));
});

test('shortenPathForDisplay returns original path when shorter than maxLength', t => {
	const path = '/short/path.txt';
	const result = shortenPathForDisplay(path, 32);
	t.is(result, path);
});

test('shortenPathForDisplay returns original path when exactly maxLength', t => {
	const path = '/exactly/32/characters/long.txt';
	const result = shortenPathForDisplay(path, 32);
	t.is(result, path);
});

test('shortenPathForDisplay returns original path for paths with single segment', t => {
	const path = '/short.txt';
	const result = shortenPathForDisplay(path, 5);
	t.is(result, path);
});

test('shortenPathForDisplay returns original path for paths with two segments', t => {
	const path = '/root/file.txt';
	const result = shortenPathForDisplay(path, 8);
	t.is(result, path);
});

test('shortenPathForDisplay shortens long path with ellipsis', t => {
	const path = '/very/long/path/to/some/deeply/nested/file.txt';
	const result = shortenPathForDisplay(path, 20);
	t.is(result, '/very/.../file.txt');
	t.true(result.length <= 20);
});

test('shortenPathForDisplay includes multiple end segments if within maxLength', t => {
	const path = '/very/long/path/to/some/deeply/nested/file.txt';
	const result = shortenPathForDisplay(path, 25);
	t.is(result, '/very/.../nested/file.txt');
	t.true(result.length <= 25);
});

test('shortenPathForDisplay uses default maxLength of 32', t => {
	const path =
		'/this/is/a/very/long/path/that/exceeds/thirty/two/characters/definitely.txt';
	const result = shortenPathForDisplay(path);
	t.true(result.length <= 32);
	t.true(result.includes('...'));
});
