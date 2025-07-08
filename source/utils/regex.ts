type GlobToRegexOptions = {
	extended?: boolean;
	globstar?: boolean;
	flags?: string;
};

type ProcessorState = {
	regexString: string;
	inGroup: boolean;
	extended: boolean;
	globstar: boolean;
};

function escapeRegexCharacter(character: string): string {
	return '\\' + character;
}

function processQuestionMark(state: ProcessorState): string {
	return state.extended ? '.' : '';
}

function processBrackets(character: string, state: ProcessorState): string {
	return state.extended ? character : '';
}

function processOpenBrace(state: ProcessorState): {
	result: string;
	inGroup: boolean;
} {
	if (state.extended) {
		return {result: '(', inGroup: true};
	}

	return {result: '', inGroup: state.inGroup};
}

function processCloseBrace(state: ProcessorState): {
	result: string;
	inGroup: boolean;
} {
	if (state.extended) {
		return {result: ')', inGroup: false};
	}

	return {result: '', inGroup: state.inGroup};
}

function processComma(state: ProcessorState): string {
	if (state.inGroup) {
		return '|';
	}

	return String.raw`\,`;
}

function processWildcard(
	glob: string,
	index: number,
	state: ProcessorState,
): {result: string; newIndex: number} {
	const previousCharacter = glob[index - 1];
	let starCount = 1;
	let currentIndex = index;

	while (glob[currentIndex + 1] === '*') {
		starCount++;
		currentIndex++;
	}

	const nextCharacter = glob[currentIndex + 1];

	if (state.globstar) {
		const isGlobstar =
			starCount > 1 &&
			(previousCharacter === '/' || previousCharacter === undefined) &&
			(nextCharacter === '/' || nextCharacter === undefined);

		if (isGlobstar) {
			return {
				result: '((?:[^/]*(?:/|$))*)',
				newIndex: currentIndex + 1,
			};
		}

		return {result: '([^/]*)', newIndex: currentIndex};
	}

	return {result: '[^/]*', newIndex: currentIndex};
}

export function globToRegex(
	glob: string,
	options: GlobToRegexOptions = {},
): RegExp {
	if (typeof glob !== 'string') {
		throw new TypeError('Expected a string');
	}

	const {extended = false, globstar = false} = options;
	const flags = options.flags ?? '';

	const state: ProcessorState = {
		regexString: '',
		inGroup: false,
		extended,
		globstar,
	};

	const regexSpecialChars = new Set([
		'/',
		'$',
		'^',
		'+',
		'.',
		'(',
		')',
		'=',
		'!',
		'|',
	]);

	for (let i = 0; i < glob.length; i++) {
		const character = glob[i];

		if (character && regexSpecialChars.has(character)) {
			state.regexString += escapeRegexCharacter(character);
		} else
			switch (character) {
				case undefined: {
					break;
				}

				case '?': {
					state.regexString += processQuestionMark(state);

					break;
				}

				case '[':
				case ']': {
					state.regexString += processBrackets(character, state);

					break;
				}

				case '{': {
					const {result, inGroup} = processOpenBrace(state);
					state.regexString += result;
					state.inGroup = inGroup;

					break;
				}

				case '}': {
					const {result, inGroup} = processCloseBrace(state);
					state.regexString += result;
					state.inGroup = inGroup;

					break;
				}

				case ',': {
					state.regexString += processComma(state);

					break;
				}

				case '*': {
					const {result, newIndex} = processWildcard(glob, i, state);
					state.regexString += result;
					i = newIndex;

					break;
				}

				default: {
					if (character !== undefined) {
						state.regexString += character;
					}
				}
			}
	}

	if (!flags?.includes('g')) {
		state.regexString = '^' + state.regexString + '$';
	}

	return new RegExp(state.regexString, flags);
}
