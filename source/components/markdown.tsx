import React from 'react';
import {marked, type Renderer} from 'marked';
import {Text} from 'ink';
import TerminalRenderer, {type TerminalRendererOptions} from 'marked-terminal';
import chalk from 'chalk';

export type Props = TerminalRendererOptions & {
	readonly children: string;
};

export default function Markdown({children, ...options}: Props) {
	marked.setOptions({
		// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
		renderer: new TerminalRenderer({
			heading: chalk.reset.bold,
			firstHeading: chalk.reset.bold.underline,
			showSectionPrefix: false,
			codespan: chalk.blue,
			code: chalk.blue,
			del: chalk.reset.strikethrough,
			blockquote: chalk.gray.italic,
			...options,
		}) as unknown as Renderer,
	});
	const parsedContent = marked.parse(children) as string;
	return <Text>{parsedContent.trim()}</Text>;
}
