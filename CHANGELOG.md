# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] - 2025-08-18

### Added

- **UNIX Tool Mode**: New `--print` (`-p`) flag for non-interactive usage
  - Supports stdin input piping for automation and scripting
  - Environment variable-based API key authentication (`MISTRAL_API_KEY`)
  - Proper UNIX exit codes (0 for success, 1 for errors)
  - SIGPIPE handling for shell pipelines
- **Initial Prompt Support**: Interactive mode now accepts an optional initial prompt argument
- **Enhanced Error Handling**:
  - UNIX signal handling (SIGPIPE, SIGINT, SIGTERM)
  - Graceful shutdown coordination
  - Uncaught exception and unhandled rejection handling
- **Utilities**:
  - Stdin reading utility with TTY detection
  - Version utility for CLI version display
  - Enhanced error handling for production environments
- **CI/CD**: GitHub Actions workflow for automated npm publishing

### Changed

- **Framework-Agnostic Architecture**:
  - Adapter pattern with separate React and print mode callbacks
  - Framework-agnostic conversation service core
  - Generic callback interfaces for different environments
- **CLI Interface**: Enhanced command-line argument parsing with Commander.js
- **Documentation**: Comprehensive updates to README.md and CLAUDE.md
  - Improved user experience with emojis and better organization
  - Added UNIX tool mode documentation
  - Enhanced feature descriptions and usage examples
