# mistral-cli

A terminal-based conversational interface for Mistral AI, built with Ink and React.

## Features

- Interactive chat interface in your terminal
- Streaming responses from Mistral AI's `devstral-small-2505` model
- Secure API key storage using system keychain
- Session-based conversation history
- Built-in commands for session management

## Install

```bash
$ npm install --global mistral-cli
```

## Usage

Simply run the CLI to start a conversation:

```bash
$ mistral-cli
```

On first run, you'll be prompted to enter your Mistral API key, which will be securely stored in your system keychain.

## Commands

- `/help` - Show available commands
- `/logout` - Clear stored API key and logout
- `/exit` or `/quit` - Exit the application

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
