export type MCPServer = {
	name: string;
	command: string;
	args: string[];
};

type MCPTool = {
	name: string;
	description?: string;
	inputSchema: {
		type: 'object';
		properties?: Record<string, unknown>;
	};
};

export type MCPListToolsResult = {
	tools: MCPTool[];
	nextCursor?: string;
};

export type MCPCallToolRequest = {
	name: string;
	arguments?: Record<string, unknown>;
};

type MCPTextContent = {
	type: 'text';
	text: string;
};

type MCPImageContent = {
	type: 'image';
	data: string;
	mimeType: string;
};

type MCPResourceContent = {
	type: 'resource';
	resource:
		| {
				text: string;
				uri: string;
				mimeType?: string;
		  }
		| {blob: string; uri: string; mimeType?: string};
};

type MCPContent = MCPTextContent | MCPImageContent | MCPResourceContent;

export type MCPCallToolResult =
	| {
			content: MCPContent[];
			isError?: boolean;
	  }
	| {toolResult?: unknown};
