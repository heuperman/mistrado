#!/usr/bin/env node
import React from 'react';
import {render} from 'ink';
import App from './app.js';
import {setTerminalTitle} from './utils/terminal.js';

setTerminalTitle('≋ Mistrado');

render(
	<React.StrictMode>
		<App />
	</React.StrictMode>,
	{exitOnCtrlC: false},
);
