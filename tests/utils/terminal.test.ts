import {stdout} from 'node:process';
import test from 'ava';
import {setTerminalTitle} from '../../source/utils/terminal.js';

// Store original stdout properties
const originalWrite = stdout.write.bind(stdout);
const originalIsTty = stdout.isTTY;

// Helper function to create isolated mock for each test
function createIsolatedMock() {
	let writtenData = '';
	const mockWrite = (data: string | Uint8Array) => {
		writtenData += data.toString();
		return true;
	};

	return {
		writtenData: () => writtenData,
		mockWrite,
		setup() {
			stdout.write = mockWrite;
		},
		teardown() {
			stdout.write = originalWrite;
			stdout.isTTY = originalIsTty;
		},
	};
}

test('setTerminalTitle writes escape sequence when stdout is TTY', t => {
	const mock = createIsolatedMock();
	mock.setup();

	try {
		// Mock TTY environment
		stdout.isTTY = true;

		setTerminalTitle('Test Title');

		// Should write the OSC escape sequence for setting terminal title
		const expectedSequence = '\u001B]2;Test Title\u0007';
		t.is(mock.writtenData(), expectedSequence);
	} finally {
		mock.teardown();
	}
});

test('setTerminalTitle does not write when stdout is not TTY', t => {
	const mock = createIsolatedMock();
	mock.setup();

	try {
		// Mock non-TTY environment
		stdout.isTTY = false;

		setTerminalTitle('Test Title not TTY');

		// Should not write anything when not in TTY
		t.is(mock.writtenData(), '');
	} finally {
		mock.teardown();
	}
});

test('setTerminalTitle handles empty string title', t => {
	const mock = createIsolatedMock();
	mock.setup();

	try {
		stdout.isTTY = true;

		setTerminalTitle('');

		const expectedSequence = '\u001B]2;\u0007';
		t.is(mock.writtenData(), expectedSequence);
	} finally {
		mock.teardown();
	}
});

test('setTerminalTitle handles title with spaces', t => {
	const mock = createIsolatedMock();
	mock.setup();

	try {
		stdout.isTTY = true;

		setTerminalTitle('Multi Word Title');

		const expectedSequence = '\u001B]2;Multi Word Title\u0007';
		t.is(mock.writtenData(), expectedSequence);
	} finally {
		mock.teardown();
	}
});

test('setTerminalTitle handles title with special characters', t => {
	const mock = createIsolatedMock();
	mock.setup();

	try {
		stdout.isTTY = true;

		setTerminalTitle('Title with "quotes" and symbols: @#$%');

		const expectedSequence =
			'\u001B]2;Title with "quotes" and symbols: @#$%\u0007';
		t.is(mock.writtenData(), expectedSequence);
	} finally {
		mock.teardown();
	}
});

test('setTerminalTitle handles title with newlines', t => {
	const mock = createIsolatedMock();
	mock.setup();

	try {
		stdout.isTTY = true;

		setTerminalTitle('Title\nwith\nnewlines');

		const expectedSequence = '\u001B]2;Title\nwith\nnewlines\u0007';
		t.is(mock.writtenData(), expectedSequence);
	} finally {
		mock.teardown();
	}
});

test('setTerminalTitle handles title with unicode characters', t => {
	const mock = createIsolatedMock();
	mock.setup();

	try {
		stdout.isTTY = true;

		setTerminalTitle('Title with émojis 🚀 and unicode ñ');

		const expectedSequence =
			'\u001B]2;Title with émojis 🚀 and unicode ñ\u0007';
		t.is(mock.writtenData(), expectedSequence);
	} finally {
		mock.teardown();
	}
});

test('setTerminalTitle handles very long title', t => {
	const mock = createIsolatedMock();
	mock.setup();

	try {
		stdout.isTTY = true;

		const longTitle = 'A'.repeat(1000);
		setTerminalTitle(longTitle);

		const expectedSequence = `\u001B]2;${longTitle}\u0007`;
		t.is(mock.writtenData(), expectedSequence);
	} finally {
		mock.teardown();
	}
});

test('setTerminalTitle is called multiple times in TTY environment', t => {
	const mock = createIsolatedMock();
	mock.setup();

	try {
		stdout.isTTY = true;

		setTerminalTitle('First Title');
		setTerminalTitle('Second Title');

		// Should contain both escape sequences
		const expectedData =
			'\u001B]2;First Title\u0007\u001B]2;Second Title\u0007';
		t.is(mock.writtenData(), expectedData);
	} finally {
		mock.teardown();
	}
});

test('setTerminalTitle mixed TTY and non-TTY calls', t => {
	const mock = createIsolatedMock();
	mock.setup();

	try {
		// First call with TTY
		stdout.isTTY = true;
		setTerminalTitle('TTY Title');

		// Second call without TTY
		stdout.isTTY = false;
		setTerminalTitle('Non-TTY Title');

		// Should only contain the first call's output
		const expectedSequence = '\u001B]2;TTY Title\u0007';
		t.is(mock.writtenData(), expectedSequence);
	} finally {
		mock.teardown();
	}
});

test('setTerminalTitle escape sequence format is correct', t => {
	const mock = createIsolatedMock();
	mock.setup();

	try {
		stdout.isTTY = true;

		setTerminalTitle('Format Test');

		// Verify the exact format of the escape sequence
		// \u001B is ESC (0x1B)
		// ]2; is the OSC (Operating System Command) sequence for setting title
		// \u0007 is BEL (0x07) which terminates the sequence
		const writtenData = mock.writtenData();
		t.true(writtenData.startsWith('\u001B]2;'));
		t.true(writtenData.endsWith('\u0007'));
		t.true(writtenData.includes('Format Test'));
	} finally {
		mock.teardown();
	}
});

test('setTerminalTitle handles null and undefined isTTY', t => {
	const mock = createIsolatedMock();
	mock.setup();

	try {
		// Test with undefined isTTY
		stdout.isTTY = undefined as unknown as boolean;
		setTerminalTitle('Undefined TTY');
		t.is(mock.writtenData(), '');

		// Reset mock data for next test
		const mock2 = createIsolatedMock();
		mock2.setup();

		try {
			// Test with null isTTY
			stdout.isTTY = null as unknown as boolean;
			setTerminalTitle('Null TTY');
			t.is(mock2.writtenData(), '');
		} finally {
			mock2.teardown();
		}
	} finally {
		mock.teardown();
	}
});

test('setTerminalTitle handles falsy isTTY values', t => {
	const falsyValues = [false, 0, '', null, undefined];

	for (const falsyValue of falsyValues) {
		const mock = createIsolatedMock();
		mock.setup();

		try {
			stdout.isTTY = falsyValue as unknown as boolean;
			setTerminalTitle('Falsy Test');
			t.is(mock.writtenData(), '', `Failed for falsy value: ${falsyValue}`);
		} finally {
			mock.teardown();
		}
	}
});
