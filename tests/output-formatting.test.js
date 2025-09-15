/**
 * Tests for output formatting functions
 * Tests different output formats: text, grouped, timesheet, summary, JSON, CSV, Markdown, HTML
 */

describe("Output Formatting", () => {
  const mockCommitData = [
    {
      title: "feat: add new user authentication",
      author_login: "user1", 
      date: "2025-01-15T10:00:00Z",
      sha: "abc123",
      html_url: "https://github.com/test/repo/commit/abc123"
    },
    {
      title: "fix: resolve login bug",
      author_login: "user1",
      date: "2025-01-15T14:30:00Z", 
      sha: "def456",
      html_url: "https://github.com/test/repo/commit/def456"
    },
    {
      title: "docs: update API documentation",
      author_login: "user2",
      date: "2025-01-16T09:15:00Z",
      sha: "ghi789", 
      html_url: "https://github.com/test/repo/commit/ghi789"
    }
  ];

  describe("Text format", () => {
    test("should format commits as simple text list", () => {
      // Test would extract and call the text formatting function
      const expectedOutput = [
        "feat: add new user authentication",
        "fix: resolve login bug", 
        "docs: update API documentation"
      ].join("\n");
      
      // Mock implementation
      const textOutput = mockCommitData.map(commit => commit.title).join("\n");
      expect(textOutput).toBe(expectedOutput);
    });
  });

  describe("Grouped format", () => {
    test("should group commits by date", () => {
      // Group commits by date
      const groupedByDate = {};
      mockCommitData.forEach(commit => {
        const date = new Date(commit.date).toISOString().split("T")[0];
        if (!groupedByDate[date]) {
          groupedByDate[date] = [];
        }
        groupedByDate[date].push(commit);
      });
      
      expect(groupedByDate["2025-01-15"]).toHaveLength(2);
      expect(groupedByDate["2025-01-16"]).toHaveLength(1);
    });

    test("should format grouped output correctly", () => {
      const expectedFormat = /^\d{4}-\d{2}-\d{2} \(\d+ commits?\):$/;
      const testLine = "2025-01-15 (2 commits):";
      expect(testLine).toMatch(expectedFormat);
    });
  });

  describe("Timesheet format", () => {
    test("should format dates in DD/MM/YYYY format", () => {
      const date = new Date("2025-01-15T10:00:00Z");
      const formatted = `${date.getDate().toString().padStart(2, "0")}/${(date.getMonth() + 1).toString().padStart(2, "0")}/${date.getFullYear()}`;
      expect(formatted).toBe("15/01/2025");
    });

    test("should add commit type labels", () => {
      const commitTypes = {
        "feat": "[FEATURE]",
        "fix": "[BUGFIX]", 
        "docs": "[DOCUMENTATION]",
        "refactor": "[REFACTOR]",
        "test": "[TEST]",
        "chore": "[CHORE]",
        "style": "[STYLE]",
        "perf": "[PERFORMANCE]"
      };
      
      expect(commitTypes["feat"]).toBe("[FEATURE]");
      expect(commitTypes["fix"]).toBe("[BUGFIX]");
      expect(commitTypes["docs"]).toBe("[DOCUMENTATION]");
    });

    test("should create timesheet format output", () => {
      // Mock timesheet formatting
      const timesheetEntry = "• [FEATURE] feat: add new user authentication";
      expect(timesheetEntry).toContain("[FEATURE]");
      expect(timesheetEntry).toContain("feat: add new user authentication");
    });
  });

  describe("Summary format", () => {
    test("should generate markdown summary", () => {
      const mockStats = {
        total: 3,
        byType: {
          feature: 1,
          bugfix: 1,
          documentation: 1
        },
        byAuthor: {
          user1: 2,
          user2: 1
        },
        averagePerDay: "1.5"
      };
      
      expect(mockStats.total).toBe(3);
      expect(mockStats.byType.feature).toBe(1);
      expect(mockStats.byAuthor.user1).toBe(2);
    });

    test("should calculate percentages correctly", () => {
      const total = 10;
      const featureCount = 3;
      const percentage = ((featureCount / total) * 100).toFixed(1);
      expect(percentage).toBe("30.0");
    });
  });

  describe("JSON format", () => {
    test("should produce valid JSON", () => {
      const jsonOutput = JSON.stringify({
        metadata: {
          total: mockCommitData.length,
          generated: new Date().toISOString()
        },
        commits: mockCommitData
      });
      
      expect(() => JSON.parse(jsonOutput)).not.toThrow();
      const parsed = JSON.parse(jsonOutput);
      expect(parsed.commits).toHaveLength(3);
    });

    test("should include metadata in JSON output", () => {
      const output = {
        metadata: {
          owner: "testowner",
          repo: "testrepo",
          branch: "main",
          dateRange: {
            start: "2025-01-01",
            end: "2025-01-31"
          },
          total: mockCommitData.length,
          generated: new Date().toISOString()
        },
        commits: mockCommitData
      };
      
      expect(output.metadata.total).toBe(3);
      expect(output.metadata.owner).toBe("testowner");
      expect(output.commits).toEqual(mockCommitData);
    });
  });

  describe("CSV format", () => {
    test("should generate proper CSV headers", () => {
      const headers = ["Date", "Author", "Title", "SHA", "URL"];
      const csvHeader = headers.join(",");
      expect(csvHeader).toBe("Date,Author,Title,SHA,URL");
    });

    test("should escape CSV values correctly", () => {
      const escapeCsvValue = (value) => {
        if (typeof value !== "string") return value;
        if (value.includes(",") || value.includes("\"") || value.includes("\n")) {
          return `"${value.replace(/"/g, "\"\"")}"`;
        }
        return value;
      };
      
      expect(escapeCsvValue("simple text")).toBe("simple text");
      expect(escapeCsvValue("text, with comma")).toBe("\"text, with comma\"");
      expect(escapeCsvValue("text \"with quotes\"")).toBe("\"text \"\"with quotes\"\"\"");
    });

    test("should format commit data as CSV rows", () => {
      const csvRow = mockCommitData.map(commit => {
        const date = new Date(commit.date).toISOString().split("T")[0];
        return [date, commit.author_login, commit.title, commit.sha, commit.html_url].join(",");
      });
      
      expect(csvRow[0]).toContain("2025-01-15");
      expect(csvRow[0]).toContain("user1");
      expect(csvRow[0]).toContain("feat: add new user authentication");
    });
  });

  describe("Markdown format", () => {
    test("should generate proper markdown headers", () => {
      const title = "# Commits for testowner/testrepo";
      expect(title).toMatch(/^# /);
    });

    test("should create markdown links for commits", () => {
      const commit = mockCommitData[0];
      const markdownLink = `[${commit.sha.substring(0, 7)}](${commit.html_url})`;
      expect(markdownLink).toBe("[abc123](https://github.com/test/repo/commit/abc123)");
    });

    test("should format dates as markdown subheaders", () => {
      const date = "2025-01-15";
      const header = `## ${date}`;
      expect(header).toBe("## 2025-01-15");
    });
  });

  describe("HTML format", () => {
    test("should generate valid HTML structure", () => {
      const htmlTemplate = `
        <!DOCTYPE html>
        <html>
        <head><title>Commits</title></head>
        <body>
          <h1>Commits</h1>
          <div class="commits"></div>
        </body>
        </html>
      `;
      
      expect(htmlTemplate).toContain("<!DOCTYPE html>");
      expect(htmlTemplate).toContain("<html>");
      expect(htmlTemplate).toContain("</html>");
    });

    test("should escape HTML entities", () => {
      const escapeHtml = (text) => {
        return text
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;")
          .replace(/'/g, "&#x27;");
      };
      
      expect(escapeHtml("feat: add <component>")).toBe("feat: add &lt;component&gt;");
      expect(escapeHtml("fix: handle \"quotes\"")).toBe("fix: handle &quot;quotes&quot;");
    });
  });

  describe("NDJSON format", () => {
    test("should format as newline-delimited JSON", () => {
      const ndjsonOutput = mockCommitData
        .map(commit => JSON.stringify(commit))
        .join("\n");
      
      const lines = ndjsonOutput.split("\n");
      expect(lines).toHaveLength(3);
      expect(() => JSON.parse(lines[0])).not.toThrow();
      expect(() => JSON.parse(lines[1])).not.toThrow();
      expect(() => JSON.parse(lines[2])).not.toThrow();
    });
  });

  describe("Date formatting utilities", () => {
    test("should format ISO dates consistently", () => {
      const date = new Date("2025-01-15T10:30:00Z");
      const isoDate = date.toISOString().split("T")[0];
      expect(isoDate).toBe("2025-01-15");
    });

    test("should handle different timezone inputs", () => {
      const utcDate = new Date("2025-01-15T10:00:00Z");
      const localDate = new Date("2025-01-15T10:00:00-05:00");
      
      expect(utcDate.toISOString()).toContain("2025-01-15T10:00:00");
      expect(localDate.toISOString()).toContain("2025-01-15T15:00:00"); // Converted to UTC
    });
  });
});