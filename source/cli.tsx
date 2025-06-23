#!/usr/bin/env node
import process from 'node:process';
import React from 'react';
import {render} from 'ink';
import App from './app.js';

render(<App />);

process.stdin.on('data', data => {
	if (data.toString() === '\u0003') {
		process.exit(0);
	}
});
