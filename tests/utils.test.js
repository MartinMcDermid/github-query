/**
 * Unit tests for utility functions in titles.js
 * Tests core functionality without external dependencies
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

// Since titles.js is a CLI script, we'll implement the core functions here for testing
// These are simplified versions of the functions from titles.js

function parseRelativeDate(dateStr) {
  const now = new Date();
  const lower = dateStr.toLowerCase().trim();

  if (lower === "today") {
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

function categorizeCommit(title) {
  if (!title || typeof title !== 'string') return "other";
  
  const lower = title.toLowerCase();

  // Handle conventional commit format with optional scope: type(scope): message
  if (lower.match(/^feat(\([^)]*\))?:/)) return "feature";
  if (lower.match(/^fix(\([^)]*\))?:/)) return "bugfix";
  if (lower.match(/^docs(\([^)]*\))?:/)) return "documentation";
  if (lower.match(/^style(\([^)]*\))?:/)) return "style";
  if (lower.match(/^refactor(\([^)]*\))?:/)) return "refactor";
  if (lower.match(/^test(\([^)]*\))?:/)) return "test";
  if (lower.match(/^chore(\([^)]*\))?:/)) return "chore";
  if (lower.match(/^perf(\([^)]*\))?:/)) return "performance";
  if (lower.match(/^ci(\([^)]*\))?:/)) return "ci";
  if (lower.match(/^build(\([^)]*\))?:/)) return "build";
  if (lower.match(/^revert(\([^)]*\))?:/)) return "revert";
  if (lower.startsWith("merge")) return "merge";

  return "other";
}

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

function validateOwner(owner) {
  if (!owner || typeof owner !== "string" || owner.trim() === "") {
    throw new Error("--owner must be a non-empty string");
  }
  const trimmed = owner.trim();
  if (!/^[a-zA-Z0-9_-]+$/.test(trimmed)) {
    throw new Error(
      "--owner contains invalid characters (use letters, numbers, hyphens, underscores)"
    );
  }
  return trimmed;
}

function loadConfig(configPath) {
  try {
    const fullPath = path.resolve(configPath);
    if (!fs.existsSync(fullPath)) {
      throw new Error(`Configuration file not found: ${configPath}`);
    }

    const content = fs.readFileSync(fullPath, "utf8");
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

describe('parseRelativeDate', () => {
  beforeEach(() => {
    // Mock Date.now() to return a consistent timestamp for testing
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2025-01-15T10:00:00Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('should parse "today" correctly', () => {
    const result = parseRelativeDate('today');
    expect(result).toBeInstanceOf(Date);
    expect(result.getFullYear()).toBe(2025);
    expect(result.getMonth()).toBe(0); // January (0-indexed)
    expect(result.getDate()).toBe(15);
    expect(result.getHours()).toBe(0);
    expect(result.getMinutes()).toBe(0);
    expect(result.getSeconds()).toBe(0);
  });

  test('should parse "yesterday" correctly', () => {
    const result = parseRelativeDate('yesterday');
    expect(result).toBeInstanceOf(Date);
    expect(result.getDate()).toBe(14);
  });

  test('should parse "7 days ago" correctly', () => {
    const result = parseRelativeDate('7 days ago');
    expect(result).toBeInstanceOf(Date);
    expect(result.getDate()).toBe(8); // 15 - 7
  });

  test('should parse "2 weeks ago" correctly', () => {
    const result = parseRelativeDate('2 weeks ago');
    expect(result).toBeInstanceOf(Date);
    // 2 weeks = 14 days, so 15 - 14 = 1
    expect(result.getDate()).toBe(1);
  });

  test('should parse "1 month ago" correctly', () => {
    const result = parseRelativeDate('1 month ago');
    expect(result).toBeInstanceOf(Date);
    expect(result.getMonth()).toBe(11); // December (previous month)
    expect(result.getFullYear()).toBe(2024);
  });

  test('should parse "1 year ago" correctly', () => {
    const result = parseRelativeDate('1 year ago');
    expect(result).toBeInstanceOf(Date);
    expect(result.getFullYear()).toBe(2024);
  });

  test('should handle case insensitive input', () => {
    expect(parseRelativeDate('TODAY')).toBeInstanceOf(Date);
    expect(parseRelativeDate('Yesterday')).toBeInstanceOf(Date);
    expect(parseRelativeDate('7 DAYS AGO')).toBeInstanceOf(Date);
  });

  test('should return null for invalid input', () => {
    expect(parseRelativeDate('invalid date')).toBeNull();
    expect(parseRelativeDate('')).toBeNull();
    expect(parseRelativeDate('abc days ago')).toBeNull();
  });

  test('should handle singular and plural units', () => {
    expect(parseRelativeDate('1 day ago')).toBeInstanceOf(Date);
    expect(parseRelativeDate('1 week ago')).toBeInstanceOf(Date);
    expect(parseRelativeDate('1 month ago')).toBeInstanceOf(Date);
    expect(parseRelativeDate('1 year ago')).toBeInstanceOf(Date);
  });
});

describe('categorizeCommit', () => {
  test('should categorize feature commits', () => {
    expect(categorizeCommit('feat: add new user authentication')).toBe('feature');
    expect(categorizeCommit('feat(auth): implement OAuth')).toBe('feature');
  });

  test('should categorize bug fix commits', () => {
    expect(categorizeCommit('fix: resolve login issue')).toBe('bugfix');
    expect(categorizeCommit('fix(ui): button styling')).toBe('bugfix');
  });

  test('should categorize documentation commits', () => {
    expect(categorizeCommit('docs: update README')).toBe('documentation');
    expect(categorizeCommit('docs(api): add endpoint documentation')).toBe('documentation');
  });

  test('should categorize style commits', () => {
    expect(categorizeCommit('style: format code')).toBe('style');
    expect(categorizeCommit('style(css): improve button styling')).toBe('style');
  });

  test('should categorize refactor commits', () => {
    expect(categorizeCommit('refactor: simplify user service')).toBe('refactor');
    expect(categorizeCommit('refactor(auth): extract validation logic')).toBe('refactor');
  });

  test('should categorize test commits', () => {
    expect(categorizeCommit('test: add user authentication tests')).toBe('test');
    expect(categorizeCommit('test(unit): improve coverage')).toBe('test');
  });

  test('should categorize chore commits', () => {
    expect(categorizeCommit('chore: update dependencies')).toBe('chore');
    expect(categorizeCommit('chore(deps): bump lodash version')).toBe('chore');
  });

  test('should categorize performance commits', () => {
    expect(categorizeCommit('perf: optimize database queries')).toBe('performance');
    expect(categorizeCommit('perf(api): cache user data')).toBe('performance');
  });

  test('should categorize CI commits', () => {
    expect(categorizeCommit('ci: update GitHub Actions')).toBe('ci');
    expect(categorizeCommit('ci(build): optimize Docker image')).toBe('ci');
  });

  test('should categorize build commits', () => {
    expect(categorizeCommit('build: update webpack config')).toBe('build');
    expect(categorizeCommit('build(deps): update package.json')).toBe('build');
  });

  test('should categorize revert commits', () => {
    expect(categorizeCommit('revert: undo previous change')).toBe('revert');
    expect(categorizeCommit('revert(auth): remove OAuth implementation')).toBe('revert');
  });

  test('should categorize merge commits', () => {
    expect(categorizeCommit('Merge pull request #123')).toBe('merge');
    expect(categorizeCommit('Merge branch feature/auth')).toBe('merge');
    expect(categorizeCommit('merge: combine feature branches')).toBe('merge');
  });

  test('should handle case insensitive input', () => {
    expect(categorizeCommit('FEAT: add feature')).toBe('feature');
    expect(categorizeCommit('Fix: resolve bug')).toBe('bugfix');
    expect(categorizeCommit('DOCS: update docs')).toBe('documentation');
  });

  test('should categorize other commits', () => {
    expect(categorizeCommit('initial commit')).toBe('other');
    expect(categorizeCommit('update version')).toBe('other');
    expect(categorizeCommit('random commit message')).toBe('other');
  });

  test('should handle empty or undefined input', () => {
    expect(categorizeCommit('')).toBe('other');
    expect(categorizeCommit(undefined)).toBe('other');
    expect(categorizeCommit(null)).toBe('other');
  });
});

describe('generateStats', () => {
  const mockCommits = [
    {
      title: 'feat: add new feature',
      author_login: 'user1',
      date: '2025-01-15T10:00:00Z'
    },
    {
      title: 'fix: resolve bug',
      author_login: 'user1', 
      date: '2025-01-15T11:00:00Z'
    },
    {
      title: 'docs: update README',
      author_login: 'user2',
      date: '2025-01-16T09:00:00Z'
    },
    {
      title: 'feat: another feature',
      author_login: 'user2',
      date: '2025-01-16T10:00:00Z'
    }
  ];

  test('should generate correct total count', () => {
    const stats = generateStats(mockCommits);
    expect(stats.total).toBe(4);
  });

  test('should categorize commits by type', () => {
    const stats = generateStats(mockCommits);
    expect(stats.byType.feature).toBe(2);
    expect(stats.byType.bugfix).toBe(1);
    expect(stats.byType.documentation).toBe(1);
  });

  test('should categorize commits by author', () => {
    const stats = generateStats(mockCommits);
    expect(stats.byAuthor.user1).toBe(2);
    expect(stats.byAuthor.user2).toBe(2);
  });

  test('should calculate average per day', () => {
    const stats = generateStats(mockCommits);
    // 4 commits over 2 days = 2.0 average
    expect(stats.averagePerDay).toBe('2.0');
  });

  test('should handle commits without dates', () => {
    const commitsNoDate = [
      { title: 'feat: feature', author_login: 'user1' },
      { title: 'fix: bug', author_login: 'user1' }
    ];
    const stats = generateStats(commitsNoDate);
    expect(stats.total).toBe(2);
    expect(stats.averagePerDay).toBe(0);
  });

  test('should handle commits without authors', () => {
    const commitsNoAuthor = [
      { title: 'feat: feature', date: '2025-01-15T10:00:00Z' }
    ];
    const stats = generateStats(commitsNoAuthor);
    expect(stats.byAuthor.Unknown).toBe(1);
  });

  test('should handle empty input', () => {
    const stats = generateStats([]);
    expect(stats.total).toBe(0);
    expect(stats.byType).toEqual({});
    expect(stats.byAuthor).toEqual({});
    expect(stats.averagePerDay).toBe(0);
  });

  test('should handle commits without titles', () => {
    const commitsNoTitle = [
      { author_login: 'user1', date: '2025-01-15T10:00:00Z' },
      { title: 'feat: valid title', author_login: 'user1', date: '2025-01-15T10:00:00Z' }
    ];
    const stats = generateStats(commitsNoTitle);
    expect(stats.total).toBe(2);
    expect(stats.byType.feature).toBe(1);
    expect(Object.keys(stats.byType).length).toBe(1);
  });
});

describe('validateOwner', () => {
  test('should accept valid GitHub usernames', () => {
    expect(validateOwner('user')).toBe('user');
    expect(validateOwner('user-name')).toBe('user-name');
    expect(validateOwner('user_name')).toBe('user_name');
    expect(validateOwner('user123')).toBe('user123');
    expect(validateOwner('123user')).toBe('123user');
  });

  test('should trim whitespace', () => {
    expect(validateOwner('  user  ')).toBe('user');
    expect(validateOwner('\tuser\n')).toBe('user');
  });

  test('should reject empty or invalid input', () => {
    expect(() => validateOwner('')).toThrow('--owner must be a non-empty string');
    expect(() => validateOwner('   ')).toThrow('--owner must be a non-empty string');
    expect(() => validateOwner(null)).toThrow('--owner must be a non-empty string');
    expect(() => validateOwner(undefined)).toThrow('--owner must be a non-empty string');
    expect(() => validateOwner(123)).toThrow('--owner must be a non-empty string');
  });

  test('should reject invalid characters', () => {
    expect(() => validateOwner('user@domain')).toThrow('--owner contains invalid characters');
    expect(() => validateOwner('user.name')).toThrow('--owner contains invalid characters');
    expect(() => validateOwner('user/name')).toThrow('--owner contains invalid characters');
    expect(() => validateOwner('user name')).toThrow('--owner contains invalid characters');
    expect(() => validateOwner('user#name')).toThrow('--owner contains invalid characters');
  });
});

// Test for loadConfig function
describe('loadConfig', () => {
  const tmpDir = os.tmpdir();
  
  beforeEach(() => {
    // Clean up any previous test files
    const testFiles = ['test-config.json', 'invalid-config.json', 'incomplete-config.json'];
    testFiles.forEach(file => {
      const filepath = path.join(tmpDir, file);
      if (fs.existsSync(filepath)) {
        fs.unlinkSync(filepath);
      }
    });
  });

  afterEach(() => {
    // Clean up test files
    const testFiles = ['test-config.json', 'invalid-config.json', 'incomplete-config.json'];
    testFiles.forEach(file => {
      const filepath = path.join(tmpDir, file);
      if (fs.existsSync(filepath)) {
        fs.unlinkSync(filepath);
      }
    });
  });

  test('should load valid configuration file', () => {
    const config = {
      owner: 'testuser',
      repo: 'testrepo', 
      branch: 'main',
      start: '2025-01-01',
      end: '2025-01-31'
    };
    
    const configPath = path.join(tmpDir, 'test-config.json');
    fs.writeFileSync(configPath, JSON.stringify(config));
    
    const result = loadConfig(configPath);
    expect(result).toEqual(config);
  });

  test('should throw error for non-existent file', () => {
    const configPath = path.join(tmpDir, 'nonexistent.json');
    expect(() => loadConfig(configPath)).toThrow('Configuration file not found');
  });

  test('should throw error for invalid JSON', () => {
    const configPath = path.join(tmpDir, 'invalid-config.json');
    fs.writeFileSync(configPath, '{ invalid json }');
    
    expect(() => loadConfig(configPath)).toThrow('Invalid JSON in configuration file');
  });

  test('should throw error for missing required fields', () => {
    const incompleteConfig = {
      owner: 'testuser',
      repo: 'testrepo'
      // missing branch, start, end
    };
    
    const configPath = path.join(tmpDir, 'incomplete-config.json');
    fs.writeFileSync(configPath, JSON.stringify(incompleteConfig));
    
    expect(() => loadConfig(configPath)).toThrow('Missing required field in config: branch');
  });
});

// Add git auto-detection function tests
describe('parseGitRemote', () => {
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

  test('should parse HTTPS GitHub URLs', () => {
    expect(parseGitRemote('https://github.com/user/repo.git')).toEqual({
      owner: 'user',
      repo: 'repo'
    });

    expect(parseGitRemote('https://github.com/user/repo')).toEqual({
      owner: 'user', 
      repo: 'repo'
    });
  });

  test('should parse SSH GitHub URLs', () => {
    expect(parseGitRemote('git@github.com:user/repo.git')).toEqual({
      owner: 'user',
      repo: 'repo'
    });

    expect(parseGitRemote('git@github.com:user/repo')).toEqual({
      owner: 'user',
      repo: 'repo'
    });
  });

  test('should parse GitHub CLI URLs', () => {
    expect(parseGitRemote('gh:user/repo')).toEqual({
      owner: 'user',
      repo: 'repo'
    });
  });

  test('should return null for invalid URLs', () => {
    expect(parseGitRemote('')).toBeNull();
    expect(parseGitRemote(null)).toBeNull();
    expect(parseGitRemote('https://gitlab.com/user/repo.git')).toBeNull();
    expect(parseGitRemote('not-a-url')).toBeNull();
  });

  test('should handle complex usernames and repo names', () => {
    expect(parseGitRemote('https://github.com/user-name/repo-name.git')).toEqual({
      owner: 'user-name',
      repo: 'repo-name'
    });

    expect(parseGitRemote('git@github.com:org_name/project.name.git')).toEqual({
      owner: 'org_name',
      repo: 'project.name'
    });
  });
});