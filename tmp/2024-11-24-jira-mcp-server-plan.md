# Jira Server MCP Server - Implementation Plan

## Overview

Build a Model Context Protocol (MCP) server that enables AI assistants to interact with on-premise Jira Server deployments (version 9.10+). The server will communicate via stdio transport and provide essential QA engineer tools for issue management.

## Problem Statement

QA engineers using AI assistants need a standardized way to interact with Jira Server (on-premise) deployments. This requires:

1. Support for Jira Server REST API v2 (different from Jira Cloud API)
2. Authentication compatible with on-premise security requirements (Personal Access Tokens, Basic Auth)
3. Essential tools for searching, viewing, creating issues, and adding comments
4. Communication via stdio for MCP protocol compliance

## Research Findings

### Jira Server vs Jira Cloud API Differences

| Aspect | Jira Cloud | Jira Server/Data Center |
|--------|------------|------------------------|
| **API Version** | v3 (versioned) | v2 (tied to Jira version) |
| **Base URL** | `https://{domain}.atlassian.net/rest/api/3` | `https://{host}/rest/api/2` |
| **Authentication** | API Tokens, OAuth 2.0 | Basic Auth, Personal Access Tokens (PAT), OAuth 1.0a |
| **User Identifiers** | Account IDs | Usernames |
| **Rate Limiting** | Stricter | Less strict |
| **Codebases** | Separate (diverging) | Separate (end of life Feb 2024 for Server, DC continues) |

**Key API Endpoint Differences:**
- Cloud uses `accountId` for user assignment; Server uses `name` field
- Some field keys differ between Cloud and Server responses
- Server lacks some newer Cloud-only endpoints

**References:**
- [Atlassian Community: Cloud vs Server API](https://community.atlassian.com/forums/Jira-questions/Difference-between-Jira-Cloud-REST-API-and-Server-REST-API/qaq-p/658434)
- [Developer Community: API Differences](https://community.developer.atlassian.com/t/what-are-the-differences-in-rest-apis-between-jira-data-center-and-jira-cloud/78178)

### Authentication Options for Jira Server

#### 1. Personal Access Tokens (PAT) - **Recommended**

- **Available since:** Jira Server/Data Center 8.14.0+
- **Usage:** Bearer token in Authorization header
- **Header format:** `Authorization: Bearer <token>`
- **Benefits:**
  - No password exposure in scripts
  - Individual token revocation
  - Optional expiry settings

```bash
curl -H "Authorization: Bearer <yourToken>" \
  https://{baseUrl}/rest/api/2/issue/ABC-123
```

**References:**
- [Personal Access Token Documentation](https://developer.atlassian.com/server/jira/platform/personal-access-token/)
- [Using PATs Guide](https://confluence.atlassian.com/enterprise/using-personal-access-tokens-1026032365.html)

#### 2. Basic Authentication

- **Availability:** All Jira Server versions
- **Usage:** Base64-encoded `username:password`
- **Header format:** `Authorization: Basic <base64(username:password)>`
- **Considerations:**
  - Less secure (credentials sent with every request)
  - CAPTCHA can block after failed attempts
  - Works with older Jira versions (<8.14)

```bash
curl -u username:password \
  -H "Content-Type: application/json" \
  https://{baseUrl}/rest/api/2/issue/ABC-123
```

**References:**
- [Basic Authentication Guide](https://developer.atlassian.com/server/jira/platform/basic-authentication/)

### Jira Server REST API Endpoints (Required for Tools)

| Tool | Method | Endpoint | Purpose |
|------|--------|----------|---------|
| Search Issues | POST | `/rest/api/2/search` | JQL-based issue search |
| Get Issue | GET | `/rest/api/2/issue/{issueIdOrKey}` | Retrieve issue details |
| Create Issue | POST | `/rest/api/2/issue` | Create new issue |
| Add Comment | POST | `/rest/api/2/issue/{issueIdOrKey}/comment` | Add comment to issue |

**References:**
- [Jira Server REST API Reference](https://developer.atlassian.com/server/jira/platform/rest/v11000/)
- [REST API Examples](https://developer.atlassian.com/server/jira/platform/jira-rest-api-examples/)

### TypeScript SDK Evaluation

| Library | Server Support | Authentication | Recommendation |
|---------|---------------|----------------|----------------|
| **jira.js** | Cloud only | API Token, OAuth 2.0 | Not suitable |
| **ts-jira-client** | Server/DC + Cloud | Basic Auth | Possible but incomplete types |
| **jira-client** | Server/DC + Cloud | Basic Auth | JavaScript with types via @types |
| **Direct REST calls** | Full control | Any | **Recommended** |

**Decision:** Use direct HTTP requests (fetch/axios) instead of SDK libraries.

**Rationale:**
1. Most TypeScript SDKs are Cloud-focused
2. Server-compatible SDKs have incomplete type definitions
3. Our needs are simple (4 endpoints)
4. Direct calls allow full control over authentication and error handling
5. Simpler dependency management

### MCP TypeScript SDK Setup

**Package:** `@modelcontextprotocol/sdk`

**Key Components:**
- `Server` - Low-level server class
- `StdioServerTransport` - Stdio communication transport
- `ListToolsRequestSchema` - Tool listing handler
- `CallToolRequestSchema` - Tool execution handler

**Basic Server Pattern:**
```typescript
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';

const server = new Server(
  { name: 'jira-mcp-server', version: '0.1.0' },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [/* tool definitions */]
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  // Handle tool calls
});

const transport = new StdioServerTransport();
await server.connect(transport);
```

**References:**
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)
- [MCP npm package](https://www.npmjs.com/package/@modelcontextprotocol/sdk)

### Reference Implementation Analysis (Slack MCP Server)

**Structure:**
```
slack-mcp-server/
├── src/
│   ├── index.ts      # Server setup, tool handlers
│   └── schemas.ts    # Zod schemas for validation
├── package.json
├── tsconfig.json
└── tsconfig.build.json
```

**Key Patterns:**
1. **Single entry point** (`index.ts`) with server creation and tool handlers
2. **Zod schemas** for input validation and JSON schema generation
3. **zodToJsonSchema** for converting Zod schemas to JSON Schema (for tool definitions)
4. **Error handling** with try/catch and meaningful error messages
5. **Console.error for logging** (not console.log, to keep stdout clean for MCP)
6. **Environment variables** for configuration (via dotenv)

## Proposed Solution

### Architecture

```
jira-mcp-server/
├── src/
│   ├── index.ts          # Main entry, server setup
│   ├── schemas.ts        # Zod schemas for tool inputs/outputs
│   ├── jira-client.ts    # HTTP client for Jira API
│   └── types.ts          # TypeScript types for Jira responses
├── package.json
├── tsconfig.json
├── tsconfig.build.json
├── .env.example
└── README.md
```

### Implementation Phases

#### Phase 1: Project Setup & Core Structure

**Tasks:**
- [ ] Initialize npm project with TypeScript
- [ ] Configure TypeScript (ES modules, strict mode)
- [ ] Install dependencies:
  - `@modelcontextprotocol/sdk`
  - `zod` (schema validation)
  - `zod-to-json-schema` (schema conversion)
  - `dotenv` (environment config)
- [ ] Create basic project structure

**Dependencies:**
```json
{
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.12.1",
    "zod": "^3.22.4",
    "zod-to-json-schema": "^3.22.4",
    "dotenv": "^16.4.7"
  },
  "devDependencies": {
    "@types/node": "^20.10.3",
    "typescript": "^5.3.2",
    "shx": "^0.3.4"
  }
}
```

#### Phase 2: Jira Client Implementation

**Tasks:**
- [ ] Create `JiraClient` class with configurable base URL
- [ ] Implement authentication (PAT and Basic Auth support)
- [ ] Implement API methods:
  - `searchIssues(jql: string, options?)` - POST `/rest/api/2/search`
  - `getIssue(issueIdOrKey: string, options?)` - GET `/rest/api/2/issue/{key}`
  - `createIssue(fields: IssueFields)` - POST `/rest/api/2/issue`
  - `addComment(issueIdOrKey: string, body: string)` - POST `/rest/api/2/issue/{key}/comment`
- [ ] Add error handling for common Jira errors
- [ ] Add request/response logging (to stderr)

**Configuration:**
```typescript
interface JiraConfig {
  baseUrl: string;           // e.g., "https://jira.company.com"
  auth:
    | { type: 'pat'; token: string }
    | { type: 'basic'; username: string; password: string };
}
```

#### Phase 3: MCP Server & Tool Implementation

**Tasks:**
- [ ] Create MCP server with stdio transport
- [ ] Define Zod schemas for tool inputs
- [ ] Implement tool handlers:
  - `jira_search_issues` - Search using JQL
  - `jira_get_issue` - Get issue details by key
  - `jira_create_issue` - Create new issue
  - `jira_add_comment` - Add comment to issue
- [ ] Wire up tool listing and call handlers

**Tool Definitions:**

##### 1. jira_search_issues
```typescript
const SearchIssuesSchema = z.object({
  jql: z.string().describe('JQL query string (e.g., "project = TEST AND status = Open")'),
  maxResults: z.number().int().min(1).max(100).optional().default(50)
    .describe('Maximum results to return (default: 50, max: 100)'),
  fields: z.array(z.string()).optional()
    .describe('Issue fields to include (default: key, summary, status, assignee)')
});
```

##### 2. jira_get_issue
```typescript
const GetIssueSchema = z.object({
  issueKey: z.string().describe('Issue key (e.g., "PROJ-123")'),
  fields: z.array(z.string()).optional()
    .describe('Specific fields to retrieve'),
  expand: z.array(z.string()).optional()
    .describe('Additional data to expand (e.g., "changelog", "transitions")')
});
```

##### 3. jira_create_issue
```typescript
const CreateIssueSchema = z.object({
  projectKey: z.string().describe('Project key (e.g., "TEST")'),
  summary: z.string().describe('Issue summary/title'),
  issueType: z.string().describe('Issue type (e.g., "Bug", "Task", "Story")'),
  description: z.string().optional().describe('Issue description'),
  priority: z.string().optional().describe('Priority name (e.g., "High", "Medium")'),
  assignee: z.string().optional().describe('Username to assign the issue to'),
  labels: z.array(z.string()).optional().describe('Labels to add'),
  components: z.array(z.string()).optional().describe('Component names')
});
```

##### 4. jira_add_comment
```typescript
const AddCommentSchema = z.object({
  issueKey: z.string().describe('Issue key (e.g., "PROJ-123")'),
  body: z.string().describe('Comment text (supports Jira wiki markup)'),
  visibility: z.object({
    type: z.enum(['group', 'role']).optional(),
    value: z.string().optional()
  }).optional().describe('Optional visibility restriction')
});
```

#### Phase 4: Testing & Documentation

**Tasks:**
- [ ] Test with MCP Inspector
- [ ] Test with Claude Desktop configuration
- [ ] Create README with setup instructions
- [ ] Create .env.example
- [ ] Document Claude Desktop configuration

## Technical Considerations

### Error Handling Strategy

1. **Network errors:** Wrap in user-friendly messages
2. **Authentication failures:** Clear message about token/credentials
3. **Jira API errors:** Parse and surface Jira error messages
4. **Validation errors:** Zod provides descriptive validation messages

### Logging

- All logging to `stderr` (keep `stdout` clean for MCP protocol)
- Log levels: ERROR for failures, INFO for operations (optional debug mode)
- Example: `console.error('Jira MCP Server running on stdio');`

### Security Considerations

- Never log full tokens/passwords
- Store credentials in environment variables only
- Validate all inputs with Zod schemas
- No hardcoded credentials

### Version Compatibility

- **Jira Server:** 8.14+ for PAT, all versions for Basic Auth
- **Target:** 9.10+ (as specified)
- **Node.js:** 20.0.0+ (MCP SDK requirement)

## Acceptance Criteria

### Functional Requirements

- [ ] Server starts successfully with valid configuration
- [ ] `jira_search_issues` returns issues matching JQL query
- [ ] `jira_get_issue` returns full issue details
- [ ] `jira_create_issue` creates issue and returns key
- [ ] `jira_add_comment` adds comment to existing issue
- [ ] All tools return appropriate errors for invalid inputs
- [ ] PAT authentication works
- [ ] Basic authentication works (fallback for older versions)

### Non-Functional Requirements

- [ ] No console.log output (only stderr)
- [ ] TypeScript strict mode compliance
- [ ] All tool inputs validated with Zod
- [ ] Build produces runnable JavaScript

### Quality Gates

- [ ] TypeScript compiles without errors
- [ ] Can be installed and run via npx or global install
- [ ] Works with Claude Desktop MCP configuration

## Environment Configuration

**.env.example:**
```bash
# Jira Server Configuration
JIRA_BASE_URL=https://jira.yourcompany.com

# Authentication (choose one method)

# Option 1: Personal Access Token (Recommended, requires Jira 8.14+)
JIRA_AUTH_TYPE=pat
JIRA_PAT=your-personal-access-token

# Option 2: Basic Authentication (for older Jira versions)
# JIRA_AUTH_TYPE=basic
# JIRA_USERNAME=your-username
# JIRA_PASSWORD=your-password
```

## Claude Desktop Configuration

**claude_desktop_config.json:**
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

## References

### Internal References
- Slack MCP Server: `../slack-mcp-server/src/index.ts`
- Slack MCP Schemas: `../slack-mcp-server/src/schemas.ts`

### External References
- [MCP TypeScript SDK Documentation](https://github.com/modelcontextprotocol/typescript-sdk)
- [Jira Server REST API v2](https://docs.atlassian.com/software/jira/docs/api/REST/9.14.0/)
- [Personal Access Tokens](https://developer.atlassian.com/server/jira/platform/personal-access-token/)
- [Basic Authentication](https://developer.atlassian.com/server/jira/platform/basic-authentication/)
- [MCP Protocol Specification](https://modelcontextprotocol.io/)

## Future Considerations

Potential future enhancements (not in initial scope):
- Update issue fields tool
- Transition issue status tool
- Upload/download attachments
- Worklog management
- Sprint/board operations (Jira Agile API)
- Caching for frequently accessed data
