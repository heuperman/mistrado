# Mistrado

A terminal-based conversational interface for Mistral AI, built with Ink and React. Features an extensible architecture with MCP (Model Context Protocol) integration for filesystem tools and real-time streaming responses.

## Features

- **Interactive Terminal UI**: Clean, responsive chat interface built with Ink and React
- **Streaming AI Responses**: Real-time streaming from Mistral AI's `devstral-small-2507` model
- **Secure API Key Storage**: Uses system keychain (keytar) for secure credential management
- **MCP Tool Integration**: Built-in filesystem tools (read, write, edit, ls, multi-edit) via Model Context Protocol
- **Modular Architecture**: Clean separation of concerns with React hooks and service layers
- **Session Management**: Persistent conversation history

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

## Install

```bash
npm install --global mistrado
```

## Usage

Simply run the CLI to start a conversation:

```bash
mistrado
```

On first run, you'll be prompted to enter your Mistral API key, which will be securely stored in your system keychain.

## Commands

- `/help` - Show available commands
- `/exit` or `/quit` - Exit the application
- `/usage` - Show token usage per model
- `/logout` - Clear stored API key and logout

### Built-in Tools

The application includes a built-in MCP tool server providing:

- `read`: File content reading with offset/limit support
- `write`: File creation and overwriting
- `edit`: String replacement in files
- `multi-edit`: Multiple sequential edits
- `ls`: Directory listing with glob ignore patterns
