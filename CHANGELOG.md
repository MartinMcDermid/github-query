# Changelog

## [1.0.3](https://github.com/MartinMcDermid/github-query/compare/v1.0.2...v1.0.3) (2025-09-15)

## [1.0.2](https://github.com/MartinMcDermid/github-query/compare/v1.0.1...v1.0.2) (2025-09-15)


### Bug Fixes

* **release:** use boolean github.autoGenerate per REST API ([53e048d](https://github.com/MartinMcDermid/github-query/commit/53e048df8e3de0871cdc2b88b591d113a653c5ad))

## 1.0.1 (2025-09-15)


### Features

* add release-it and GitHub workflows ([a34b0ea](https://github.com/MartinMcDermid/github-query/commit/a34b0ea8120d02b773be855f4eb2c6fdce3cfbc5))

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Git auto-detection functionality with `--auto` flag
- Comprehensive test suite with 119+ tests
- Support for SSH, HTTPS, and GitHub CLI remote formats
- Smart remote prioritization (origin > upstream > first available)
- Automatic repository, branch, and owner detection from current git directory

### Enhanced  
- CLI help text with auto-detection examples
- Error handling for git repository detection
- Documentation with auto-detection usage examples

### Technical
- Added 27 new tests for git auto-detection functionality
- Improved test coverage across all core functions
- Added git command mocking for reliable testing

## [1.0.0] - 2025-01-XX

### Added
- Initial release
- GitHub API integration for fetching commit data
- Multiple output formats: text, grouped, timesheet, summary, JSON, NDJSON, CSV, Markdown, HTML
- Flexible date support including relative dates ("7 days ago", "today", etc.)
- Advanced filtering by author, committer, and regex patterns
- Configuration file support
- GitHub CLI authentication integration
- Rate limiting and retry logic with exponential backoff
- Commit categorization and statistical analysis
- Progress tracking and verbose mode
- Comprehensive error handling and validation
- Timesheet-optimized output format
- Command-line interface with extensive options
