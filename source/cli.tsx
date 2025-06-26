#!/usr/bin/env node
import React from 'react';
import {render} from 'ink';
import App from './app.js';

render(
	<React.StrictMode>
		<App />
	</React.StrictMode>,
	{exitOnCtrlC: false},
);
