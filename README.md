# ≋ Mistrado

Mistrado is a terminal-based coding assistant powered by Mistral's AI model, (heavily) inspired by Claude Code. Use Mistral's models from the terminal to write and explain code.

I created this tool because I love the fast, cheap and capable models Mistral provides. I also love Claude Code for its excellent product features. This is my attempt to combine the two and encourage Mistral to create their own CLI tool by showing what is possible.

> [!CAUTION]
> Mistrado does not have manual tool call confirmation support yet. Tool calls requested by the model will be executed without notice. This tool can delete and rewrite local files. Use at your own risk.

## Features

- **Dual Mode Operation**: Interactive terminal UI for conversations and UNIX-standard CLI tool for scripting
- **Interactive Terminal UI**: Clean, responsive chat interface built with Ink and React
- **UNIX Tool Mode**: Standard CLI tool with stdin/stdout support for automation and scripting
- **Session Management**: Persistent conversation history during interactive sessions
- **Built-in Tools**: Comprehensive filesystem operations, search capabilities, and task management
- **Secure API Key Storage**: Uses system keychain for secure credential management
- **Custom Instructions**: Project-specific AI behavior via optional AGENTS.md file

## Installation

```bash
npm install -g mistrado
```

### Update

```bash
npm update -g mistrado
```

## Usage

Mistrado operates in two modes:

### Interactive Mode

Start an interactive session in your project directory:

```bash
# Start interactive session
mistrado

# Start with an initial prompt
mistrado "Help me understand this codebase"
```

#### First Time Setup

On your first run, you'll be prompted to enter your Mistral API key. The key is securely stored in your system keychain for future sessions.

### UNIX Tool Mode

With the `--print` (or `-p`) flag, Mistrado will run a single prompt and output the final response to stdout. This allows you to use Mistrado as a standard UNIX tool for automation and scripting:

```bash
# Direct prompt
MISTRAL_API_KEY=your_key mistrado -p "What is 2+2?"

# Pipe input from stdin
echo "Write a haiku about programming" | MISTRAL_API_KEY=your_key mistrado -p

# Use in scripts
cat requirements.txt | MISTRAL_API_KEY=your_key mistrado -p "Generate test cases for these requirements"

# Help and version
mistrado -h
mistrado -v
```

**Environment Setup for UNIX Mode:**

- Set `MISTRAL_API_KEY` environment variable
- Proper exit codes: 0 for success, 1 for errors
- SIGPIPE handling for shell pipelines

### Interactive Mode Commands

- `/help` - Show available commands
- `/exit` or `/quit` - Exit the application
- `/usage` - Show token usage per model
- `/logout` - Clear stored API key and exit
- `/settings` - Select the AI model to use
- `/clear` - Clear the session history

Press **ESC** to quickly stop long-running operations and regain control of the interface.

### Model Configuration

By default, Mistrado uses `mistral-medium-2508`, the latest powerful model from Mistral. You can select a different model using the `/settings` command. Settings are only applied to the current project.

### Custom Instructions

You can customize the AI's behavior for your specific project by creating an `AGENTS.md` file in your project root:

The content of `AGENTS.md` will be automatically included in the system prompt, allowing you to provide project-specific guidelines, coding standards, or context that should be applied to all interactions.

## Built-in Tools

Mistrado includes comprehensive tools that enable the AI to work with your codebase:

**File Operations**: `read`, `write`, `edit`, `multi-edit`, `ls`  
**Search & Discovery**: `glob` (pattern matching), `grep` (content search)  
**Web Integration**: `webfetch` (HTTP requests)  
**Task Management**: `todo-write` (progress tracking)

These tools enable the AI to analyze code, manage files, explore projects, fetch web content, and organize complex tasks.

> [!CAUTION]
> Tool calls requested by the model will be executed without notice. For safety reasons there is no `bash` tool included or option to add your own MCP servers yet.

## Model Optimizations

Mistrado is optimized specifically for Mistral models with smart handling for:

- **Tool Call Discovery**: Recognising and executing tool calls, even when included in the response message instead of the tool calls array
- **Retry Strategy Suggestions**: Less tool call looping with specific instructions to not retry failed requests with identical arguments

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

Upcoming features to make Mistrado even better:

- Permission management for tool calls
- Bash tool for executing shell commands
- Git diffs for edit operations
- File reference command
- MCP server integration support
- Configuration flags for UNIX mode
- Conversation persistence across sessions
