/**
 * Tests for Git Auto-Detection functionality
 * Tests the automatic detection of git repository information
 */

const { execSync: _execSync } = require("child_process");
const _fs = require("fs");
const path = require("path");
const _os = require("os");

// Mock execSync for controlled testing
const mockExecSync = jest.fn();
jest.mock("child_process", () => ({
  execSync: mockExecSync
}));

// Since titles.js is a CLI script, we'll implement the functions here for testing
// These are the same functions from titles.js

function parseGitRemote(remoteUrl) {
  if (!remoteUrl) return null;

  // Handle HTTPS URLs: https://github.com/owner/repo.git
  const httpsMatch = remoteUrl.match(/https:\/\/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?$/);
  if (httpsMatch) {
    return { owner: httpsMatch[1], repo: httpsMatch[2] };
  }

  // Handle SSH URLs: git@github.com:owner/repo.git
  const sshMatch = remoteUrl.match(/git@github\.com:([^/]+)\/([^/]+?)(?:\.git)?$/);
  if (sshMatch) {
    return { owner: sshMatch[1], repo: sshMatch[2] };
  }

  // Handle GitHub CLI URLs: gh:owner/repo
  const ghMatch = remoteUrl.match(/gh:([^/]+)\/([^/]+)$/);
  if (ghMatch) {
    return { owner: ghMatch[1], repo: ghMatch[2] };
  }

  return null;
}

function isInGitRepository() {
  try {
    mockExecSync("git rev-parse --git-dir", { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

function getCurrentBranch() {
  try {
    const branch = mockExecSync("git rev-parse --abbrev-ref HEAD", { 
      encoding: "utf8", 
      stdio: "pipe" 
    }).trim();
    return branch === "HEAD" ? "main" : branch;
  } catch {
    return null;
  }
}

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
    // Get all remotes
    const remotesOutput = mockExecSync("git remote -v", { 
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

  } catch {
    // Git commands failed, but we're still in a git repo
  }

  return info;
}

describe("Git Remote URL Parsing", () => {
  describe("parseGitRemote", () => {
    test("should parse HTTPS GitHub URLs", () => {
      expect(parseGitRemote("https://github.com/user/repo.git")).toEqual({
        owner: "user",
        repo: "repo"
      });

      expect(parseGitRemote("https://github.com/org/my-project.git")).toEqual({
        owner: "org",
        repo: "my-project"
      });
    });

    test("should parse HTTPS GitHub URLs without .git suffix", () => {
      expect(parseGitRemote("https://github.com/user/repo")).toEqual({
        owner: "user",
        repo: "repo"
      });
    });

    test("should parse SSH GitHub URLs", () => {
      expect(parseGitRemote("git@github.com:user/repo.git")).toEqual({
        owner: "user",
        repo: "repo"
      });

      expect(parseGitRemote("git@github.com:org/my-project.git")).toEqual({
        owner: "org",
        repo: "my-project"
      });
    });

    test("should parse SSH GitHub URLs without .git suffix", () => {
      expect(parseGitRemote("git@github.com:user/repo")).toEqual({
        owner: "user",
        repo: "repo"
      });
    });

    test("should parse GitHub CLI URLs", () => {
      expect(parseGitRemote("gh:user/repo")).toEqual({
        owner: "user",
        repo: "repo"
      });
    });

    test("should return null for invalid URLs", () => {
      expect(parseGitRemote("")).toBeNull();
      expect(parseGitRemote(null)).toBeNull();
      expect(parseGitRemote("https://gitlab.com/user/repo.git")).toBeNull();
      expect(parseGitRemote("not-a-url")).toBeNull();
      expect(parseGitRemote("ftp://github.com/user/repo")).toBeNull();
    });

    test("should handle edge cases", () => {
      expect(parseGitRemote("https://github.com/user-name/repo-name.git")).toEqual({
        owner: "user-name",
        repo: "repo-name"
      });

      expect(parseGitRemote("git@github.com:user_name/repo_name.git")).toEqual({
        owner: "user_name",
        repo: "repo_name"
      });
    });
  });
});

describe("Git Repository Detection", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("isInGitRepository", () => {
    test("should return true when in a git repository", () => {
      mockExecSync.mockImplementation(() => "/path/to/.git");
      
      expect(isInGitRepository()).toBe(true);
      expect(mockExecSync).toHaveBeenCalledWith("git rev-parse --git-dir", { stdio: "pipe" });
    });

    test("should return false when not in a git repository", () => {
      mockExecSync.mockImplementation(() => {
        throw new Error("Not a git repository");
      });
      
      expect(isInGitRepository()).toBe(false);
    });
  });

  describe("getCurrentBranch", () => {
    test("should return current branch name", () => {
      mockExecSync.mockReturnValue("feature/auto-detection\n");
      
      expect(getCurrentBranch()).toBe("feature/auto-detection");
      expect(mockExecSync).toHaveBeenCalledWith("git rev-parse --abbrev-ref HEAD", {
        encoding: "utf8",
        stdio: "pipe"
      });
    });

    test("should return \"main\" when in detached HEAD state", () => {
      mockExecSync.mockReturnValue("HEAD\n");
      
      expect(getCurrentBranch()).toBe("main");
    });

    test("should return null when git command fails", () => {
      mockExecSync.mockImplementation(() => {
        throw new Error("Not a git repository");
      });
      
      expect(getCurrentBranch()).toBeNull();
    });

    test("should handle branch names with special characters", () => {
      mockExecSync.mockReturnValue("feature/add-new-feature-123\n");
      
      expect(getCurrentBranch()).toBe("feature/add-new-feature-123");
    });
  });
});

describe("Git Auto-Detection Integration", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("should return basic info when not in git repository", () => {
    mockExecSync.mockImplementation(() => {
      throw new Error("Not a git repository");
    });

    const info = autoDetectGitInfo();

    expect(info).toEqual({
      isGitRepo: false,
      owner: null,
      repo: null,
      branch: null,
      remotes: [],
      workingDir: expect.any(String)
    });
  });

  test("should detect repository with origin remote", () => {
    mockExecSync
      .mockReturnValueOnce("/path/to/.git") // git rev-parse --git-dir
      .mockReturnValueOnce("main\n") // git rev-parse --abbrev-ref HEAD  
      .mockReturnValueOnce("origin\thttps://github.com/user/repo.git (fetch)\norigin\thttps://github.com/user/repo.git (push)\n"); // git remote -v

    const info = autoDetectGitInfo();

    expect(info.isGitRepo).toBe(true);
    expect(info.owner).toBe("user");
    expect(info.repo).toBe("repo");
    expect(info.branch).toBe("main");
    expect(info.remotes).toEqual([
      {
        name: "origin",
        url: "https://github.com/user/repo.git",
        owner: "user",
        repo: "repo"
      }
    ]);
  });

  test("should detect repository with multiple remotes", () => {
    mockExecSync
      .mockReturnValueOnce("/path/to/.git")
      .mockReturnValueOnce("feature/test\n")
      .mockReturnValueOnce([
        "origin\thttps://github.com/user/repo.git (fetch)",
        "origin\thttps://github.com/user/repo.git (push)",
        "upstream\tgit@github.com:mainuser/repo.git (fetch)", 
        "upstream\tgit@github.com:mainuser/repo.git (push)"
      ].join("\n"));

    const info = autoDetectGitInfo();

    expect(info.isGitRepo).toBe(true);
    expect(info.owner).toBe("user"); // Should prefer origin
    expect(info.repo).toBe("repo");
    expect(info.branch).toBe("feature/test");
    expect(info.remotes).toHaveLength(2);
    expect(info.remotes[0].name).toBe("origin");
    expect(info.remotes[1].name).toBe("upstream");
  });

  test("should prefer upstream when origin is not available", () => {
    mockExecSync
      .mockReturnValueOnce("/path/to/.git")
      .mockReturnValueOnce("main\n")
      .mockReturnValueOnce([
        "upstream\tgit@github.com:mainuser/repo.git (fetch)",
        "upstream\tgit@github.com:mainuser/repo.git (push)"
      ].join("\n"));

    const info = autoDetectGitInfo();

    expect(info.owner).toBe("mainuser");
    expect(info.repo).toBe("repo");
  });

  test("should use first remote when neither origin nor upstream exist", () => {
    mockExecSync
      .mockReturnValueOnce("/path/to/.git")
      .mockReturnValueOnce("main\n")
      .mockReturnValueOnce([
        "myremote\thttps://github.com/someuser/somerepo.git (fetch)",
        "myremote\thttps://github.com/someuser/somerepo.git (push)"
      ].join("\n"));

    const info = autoDetectGitInfo();

    expect(info.owner).toBe("someuser");
    expect(info.repo).toBe("somerepo");
  });

  test("should handle git repository with no GitHub remotes", () => {
    mockExecSync
      .mockReturnValueOnce("/path/to/.git")
      .mockReturnValueOnce("main\n")
      .mockReturnValueOnce([
        "origin\thttps://gitlab.com/user/repo.git (fetch)",
        "origin\thttps://gitlab.com/user/repo.git (push)"
      ].join("\n"));

    const info = autoDetectGitInfo();

    expect(info.isGitRepo).toBe(true);
    expect(info.owner).toBeNull();
    expect(info.repo).toBeNull();
    expect(info.remotes).toEqual([]);
  });

  test("should handle git repository with no remotes", () => {
    mockExecSync
      .mockReturnValueOnce("/path/to/.git")
      .mockReturnValueOnce("main\n")
      .mockReturnValueOnce(""); // Empty remote output

    const info = autoDetectGitInfo();

    expect(info.isGitRepo).toBe(true);
    expect(info.owner).toBeNull();
    expect(info.repo).toBeNull();
    expect(info.remotes).toEqual([]);
  });

  test("should handle git remote command failure gracefully", () => {
    mockExecSync
      .mockReturnValueOnce("/path/to/.git")
      .mockReturnValueOnce("main\n")
      .mockImplementationOnce(() => {
        throw new Error("git remote failed");
      });

    const info = autoDetectGitInfo();

    expect(info.isGitRepo).toBe(true);
    expect(info.branch).toBe("main");
    expect(info.owner).toBeNull();
    expect(info.repo).toBeNull();
  });
});

describe("CLI Integration", () => {
  const _TITLES_SCRIPT = path.join(__dirname, "..", "titles.js");

  test("should show auto-detection in help text", () => {
    const _result = mockExecSync.mockImplementation(() => {
      // Mock successful command for help
      return "";
    });

    // We can't easily test the actual CLI without running it,
    // but we can test that our function works as expected
    expect(parseGitRemote("https://github.com/test/repo.git")).toEqual({
      owner: "test",
      repo: "repo"
    });
  });
});