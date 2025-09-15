# Changelog

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