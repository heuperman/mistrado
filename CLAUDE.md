# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

- **Build**: `npm run build` - Compiles TypeScript to `dist/` directory
- **Development**: `npm run dev` - Runs TypeScript compiler in watch mode
- **Test/Lint**: `npm run test` - Runs prettier, xo linter, and ava tests

## Architecture Overview

This is an Ink-based CLI application that provides a conversational interface to Mistral AI's API. The application uses React components to render a terminal UI and provides built-in filesystem and search tools.

### Core Flow

The app initializes two main systems concurrently:

1. **Mistral API client** - for AI conversations
2. **Tool Manager** - provides built-in filesystem and search tools

When users submit prompts, the app:

1. Sends message + available tools to Mistral API
2. If AI responds with tool calls, executes them via Tool Manager
3. Returns tool results to continue the conversation
4. Displays streaming responses in real-time terminal UI

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

#### Services Layer

- **ConversationService** (`source/services/conversation-service.ts`): Handles AI interactions, tool calling, and conversation flow with callback-based architecture
- **MistralService** (`source/services/mistral-service.ts`): Manages Mistral AI client and streaming responses using configurable model (defaults to `devstral-small-latest`)
- **ToolManager** (`source/services/tool-manager.ts`): Manages built-in tools, handles tool registration and execution
- **SecretsService** (`source/services/secrets-service.ts`): Secure API key storage via system keychain (keytar)

#### Command System

- **CommandHandler** (`source/commands/command-handler.ts`): Encapsulates slash command logic, aliases, descriptions, and execution

#### Utilities

- **App Utils** (`source/utils/app-utils.ts`): Shared utility functions like git repository detection
- **Converters** (`source/utils/converters.ts`): Bidirectional conversion between Mistral and MCP formats
- **Git** (`source/utils/git.ts`): Git repository utilities
- **Gitignore** (`source/utils/gitignore.ts`): Gitignore parsing and matching
- **Paths** (`source/utils/paths.ts`): Path utilities and resolution
- **Regex** (`source/utils/regex.ts`): Regular expression utilities
- **Validation** (`source/utils/validation.ts`): Input validation utilities

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

### Indentation Normalization System

The application includes an intelligent indentation normalization system to address current AI model limitations with indentation consistency.

#### Background & Problem

AI models sometimes provide code snippets with incorrect indentation (e.g., using spaces when the target file uses tabs, or using 2 spaces when the file uses 4 spaces). This causes edit operations to fail because the provided `oldString` doesn't match the file's actual content due to indentation mismatches.

#### Solution (`source/utils/indentation-normalizer.ts`)

**Automatic Detection & Conversion**: The system automatically:

1. **Detects** the target file's indentation method (tabs, 2-space, 4-space, 8-space)
2. **Analyzes** the AI-provided strings for their indentation patterns
3. **Converts** mismatched indentation to match the target file's format
4. **Reports** when normalization occurs for transparency

**Key Features**:

- **Smart Detection**: Analyzes file content to determine predominant indentation style
- **Flexible Conversion**: Handles tabs ↔ spaces and different space sizes (2, 4, 8)
- **Edge Case Handling**: Manages mixed indentation, empty files, and irregular patterns
- **Non-Intrusive**: Only normalizes when mismatches are detected
- **Transparent Reporting**: Shows normalization details in tool output

**Integration**: Automatically enabled in `edit` and `multi-edit` tools without user configuration.

**Removal Path**: The logic is cleanly separated in its own utility module, making it easy to remove when AI model capabilities improve and this workaround is no longer needed.

### Todo Management System

The application includes a comprehensive todo management system to help track progress during coding sessions:

#### TodoWrite Tool (`source/tools/todo-write.ts`)

**Purpose**: Enables the AI to create and manage structured task lists, providing users with visibility into complex multi-step work and helping maintain focus on current objectives.

**Key Features**:

- **Task States**: `pending`, `in_progress`, `completed`
- **Priority Levels**: `high`, `medium`, `low`
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

### Type System & Converters

- **Mistral Types** (`source/types/mistral.ts`): Mistral API message and tool types
- **MCP Types** (`source/types/mcp.ts`): MCP protocol types for tool definitions

### Key Patterns

- **Separation of Concerns**: Each module has a single, well-defined responsibility
- **Custom React Hooks**: Encapsulate complex state logic and side effects
- **Callback Pattern**: ConversationService uses callbacks for loose coupling with UI state
- **React Component Composition**: Reusable components with readonly props following React best practices
- **Centralized State Management**: useAppState hook manages all application state in one place
- **Streaming responses** from Mistral API with real-time UI updates
- **Slash commands** (`/help`, `/usage`, `/logout`, `/exit`, `/quit`) for session management
- **Conversation history** maintained as `MistralMessage[]` array with system prompt injection
- **Graceful shutdown** handling via signal handlers
- **Tool execution results** fed back into conversation for AI followup
- **Prefer types over interfaces** for type definitions
- **Boolean prop naming**: Use `isLoading` instead of `loading` for clarity

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
