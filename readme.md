# Mistrado

A terminal-based conversational interface for Mistral AI, built with Ink and React. Features built-in filesystem and search tools with real-time streaming responses.

## Features

- **Interactive Terminal UI**: Clean, responsive chat interface built with Ink and React
- **Streaming AI Responses**: Real-time streaming from Mistral AI with configurable model selection
- **Secure API Key Storage**: Uses system keychain (keytar) for secure credential management
- **Built-in Tools**: Comprehensive filesystem operations (read, write, edit, ls, multi-edit) and search capabilities (glob, grep)
- **Modular Architecture**: Clean separation of concerns with React hooks and service layers
- **Session Management**: Persistent conversation history
- **Custom Instructions**: Optional AGENTS.md file support for project-specific AI behavior

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

## Installation

```bash
npm install --global mistrado
```

## Usage

Start a conversation with Mistral AI:

```bash
mistrado
```

### First Time Setup

On first run, you'll be prompted to enter your Mistral API key. The key is securely stored in your system keychain for future sessions.

### Model Configuration

By default, Mistrado uses the `devstral-small-2507` model. You can configure a different model by creating a settings file:

```bash
mkdir -p .mistrado
echo '{"model": "your-preferred-model"}' > .mistrado/settings.json
```

## Commands

- `/help` - Show available commands
- `/exit` or `/quit` - Exit the application
- `/usage` - Show token usage per model
- `/logout` - Clear stored API key and logout

### Built-in Tools

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

These tools enable the AI to help with code analysis, file management, and project exploration.

### Custom Instructions

You can customize the AI's behavior for your specific project by creating an `AGENTS.md` file in your project root:

```bash
# Example AGENTS.md
echo "# Project Instructions

When working on this codebase:
- Always use TypeScript strict mode
- Follow the existing React patterns
- Run tests after making changes" > AGENTS.md
```

The content of `AGENTS.md` will be automatically included in the system prompt, allowing you to provide project-specific guidelines, coding standards, or context that should be applied to all interactions.

## Requirements

- Node.js 16 or higher
- Mistral API key ([get one here](https://console.mistral.ai/))

## License

MIT
