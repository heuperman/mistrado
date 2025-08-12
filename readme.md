# ≋ Mistrado

Mistrado is a terminal-based coding assistant powered by Mistral's AI model, (heavily) inspired by Claude Code. Use Mistral's models from the terminal to write and explain code.

I created this tool because I love the fast, cheap and capable models Mistral provides. I also love Claude Code for its excellent product features. This is my attempt to combine the two and encourage Mistral to create their own CLI tool by showing what is possible.

> [!CAUTION]
> Mistrado does not have manual tool call confirmation support yet. Tool calls requested by the model will be executed without notice. This tool can delete and rewrite local files. Use at your own risk.

## Features

- **Interactive Terminal UI**: Clean, responsive chat interface built with Ink and React.
- **Session Management**: Persistent conversation history during a session.
- **Built-in Tools**: Comprehensive filesystem operations (read, write, edit, ls, multi-edit), search capabilities (glob, grep), and task management.
- **Secure API Key Storage**: Uses system keychain (keytar) for secure credential management.
- **Custom Instructions**: Supports optional AGENTS.md file for project-specific instructions for the AI.

## Installation

```bash
npm install -g mistrado
```

## Usage

Start a session in your project directory:

```bash
mistrado
```

### First Time Setup

On your first run, you'll be prompted to enter your Mistral API key. The key is securely stored in your system keychain for future sessions.

### Commands

- `/help` - Show available commands
- `/exit` or `/quit` - Exit the application
- `/usage` - Show token usage per model
- `/logout` - Clear stored API key and exit
- `/settings` - Select the AI model to use
- `/clear` - Clear the session history

Press **ESC** to quickly stop long-running operations and regain control of the interface.

### Model Configuration

By default, Mistrado uses the `devstral-small-latest` model. You can select a different model using the `/settings` command. Settings are only applied to the current project.

### Custom Instructions

You can customize the AI's behavior for your specific project by creating an `AGENTS.md` file in your project root:

The content of `AGENTS.md` will be automatically included in the system prompt, allowing you to provide project-specific guidelines, coding standards, or context that should be applied to all interactions.

## Built-in Tools

The application includes built-in tools for filesystem operations and content search:

**Filesystem Operations:**

- `read`: File content reading with offset/limit support
- `write`: File creation and overwriting
- `edit`: String replacement in files
- `multi-edit`: Multiple sequential edits in a single operation
- `ls`: Directory listing with glob ignore patterns

**Search Tools:**

- `glob`: Find files by pattern matching (e.g., `*.js`, `**/*.ts`)
- `grep`: Search file contents using regular expressions

**Web Tools:**

- `webfetch`: Fetch content from URLs via HTTP GET requests

**Task Management:**

- `todo-write`: Create and manage structured task lists with progress tracking

These tools enable the AI to help with code analysis, file management, project exploration, web content retrieval, and task organization.

> [!CAUTION]
> Tool calls requested by the model will be executed without notice. For safety reasons there is no `bash` tool included or option to add your own MCP servers yet.

## Model Behavior

Mistrado is built specifically for use with Mistral models. It includes several features specifically to deal with the quirks of those models:

- **Tool Call Parsing**: Handling tool calls included in the response message instead of the tool calls arrays.
- **Smart Indentation Handling**: Automatic indentation normalization to handle inability to output tabs.
- **Tool Retry Discouragement**: Specific instructions encouraging the model to take a different approach when tool calls fail.

## Requirements

- Node.js 18 or higher
- Mistral API key - get one at https://console.mistral.ai/

## Development

```bash
# Install dependencies
npm install

# Development mode (watch)
npm run dev

# Build
npm run build

# Test and lint
npm run test
```

## Data collection

Mistrado only sends your requests and API key to Mistral's API. No usage or any other data is recorded.

## License

MIT

## Roadmap

There are many new features planned for Mistrado, including:

- Headless mode: use Mistrado as a UNIX tool
- Permission management for tool calls
- Bash tool for executing shell commands
- Git diffs for edits
- Command to add files to request
- Support for adding MCP tool servers
