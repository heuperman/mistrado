#!/usr/bin/env node
import React from 'react';
import {render} from 'ink';
import {program} from 'commander';
import App from './app.js';
import {setTerminalTitle} from './utils/terminal.js';
import {handlePrintMode} from './modes/print-mode.js';
import {getVersion} from './utils/version.js';

// Set up CLI arguments
program
	.name('mistrado')
	.description('AI conversation tool powered by Mistral AI')
	.version(getVersion(), '-v, --version')
	.option('-p, --print', 'Run single prompt and print result')
	.argument(
		'[prompt]',
		'Prompt text (for print mode or as starting prompt in interactive mode)',
	)
	.helpOption('-h, --help', 'Display help information');

program.parse();

const options = program.opts();
const {args} = program;

if (options['print']) {
	// Non-interactive mode
	await handlePrintMode(args[0]);
} else {
	// Interactive mode
	setTerminalTitle('≋ Mistrado');

	const initialPrompt = args[0];

	render(
		<React.StrictMode>
			<App initialPrompt={initialPrompt} />
		</React.StrictMode>,
		{
			exitOnCtrlC: false,
		},
	);
}
