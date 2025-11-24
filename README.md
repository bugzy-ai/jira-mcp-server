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

```bash
# Clone the repository
git clone https://github.com/bugzy-ai/jira-mcp-server.git
cd jira-mcp-server

# Install dependencies
npm install

# Build
npm run build

# Run locally
npm start
```

## License

MIT
