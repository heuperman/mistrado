# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

- **Build**: `npm run build` - Compiles TypeScript to `dist/` directory
- **Development**: `npm run dev` - Runs TypeScript compiler in watch mode
- **Test/Lint**: `npm run test` - Runs prettier, xo linter, and ava tests. If you have made changes, run `npm run fix` before running the tests
- **Fix** `npm run fix` - Runs prettier and xo with flags to fix formatting and linting errors

## Architecture Overview

This is a dual-mode CLI application that provides both interactive and non-interactive interfaces to Mistral AI's API:

1. **Interactive Mode**: Ink-based React UI for terminal-based conversations
2. **Print Mode**: UNIX-standard tool for scripting and automation

The application uses a **framework-agnostic core** with adapters for different environments.

### Core Flow

The app initializes two main systems concurrently:

1. **Mistral API client** - for AI conversations
2. **Tool Manager** - provides built-in filesystem and search tools

When users submit prompts, the app:

1. Sends message + available tools to Mistral API
2. If AI responds with tool calls, executes them via Tool Manager
3. Returns tool results to continue the conversation
4. Displays responses (streaming in interactive mode, final output in print mode)

### Modular Architecture

The codebase follows a modular architecture with clear separation of concerns:

#### Core Components

- **App** (`source/app.tsx`): Lightweight orchestration component that coordinates hooks, services, and user interactions
- **CLI Entry** (`source/cli.tsx`): Simple entry point that renders the App component
- **Conversation** (`source/components/conversation.tsx`): Reusable component for displaying conversation history with message type styling
- **Login** (`source/components/login.tsx`): Secure API key input and storage interface
- **Hero** (`source/components/hero.tsx`): Welcome/branding display
- **Loading** (`source/components/loading.tsx`): Loading indicator with token progress display
- **Markdown** (`source/components/markdown.tsx`): Markdown rendering component

#### Custom Hooks

- **useAppState** (`source/hooks/use-app-state.ts`): Centralized state management for services, conversation, loading states, and initialization logic
- **useSignalHandler** (`source/hooks/use-signal-handler.ts`): Process signal handling (SIGINT/SIGTERM) and graceful shutdown coordination

#### Services Layer (Framework-Agnostic Core)

- **ConversationService** (`source/services/conversation-service.ts`): Framework-agnostic conversation engine using generic callback interfaces. Handles AI interactions, tool calling, and conversation flow
- **MistralService** (`source/services/mistral-service.ts`): Manages Mistral AI client and streaming responses using configurable model (defaults to `mistral-medium-2508`)
- **ToolManager** (`source/services/tool-manager.ts`): Manages built-in tools, handles tool registration and execution
- **SecretsService** (`source/services/secrets-service.ts`): Secure API key storage via system keychain (keytar)

#### Command System

- **CommandHandler** (`source/commands/command-handler.ts`): Framework-agnostic command handling using generic callback interfaces

#### Framework Adapters

- **React Callbacks** (`source/adapters/react-callbacks.ts`): Bridges React state setters to generic callback interfaces for interactive mode
- **Print Callbacks** (`source/adapters/print-callbacks.ts`): Captures output and manages error state for UNIX tool usage in print mode

#### Mode Implementations

- **Interactive Mode** (`source/app.tsx`): Full React-based UI with streaming responses and real-time interaction
- **Print Mode** (`source/modes/print-mode.ts`): UNIX-standard CLI tool that outputs final results to stdout

#### Utilities

- **App Utils** (`source/utils/app-utils.ts`): Shared utility functions like git repository detection
- **Converters** (`source/utils/converters.ts`): Bidirectional conversion between Mistral and MCP formats
- **Git** (`source/utils/git.ts`): Git repository utilities
- **Gitignore** (`source/utils/gitignore.ts`): Gitignore parsing and matching
- **Paths** (`source/utils/paths.ts`): Path utilities and resolution
- **Regex** (`source/utils/regex.ts`): Regular expression utilities
- **Validation** (`source/utils/validation.ts`): Input validation utilities
- **Stdin** (`source/utils/stdin.ts`): Handle stdin input for UNIX tool piping with TTY detection
- **Version** (`source/utils/version.ts`): Read version from package.json for CLI version display
- **Error Handling** (`source/utils/error-handling.ts`): UNIX signal handling (SIGPIPE, SIGINT, SIGTERM) for graceful shutdown

### Built-in Tool System

The app uses a **ToolManager** service (`source/services/tool-manager.ts`) that provides filesystem operation, search, task management, and web tools:

- **edit**: String replacement in files
- **glob**: File search by glob pattern
- **grep**: Content search by regex pattern
- **ls**: Directory listing with glob ignore patterns
- **multi-edit**: Multiple edits in sequence
- **read**: File content reading with offset/limit
- **todo-write**: Task management and progress tracking
- **webfetch**: HTTP GET requests to fetch web content
- **write**: File creation/overwriting

Tool implementations are in `source/tools/` with each tool having its own file (e.g., `edit.ts`, `read.ts`, `grep.ts`, `web-fetch.ts`, `todo-write.ts`).

### File Operations System

The edit and multi-edit tools share common file manipulation logic through a centralized utility module.

#### Shared File Operations Utility (`source/utils/file-operations.ts`)

**Purpose**: Provides a unified, well-tested foundation for all file editing operations across the application.

**Core Functions**:

- **Path Validation**: Ensures file paths are absolute and properly formatted
- **File Existence**: Validates files exist before attempting operations
- **File I/O**: Handles reading and writing with proper error handling and UTF-8 encoding
- **String Replacement**: Performs single and multiple string replacements with regex escaping
- **Edit Operations**: Complete edit workflows (read → validate → edit → write)

**Key Features**:

- **Consistent Error Handling**: Uniform error messages and validation across all edit tools
- **Type Safety**: Full TypeScript typing for all operations and return values
- **Comprehensive Testing**: Isolated testing of core file operations independent of tool interfaces
- **Reusability**: Shared logic reduces duplication between edit and multi-edit tools

**Integration**: Both `edit` and `multi-edit` tools use these utilities while maintaining their distinct interfaces:

- **Edit Tool**: Single operations with uniqueness validation for non-replaceAll operations
- **Multi-Edit Tool**: Sequential operations on existing files only (no file creation)

### Todo Management System

The application includes a comprehensive todo management system to help track progress during coding sessions:

#### TodoWrite Tool (`source/tools/todo-write.ts`)

**Purpose**: Enables the AI to create and manage structured task lists, providing users with visibility into complex multi-step work and helping maintain focus on current objectives.

**Key Features**:

- **Task States**: `pending`, `in_progress`, `completed`
- **Business Rules**: Only one task can be `in_progress` at a time
- **Session Persistence**: Todos are maintained per session in memory
- **Visual Feedback**: Real-time display of task progress in the terminal

**Usage Pattern**:

- AI proactively creates todos for complex tasks (3+ steps)
- Updates task status as work progresses
- Marks tasks complete immediately upon finishing
- Provides progress summaries (e.g., "3/5 tasks completed")

#### Todo Context Injection (`source/services/conversation-service.ts`)

**Automatic Context**: Every user message automatically includes current todo state as context for the AI:

```
User: "Help me fix the authentication bug"

<system-reminder>
Current todos:
☐ Set up authentication endpoints
☐ **Implement login form validation** (in progress)
☑ ~Create user database schema~
</system-reminder>
```

**Implementation**:

- **Where**: `injectTodoContext()` method in ConversationService
- **When**: Before every API call to Mistral
- **Format**: `<system-reminder>` tags wrap todo context
- **Logic**: Only injects if the latest message is from the user (prevents duplication during tool calls)

#### Todo Display (`source/utils/app-utils.ts`)

**Visual Formatting**:

- `☐ Task content` - Pending tasks
- `☐ **Task content** (in progress)` - Active tasks
- `☑ ~Task content~` - Completed tasks (strikethrough)

**Tool Call Display**: When TodoWrite is invoked, shows current todos being updated:

```
**TodoWrite**
☐ Research existing patterns
☐ **Implement new feature** (in progress)
☑ ~Set up project structure~
```

#### Benefits

- **Continuous Awareness**: AI always knows current task state
- **Progress Tracking**: Visual indicators of work completion
- **Focus Management**: Prevents context loss during complex tasks
- **User Transparency**: Clear visibility into AI's task planning and execution

### Tool Permission System (Work in Progress)

The application includes a permission system that prompts users before executing tools in interactive mode while maintaining automatic execution in print mode.

#### Current Implementation

**Permission Flow**:

- When AI requests tool execution, users are prompted individually for each **unsafe** tool
- **Safe Tool Allowlist**: Read-only tools (`glob`, `grep`, `ls`, `read`, `todo-write`) execute without permission prompts
- **Fail-fast batch strategy**: If any unsafe tool in a multi-tool request is denied, all tools are rejected
- **Allowlist Design**: New tools automatically require permissions unless explicitly added to the safe list
- Synthetic rejection messages maintain proper Mistral API conversation structure
- Print mode continues to auto-execute tools without permission prompts

**Core Components**:

- **ToolExecutionManager** (`source/services/tool-execution-manager.ts`): Handles permission checking and synthetic message generation
- **ToolPermission** (`source/components/ToolPermission.tsx`): UI component for Yes/No permission prompts
- **ConversationService** (`source/services/conversation-service.ts`): Integrates permission flow with conversation handling

**Message Flow Integrity**: The system ensures proper API conversation structure by generating synthetic tool result messages and assistant acknowledgments when tools are denied, preventing API errors from missing tool responses.

#### Planned Enhancements

- **Permission Storage**: Persist user tool permissions across sessions
- **Permission Management**: Allow users to view and edit stored permissions
- **Enhanced Information**: Provide more detailed tool information during permission requests (parameters, affected files, etc.)
- **Batch Permission Options**: Allow users to approve/deny entire tool batches at once

### Interrupt Handling System

The application provides ESC key interrupt functionality that allows users to stop running operations while maintaining conversation integrity.

#### Implementation (`source/services/conversation-service.ts`)

**Interrupt Detection**: The system checks for interruptions at key points:

- During API streaming responses (via AbortController)
- Between tool call executions (`callbacks.onInterruptionCheck()`)

**Synthetic Message Injection**: When an interruption occurs, the system injects synthetic messages to maintain proper API conversation flow:

1. **Tool Result Messages**: For interrupted tool calls, generates synthetic tool result messages with "Interrupted by user" content and proper `toolCallId` mapping
2. **Assistant Acknowledgment**: Adds synthetic assistant message with "Process interrupted by user." to complete the conversation turn
3. **Dual History Updates**:
   - Updates API conversation history (`callbacks.onMessagesUpdate()`) with synthetic messages for proper call/response pairing
   - Updates user-visible conversation history (`callbacks.onHistoryUpdate()`) with interruption acknowledgment

**Key Methods**:

- `handleInterruption()`: Coordinates synthetic message generation and history updates
- `generateInterruptedToolMessages()`: Creates synthetic tool result messages for incomplete tool calls

**Purpose**: This dual-message approach ensures that:

- API conversation history maintains proper structure (every tool call has a corresponding tool result)
- Users receive clear feedback about the interruption
- Future API calls can continue normally without conversation state corruption

### Framework-Agnostic Type System

- **Callback Types** (`source/types/callbacks.ts`): Generic callback interfaces for conversation and command handling
- **Mistral Types** (`source/types/mistral.ts`): Mistral API message and tool types
- **MCP Types** (`source/types/mcp.ts`): MCP protocol types for tool definitions

#### Callback Architecture

The application uses a **generic callback system** that enables the same core logic to work in multiple environments:

**ConversationCallbacks**: Framework-agnostic interface for conversation handling

- `onError`: Error handling
- `onHistoryUpdate`: Conversation history updates
- `onMessagesUpdate`: Message state updates (optional for non-stateful environments)
- `onAbortControllerCreate`: Abort controller creation for interruptions
- Optional callbacks for loading states, token progress, usage tracking

**CommandCallbacks**: Framework-agnostic interface for command handling

- `addToHistory`: Add entries to conversation history
- `updateMessages`: Update message state
- `logAndExit`: Handle application exit with logging
- `usage`: Access to token usage data
- `openSettings`: Settings panel access (optional)

**Adapter Pattern**: Environment-specific adapters implement these interfaces:

- **React Adapter**: Bridges to React state setters and hooks
- **Print Adapter**: Captures output for UNIX tool usage

### Usage Modes

#### Interactive Mode (Default)

Start the CLI without flags to enter interactive mode:

```bash
mistrado

# Or start with an initial prompt
mistrado "Help me understand this codebase"
```

Features:

- Full React-based terminal UI with Ink
- Real-time streaming responses
- ESC key interrupt handling
- Slash commands (`/help`, `/usage`, `/logout`, `/exit`, `/quit`)
- API key storage via system keychain
- Session state management
- Initial prompt support via command line argument

#### Print Mode (UNIX Tool)

Use the `-p/--print` flag for non-interactive usage:

```bash
# With command line argument
MISTRAL_API_KEY=your_key mistrado -p "What is 2+2?"

# With stdin piping
echo "Write a haiku about coding" | MISTRAL_API_KEY=your_key mistrado -p

# Help and version
mistrado -h
mistrado -v
```

Features:

- UNIX-standard CLI behavior (stdin/stdout/stderr)
- Proper exit codes (0 for success, 1 for failure)
- SIGPIPE handling for piped output
- Environment variable API key only (no keychain storage)
- Same conversation engine and tools as interactive mode
- Final output only (no streaming or intermediate states)
- TTY detection for stdin input validation

### Key Patterns

- **Framework-Agnostic Core**: Conversation engine works in any environment via callback adapters
- **Adapter Pattern**: Environment-specific adapters bridge core logic to UI frameworks
- **Separation of Concerns**: Each module has a single, well-defined responsibility
- **Generic Callback Interfaces**: Enable same core logic across React UI and UNIX tool
- **Custom React Hooks**: Encapsulate complex state logic and side effects (interactive mode only)
- **React Component Composition**: Reusable components with readonly props following React best practices
- **Centralized State Management**: useAppState hook manages all application state in one place
- **Streaming responses** from Mistral API with real-time UI updates (interactive mode)
- **Conversation history** maintained as `MistralMessage[]` array with system prompt injection
- **Graceful shutdown** handling via signal handlers
- **Tool execution results** fed back into conversation for AI followup
- **Prefer types over interfaces** for type definitions
- **Boolean prop naming**: Use `isLoading` instead of `loading` for clarity
- **ESC interrupt handling**: Users can interrupt running operations (API calls and tool execution) by pressing ESC key in interactive mode

### System Prompt

The system prompt (`source/prompts/system.ts`) configures the AI as "Mistrado" with specific behavior patterns:

- Concise responses (≤4 lines unless detail requested)
- Direct answers without preamble/postamble
- File path references with `file_path:line_number` format
- Security-focused (refuse malicious code requests)
- Custom instructions support via AGENTS.md file

### Custom Instructions (AGENTS.md)

The application supports project-specific custom instructions through an `AGENTS.md` file in the working directory:

- **File Location**: `AGENTS.md` in the project root directory
- **Loading**: Automatically detected and loaded during app initialization (`source/hooks/use-app-state.ts:85`)
- **Integration**: Content appended to system prompt under "## Custom Instructions" section
- **Utility Function**: `loadCustomInstruction()` in `source/utils/custom-instructions.ts`
- **Behavior**:
  - Returns `undefined` if file doesn't exist or is empty/whitespace-only
  - Safely handles file read errors
  - Trims whitespace from content
- **Use Cases**: Project-specific coding standards, architectural guidelines, testing requirements, or contextual information

### Security Notes

- API keys stored securely via keytar (system keychain)
- No API keys or secrets should be committed to the repository
- System prompt includes malicious code detection and refusal
