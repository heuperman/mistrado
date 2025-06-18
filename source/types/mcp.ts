export type McpServer = {
	name: string;
	command: string;
	args: string[];
};

type McpTool = {
	name: string;
	description?: string;
	inputSchema: {
		type: 'object';
		properties?: Record<string, unknown>;
	};
};

export type McpListToolsResult = {
	tools: McpTool[];
	nextCursor?: string;
};

export type McpCallToolRequest = {
	name: string;
	arguments?: Record<string, unknown>;
};

type McpTextContent = {
	type: 'text';
	text: string;
};

type McpImageContent = {
	type: 'image';
	data: string;
	mimeType: string;
};

type McpResourceContent = {
	type: 'resource';
	resource:
		| {
				text: string;
				uri: string;
				mimeType?: string;
		  }
		| {blob: string; uri: string; mimeType?: string};
};

// Add support for additional content types from MCP SDK
type McpAudioContent = {
	type: 'audio';
	data: string;
	mimeType: string;
};

type McpContent =
	| McpTextContent
	| McpImageContent
	| McpResourceContent
	| McpAudioContent;

export type McpCallToolResult =
	| {
			content: McpContent[];
			isError?: boolean;
	  }
	| {toolResult?: unknown};
