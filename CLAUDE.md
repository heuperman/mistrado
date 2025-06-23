# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

- **Build**: `npm run build` - Compiles TypeScript to `dist/` directory
- **Development**: `npm run dev` - Runs TypeScript compiler in watch mode
- **Test/Lint**: `npm run test` - Runs prettier, xo linter, and ava tests

## Architecture Overview

This is an Ink-based CLI application that provides a conversational interface to Mistral AI's API. The application uses React components to render a terminal UI and integrates with MCP (Model Context Protocol) to provide filesystem tools.

### Core Flow

The app initializes three main systems concurrently:
1. **Mistral API client** - for AI conversations
2. **MCP Manager** - coordinates multiple MCP servers for tool execution
3. **Built-in Tool Server** - provides filesystem operations (read, write, edit, ls, multi-edit)

When users submit prompts, the app:
1. Sends message + available MCP tools to Mistral API
2. If AI responds with tool calls, executes them via MCP Manager
3. Returns tool results to continue the conversation
4. Displays streaming responses in real-time terminal UI

### Key Components

- **App** (`source/app.tsx`): Main React component managing conversation state, API key handling, and coordinating between Mistral service and MCP tools. Handles graceful shutdown via SIGINT/SIGTERM signals
- **CLI Entry** (`source/cli.tsx`): Simple entry point that renders the App component
- **Login** (`source/components/login.tsx`): Secure API key input and storage interface
- **Hero** (`source/components/hero.tsx`): Welcome/branding display

### Services Layer

- **MistralService** (`source/services/mistral-service.ts`): Manages Mistral AI client and streaming responses using `devstral-small-2505` model
- **McpManager** (`source/services/mcp-manager.ts`): Orchestrates multiple MCP servers, maps tools to servers, handles parallel tool execution
- **McpClient** (`source/services/mcp-client.ts`): Individual MCP server connection management with stdio transport
- **SecretsService** (`source/services/secrets-service.ts`): Secure API key storage via system keychain (keytar)

### MCP Tool Integration

The app runs a built-in **ToolServer** (`source/tools/tool-server.ts`) that provides filesystem operations:
- **edit**: String replacement in files
- **multi-edit**: Multiple edits in sequence 
- **read**: File content reading with offset/limit
- **write**: File creation/overwriting
- **ls**: Directory listing with glob ignore patterns

Tool handlers are in `source/tools/handlers/` and use MCP protocol for communication.

### Type System & Converters

- **Mistral Types** (`source/types/mistral.ts`): Mistral API message and tool types
- **MCP Types** (`source/types/mcp.ts`): MCP protocol types for servers and tools
- **Converters** (`source/utils/converters.ts`): Bidirectional conversion between Mistral and MCP formats

### Key Patterns

- React hooks for state management (conversation history, loading states, errors)
- Streaming responses from Mistral API with real-time UI updates
- Slash commands (`/help`, `/usage`, `/logout`, `/exit`, `/quit`) for session management
- Conversation history maintained as `MistralMessage[]` array with system prompt injection
- Graceful shutdown handling for MCP server connections
- Tool execution results fed back into conversation for AI followup
- Prefer types over interfaces for type definitions

### System Prompt

The system prompt (`source/prompts/system.ts`) configures the AI as "Mistrado" with specific behavior patterns:
- Concise responses (≤4 lines unless detail requested)
- Direct answers without preamble/postamble
- File path references with `file_path:line_number` format
- Security-focused (refuse malicious code requests)

### Security Notes

- API keys stored securely via keytar (system keychain)
- No API keys or secrets should be committed to the repository
- System prompt includes malicious code detection and refusal
