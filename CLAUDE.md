# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

- **Build**: `npm run build` - Compiles TypeScript to `dist/` directory
- **Development**: `npm run dev` - Runs TypeScript compiler in watch mode
- **Test/Lint**: `npm run test` - Runs prettier, xo linter, and ava tests. If you have made changes, run `npm run fix` before running the tests
- **Fix** `npm run fix` - Runs prettier and xo with flags to fix formatting and linting errors

## Architecture Overview

Dual-mode CLI for Mistral AI's API with framework-agnostic core:

1. **Interactive Mode**: React/Ink terminal UI with streaming
2. **Print Mode**: UNIX tool for scripting

**Core Flow**: Mistral API client → ToolExecutionManager (permission checks) → ToolManager/McpManager (execution) → response (streaming or final)

### Key Modules

**Services** (framework-agnostic):
- `ConversationService`: Conversation engine with tool execution delegation
- `MistralService`: API client with configurable model (default: `mistral-medium-2508`)
- `ToolManager`: Built-in tool registration and execution
- `McpManager`: MCP server integration and tool coordination
- `ToolExecutionManager`: Permission checking and synthetic message generation
- `PermissionStorage`: Session-based tool permissions (in-memory)
- `SecretsService`: API key storage via system keychain

**Commands**: Slash commands via `CommandHandler` - `/help`, `/usage`, `/logout`, `/exit` (`/quit`), `/settings`, `/clear`

**Adapters**:
- `react-callbacks.ts`: React state bridge for interactive mode
- `print-callbacks.ts`: Output capture for print mode

**Utils**: `converters.ts` (Mistral ↔ MCP), `file-operations.ts` (shared edit logic), `custom-instructions.ts` (AGENTS.md loading)

### Built-in Tools

Tools in `source/tools/`, managed by `ToolManager`:

- **bash**: Execute shell commands with timeout/background support
- **edit**: String replacement in files (uses `file-operations.ts`)
- **multi-edit**: Sequential edits (uses `file-operations.ts`)
- **read**: Read files with offset/limit
- **write**: Create/overwrite files
- **glob**: Find files by pattern
- **grep**: Search file contents
- **ls**: List directories (respects .gitignore)
- **todo-write**: Task tracking (stored in ToolManager)
- **webfetch**: HTTP GET requests

### MCP Integration

**McpManager** (`source/services/mcp-manager.ts`) coordinates built-in tools (via ToolManager) and external MCP servers. Maps tools to servers, routes `callTool()` requests, converts between Mistral and MCP formats via `converters.ts`.

**McpClient** (`source/services/mcp-client.ts`) handles individual MCP server connections.

### File Operations (`source/utils/file-operations.ts`)

Shared utility for `edit` and `multi-edit` tools providing path validation, file I/O, string replacement, and edit workflows. Both tools use these utilities while maintaining distinct interfaces (edit: single operations with uniqueness validation; multi-edit: sequential operations, no file creation).

### Todo System

**TodoWrite tool** tracks tasks with states: `pending`, `in_progress`, `completed`. Only one task can be `in_progress` at once. Stored in ToolManager memory.

**Auto-injection**: `ConversationService.injectTodoContext()` adds current todos to user messages in `<system-reminder>` tags before API calls.

**Display** (`source/utils/app-utils.ts`): ☐ pending, ☐ **in progress**, ☑ ~completed~

### Tool Permissions

**ToolExecutionManager** checks permissions before execution. Safe tools (read-only: `glob`, `grep`, `ls`, `read`, `todo-write`, `webfetch`) auto-execute. Unsafe tools (`bash`, `edit`, `multi-edit`, `write`) require permission in interactive mode.

**Options**: "Just this time" or "For this session" (stored in-memory via PermissionStorage).

**Batch handling**: Denying one unsafe tool rejects all in batch.

**Synthetic messages**: Generates tool results for denied tools to maintain API conversation structure.

**Print mode**: Auto-executes all tools (no prompts).

### ESC Interrupts

**ConversationService** handles ESC key interrupts during API streaming (AbortController) and between tool executions (`callbacks.onInterruptionCheck()`).

**Synthetic messages**: Generates tool result messages ("Interrupted by user") and assistant acknowledgment to maintain API conversation structure.

**Methods**: `handleInterruption()`, `generateInterruptedToolMessages()`

### Callback Architecture

**Types** (`source/types/`): `callbacks.ts` (generic interfaces), `mistral.ts` (API types), `mcp.ts` (protocol types)

**ConversationCallbacks**: `onError`, `onHistoryUpdate`, `onMessagesUpdate`, `onAbortControllerCreate`, loading/progress callbacks

**CommandCallbacks**: `addToHistory`, `updateMessages`, `logAndExit`, `usage`, `openSettings`

Adapters bridge callbacks to React state (interactive) or output capture (print).

### Usage Modes

**Interactive** (default): `mistrado [prompt]` - React/Ink UI, streaming, ESC interrupts, tool permissions, slash commands, keychain API key storage

**Print**: `mistrado -p [prompt]` or stdin - UNIX tool, exit codes, SIGPIPE handling, env var API key only (`MISTRAL_API_KEY`), final output only

### Coding Patterns

- Framework-agnostic core via callback adapters
- Types over interfaces
- Boolean props: `isLoading` not `loading`
- Conversation history as `MistralMessage[]` with system prompt injection
- Streaming responses with real-time updates (interactive)
- Tool results fed back for AI followup

### System Prompt & Custom Instructions

**System prompt** (`source/prompts/system.ts`): Configures AI as "Mistrado" - concise responses, `file_path:line_number` references, security-focused

**AGENTS.md**: Project-specific instructions loaded from working directory, appended to system prompt under "## Custom Instructions". Loaded by `loadCustomInstruction()` in `source/utils/custom-instructions.ts`
