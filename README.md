# @bugzy-ai/jira-mcp-server

MCP (Model Context Protocol) server for Jira Server (on-premise) integration. Enables AI assistants like Claude to interact with Jira Server deployments via standardized tools.

## Features

- **jira_search_issues** - Search issues using JQL (Jira Query Language)
- **jira_get_issue** - Get detailed information about a specific issue
- **jira_create_issue** - Create new issues in any project
- **jira_add_comment** - Add comments to existing issues

## Requirements

- Node.js 20.0.0 or higher
- Jira Server/Data Center 8.14+ (for PAT authentication) or any version (for basic auth)

## Installation

```bash
npm install @bugzy-ai/jira-mcp-server
```

Or run directly with npx:

```bash
npx @bugzy-ai/jira-mcp-server
```

## Configuration

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `JIRA_BASE_URL` | Your Jira Server URL (e.g., `https://jira.yourcompany.com`) | Yes |
| `JIRA_AUTH_TYPE` | Authentication type: `pat` or `basic` | No (default: `pat`) |
| `JIRA_PAT` | Personal Access Token (when using PAT auth) | When `JIRA_AUTH_TYPE=pat` |
| `JIRA_USERNAME` | Username (when using basic auth) | When `JIRA_AUTH_TYPE=basic` |
| `JIRA_PASSWORD` | Password (when using basic auth) | When `JIRA_AUTH_TYPE=basic` |

### Creating a Personal Access Token (PAT)

1. Log in to your Jira Server instance
2. Click your profile picture > **Profile**
3. Click **Personal Access Tokens** in the left sidebar
4. Click **Create token**
5. Give it a name and optionally set an expiry date
6. Copy the generated token

## Claude Desktop Integration

Add the following to your Claude Desktop configuration file:

**macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "jira": {
      "command": "npx",
      "args": ["@bugzy-ai/jira-mcp-server"],
      "env": {
        "JIRA_BASE_URL": "https://jira.yourcompany.com",
        "JIRA_AUTH_TYPE": "pat",
        "JIRA_PAT": "your-personal-access-token"
      }
    }
  }
}
```

Or if installed locally:

```json
{
  "mcpServers": {
    "jira": {
      "command": "node",
      "args": ["/path/to/jira-mcp-server/dist/index.js"],
      "env": {
        "JIRA_BASE_URL": "https://jira.yourcompany.com",
        "JIRA_AUTH_TYPE": "pat",
        "JIRA_PAT": "your-personal-access-token"
      }
    }
  }
}
```

## Usage Examples

Once configured, you can ask Claude to:

- "Search for open bugs in the TEST project"
- "Get details about issue TEST-123"
- "Create a new bug in project TEST with summary 'Login button not working'"
- "Add a comment to TEST-123 saying the issue has been reproduced"

## Tool Reference

### jira_search_issues

Search for issues using JQL.

**Parameters:**
- `jql` (required): JQL query string
- `maxResults` (optional): Maximum results (1-100, default: 50)
- `fields` (optional): Fields to include in response

**Example:**
```
jql: "project = TEST AND status = Open ORDER BY created DESC"
maxResults: 20
```

### jira_get_issue

Get detailed information about a specific issue.

**Parameters:**
- `issueKey` (required): Issue key (e.g., "TEST-123")
- `fields` (optional): Specific fields to retrieve
- `expand` (optional): Additional data to expand (e.g., "changelog", "transitions")

### jira_create_issue

Create a new issue.

**Parameters:**
- `projectKey` (required): Project key (e.g., "TEST")
- `summary` (required): Issue summary/title
- `issueType` (required): Issue type (e.g., "Bug", "Task", "Story")
- `description` (optional): Issue description
- `priority` (optional): Priority name (e.g., "High", "Medium")
- `assignee` (optional): Username to assign to
- `labels` (optional): Array of labels
- `components` (optional): Array of component names

### jira_add_comment

Add a comment to an existing issue.

**Parameters:**
- `issueKey` (required): Issue key (e.g., "TEST-123")
- `body` (required): Comment text (supports Jira wiki markup)
- `visibility` (optional): Visibility restriction (group or role)

## Development

### Prerequisites

- Node.js 20+
- Docker (for local Jira instance)
- 6GB+ RAM available for Docker

### Quick Start

```bash
# Clone the repository
git clone https://github.com/bugzy-ai/jira-mcp-server.git
cd jira-mcp-server

# Install dependencies
npm install

# Build
npm run build

# Setup local Jira (Docker)
npm run setup
```

### Local Jira Setup

The setup script will:
1. Start a Jira Docker container
2. Wait for Jira to be ready (~3-5 minutes on first boot)
3. Guide you through manual setup (license + admin user)
4. Create a TEST project for development
5. Generate a `.env` file with local credentials

**First run requires manual steps:**
1. Open http://localhost:8080 in your browser
2. Complete the setup wizard
3. Get a [free evaluation license](https://my.atlassian.com/license/evaluation) or [timebomb license](https://developer.atlassian.com/platform/marketplace/timebomb-licenses-for-testing-server-apps/)
4. Create admin user (recommended: `admin`/`admin`)
5. Run `npm run setup` again to create test project

### Testing

**With MCP Inspector (debug individual tools):**
```bash
npm run dev
# Opens browser at http://localhost:6274
```

**With Claude Code (test in conversation):**
1. The project includes a `.mcp.json` that configures the local server
2. Restart Claude Code to pick up the config
3. Try: "Search for issues in the TEST project"

### Available Scripts

| Script | Description |
|--------|-------------|
| `npm run build` | Build TypeScript to dist/ |
| `npm run build:watch` | Build with watch mode |
| `npm run dev` | Run MCP Inspector |
| `npm run setup` | Setup local Jira Docker |
| `npm start` | Run the MCP server |
| `npm run clean` | Remove dist/ |

### Docker Commands

```bash
# View Jira logs
docker logs jira-mcp-test

# Stop Jira
docker stop jira-mcp-test

# Start Jira
docker start jira-mcp-test

# Remove container (loses data)
docker rm -f jira-mcp-test
```

## License

MIT
