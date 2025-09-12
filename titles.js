#!/usr/bin/env node
/**
 * GitHub Commit Titles - A Node.js CLI tool to fetch commit titles from GitHub repositories
 *
 * This tool fetches commit titles from a GitHub repository within a specified date range.
 * It supports multiple output formats, filtering options, and authentication methods.
 *
 * Features:
 * - Flexible date support (ISO, YYYY-MM-DD, relative dates)
 * - Multiple output formats (text, grouped, timesheet, summary, JSON, CSV, Markdown, HTML)
 * - Advanced filtering (author, committer, regex patterns)
 * - GitHub CLI integration for authentication
 * - Configuration file support
 * - Rate limiting and retry logic
 * - Statistical analysis and commit categorization
 *
 * @requires Node.js 18+ (uses global fetch)
 * @author GitHub Commit Titles Tool
 * @version 1.0.0
 */

// Requires Node 18+ (uses global fetch)
const { readFileSync, writeFileSync, existsSync, mkdirSync } = require("fs");
const { dirname, resolve } = require("path");

const HELP = `
Fetch commit titles from a GitHub repo/branch within a date range.

Git Auto-Detection:
  --auto                          Auto-detect owner, repo, and branch from current git repository

Required (unless using --config or --auto):
  --owner <orgOrUser>
  --repo <repo>
  --branch <branch>
  --start <ISO date, YYYY-MM-DD, or relative date>
  --end   <ISO date, YYYY-MM-DD, or relative date>

Optional:
  --author <github-username>      Filter by commit author (as on GitHub)
  --committer <github-username>   Filter by committer instead
  --exclude-merges                Skip commits whose title starts with "Merge"
  --exclude-pattern <regex>       Skip commits matching regex pattern
  --include-pattern <regex>       Only include commits matching regex pattern
  --format <text|grouped|timesheet|summary|json|ndjson|csv|markdown|html> Output format (default: text)
  --output <file>                 Write output to file instead of stdout
  --token <token>                 GitHub token; otherwise uses env GITHUB_TOKEN or GitHub CLI
  --max <n>                       Hard cap number of commits scanned (default: none)
  --verbose                       Show progress and rate limit info
  --config <file>                 Load configuration from JSON file
  --retry <n>                     Number of retries for failed requests (default: 3)
  --timeout <ms>                  Request timeout in milliseconds (default: 30000)
  --stats                         Show commit statistics in verbose mode
  -h, --help

Relative dates supported:
  "today", "yesterday", "7 days ago", "2 weeks ago", "1 month ago", etc.

Output formats:
  text      - Simple list of commit titles
  grouped   - Commits grouped by date with emojis
  timesheet - Clean format optimized for copying to timesheets (DD/MM/YYYY format)
  summary   - Statistical summary with commit types and contributors
  json      - Structured JSON with metadata
  ndjson    - Newline-delimited JSON
  csv       - Comma-separated values
  markdown  - Formatted markdown with links
  html      - Styled HTML page

Configuration file format:
  {
    "owner": "user",
    "repo": "repo",
    "branch": "main",
    "start": "2025-01-01",
    "end": "2025-01-31",
    "author": "username",
    "format": "json",
    "output": "commits.json"
  }

Notes:
- Date filtering uses GitHub API 'since' (exclusive) and 'until' (inclusive-ish by time). Provide explicit times if needed.
- Auth strongly recommended (rate limit 5,000/hr). Without auth it's 60/hr.
- Use --verbose to see progress and rate limit information.
- Authentication sources (in order): --token, GITHUB_TOKEN env var, GitHub CLI ('gh auth login')
- Configuration file values are overridden by command line arguments.

Examples:
  # Auto-detect from current git repository
  node titles.js --auto --start "7 days ago" --end "today" --format timesheet
  node titles.js --auto --start "1 week ago" --end "today" --author your-username --format summary --verbose

  # Traditional usage with explicit parameters
  GITHUB_TOKEN=ghp_xxx node titles.js --owner user --repo repo --branch main --start 2025-08-01 --end 2025-08-22 --author username --exclude-merges --format json
  node titles.js --config my-config.json --output commits.txt
  node titles.js --owner user --repo repo --start "7 days ago" --end "today" --format grouped --output commits.txt
  node titles.js --owner user --repo repo --start "7 days ago" --end "today" --format timesheet --output timesheet.txt
  node titles.js --owner user --repo repo --start "7 days ago" --end "today" --format summary --output summary.md
  node titles.js --owner user --repo repo --start "7 days ago" --end "today" --format markdown --output CHANGELOG.md
`;

/**
 * Utility Functions
 * ================
 * Core utility functions for date parsing, validation, and data processing
 */

/**
 * Parses relative date strings into Date objects
 *
 * Supports formats like "today", "yesterday", "7 days ago", "2 weeks ago", etc.
 *
 * @param {string} dateStr - The relative date string to parse
 * @returns {Date|null} The parsed Date object or null if invalid
 *
 * @example
 * parseRelativeDate("today") // Returns Date object for today at midnight
 * parseRelativeDate("7 days ago") // Returns Date object for 7 days ago
 * parseRelativeDate("2 weeks ago") // Returns Date object for 2 weeks ago
 */
function parseRelativeDate(dateStr) {
  const now = new Date();
  const lower = dateStr.toLowerCase().trim();

  if (lower === "today") {
    // For "today", return the start of today (midnight)
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }
  if (lower === "yesterday") {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  }

  const match = lower.match(/^(\d+)\s+(day|week|month|year)s?\s+ago$/);
  if (match) {
    const [, amount, unit] = match;
    const num = parseInt(amount);

    switch (unit) {
      case "day":
        return new Date(now.getTime() - num * 24 * 60 * 60 * 1000);
      case "week":
        return new Date(now.getTime() - num * 7 * 24 * 60 * 60 * 1000);
      case "month":
        return new Date(now.getFullYear(), now.getMonth() - num, now.getDate());
      case "year":
        return new Date(now.getFullYear() - num, now.getMonth(), now.getDate());
    }
  }

  return null;
}

/**
 * Categorizes commit titles based on conventional commit prefixes
 *
 * Analyzes the commit title to determine its type based on common commit message
 * conventions. This is used for statistics and output formatting.
 *
 * @param {string} title - The commit title to categorize
 * @returns {string} The commit type category
 *
 * @example
 * categorizeCommit("feat: add new feature") // Returns "feature"
 * categorizeCommit("fix: resolve bug") // Returns "bugfix"
 * categorizeCommit("docs: update README") // Returns "documentation"
 */
function categorizeCommit(title) {
  const lower = title.toLowerCase();

  if (lower.startsWith("feat:")) return "feature";
  if (lower.startsWith("fix:")) return "bugfix";
  if (lower.startsWith("docs:")) return "documentation";
  if (lower.startsWith("style:")) return "style";
  if (lower.startsWith("refactor:")) return "refactor";
  if (lower.startsWith("test:")) return "test";
  if (lower.startsWith("chore:")) return "chore";
  if (lower.startsWith("perf:")) return "performance";
  if (lower.startsWith("ci:")) return "ci";
  if (lower.startsWith("build:")) return "build";
  if (lower.startsWith("revert:")) return "revert";
  if (lower.startsWith("merge")) return "merge";

  return "other";
}

/**
 * Generates statistical analysis of commit data
 *
 * Analyzes commit items to produce comprehensive statistics including:
 * - Total commit count
 * - Breakdown by commit type
 * - Breakdown by author
 * - Breakdown by date
 * - Average commits per day
 *
 * @param {Array} items - Array of commit objects with title, author_login, and date properties
 * @returns {Object} Statistics object with total, byType, byAuthor, byDate, and averagePerDay
 *
 * @example
 * const stats = generateStats(commits);
 * console.log(`Total commits: ${stats.total}`);
 * console.log(`Average per day: ${stats.averagePerDay}`);
 */
function generateStats(items) {
  const stats = {
    total: items.length,
    byType: {},
    byAuthor: {},
    byDate: {},
    averagePerDay: 0,
  };

  const dateCounts = {};

  for (const item of items) {
    if (!item.title) continue;

    // Count by type
    const type = categorizeCommit(item.title);
    stats.byType[type] = (stats.byType[type] || 0) + 1;

    // Count by author
    const author = item.author_login || "Unknown";
    stats.byAuthor[author] = (stats.byAuthor[author] || 0) + 1;

    // Count by date
    if (item.date) {
      const date = new Date(item.date).toISOString().split("T")[0];
      dateCounts[date] = (dateCounts[date] || 0) + 1;
    }
  }

  // Calculate average per day
  const uniqueDays = Object.keys(dateCounts).length;
  stats.averagePerDay =
    uniqueDays > 0 ? (stats.total / uniqueDays).toFixed(1) : 0;
  stats.byDate = dateCounts;

  return stats;
}

/**
 * Retrieves GitHub authentication token from GitHub CLI
 *
 * Attempts to get a GitHub token using two methods:
 * 1. Reads the GitHub CLI configuration file (~/.config/gh/hosts.yml)
 * 2. Executes the 'gh auth token' command
 *
 * This allows users to authenticate using GitHub CLI without manually
 * providing tokens via environment variables or command line.
 *
 * @returns {string|null} The GitHub token or null if not available
 *
 * @example
 * const token = getGitHubCLIToken();
 * if (token) {
 *   console.log("Using GitHub CLI token");
 * }
 */
function getGitHubCLIToken() {
  try {
    // Method 1: Try to read GitHub CLI config file
    const os = require("os");
    const homeDir = os.homedir();
    const configPath = require("path").join(
      homeDir,
      ".config",
      "gh",
      "hosts.yml"
    );

    if (existsSync(configPath)) {
      const yaml = require("yaml");
      const config = yaml.parse(readFileSync(configPath, "utf8"));

      // Look for the default GitHub host
      const githubHost = config["github.com"] || config["api.github.com"];
      if (githubHost && githubHost.oauth_token) {
        return githubHost.oauth_token;
      }
    }
  } catch (err) {
    // Silently fail - GitHub CLI might not be installed or configured
    // This could be due to missing yaml package, invalid config, etc.
  }

  try {
    // Method 2: Try to execute 'gh auth token' command
    const { execSync } = require("child_process");
    const token = execSync("gh auth token", {
      encoding: "utf8",
      stdio: "pipe",
    }).trim();
    if (token && token.length > 0) {
      return token;
    }
  } catch (err) {
    // Silently fail - gh command might not be available or user not authenticated
  }

  return null;
}

/**
 * Loads and validates configuration from a JSON file
 *
 * Reads a JSON configuration file and validates that all required fields
 * are present. Configuration files allow users to store common settings
 * and avoid repetitive command line arguments.
 *
 * @param {string} configPath - Path to the JSON configuration file
 * @returns {Object} The parsed and validated configuration object
 * @throws {Error} If file doesn't exist, is invalid JSON, or missing required fields
 *
 * @example
 * const config = loadConfig("config.json");
 * // Returns: { owner: "user", repo: "repo", branch: "main", ... }
 */
function loadConfig(configPath) {
  try {
    const fullPath = resolve(configPath);
    if (!existsSync(fullPath)) {
      throw new Error(`Configuration file not found: ${configPath}`);
    }

    const content = readFileSync(fullPath, "utf8");
    const config = JSON.parse(content);

    // Validate required fields
    const required = ["owner", "repo", "branch", "start", "end"];
    for (const field of required) {
      if (!config[field]) {
        throw new Error(`Missing required field in config: ${field}`);
      }
    }

    return config;
  } catch (err) {
    if (err instanceof SyntaxError) {
      throw new Error(`Invalid JSON in configuration file: ${err.message}`);
    }
    throw err;
  }
}

/**
 * Ensures the output directory exists before writing files
 *
 * Creates the directory structure for the output file if it doesn't exist.
 * This prevents errors when writing to nested directories that haven't been created yet.
 *
 * @param {string} outputPath - The output file path
 *
 * @example
 * ensureOutputDirectory("./reports/weekly-summary.md");
 * // Creates ./reports/ directory if it doesn't exist
 */
function ensureOutputDirectory(outputPath) {
  if (outputPath && outputPath !== "-") {
    const dir = dirname(outputPath);
    if (dir !== "." && !existsSync(dir)) {
      try {
        mkdirSync(dir, { recursive: true });
      } catch (err) {
        console.warn(
          `Warning: Could not create output directory ${dir}: ${err.message}`
        );
      }
    }
  }
}

/**
 * Git Auto-Detection Functions
 * ============================
 * Functions to automatically detect git repository information from the current working directory
 */

/**
 * Detects if the current directory is inside a git repository
 * 
 * @returns {boolean} True if inside a git repository
 */
function isInGitRepository() {
  try {
    const { execSync } = require("child_process");
    execSync("git rev-parse --git-dir", { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

/**
 * Gets the current git branch name
 * 
 * @returns {string|null} Current branch name or null if not in a git repo
 */
function getCurrentBranch() {
  try {
    const { execSync } = require("child_process");
    const branch = execSync("git rev-parse --abbrev-ref HEAD", { 
      encoding: "utf8", 
      stdio: "pipe" 
    }).trim();
    return branch === "HEAD" ? "main" : branch; // Handle detached HEAD
  } catch {
    return null;
  }
}

/**
 * Extracts owner and repo from git remote URL
 * 
 * @param {string} remoteUrl - Git remote URL (HTTPS or SSH)
 * @returns {Object|null} Object with owner and repo properties, or null if parsing fails
 * 
 * @example
 * parseGitRemote("https://github.com/user/repo.git") // Returns { owner: "user", repo: "repo" }
 * parseGitRemote("git@github.com:user/repo.git") // Returns { owner: "user", repo: "repo" }
 */
function parseGitRemote(remoteUrl) {
  if (!remoteUrl) return null;

  // Handle HTTPS URLs: https://github.com/owner/repo.git
  const httpsMatch = remoteUrl.match(/https:\/\/github\.com\/([^\/]+)\/([^\/]+?)(?:\.git)?$/);
  if (httpsMatch) {
    return { owner: httpsMatch[1], repo: httpsMatch[2] };
  }

  // Handle SSH URLs: git@github.com:owner/repo.git
  const sshMatch = remoteUrl.match(/git@github\.com:([^\/]+)\/([^\/]+?)(?:\.git)?$/);
  if (sshMatch) {
    return { owner: sshMatch[1], repo: sshMatch[2] };
  }

  // Handle GitHub CLI URLs: gh:owner/repo
  const ghMatch = remoteUrl.match(/gh:([^\/]+)\/([^\/]+)$/);
  if (ghMatch) {
    return { owner: ghMatch[1], repo: ghMatch[2] };
  }

  return null;
}

/**
 * Gets git remote information from the current repository
 * 
 * @param {string} remoteName - Name of the remote (default: "origin")
 * @returns {Object|null} Object with owner and repo, or null if not found
 */
function getGitRemoteInfo(remoteName = "origin") {
  try {
    const { execSync } = require("child_process");
    const remoteUrl = execSync(`git remote get-url ${remoteName}`, {
      encoding: "utf8",
      stdio: "pipe"
    }).trim();
    
    return parseGitRemote(remoteUrl);
  } catch {
    return null;
  }
}

/**
 * Auto-detects git repository information from the current working directory
 * 
 * Attempts to extract:
 * - Owner (GitHub username or organization)
 * - Repository name
 * - Current branch
 * - Remote URL information
 * 
 * @returns {Object} Object containing detected git information
 * 
 * @example
 * const gitInfo = autoDetectGitInfo();
 * // Returns: { owner: "user", repo: "repo", branch: "main", isGitRepo: true, remotes: [...] }
 */
function autoDetectGitInfo() {
  const info = {
    isGitRepo: false,
    owner: null,
    repo: null,
    branch: null,
    remotes: [],
    workingDir: process.cwd()
  };

  // Check if we're in a git repository
  if (!isInGitRepository()) {
    return info;
  }

  info.isGitRepo = true;
  info.branch = getCurrentBranch();

  try {
    const { execSync } = require("child_process");
    
    // Get all remotes
    const remotesOutput = execSync("git remote -v", { 
      encoding: "utf8", 
      stdio: "pipe" 
    }).trim();

    const remoteLines = remotesOutput.split("\n").filter(line => line.includes("(fetch)"));
    
    for (const line of remoteLines) {
      const [name, url] = line.split("\t");
      const cleanUrl = url.replace(" (fetch)", "");
      const parsed = parseGitRemote(cleanUrl);
      
      if (parsed) {
        info.remotes.push({
          name: name.trim(),
          url: cleanUrl,
          ...parsed
        });
      }
    }

    // Prefer origin remote, then upstream, then first available
    const preferredRemote = info.remotes.find(r => r.name === "origin") ||
                           info.remotes.find(r => r.name === "upstream") ||
                           info.remotes[0];

    if (preferredRemote) {
      info.owner = preferredRemote.owner;
      info.repo = preferredRemote.repo;
    }

  } catch (err) {
    // Git commands failed, but we're still in a git repo
    // This might be a newly initialized repo with no remotes
  }

  return info;
}

/**
 * Validation Functions
 * ===================
 * Functions to validate and sanitize user input parameters
 */

/**
 * Validates and sanitizes the GitHub owner parameter
 *
 * Ensures the owner is a valid GitHub username or organization name.
 * Only allows letters, numbers, hyphens, and underscores.
 *
 * @param {string} owner - The GitHub owner (username or organization)
 * @returns {string} The sanitized owner string
 * @throws {Error} If owner is invalid or contains invalid characters
 *
 * @example
 * validateOwner("user-name") // Returns "user-name"
 * validateOwner("invalid@user") // Throws Error
 */
function validateOwner(owner) {
  if (!owner || typeof owner !== "string" || owner.trim() === "") {
    throw new Error("--owner must be a non-empty string");
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(owner)) {
    throw new Error(
      "--owner contains invalid characters (use letters, numbers, hyphens, underscores)"
    );
  }
  return owner.trim();
}

/**
 * Validates and sanitizes the GitHub repository parameter
 *
 * Ensures the repository name is valid and contains only allowed characters.
 *
 * @param {string} repo - The GitHub repository name
 * @returns {string} The sanitized repository name
 * @throws {Error} If repository name is invalid or contains invalid characters
 *
 * @example
 * validateRepo("my-repo") // Returns "my-repo"
 * validateRepo("invalid/repo") // Throws Error
 */
function validateRepo(repo) {
  if (!repo || typeof repo !== "string" || repo.trim() === "") {
    throw new Error("--repo must be a non-empty string");
  }
  if (!/^[a-zA-Z0-9._-]+$/.test(repo)) {
    throw new Error("--repo contains invalid characters");
  }
  return repo.trim();
}

function validateBranch(branch) {
  if (!branch || typeof branch !== "string" || branch.trim() === "") {
    throw new Error("--branch must be a non-empty string");
  }
  return branch.trim();
}

/**
 * Validates and parses date parameters
 *
 * Supports both relative dates ("today", "7 days ago") and absolute dates
 * (ISO format, YYYY-MM-DD). Performs sanity checks to ensure dates are reasonable.
 *
 * @param {string} date - The date string to validate
 * @param {string} name - The parameter name for error messages
 * @returns {Date} The parsed Date object
 * @throws {Error} If date is invalid or unreasonable
 *
 * @example
 * validateDate("2025-01-01", "start") // Returns Date object
 * validateDate("7 days ago", "end") // Returns Date object
 * validateDate("invalid", "start") // Throws Error
 */
function validateDate(date, name) {
  if (!date || typeof date !== "string") {
    throw new Error(`--${name} must be a valid date string`);
  }

  // Try relative date first
  const relativeDate = parseRelativeDate(date);
  if (relativeDate) {
    return relativeDate;
  }

  // Try absolute date
  const dt = new Date(date);
  if (Number.isNaN(dt.valueOf())) {
    throw new Error(`--${name} is not a valid date: ${date}`);
  }

  // Check for reasonable date range (not too far in past/future)
  const now = new Date();
  const yearDiff = Math.abs(now.getFullYear() - dt.getFullYear());
  if (yearDiff > 50) {
    throw new Error(`--${name} date seems unreasonable: ${date}`);
  }

  return dt;
}

function validateMax(max) {
  if (!max) return undefined;

  const num = Number(max);
  if (Number.isNaN(num) || num <= 0 || !Number.isInteger(num)) {
    throw new Error("--max must be a positive integer");
  }

  if (num > 10000) {
    throw new Error("--max cannot exceed 10,000 (GitHub API limit)");
  }

  return num;
}

function validateToken(token) {
  if (!token) return "";

  if (typeof token !== "string" || token.trim() === "") {
    throw new Error("GitHub token must be a non-empty string");
  }

  // Basic GitHub token format validation (only warn for obviously wrong formats)
  if (token.length < 20 || token.length > 100) {
    console.warn("Warning: Token length seems unusual for GitHub tokens");
  }

  return token.trim();
}

function validateRegex(pattern, name) {
  if (!pattern) return null;

  try {
    return new RegExp(pattern, "i");
  } catch (err) {
    throw new Error(`Invalid regex pattern for --${name}: ${err.message}`);
  }
}

/**
 * Parses command line arguments into a structured object
 *
 * Handles both flag arguments (--verbose, --exclude-merges) and value arguments
 * (--owner, --repo, etc.). Provides helpful error messages for missing values
 * and unknown arguments.
 *
 * @param {Array} argv - Array of command line arguments (typically process.argv.slice(2))
 * @returns {Object} Parsed arguments object
 * @throws {Error} If required values are missing for arguments
 *
 * @example
 * const args = parseArgs(["--owner", "user", "--repo", "repo", "--verbose"]);
 * // Returns: { owner: "user", repo: "repo", verbose: true }
 */
function parseArgs(argv) {
  const args = {};
  const flags = new Set([
    "--owner",
    "--repo",
    "--branch",
    "--start",
    "--end",
    "--author",
    "--committer",
    "--format",
    "--output",
    "--token",
    "--max",
    "--config",
    "--retry",
    "--timeout",
    "--exclude-pattern",
    "--include-pattern",
  ]);

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "-h" || a === "--help") {
      args.help = true;
      continue;
    }
    if (a === "--exclude-merges") {
      args.excludeMerges = true;
      continue;
    }
    if (a === "--verbose") {
      args.verbose = true;
      continue;
    }
    if (a === "--stats") {
      args.stats = true;
      continue;
    }
    if (a === "--auto") {
      args.auto = true;
      continue;
    }
    if (flags.has(a)) {
      if (i + 1 >= argv.length) {
        throw new Error(`Missing value for ${a}`);
      }
      args[a.slice(2)] = argv[++i];
    } else {
      // Collect unknown args for better error reporting
      if (!args.unknownArgs) args.unknownArgs = [];
      args.unknownArgs.push(a);
    }
  }

  // Report unknown arguments
  if (args.unknownArgs && args.unknownArgs.length > 0) {
    console.warn(`Warning: Unknown arguments: ${args.unknownArgs.join(", ")}`);
  }

  return args;
}

function toISO(d) {
  // Accept YYYY-MM-DD or ISO; if plain date, make it local midnight -> ISO
  // For safety, treat start as exact given moment; do not auto-adjust.
  const dt = new Date(d);
  if (Number.isNaN(dt.valueOf())) throw new Error(`Invalid date: ${d}`);
  return dt.toISOString();
}

function parseLinkHeader(link) {
  // Parse RFC 5988 Link: <url>; rel="next", <url>; rel="last"
  if (!link) return {};
  return link.split(",").reduce((acc, part) => {
    const m = part.match(/<([^>]+)>;\s*rel="([^"]+)"/);
    if (m) acc[m[2]] = m[1];
    return acc;
  }, {});
}

function firstLine(msg = "") {
  return msg.split("\n")[0].trim();
}

function toCSVCell(s) {
  const v = (s ?? "").toString();
  if (/[",\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

function checkRateLimit(headers, verbose = false) {
  const remaining = headers.get("x-ratelimit-remaining");
  const reset = headers.get("x-ratelimit-reset");

  if (verbose && remaining !== null) {
    const resetDate = reset ? new Date(parseInt(reset) * 1000) : null;
    console.error(
      `Rate limit: ${remaining} requests remaining${
        resetDate ? `, resets at ${resetDate.toISOString()}` : ""
      }`
    );

    if (parseInt(remaining) < 10) {
      console.error("Warning: Rate limit is running low!");
    }
  }

  return { remaining: parseInt(remaining), reset };
}

async function fetchWithRetry(url, options, retries = 3, timeout = 30000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      return response;
    } catch (err) {
      if (attempt === retries) {
        clearTimeout(timeoutId);
        // Provide more specific error messages
        if (err.code === "ENOTFOUND") {
          throw new Error(
            "Network error: Could not resolve host. Check your internet connection."
          );
        } else if (err.code === "ECONNREFUSED") {
          throw new Error(
            "Network error: Connection refused. Check your internet connection."
          );
        } else if (err.name === "AbortError") {
          throw new Error(`Request timeout after ${timeout}ms`);
        } else {
          throw new Error(`Network error: ${err.message}`);
        }
      }

      if (err.name === "AbortError") {
        throw new Error(`Request timeout after ${timeout}ms`);
      }

      // Wait before retrying (exponential backoff)
      const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

/**
 * API and Network Functions
 * ========================
 * Functions for interacting with GitHub API and handling network requests
 */

/**
 * Fetches commits from GitHub API with pagination and error handling
 *
 * Makes requests to the GitHub API to fetch commits within a date range.
 * Handles pagination automatically, rate limiting, and provides detailed
 * error messages for common API issues.
 *
 * @param {Object} params - Parameters for the API request
 * @param {string} params.owner - GitHub owner (username or organization)
 * @param {string} params.repo - GitHub repository name
 * @param {string} params.branch - Branch name to fetch commits from
 * @param {string} params.startISO - Start date in ISO format
 * @param {string} params.endISO - End date in ISO format
 * @param {string} [params.author] - Filter by commit author
 * @param {string} [params.committer] - Filter by committer
 * @param {string} [params.token] - GitHub authentication token
 * @param {number} [params.max] - Maximum number of commits to fetch
 * @param {boolean} [params.verbose=false] - Enable verbose logging
 * @param {number} [params.retries=3] - Number of retry attempts
 * @param {number} [params.timeout=30000] - Request timeout in milliseconds
 * @returns {Promise<Array>} Array of commit objects from GitHub API
 * @throws {Error} If API request fails or returns an error status
 *
 * @example
 * const commits = await fetchCommits({
 *   owner: "user",
 *   repo: "repo",
 *   branch: "main",
 *   startISO: "2025-01-01T00:00:00Z",
 *   endISO: "2025-01-31T23:59:59Z",
 *   token: "ghp_xxx",
 *   verbose: true
 * });
 */
async function fetchCommits({
  owner,
  repo,
  branch,
  startISO,
  endISO,
  author,
  committer,
  token,
  max,
  verbose = false,
  retries = 3,
  timeout = 30000,
}) {
  const per_page = 100;
  let url = new URL(`https://api.github.com/repos/${owner}/${repo}/commits`);
  url.searchParams.set("sha", branch);
  url.searchParams.set("per_page", per_page.toString());
  url.searchParams.set("since", startISO);
  url.searchParams.set("until", endISO);
  if (author) url.searchParams.set("author", author);
  if (committer) url.searchParams.set("committer", committer);

  const headers = {
    Accept: "application/vnd.github+json",
    "User-Agent": "commit-title-scraper/1.0",
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const all = [];
  let next = url.toString();
  let pageCount = 0;

  while (next) {
    pageCount++;
    if (verbose) {
      console.error(
        `Fetching page ${pageCount}... (${all.length} commits so far)`
      );
    }

    const resp = await fetchWithRetry(next, { headers }, retries, timeout);

    // Check rate limits
    checkRateLimit(resp.headers, verbose);

    if (!resp.ok) {
      const bodyText = await resp.text().catch(() => "");
      let errorMsg = `GitHub API error ${resp.status}: ${
        bodyText || resp.statusText
      }`;

      // Provide more helpful error messages
      if (resp.status === 404) {
        errorMsg = `Repository not found: ${owner}/${repo} (check owner and repo names)`;
      } else if (resp.status === 401) {
        errorMsg = `Authentication failed: check your GitHub token`;
      } else if (resp.status === 403) {
        errorMsg = `Access forbidden: check repository permissions and rate limits`;
      } else if (resp.status === 422) {
        errorMsg = `Invalid request: check branch name and date parameters`;
      }

      throw new Error(errorMsg);
    }

    const page = await resp.json();
    all.push(...page);

    if (max && all.length >= max) {
      if (verbose) {
        console.error(`Reached max limit of ${max} commits`);
      }
      break;
    }

    const links = parseLinkHeader(resp.headers.get("link"));
    next = links.next || null;

    // Add a small delay to be respectful to GitHub's API
    if (next && !token) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  if (verbose) {
    console.error(`Fetched ${all.length} commits from ${pageCount} pages`);
  }

  return max ? all.slice(0, max) : all;
}

/**
 * Output Formatting Functions
 * ==========================
 * Functions for formatting commit data into different output formats
 */

/**
 * Groups commit items by date for organized output
 *
 * Takes an array of commit items and groups them by date (YYYY-MM-DD format).
 * Returns an object with dates as keys and arrays of commits as values,
 * sorted with newest dates first.
 *
 * @param {Array} items - Array of commit objects with date property
 * @returns {Object} Object with dates as keys and commit arrays as values
 *
 * @example
 * const grouped = groupByDate(commits);
 * // Returns: { "2025-01-15": [commit1, commit2], "2025-01-14": [commit3] }
 */
function groupByDate(items) {
  const groups = {};

  for (const item of items) {
    if (!item.title) continue;

    const date = item.date
      ? new Date(item.date).toISOString().split("T")[0]
      : "Unknown";
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(item);
  }

  // Sort dates (newest first)
  return Object.entries(groups)
    .sort(([a], [b]) => b.localeCompare(a))
    .reduce((acc, [date, items]) => {
      acc[date] = items;
      return acc;
    }, {});
}

/**
 * Outputs commit titles as simple text (one per line)
 *
 * @param {Array} items - Array of commit objects with title property
 */
function outputText(items) {
  for (const it of items) {
    if (it.title) console.log(it.title);
  }
}

/**
 * Formats commits grouped by date with bullet points
 *
 * Groups commits by date and formats them with date headers and bullet points.
 * Returns a string suitable for display or file output.
 *
 * @param {Array} items - Array of commit objects
 * @returns {string} Formatted string with commits grouped by date
 *
 * @example
 * const output = outputGrouped(commits);
 * // Returns: "2025-01-15 (2 commits):\n  • feat: add new feature\n  • fix: resolve bug"
 */
function outputGrouped(items) {
  const grouped = groupByDate(items);
  const lines = [];

  for (const [date, dateItems] of Object.entries(grouped)) {
    lines.push(`\n${date} (${dateItems.length} commits):`);
    for (const it of dateItems) {
      lines.push(`  • ${it.title}`);
    }
  }

  return lines.join("\n");
}

/**
 * Formats commits for timesheet entry with date and type categorization
 *
 * Creates a clean format optimized for copying into daily timesheets.
 * Uses DD/MM/YYYY date format and categorizes commits by type with
 * uppercase labels in brackets.
 *
 * @param {Array} items - Array of commit objects
 * @returns {string} Formatted string suitable for timesheet entry
 *
 * @example
 * const output = outputTimesheet(commits);
 * // Returns: "15/01/2025:\n• [FEATURE] feat: add new feature\n• [BUGFIX] fix: resolve bug"
 */
function outputTimesheet(items) {
  const grouped = groupByDate(items);
  const lines = [];

  for (const [date, dateItems] of Object.entries(grouped)) {
    // Format date as DD/MM/YYYY for timesheet
    const [year, month, day] = date.split("-");
    const formattedDate = `${day}/${month}/${year}`;

    lines.push(`${formattedDate}:`);
    for (const it of dateItems) {
      const type = categorizeCommit(it.title);
      const typePrefix = `[${type.toUpperCase()}]`;

      lines.push(`• ${typePrefix} ${it.title}`);
    }
    lines.push(""); // Empty line between dates
  }

  return lines.join("\n");
}

/**
 * Generates a comprehensive markdown summary of commit statistics
 *
 * Creates a detailed markdown report with commit statistics including:
 * - Total commits and average per day
 * - Breakdown by commit type with percentages
 * - Top contributors with commit counts
 * - Recent activity by date
 *
 * @param {Array} items - Array of commit objects
 * @param {Object} args - Command line arguments for metadata
 * @param {string} startISO - Start date in ISO format
 * @param {string} endISO - End date in ISO format
 * @returns {string} Markdown formatted summary report
 *
 * @example
 * const summary = outputSummary(commits, args, "2025-01-01T00:00:00Z", "2025-01-31T23:59:59Z");
 * // Returns markdown formatted summary with statistics
 */
function outputSummary(items, args, startISO, endISO) {
  const stats = generateStats(items);
  const lines = [
    `# Commit Summary: ${args.owner}/${args.repo}`,
    "",
    `**Branch:** ${args.branch}`,
    `**Date Range:** ${startISO} to ${endISO}`,
    `**Total Commits:** ${stats.total}`,
    `**Average per Day:** ${stats.averagePerDay}`,
    "",
    "## Commit Types",
    "",
  ];

  // Sort commit types by count
  const sortedTypes = Object.entries(stats.byType).sort(
    ([, a], [, b]) => b - a
  );

  for (const [type, count] of sortedTypes) {
    const percentage = ((count / stats.total) * 100).toFixed(1);
    lines.push(`- **${type}**: ${count} (${percentage}%)`);
  }

  lines.push("", "## Top Contributors", "");

  // Sort authors by count
  const sortedAuthors = Object.entries(stats.byAuthor)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5); // Top 5

  for (const [author, count] of sortedAuthors) {
    const percentage = ((count / stats.total) * 100).toFixed(1);
    lines.push(`- **${author}**: ${count} commits (${percentage}%)`);
  }

  lines.push("", "## Recent Activity", "");

  // Show last 5 days with activity
  const sortedDates = Object.entries(stats.byDate)
    .sort(([a], [b]) => b.localeCompare(a))
    .slice(0, 5);

  for (const [date, count] of sortedDates) {
    lines.push(`- **${date}**: ${count} commits`);
  }

  return lines.join("\n");
}

function outputJSON(items, args, startISO, endISO) {
  const output = {
    owner: args.owner,
    repo: args.repo,
    branch: args.branch,
    start: startISO,
    end: endISO,
    author: args.author ?? null,
    committer: args.committer ?? null,
    excludeMerges: !!args.excludeMerges,
    count: items.length,
    titles: items.map((i) => i.title).filter(Boolean),
    // bonus data if you need it later:
    commits: items,
  };

  return JSON.stringify(output, null, 2);
}

function outputNDJSON(items) {
  return items.map((it) => JSON.stringify(it)).join("\n");
}

function outputCSV(items) {
  const header = [
    "sha",
    "date",
    "author_login",
    "committer_login",
    "title",
    "html_url",
  ]
    .map(toCSVCell)
    .join(",");

  const rows = items.map((it) =>
    [
      it.sha,
      it.date,
      it.author_login,
      it.committer_login,
      it.title,
      it.html_url,
    ]
      .map(toCSVCell)
      .join(",")
  );

  return [header, ...rows].join("\n");
}

function outputMarkdown(items, args, startISO, endISO) {
  const lines = [
    `# Commit History: ${args.owner}/${args.repo}`,
    "",
    `**Branch:** ${args.branch}`,
    `**Date Range:** ${startISO} to ${endISO}`,
    `**Total Commits:** ${items.length}`,
    "",
    "## Commits by Date",
    "",
  ];

  const grouped = groupByDate(items);

  for (const [date, dateItems] of Object.entries(grouped)) {
    lines.push(`### ${date} (${dateItems.length} commits)`);
    lines.push("");

    for (const it of dateItems) {
      const author = it.author_login || "Unknown";
      lines.push(`- [${it.title}](${it.html_url}) (${author})`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

function outputHTML(items, args, startISO, endISO) {
  const html = [
    "<!DOCTYPE html>",
    "<html>",
    "<head>",
    "<title>Commit History</title>",
    "<style>",
    'body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }',
    ".header { background: #f6f8fa; padding: 20px; border-radius: 6px; margin-bottom: 20px; }",
    ".date-group { margin-bottom: 30px; }",
    ".date-header { background: #f1f3f4; padding: 10px 15px; border-radius: 4px; margin-bottom: 15px; font-weight: 600; color: #24292e; }",
    ".commit { border-bottom: 1px solid #e1e4e8; padding: 10px 0; }",
    ".commit:last-child { border-bottom: none; }",
    ".date { color: #586069; font-size: 0.9em; }",
    ".author { color: #0366d6; font-weight: 500; }",
    ".title { font-weight: 500; margin: 5px 0; }",
    "a { color: #0366d6; text-decoration: none; }",
    "a:hover { text-decoration: underline; }",
    "</style>",
    "</head>",
    "<body>",
    '<div class="header">',
    `<h1>Commit History: ${args.owner}/${args.repo}</h1>`,
    `<p><strong>Branch:</strong> ${args.branch}</p>`,
    `<p><strong>Date Range:</strong> ${startISO} to ${endISO}</p>`,
    `<p><strong>Total Commits:</strong> ${items.length}</p>`,
    "</div>",
    '<div class="commits">',
  ];

  const grouped = groupByDate(items);

  for (const [date, dateItems] of Object.entries(grouped)) {
    html.push(
      '<div class="date-group">',
      `<div class="date-header">${date} (${dateItems.length} commits)</div>`
    );

    for (const it of dateItems) {
      const author = it.author_login || "Unknown";
      html.push(
        '<div class="commit">',
        `<div class="title"><a href="${it.html_url}" target="_blank">${it.title}</a></div>`,
        `<div class="author">${author}</div>`,
        "</div>"
      );
    }

    html.push("</div>");
  }

  html.push("</div>", "</body>", "</html>");
  return html.join("\n");
}

function writeOutput(content, outputPath) {
  if (!outputPath || outputPath === "-") {
    console.log(content);
  } else {
    try {
      writeFileSync(outputPath, content, "utf8");
      console.error(`Output written to: ${outputPath}`);
    } catch (err) {
      throw new Error(`Failed to write output file: ${err.message}`);
    }
  }
}

/**
 * Main Application Entry Point
 * ===========================
 * Orchestrates the entire application flow from argument parsing to output generation
 */

/**
 * Main function that coordinates the entire application
 *
 * This is the primary entry point that:
 * 1. Parses command line arguments
 * 2. Loads configuration files if specified
 * 3. Validates all input parameters
 * 4. Fetches commits from GitHub API
 * 5. Applies filters and transformations
 * 6. Generates output in the requested format
 * 7. Handles errors and provides helpful messages
 *
 * The function supports multiple authentication methods, various output formats,
 * and comprehensive error handling for a robust user experience.
 *
 * @async
 * @throws {Error} If validation fails, API requests fail, or output generation fails
 *
 * @example
 * // Called automatically when script is executed
 * // node titles.js --owner user --repo repo --start "7 days ago" --end "today"
 */
async function main() {
  try {
    const args = parseArgs(process.argv.slice(2));
    if (args.help) {
      console.log(HELP.trim());
      process.exit(0);
    }

    // Load configuration file if specified
    let config = {};
    if (args.config) {
      config = loadConfig(args.config);
    }

    // Auto-detect git repository information if --auto flag is used
    let gitInfo = {};
    if (args.auto) {
      gitInfo = autoDetectGitInfo();
      
      if (!gitInfo.isGitRepo) {
        throw new Error("--auto flag requires being run from within a git repository");
      }
      
      if (!gitInfo.owner || !gitInfo.repo) {
        throw new Error("Could not auto-detect GitHub repository information. Ensure you have a GitHub remote configured (origin/upstream).");
      }
      
      if (args.verbose) {
        console.error(`Auto-detected: ${gitInfo.owner}/${gitInfo.repo} (${gitInfo.branch})`);
        if (gitInfo.remotes.length > 1) {
          console.error(`Available remotes: ${gitInfo.remotes.map(r => r.name).join(", ")}`);
        }
      }
    }

    // Merge config with git auto-detection and command line args (CLI args take precedence)
    const finalArgs = { ...config, ...gitInfo, ...args };

    // Validate required arguments
    const required = ["owner", "repo", "branch", "start", "end"];
    for (const k of required) {
      if (!finalArgs[k]) {
        console.error(`Missing --${k}\n`);
        console.error(HELP.trim());
        process.exit(1);
      }
    }

    // Validate and sanitize inputs
    const owner = validateOwner(finalArgs.owner);
    const repo = validateRepo(finalArgs.repo);
    const branch = validateBranch(finalArgs.branch);
    const startDate = validateDate(finalArgs.start, "start");
    const endDate = validateDate(finalArgs.end, "end");
    const max = validateMax(finalArgs.max);
    const token = validateToken(
      finalArgs.token || process.env.GITHUB_TOKEN || getGitHubCLIToken() || ""
    );
    const retries = finalArgs.retry ? parseInt(finalArgs.retry) : 3;
    const timeout = finalArgs.timeout ? parseInt(finalArgs.timeout) : 30000;
    const excludePattern = validateRegex(
      finalArgs.excludePattern,
      "exclude-pattern"
    );
    const includePattern = validateRegex(
      finalArgs.includePattern,
      "include-pattern"
    );

    // Validate date range (allow same day for start/end)
    if (startDate > endDate) {
      throw new Error("--start date must be before or equal to --end date");
    }

    // Handle special case for same-day ranges
    let startISO = startDate.toISOString();
    let endISO = endDate.toISOString();

    // If both dates are the same day, set end to end of that day
    if (startDate.toDateString() === endDate.toDateString()) {
      const endOfDay = new Date(endDate);
      endOfDay.setHours(23, 59, 59, 999);
      endISO = endOfDay.toISOString();
    }

    // Ensure output directory exists
    ensureOutputDirectory(finalArgs.output);

    if (finalArgs.verbose) {
      console.error(`Fetching commits from ${owner}/${repo} (${branch})`);
      console.error(`Date range: ${startISO} to ${endISO}`);
      if (max) console.error(`Max commits: ${max}`);
      if (token) {
        if (finalArgs.token) {
          console.error("Using GitHub token from command line");
        } else if (process.env.GITHUB_TOKEN) {
          console.error("Using GitHub token from environment variable");
        } else {
          console.error("Using GitHub token from GitHub CLI");
        }
      } else {
        console.error("Warning: No GitHub token provided (rate limit: 60/hr)");
        console.error(
          "  Use --token, GITHUB_TOKEN env var, or 'gh auth login'"
        );
      }
      if (excludePattern)
        console.error(`Exclude pattern: ${excludePattern.source}`);
      if (includePattern)
        console.error(`Include pattern: ${includePattern.source}`);
    }

    const commits = await fetchCommits({
      owner,
      repo,
      branch,
      startISO,
      endISO,
      author: finalArgs.author,
      committer: finalArgs.committer,
      token,
      max,
      verbose: finalArgs.verbose,
      retries,
      timeout,
    });

    if (commits.length === 0) {
      if (finalArgs.verbose) {
        console.error("No commits found in the specified date range");
      }
      process.exit(0);
    }

    // Map down to fields we may want
    let items = commits.map((c) => ({
      sha: c.sha,
      title: firstLine(c?.commit?.message || ""),
      date: c?.commit?.author?.date || c?.commit?.committer?.date || null,
      html_url: c?.html_url,
      author_login: c?.author?.login || null,
      committer_login: c?.committer?.login || null,
    }));

    // Apply filters
    if (finalArgs.excludeMerges) {
      const beforeCount = items.length;
      items = items.filter((i) => !/^merge\b/i.test(i.title));
      if (finalArgs.verbose && beforeCount !== items.length) {
        console.error(`Excluded ${beforeCount - items.length} merge commits`);
      }
    }

    if (excludePattern) {
      const beforeCount = items.length;
      items = items.filter((i) => !excludePattern.test(i.title));
      if (finalArgs.verbose && beforeCount !== items.length) {
        console.error(
          `Excluded ${
            beforeCount - items.length
          } commits matching exclude pattern`
        );
      }
    }

    if (includePattern) {
      const beforeCount = items.length;
      items = items.filter((i) => includePattern.test(i.title));
      if (finalArgs.verbose && beforeCount !== items.length) {
        console.error(
          `Included ${items.length} commits matching include pattern`
        );
      }
    }

    const format = (finalArgs.format || "text").toLowerCase();
    let output;

    switch (format) {
      case "text":
        output = items
          .map((it) => it.title)
          .filter(Boolean)
          .join("\n");
        break;
      case "grouped":
        output = outputGrouped(items);
        break;
      case "timesheet":
        output = outputTimesheet(items);
        break;
      case "summary":
        output = outputSummary(items, finalArgs, startISO, endISO);
        break;
      case "json":
        output = outputJSON(items, finalArgs, startISO, endISO);
        break;
      case "ndjson":
        output = outputNDJSON(items);
        break;
      case "csv":
        output = outputCSV(items);
        break;
      case "markdown":
        output = outputMarkdown(items, finalArgs, startISO, endISO);
        break;
      case "html":
        output = outputHTML(items, finalArgs, startISO, endISO);
        break;
      default:
        console.error(
          `Unknown --format ${finalArgs.format}. Use text|grouped|timesheet|summary|json|ndjson|csv|markdown|html.`
        );
        process.exit(2);
    }

    writeOutput(output, finalArgs.output);

    if (finalArgs.verbose) {
      console.error(`Output ${items.length} commits in ${format} format`);

      if (finalArgs.stats && items.length > 0) {
        const stats = generateStats(items);
        console.error("\nCommit Statistics:");
        console.error(`   Total commits: ${stats.total}`);
        console.error(`   Average per day: ${stats.averagePerDay}`);
        console.error(
          `   Unique authors: ${Object.keys(stats.byAuthor).length}`
        );
        console.error(
          `   Days with activity: ${Object.keys(stats.byDate).length}`
        );

        // Show top commit types
        const topTypes = Object.entries(stats.byType)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 3);
        if (topTypes.length > 0) {
          console.error("   Top commit types:");
          for (const [type, count] of topTypes) {
            const percentage = ((count / stats.total) * 100).toFixed(1);
            console.error(`     ${type}: ${count} (${percentage}%)`);
          }
        }
      }
    }
  } catch (err) {
    console.error(err?.message || err);
    process.exit(1);
  }
}

// Execute the main function
main();
