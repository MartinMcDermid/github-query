# GitHub Commit Titles

A powerful Node.js CLI tool to fetch commit titles from GitHub repositories within a date range. Perfect for generating changelogs, analyzing commit patterns, extracting commit history, and creating timesheet entries.

## Features

- Flexible Date Support: Absolute dates, ISO dates, and relative dates ("7 days ago", "today", etc.)
- Configuration Files: Load settings from JSON config files
- Multiple Output Formats: Text, Grouped, Timesheet, Summary, JSON, NDJSON, CSV, Markdown, and HTML
- Advanced Filtering: Filter by author, committer, regex patterns, and exclude merges
- File Output: Write results to files instead of stdout
- Retry Logic: Automatic retry with exponential backoff for failed requests
- Rate Limit Awareness: Real-time rate limit monitoring and warnings
- Robust Error Handling: Comprehensive validation and helpful error messages
- Progress Tracking: Verbose mode with detailed progress information
- GitHub CLI Integration: Automatic authentication using GitHub CLI
- Timesheet Ready: Special output format optimized for copying to timesheets
- Commit Analytics: Statistical analysis and commit type categorization

## Installation

### Prerequisites

- Node.js 18+ (uses global fetch)

### Quick Start

```bash
# Clone or download the script
git clone <repository-url>
cd github-commit-titles

# Install dependencies
npm install

# Make executable
chmod +x titles.js

# Run directly
node titles.js --help
```

### Global Installation (Optional)

```bash
# Install globally
npm install -g .

# Use as command
github-commits --help
```

## Usage

### Basic Usage

```bash
# Fetch commits from last week (uses GitHub CLI if logged in)
node titles.js --owner user --repo repo --start "7 days ago" --end "today"

# With explicit authentication
GITHUB_TOKEN=ghp_xxx node titles.js --owner user --repo repo --start 2025-01-01 --end 2025-01-31

# Using GitHub CLI (recommended)
gh auth login  # Login once
node titles.js --owner user --repo repo --start "1 month ago" --end "today"
```

### Timesheet Integration

Perfect for daily work logging:

```bash
# Get today's commits for timesheet
node titles.js --owner user --repo repo --start "today" --end "today" --author your-username --format timesheet

# Get this week's work for timesheet
node titles.js --owner user --repo repo --start "7 days ago" --end "today" --author your-username --format timesheet

# Save to file for easy copying
node titles.js --owner user --repo repo --start "yesterday" --end "yesterday" --author your-username --format timesheet --output today-work.txt
```

### Analytics and Statistics

```bash
# Get a statistical summary of your work
node titles.js --owner user --repo repo --start "1 month ago" --end "today" --author your-username --format summary

# Show statistics in verbose mode
node titles.js --owner user --repo repo --start "2 weeks ago" --end "today" --author your-username --verbose --stats

# Generate summary report
node titles.js --owner user --repo repo --start "1 month ago" --end "today" --format summary --output work-summary.md
```

### Advanced Examples

#### Generate a Markdown Changelog

```bash
node titles.js \
  --owner user \
  --repo my-project \
  --start "1 month ago" \
  --end "today" \
  --exclude-merges \
  --format markdown \
  --output CHANGELOG.md
```

#### Filter by Author and Export to JSON

```bash
node titles.js \
  --owner user \
  --repo repo \
  --start 2025-01-01 \
  --end 2025-01-31 \
  --author username \
  --format json \
  --output commits.json
```

#### Use Configuration File

```bash
# config.json
{
  "owner": "user",
  "repo": "repo",
  "branch": "main",
  "start": "2025-01-01",
  "end": "2025-01-31",
  "author": "username",
  "format": "timesheet",
  "output": "timesheet.txt",
  "verbose": true,
  "stats": true
}

# Run with config
node titles.js --config config.json
```

#### Advanced Filtering

```bash
# Exclude commits matching pattern
node titles.js \
  --owner user --repo repo \
  --start "2 weeks ago" --end "today" \
  --exclude-pattern "^(fix|chore):" \
  --include-pattern "feat:" \
  --format grouped
```

## Command Line Options

### Required (unless using --config)

- `--owner <orgOrUser>` - GitHub organization or username
- `--repo <repo>` - Repository name
- `--branch <branch>` - Branch name
- `--start <date>` - Start date (ISO, YYYY-MM-DD, or relative)
- `--end <date>` - End date (ISO, YYYY-MM-DD, or relative)

### Optional

- `--author <username>` - Filter by commit author
- `--committer <username>` - Filter by committer
- `--exclude-merges` - Skip merge commits
- `--exclude-pattern <regex>` - Skip commits matching regex
- `--include-pattern <regex>` - Only include commits matching regex
- `--format <format>` - Output format: text, grouped, timesheet, summary, json, ndjson, csv, markdown, html
- `--output <file>` - Write output to file (default: stdout)
- `--token <token>` - GitHub token (or use GITHUB_TOKEN env var or GitHub CLI)
- `--max <n>` - Maximum number of commits to fetch
- `--verbose` - Show progress and rate limit info
- `--config <file>` - Load configuration from JSON file
- `--retry <n>` - Number of retries for failed requests (default: 3)
- `--timeout <ms>` - Request timeout in milliseconds (default: 30000)
- `--stats` - Show commit statistics in verbose mode
- `-h, --help` - Show help

## Relative Date Support

The tool supports natural language relative dates:

- `today`
- `yesterday`
- `7 days ago`
- `2 weeks ago`
- `1 month ago`
- `3 years ago`

## Output Formats

### Text (default)

Simple list of commit titles, one per line.

### Grouped

Commits grouped by date with bullet points:

```
2025-08-21 (3 commits):
  • refactor: integrate renumberOriginalIndex utility
  • test: add pass-through for renumberOriginalIndex
  • fix: clear force-edit cells after data changes

2025-08-20 (2 commits):
  • refactor: remove memoization of table key
  • fix: update data handling in BriefsManager
```

### Timesheet

Clean format optimized for copying to timesheets (DD/MM/YYYY format) with commit type labels:

```
21/08/2025:
• [REFACTOR] refactor: integrate renumberOriginalIndex utility for consistent row indexing
• [TEST] test: add pass-through for renumberOriginalIndex in BriefsManager tests
• [BUGFIX] fix: clear force-edit cells after data changes in DataTable component

20/08/2025:
• [REFACTOR] refactor: remove memoization of table key in DataTable component
• [BUGFIX] fix: update data handling in BriefsManager
```

### Summary

Statistical summary with commit types, contributors, and activity patterns:

```markdown
# Commit Summary: user/repo

**Branch:** main
**Date Range:** 2025-08-01 to 2025-08-21
**Total Commits:** 45
**Average per Day:** 2.1

## Commit Types

- **refactor**: 15 (33.3%)
- **fix**: 12 (26.7%)
- **feat**: 8 (17.8%)
- **test**: 6 (13.3%)
- **docs**: 4 (8.9%)

## Top Contributors

- **username**: 25 commits (55.6%)
- **other-user**: 15 commits (33.3%)
- **another-user**: 5 commits (11.1%)

## Recent Activity

- **2025-08-21**: 3 commits
- **2025-08-20**: 2 commits
- **2025-08-19**: 4 commits
```

### JSON

Structured JSON with metadata and commit details.

### NDJSON (Newline Delimited JSON)

One JSON object per line for easy streaming processing.

### CSV

Comma-separated values with headers for spreadsheet import.

### Markdown

Formatted markdown with links to GitHub commits, grouped by date.

### HTML

Styled HTML page with commit history, grouped by date.

## Commit Type Categorization

The tool automatically categorizes commits by type and assigns uppercase labels (e.g., [FEATURE], [BUGFIX], [REFACTOR]).

- feat: New features
- fix: Bug fixes
- refactor: Code refactoring
- test: Tests
- docs: Documentation
- chore: Maintenance tasks
- perf: Performance improvements
- ci: CI/CD changes
- build: Build system changes
- style: Code style changes
- revert: Reverted changes
- merge: Merge commits
- other: Other commits

## Configuration Files

Create a JSON configuration file to store common settings:

```json
{
  "owner": "user",
  "repo": "repo",
  "branch": "main",
  "start": "2025-01-01",
  "end": "2025-01-31",
  "author": "username",
  "format": "timesheet",
  "output": "timesheet.txt",
  "excludeMerges": true,
  "verbose": true,
  "stats": true
}
```

Command line arguments override configuration file values.

## Authentication

For best results, use authentication. The tool supports multiple authentication methods (in order of precedence):

1. **Command line token**: `--token ghp_xxx`
2. **Environment variable**: `GITHUB_TOKEN=ghp_xxx node titles.js ...`
3. **GitHub CLI**: If you're logged in with `gh auth login`, the tool will automatically use your GitHub CLI token

### GitHub CLI Authentication (Recommended)

```bash
# Login with GitHub CLI
gh auth login

# Run the tool - it will automatically use your GitHub CLI token
node titles.js --owner user --repo repo --start "7 days ago" --end "today"
```

### Manual Token Setup

1. Go to GitHub Settings → Developer settings → Personal access tokens
2. Generate a new token with `repo` scope
3. Use via environment variable: `GITHUB_TOKEN=ghp_xxx node titles.js ...`
4. Or via command line: `--token ghp_xxx`

Without authentication, you're limited to 60 requests per hour vs 5,000 with auth.

## Error Handling

The tool provides helpful error messages for common issues:

- Invalid repository names
- Authentication failures
- Rate limit exceeded
- Invalid date formats
- Network timeouts
- Same-day date ranges (automatically handled)

## Performance

- Automatic pagination handling
- Rate limit monitoring
- Retry logic with exponential backoff
- Progress indicators for large datasets
- Efficient memory usage
- Network error recovery

## Examples

### Daily Timesheet Entry

```bash
# Get today's work for timesheet
node titles.js \
  --owner user \
  --repo project \
  --start "today" \
  --end "today" \
  --author your-username \
  --format timesheet \
  --output today-work.txt
```

### Weekly Work Summary

```bash
# Get your work from the last week with statistics
node titles.js \
  --owner user \
  --repo project \
  --start "1 week ago" \
  --end "today" \
  --author your-username \
  --format summary \
  --verbose \
  --stats \
  --output weekly-summary.md
```

### Generate Weekly Report

```bash
node titles.js \
  --owner myorg \
  --repo myproject \
  --start "1 week ago" \
  --end "today" \
  --exclude-merges \
  --format markdown \
  --output weekly-report.md \
  --verbose
```

### Analyze Feature Development

```bash
node titles.js \
  --owner user \
  --repo app \
  --start "1 month ago" \
  --end "today" \
  --include-pattern "feat:" \
  --format csv \
  --output features.csv
```

### Create HTML Report

```bash
node titles.js \
  --owner user \
  --repo repo \
  --start "2025-01-01" \
  --end "2025-01-31" \
  --format html \
  --output report.html
```

### Personal Work Summary

```bash
# Get your work from the last month, grouped by date
node titles.js \
  --owner user \
  --repo project \
  --start "1 month ago" \
  --end "today" \
  --author your-username \
  --format grouped \
  --output my-work-summary.txt
```

### Team Activity Analysis

```bash
# Analyze team activity with statistics
node titles.js \
  --owner org \
  --repo project \
  --start "2 weeks ago" \
  --end "today" \
  --format summary \
  --verbose \
  --stats \
  --output team-activity.md
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Support

For issues and questions:

- Create an issue on GitHub
- Check the help: `node titles.js --help`
- Review the examples above
