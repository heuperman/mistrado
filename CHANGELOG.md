# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.0] - 2025-08-27

### Added

- **Tool Permission System**: Mistrado now asks for your permission before modifying files or performing write operations
- **Session Permissions**: Choose to allow tools "just this time" or "for this session" to reduce repeated prompts
- **Safe Operations**: Read-only tools (viewing files, searching, web requests) execute automatically without interruption

### Changed

- **Interactive Mode**: File modification tools now require user approval before execution
- **UNIX Mode**: Continues to execute all tools automatically for scripting and automation workflows

## [0.2.2] - 2025-08-25

### Changed

- Add more model options and set default model to the latest Mistral Medium, the most capable model

## [0.2.1] - 2025-08-19

### Fixed

- Resolve CI pipeline issues that were preventing automated testing and publishing
- Fix import errors in case-sensitive environments by standardizing component file naming

## [0.2.0] - 2025-08-18

### Added

- Use `--print` flag for non-interactive UNIX tool mode with stdin piping support
- Pass API key via `MISTRAL_API_KEY` environment variable for automation scripts
- Start interactive mode with an initial prompt by passing it as an argument
- Press ESC to interrupt running operations gracefully
- Use standard UNIX exit codes (0 for success, 1 for errors) for scripting integration

### Changed

- Enhanced command-line argument parsing with help and version flags
- Improved documentation with better organization and usage examples
