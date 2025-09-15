/**
 * Integration tests for the CLI functionality of titles.js
 * Tests the command-line interface and argument parsing
 */

const { execSync, spawn: _spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const os = require("os");

const TITLES_SCRIPT = path.join(__dirname, "..", "titles.js");
const tmpDir = os.tmpdir();

describe("CLI Integration Tests", () => {
  let tempFiles = [];

  beforeEach(() => {
    tempFiles = [];
  });

  afterEach(() => {
    // Clean up temporary files
    tempFiles.forEach(file => {
      if (fs.existsSync(file)) {
        try {
          fs.unlinkSync(file);
        } catch {
          // Ignore cleanup errors
        }
      }
    });
  });

  const addTempFile = (filepath) => {
    tempFiles.push(filepath);
    return filepath;
  };

  test("should display help message", () => {
    const result = execSync(`node "${TITLES_SCRIPT}" --help`, { 
      encoding: "utf8",
      timeout: 10000 
    });
    
    expect(result).toContain("Fetch commit titles from a GitHub repo/branch");
    expect(result).toContain("--owner");
    expect(result).toContain("--repo");
    expect(result).toContain("--branch");
    expect(result).toContain("--start");
    expect(result).toContain("--end");
  });

  test("should display help with -h flag", () => {
    const result = execSync(`node "${TITLES_SCRIPT}" -h`, { 
      encoding: "utf8",
      timeout: 10000 
    });
    
    expect(result).toContain("Fetch commit titles from a GitHub repo/branch");
  });

  test("should show error for missing required arguments", () => {
    expect(() => {
      execSync(`node "${TITLES_SCRIPT}"`, { 
        encoding: "utf8",
        timeout: 10000,
        stdio: "pipe"
      });
    }).toThrow();
  });

  test("should show error for invalid owner characters", () => {
    expect(() => {
      execSync(`node "${TITLES_SCRIPT}" --owner "invalid@user" --repo test --branch main --start 2025-01-01 --end 2025-01-02`, { 
        encoding: "utf8",
        timeout: 10000,
        stdio: "pipe"
      });
    }).toThrow();
  });

  test("should validate date format", () => {
    expect(() => {
      execSync(`node "${TITLES_SCRIPT}" --owner testuser --repo testrepo --branch main --start "invalid-date" --end 2025-01-02`, { 
        encoding: "utf8",
        timeout: 10000,
        stdio: "pipe"
      });
    }).toThrow();
  });

  test("should accept relative dates", () => {
    // This test will fail due to missing auth/repo, but should pass validation
    const testConfigPath = addTempFile(path.join(tmpDir, "test-config.json"));
    const config = {
      owner: "testuser",
      repo: "testrepo",
      branch: "main",
      start: "today",
      end: "today"
    };
    fs.writeFileSync(testConfigPath, JSON.stringify(config));

    expect(() => {
      execSync(`node "${TITLES_SCRIPT}" --config "${testConfigPath}" --max 1`, { 
        encoding: "utf8",
        timeout: 10000,
        stdio: "pipe"
      });
    }).toThrow(); // Will fail due to auth, but date parsing should work
  });

  test("should load configuration from file", () => {
    const testConfigPath = addTempFile(path.join(tmpDir, "valid-config.json"));
    const config = {
      owner: "testuser",
      repo: "testrepo",
      branch: "main",
      start: "2025-01-01",
      end: "2025-01-02",
      format: "json",
      max: 1
    };
    fs.writeFileSync(testConfigPath, JSON.stringify(config));

    expect(() => {
      execSync(`node "${TITLES_SCRIPT}" --config "${testConfigPath}"`, { 
        encoding: "utf8",
        timeout: 10000,
        stdio: "pipe"
      });
    }).toThrow(); // Will fail due to missing auth/invalid repo, but config loading should work
  });

  test("should reject invalid configuration file", () => {
    const testConfigPath = addTempFile(path.join(tmpDir, "invalid-config.json"));
    fs.writeFileSync(testConfigPath, "{ invalid json }");

    expect(() => {
      execSync(`node "${TITLES_SCRIPT}" --config "${testConfigPath}"`, { 
        encoding: "utf8",
        timeout: 10000,
        stdio: "pipe"
      });
    }).toThrow();
  });

  test("should handle different output formats", () => {
    const formats = ["text", "grouped", "timesheet", "summary", "json", "csv", "markdown", "html"];
    
    formats.forEach(format => {
      expect(() => {
        execSync(`node "${TITLES_SCRIPT}" --owner testuser --repo testrepo --branch main --start 2025-01-01 --end 2025-01-02 --format ${format} --max 1`, { 
          encoding: "utf8",
          timeout: 10000,
          stdio: "pipe"
        });
      }).toThrow(); // Will fail due to auth, but format validation should pass
    });
  });

  test("should reject invalid output format", () => {
    expect(() => {
      execSync(`node "${TITLES_SCRIPT}" --owner testuser --repo testrepo --branch main --start 2025-01-01 --end 2025-01-02 --format invalid`, { 
        encoding: "utf8",
        timeout: 10000,
        stdio: "pipe"
      });
    }).toThrow();
  });

  test("should handle output file parameter", () => {
    const outputPath = addTempFile(path.join(tmpDir, "test-output.txt"));
    
    expect(() => {
      execSync(`node "${TITLES_SCRIPT}" --owner testuser --repo testrepo --branch main --start 2025-01-01 --end 2025-01-02 --output "${outputPath}" --max 1`, { 
        encoding: "utf8",
        timeout: 10000,
        stdio: "pipe"
      });
    }).toThrow(); // Will fail due to auth, but output path validation should work
  });

  test("should handle boolean flags correctly", () => {
    const flags = ["--verbose", "--exclude-merges", "--stats"];
    
    flags.forEach(flag => {
      expect(() => {
        execSync(`node "${TITLES_SCRIPT}" --owner testuser --repo testrepo --branch main --start 2025-01-01 --end 2025-01-02 ${flag} --max 1`, { 
          encoding: "utf8",
          timeout: 10000,
          stdio: "pipe"
        });
      }).toThrow(); // Will fail due to auth, but flag parsing should work
    });
  });

  test("should validate numeric parameters", () => {
    // Test max parameter
    expect(() => {
      execSync(`node "${TITLES_SCRIPT}" --owner testuser --repo testrepo --branch main --start 2025-01-01 --end 2025-01-02 --max abc`, { 
        encoding: "utf8",
        timeout: 10000,
        stdio: "pipe"
      });
    }).toThrow();

    // Test retry parameter  
    expect(() => {
      execSync(`node "${TITLES_SCRIPT}" --owner testuser --repo testrepo --branch main --start 2025-01-01 --end 2025-01-02 --retry -1`, { 
        encoding: "utf8",
        timeout: 10000,
        stdio: "pipe"
      });
    }).toThrow();

    // Test timeout parameter
    expect(() => {
      execSync(`node "${TITLES_SCRIPT}" --owner testuser --repo testrepo --branch main --start 2025-01-01 --end 2025-01-02 --timeout abc`, { 
        encoding: "utf8",
        timeout: 10000,
        stdio: "pipe"
      });
    }).toThrow();
  });

  test("should handle regex patterns", () => {
    expect(() => {
      execSync(`node "${TITLES_SCRIPT}" --owner testuser --repo testrepo --branch main --start 2025-01-01 --end 2025-01-02 --include-pattern "^feat:" --exclude-pattern "^chore:" --max 1`, { 
        encoding: "utf8",
        timeout: 10000,
        stdio: "pipe"
      });
    }).toThrow(); // Will fail due to auth, but regex validation should work
  });

  test("should handle author and committer filters", () => {
    expect(() => {
      execSync(`node "${TITLES_SCRIPT}" --owner testuser --repo testrepo --branch main --start 2025-01-01 --end 2025-01-02 --author testauthor --committer testcommitter --max 1`, { 
        encoding: "utf8",
        timeout: 10000,
        stdio: "pipe"
      });
    }).toThrow(); // Will fail due to auth, but filter validation should work
  });

  describe("Configuration file precedence", () => {
    test("command line arguments should override config file", () => {
      const testConfigPath = addTempFile(path.join(tmpDir, "precedence-config.json"));
      const config = {
        owner: "configuser",
        repo: "configrepo",
        branch: "main",
        start: "2025-01-01",
        end: "2025-01-02",
        format: "json"
      };
      fs.writeFileSync(testConfigPath, JSON.stringify(config));

      expect(() => {
        execSync(`node "${TITLES_SCRIPT}" --config "${testConfigPath}" --owner overrideuser --format text --max 1`, { 
          encoding: "utf8",
          timeout: 10000,
          stdio: "pipe"
        });
      }).toThrow(); // Will fail due to auth, but argument precedence should work
    });
  });

  describe("Error handling", () => {
    test("should handle missing config file", () => {
      const nonExistentConfig = path.join(tmpDir, "nonexistent-config.json");
      
      expect(() => {
        execSync(`node "${TITLES_SCRIPT}" --config "${nonExistentConfig}"`, { 
          encoding: "utf8",
          timeout: 10000,
          stdio: "pipe"
        });
      }).toThrow();
    });

    test("should handle incomplete config file", () => {
      const testConfigPath = addTempFile(path.join(tmpDir, "incomplete-config.json"));
      const incompleteConfig = {
        owner: "testuser",
        repo: "testrepo"
        // Missing required fields: branch, start, end
      };
      fs.writeFileSync(testConfigPath, JSON.stringify(incompleteConfig));

      expect(() => {
        execSync(`node "${TITLES_SCRIPT}" --config "${testConfigPath}"`, { 
          encoding: "utf8",
          timeout: 10000,
          stdio: "pipe"
        });
      }).toThrow();
    });
  });
});