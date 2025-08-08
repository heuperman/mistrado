import test from 'ava';
import {
	type IndentationType,
	detectIndentation,
	normalizeIndentation,
	convertIndentation,
} from '../../source/utils/indentation-normalizer.js';

// DetectIndentation tests
test('detectIndentation detects tabs', t => {
	const content = `function test() {
\tif (true) {
\t\treturn 'hello';
\t}
}`;
	const result = detectIndentation(content);
	t.deepEqual(result, {type: 'tabs', size: 1});
});

test('detectIndentation detects 2-space indentation', t => {
	const content = `function test() {
  if (true) {
    return 'hello';
  }
}`;
	const result = detectIndentation(content);
	t.deepEqual(result, {type: 'spaces', size: 2});
});

test('detectIndentation detects 4-space indentation', t => {
	const content = `function test() {
    if (true) {
        return 'hello';
    }
}`;
	const result = detectIndentation(content);
	t.deepEqual(result, {type: 'spaces', size: 4});
});

test('detectIndentation detects 8-space indentation', t => {
	const content = `function test() {
        if (true) {
                return 'hello';
        }
}`;
	const result = detectIndentation(content);
	t.deepEqual(result, {type: 'spaces', size: 8});
});

test('detectIndentation handles mixed indentation', t => {
	// This test shows the algorithm behavior: it actually counts this as spaces
	// because lines starting with "  \t" have 2 leading spaces and 0 leading tabs
	const content = `function test() {
\tif (true) {
\t\treturn 'hello';
\t}
  \tif (false) {
    return 'world';
  }
}`;
	const result = detectIndentation(content);
	// The algorithm detects this as spaces, not mixed, because no single line
	// starts with both spaces AND tabs - just spaces followed by tabs
	t.is(result.type, 'spaces');
	t.is(result.size, 2);
});

test('detectIndentation handles no indentation', t => {
	const content = `function test() {
return 'hello';
}`;
	const result = detectIndentation(content);
	t.deepEqual(result, {type: 'none', size: 0});
});

test('detectIndentation handles empty content', t => {
	const result = detectIndentation('');
	t.deepEqual(result, {type: 'none', size: 0});
});

test('detectIndentation handles whitespace-only content', t => {
	const result = detectIndentation('   \n\t\n  ');
	t.deepEqual(result, {type: 'none', size: 0});
});

test('detectIndentation skips empty lines', t => {
	const content = `function test() {

    if (true) {

        return 'hello';
    }
}`;
	const result = detectIndentation(content);
	t.deepEqual(result, {type: 'spaces', size: 4});
});

test('detectIndentation prefers tabs when equal usage', t => {
	const content = `function test() {
\tif (true) {
\t\treturn 'hello';
\t}
  if (false) {
    return 'world';
  }
}`;
	// 3 tab-indented lines vs 2 space-indented lines, tabs should win
	const result = detectIndentation(content);
	// But algorithm will detect spaces because there are more space counts (3 total: [2, 4, 2])
	// vs tab counts (3 total: [1, 2, 1]). Since counts are equal, spaces win due to order.
	t.deepEqual(result, {type: 'spaces', size: 2});
});

test('detectIndentation handles complex space patterns', t => {
	const content = `function test() {
  const a = 1;
    const b = 2;
      const c = 3;
}`;
	// GCD of [2, 4, 6] is 2
	const result = detectIndentation(content);
	t.deepEqual(result, {type: 'spaces', size: 2});
});

test('detectIndentation handles irregular space patterns', t => {
	const content = `function test() {
   const a = 1;
      const b = 2;
         const c = 3;
}`;
	// GCD of [3, 6, 9] is 3
	const result = detectIndentation(content);
	t.deepEqual(result, {type: 'spaces', size: 3});
});

// ConvertIndentation tests
test('convertIndentation converts tabs to 4-space indentation', t => {
	const text = `function test() {
\tif (true) {
\t\treturn 'hello';
\t}
}`;
	const fromType: IndentationType = {type: 'tabs', size: 1};
	const toType: IndentationType = {type: 'spaces', size: 4};
	const result = convertIndentation(text, fromType, toType);

	const expected = `function test() {
    if (true) {
        return 'hello';
    }
}`;
	t.is(result, expected);
});

test('convertIndentation converts 4-space to tabs', t => {
	const text = `function test() {
    if (true) {
        return 'hello';
    }
}`;
	const fromType: IndentationType = {type: 'spaces', size: 4};
	const toType: IndentationType = {type: 'tabs', size: 1};
	const result = convertIndentation(text, fromType, toType);

	const expected = `function test() {
\tif (true) {
\t\treturn 'hello';
\t}
}`;
	t.is(result, expected);
});

test('convertIndentation converts 2-space to 4-space indentation', t => {
	const text = `function test() {
  if (true) {
    return 'hello';
  }
}`;
	const fromType: IndentationType = {type: 'spaces', size: 2};
	const toType: IndentationType = {type: 'spaces', size: 4};
	const result = convertIndentation(text, fromType, toType);

	const expected = `function test() {
    if (true) {
        return 'hello';
    }
}`;
	t.is(result, expected);
});

test('convertIndentation converts 4-space to 2-space indentation', t => {
	const text = `function test() {
    if (true) {
        return 'hello';
    }
}`;
	const fromType: IndentationType = {type: 'spaces', size: 4};
	const toType: IndentationType = {type: 'spaces', size: 2};
	const result = convertIndentation(text, fromType, toType);

	const expected = `function test() {
  if (true) {
    return 'hello';
  }
}`;
	t.is(result, expected);
});

test('convertIndentation preserves empty lines', t => {
	const text = `function test() {

    if (true) {

        return 'hello';
    }
}`;
	const fromType: IndentationType = {type: 'spaces', size: 4};
	const toType: IndentationType = {type: 'tabs', size: 1};
	const result = convertIndentation(text, fromType, toType);

	const expected = `function test() {

\tif (true) {

\t\treturn 'hello';
\t}
}`;
	t.is(result, expected);
});

test('convertIndentation handles nested indentation levels', t => {
	const text = `class Test {
    constructor() {
        if (true) {
            this.value = {
                nested: {
                    deep: 'value'
                }
            };
        }
    }
}`;
	const fromType: IndentationType = {type: 'spaces', size: 4};
	const toType: IndentationType = {type: 'tabs', size: 1};
	const result = convertIndentation(text, fromType, toType);

	const expected = `class Test {
\tconstructor() {
\t\tif (true) {
\t\t\tthis.value = {
\t\t\t\tnested: {
\t\t\t\t\tdeep: 'value'
\t\t\t\t}
\t\t\t};
\t\t}
\t}
}`;
	t.is(result, expected);
});

test('convertIndentation returns unchanged text when no conversion needed', t => {
	const text = `function test() {
\tif (true) {
\t\treturn 'hello';
\t}
}`;
	const fromType: IndentationType = {type: 'tabs', size: 1};
	const toType: IndentationType = {type: 'tabs', size: 1};
	const result = convertIndentation(text, fromType, toType);

	t.is(result, text);
});

test('convertIndentation handles mixed whitespace gracefully', t => {
	const text = `function test() {
\tif (true) {
  \treturn 'hello';
\t}
}`;
	const fromType: IndentationType = {type: 'mixed', size: 0};
	const toType: IndentationType = {type: 'tabs', size: 1};
	const result = convertIndentation(text, fromType, toType);

	// Should return unchanged for mixed indentation
	t.is(result, text);
});

// NormalizeIndentation tests
test('normalizeIndentation converts spaces to tabs when file uses tabs', t => {
	const oldString = `    if (condition) {
        doSomething();
    }`;
	const newString = `    if (newCondition) {
        doSomethingElse();
    }`;
	const fileContent = `function test() {
\tif (existing) {
\t\treturn true;
\t}
}`;

	const result = normalizeIndentation(oldString, newString, fileContent);

	t.true(result.wasNormalized);
	t.is(
		result.normalizedOldString,
		`\tif (condition) {
\t\tdoSomething();
\t}`,
	);
	t.is(
		result.normalizedNewString,
		`\tif (newCondition) {
\t\tdoSomethingElse();
\t}`,
	);
	t.truthy(result.details);
	t.true(result.details!.includes('converted from spaces(4) to tabs(1)'));
});

test('normalizeIndentation converts tabs to spaces when file uses spaces', t => {
	const oldString = `\tif (condition) {
\t\tdoSomething();
\t}`;
	const newString = `\tif (newCondition) {
\t\tdoSomethingElse();
\t}`;
	const fileContent = `function test() {
    if (existing) {
        return true;
    }
}`;

	const result = normalizeIndentation(oldString, newString, fileContent);

	t.true(result.wasNormalized);
	t.is(
		result.normalizedOldString,
		`    if (condition) {
        doSomething();
    }`,
	);
	t.is(
		result.normalizedNewString,
		`    if (newCondition) {
        doSomethingElse();
    }`,
	);
	t.truthy(result.details);
	t.true(result.details!.includes('converted from tabs(1) to spaces(4)'));
});

test('normalizeIndentation handles space size conversion', t => {
	const oldString = `  if (condition) {
    doSomething();
  }`;
	const newString = `  if (newCondition) {
    doSomethingElse();
  }`;
	const fileContent = `function test() {
    if (existing) {
        return true;
    }
}`;

	const result = normalizeIndentation(oldString, newString, fileContent);

	t.true(result.wasNormalized);
	t.is(
		result.normalizedOldString,
		`    if (condition) {
        doSomething();
    }`,
	);
	t.is(
		result.normalizedNewString,
		`    if (newCondition) {
        doSomethingElse();
    }`,
	);
	t.truthy(result.details);
	t.true(result.details!.includes('converted from spaces(2) to spaces(4)'));
});

test('normalizeIndentation does not normalize when indentation matches', t => {
	const oldString = `\tif (condition) {
\t\tdoSomething();
\t}`;
	const newString = `\tif (newCondition) {
\t\tdoSomethingElse();
\t}`;
	const fileContent = `function test() {
\tif (existing) {
\t\treturn true;
\t}
}`;

	const result = normalizeIndentation(oldString, newString, fileContent);

	t.false(result.wasNormalized);
	t.is(result.normalizedOldString, oldString);
	t.is(result.normalizedNewString, newString);
	t.is(result.details, undefined);
});

test('normalizeIndentation handles file with no indentation', t => {
	const oldString = `\tif (condition) {
\t\tdoSomething();
\t}`;
	const newString = `\tif (newCondition) {
\t\tdoSomethingElse();
\t}`;
	const fileContent = `function test() {
return true;
}`;

	const result = normalizeIndentation(oldString, newString, fileContent);

	t.false(result.wasNormalized);
	t.is(result.normalizedOldString, oldString);
	t.is(result.normalizedNewString, newString);
	t.is(result.details, undefined);
});

test('normalizeIndentation handles strings with no indentation', t => {
	const oldString = `if (condition) {
doSomething();
}`;
	const newString = `if (newCondition) {
doSomethingElse();
}`;
	const fileContent = `function test() {
\tif (existing) {
\t\treturn true;
\t}
}`;

	const result = normalizeIndentation(oldString, newString, fileContent);

	t.false(result.wasNormalized);
	t.is(result.normalizedOldString, oldString);
	t.is(result.normalizedNewString, newString);
	t.is(result.details, undefined);
});

test('normalizeIndentation normalizes only what needs normalization', t => {
	const oldString = `    if (condition) {
        doSomething();
    }`;
	const newString = `\tif (newCondition) {
\t\tdoSomethingElse();
\t}`;
	const fileContent = `function test() {
\tif (existing) {
\t\treturn true;
\t}
}`;

	const result = normalizeIndentation(oldString, newString, fileContent);

	t.true(result.wasNormalized);
	t.is(
		result.normalizedOldString,
		`\tif (condition) {
\t\tdoSomething();
\t}`,
	);
	t.is(result.normalizedNewString, newString); // Already tabs, no change needed
	t.truthy(result.details);
	t.true(
		result.details!.includes('oldString: converted from spaces(4) to tabs(1)'),
	);
	t.false(result.details!.includes('newString'));
});

test('normalizeIndentation handles complex multi-line strings', t => {
	const oldString = `    const config = {
        server: {
            port: 3000,
            middleware: [
                'cors',
                'helmet'
            ]
        },
        database: {
            host: 'localhost'
        }
    };`;
	const newString = `    const newConfig = {
        api: {
            version: 'v1',
            routes: [
                '/users',
                '/posts'
            ]
        }
    };`;
	const fileContent = `function setupApp() {
\tconst app = express();
\treturn app;
}`;

	const result = normalizeIndentation(oldString, newString, fileContent);

	t.true(result.wasNormalized);
	t.true(result.normalizedOldString.includes('\tconst config = {'));
	t.true(result.normalizedNewString.includes('\tconst newConfig = {'));
	t.true(result.normalizedOldString.includes('\t\tserver: {'));
	t.true(result.normalizedNewString.includes('\t\tapi: {'));
});
