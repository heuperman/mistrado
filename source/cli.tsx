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
	.option('-p, --print', 'Print mode: run single prompt and output result')
	.argument('[prompt]', 'Prompt text (when using --print)')
	.helpOption('-h, --help', 'Display help information');

program.parse();

const options = program.opts();
const {args} = program;

if (options['print']) {
	// Non-interactive mode - reuse existing services
	await handlePrintMode(args[0]);
} else {
	// Interactive mode (existing behavior)
	setTerminalTitle('≋ Mistrado');
	render(
		<React.StrictMode>
			<App />
		</React.StrictMode>,
		{exitOnCtrlC: false},
	);
}
