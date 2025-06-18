# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

- **Build**: `npm run build` - Compiles TypeScript to `dist/` directory
- **Development**: `npm run dev` - Runs TypeScript compiler in watch mode
- **Test/Lint**: `npm run test` - Runs prettier, xo linter, and ava tests

## Architecture Overview

This is an Ink-based CLI application that provides a conversational interface to Mistral AI's API. The application uses React components to render a terminal UI.

### Core Components

- **App** (`source/app.tsx`): Main application component handling conversation state, API key management, and user input
- **CLI Entry** (`source/cli.tsx`): Simple entry point that renders the App component
- **ApiKeyInput** (`source/components/ApiKeyInput.tsx`): Handles secure API key input and storage
- **Hero** (`source/components/Hero.tsx`): Displays welcome/branding information

### Services

- **mistralService** (`source/services/mistralService.ts`): Manages Mistral AI client initialization and streaming chat responses using the `devstral-small-2505` model
- **secretsService** (`source/services/secretsService.ts`): Handles secure storage/retrieval of API keys using keytar
- **mcpManager** (`source/services/mcpManager.ts`): Manages MCP (Model Context Protocol) servers and tool integration
- **mcpClient** (`source/services/mcpClient.ts`): Handles communication with individual MCP servers

### Key Patterns

- Uses React hooks for state management (conversation history, loading states, errors)
- Implements streaming responses from Mistral API with real-time UI updates
- Supports slash commands (`/help`, `/usage`, `/logout`, `/exit`, `/quit`)
- Maintains conversation history as `MistralMessage[]` array
- Integrates MCP (Model Context Protocol) servers for filesystem tools and extensions
- Type definitions separate Mistral AI types from MCP types

### Security Notes

- API keys are stored securely via keytar (system keychain)
- No API keys or secrets should be committed to the repository
