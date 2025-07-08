import test from 'ava';
import {globToRegex} from '../../source/utils/regex.js';

test('should match literal strings', t => {
	const regex = globToRegex('hello.txt');

	t.true(regex.test('hello.txt'));
	t.false(regex.test('hello.js'));
	t.false(regex.test('world.txt'));
});

test('should match single wildcard patterns', t => {
	const regex = globToRegex('*.txt');

	t.true(regex.test('hello.txt'));
	t.true(regex.test('world.txt'));
	t.false(regex.test('hello.js'));
	t.false(regex.test('nested/file.txt'));
});

test('should match with globstar when enabled', t => {
	const regex = globToRegex('**/*.js', {globstar: true});

	t.true(regex.test('file.js'));
	t.true(regex.test('nested/file.js'));
	t.true(regex.test('deeply/nested/file.js'));
	t.false(regex.test('file.txt'));
});

test('should be case insensitive with i flag', t => {
	const regex = globToRegex('*.TXT', {flags: 'i'});

	t.true(regex.test('hello.txt'));
	t.true(regex.test('hello.TXT'));
	t.true(regex.test('hello.Txt'));
});

test('should escape regex special characters', t => {
	const regex = globToRegex('test.file');

	t.true(regex.test('test.file'));
	t.false(regex.test('testXfile'));
});
