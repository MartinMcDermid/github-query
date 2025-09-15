/**
 * Test helper utilities
 * Common functions and mocks for testing
 */

const fs = require("fs");
const path = require("path");
const os = require("os");

/**
 * Create a temporary file for testing
 * @param {string} filename 
 * @param {string} content 
 * @returns {string} Full path to the temporary file
 */
function createTempFile(filename, content = "") {
  const tempDir = os.tmpdir();
  const filePath = path.join(tempDir, filename);
  fs.writeFileSync(filePath, content);
  return filePath;
}

/**
 * Clean up temporary files
 * @param {string[]} filePaths 
 */
function cleanupTempFiles(filePaths) {
  filePaths.forEach(filePath => {
    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch {
        // Ignore cleanup errors
      }
    }
  });
}

/**
 * Mock GitHub API response
 * @param {Array} commits 
 * @param {number} status 
 * @returns {Object} Mock response object
 */
function mockGitHubResponse(commits = [], status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Map([
      ["x-ratelimit-remaining", "4999"],
      ["x-ratelimit-limit", "5000"],
      ["x-ratelimit-reset", Math.floor(Date.now() / 1000) + 3600]
    ]),
    json: async () => commits
  };
}

/**
 * Create sample commit data for testing
 * @param {number} count 
 * @returns {Array} Array of mock commit objects
 */
function createMockCommits(count = 3) {
  const commits = [];
  const baseDate = new Date("2025-01-15T10:00:00Z");
  
  for (let i = 0; i < count; i++) {
    const commitDate = new Date(baseDate.getTime() + (i * 24 * 60 * 60 * 1000));
    commits.push({
      sha: `abc${i.toString().padStart(3, "0")}`,
      commit: {
        message: `feat: add feature ${i + 1}`,
        author: {
          name: `Author ${i + 1}`,
          date: commitDate.toISOString()
        }
      },
      author: {
        login: `user${i + 1}`
      },
      html_url: `https://github.com/test/repo/commit/abc${i.toString().padStart(3, "0")}`
    });
  }
  
  return commits;
}

/**
 * Mock console methods for testing output
 */
function mockConsole() {
  const originalConsole = { ...console };
  const logs = [];
  const errors = [];
  const warns = [];
  
  console.log = jest.fn((...args) => {
    logs.push(args.join(" "));
  });
  
  console.error = jest.fn((...args) => {
    errors.push(args.join(" "));
  });
  
  console.warn = jest.fn((...args) => {
    warns.push(args.join(" "));
  });
  
  return {
    logs,
    errors, 
    warns,
    restore: () => {
      console.log = originalConsole.log;
      console.error = originalConsole.error;
      console.warn = originalConsole.warn;
    }
  };
}

/**
 * Extract functions from titles.js for unit testing
 * Since titles.js is a CLI script, this helper extracts testable functions
 */
function extractFunctionsFromTitles() {
  const titlesPath = path.join(__dirname, "..", "titles.js");
  const content = fs.readFileSync(titlesPath, "utf8");
  
  // Extract function definitions using regex
  const functions = {};
  const functionRegex = /function\s+(\w+)\s*\([^)]*\)\s*{[\s\S]*?^}/gm;
  let match;
  
  while ((match = functionRegex.exec(content)) !== null) {
    const funcName = match[1];
    const funcCode = match[0];
    
    try {
      // Create a sandbox to evaluate the function
      const vm = require("vm");
      const context = {
        require,
        console,
        process,
        Buffer,
        Date,
        JSON,
        parseInt,
        parseFloat,
        Math,
        RegExp,
        String,
        Array,
        Object,
        Error,
        SyntaxError,
        __dirname: path.join(__dirname, ".."),
        __filename: path.join(__dirname, "..", "titles.js")
      };
      
      // Add Node.js modules to context
      context.fs = require("fs");
      context.path = require("path");
      context.os = require("os");
      context.yaml = require("yaml");
      
      vm.runInNewContext(funcCode, context);
      if (context[funcName] && typeof context[funcName] === "function") {
        functions[funcName] = context[funcName];
      }
    } catch (_e) {
      // Some functions might have dependencies that can't be easily mocked
      console.warn(`Could not extract function ${funcName}:`, _e.message);
    }
  }
  
  return functions;
}

module.exports = {
  createTempFile,
  cleanupTempFiles,
  mockGitHubResponse,
  createMockCommits,
  mockConsole,
  extractFunctionsFromTitles
};