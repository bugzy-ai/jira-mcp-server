#!/usr/bin/env node

import "dotenv/config";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  ErrorCode,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import { zodToJsonSchema } from "zod-to-json-schema";

import { JiraClient, JiraClientError } from "./jira-client.js";
import {
  SearchIssuesSchema,
  GetIssueSchema,
  CreateIssueSchema,
  AddCommentSchema,
} from "./schemas.js";
import type { JiraConfig } from "./types.js";
import { logger } from "./logger.js";

function getConfig(): JiraConfig {
  const baseUrl = process.env.JIRA_BASE_URL;
  if (!baseUrl) {
    throw new Error("JIRA_BASE_URL environment variable is required");
  }

  const authType = process.env.JIRA_AUTH_TYPE || "pat";

  if (authType === "pat") {
    const token = process.env.JIRA_PAT;
    if (!token) {
      throw new Error(
        "JIRA_PAT environment variable is required when using PAT authentication"
      );
    }
    return { baseUrl, auth: { type: "pat", token } };
  } else if (authType === "basic") {
    const username = process.env.JIRA_USERNAME;
    const password = process.env.JIRA_PASSWORD;
    if (!username || !password) {
      throw new Error(
        "JIRA_USERNAME and JIRA_PASSWORD are required when using basic authentication"
      );
    }
    return { baseUrl, auth: { type: "basic", username, password } };
  } else {
    throw new Error(
      `Invalid JIRA_AUTH_TYPE: ${authType}. Must be "pat" or "basic"`
    );
  }
}

const TOOLS = [
  {
    name: "jira_search_issues",
    description:
      "Search for Jira issues using JQL (Jira Query Language). Returns a list of issues matching the query.",
    inputSchema: zodToJsonSchema(SearchIssuesSchema),
  },
  {
    name: "jira_get_issue",
    description:
      "Get detailed information about a specific Jira issue by its key (e.g., PROJ-123).",
    inputSchema: zodToJsonSchema(GetIssueSchema),
  },
  {
    name: "jira_create_issue",
    description:
      "Create a new Jira issue in a specified project with the given details.",
    inputSchema: zodToJsonSchema(CreateIssueSchema),
  },
  {
    name: "jira_add_comment",
    description:
      "Add a comment to an existing Jira issue. Supports Jira wiki markup formatting.",
    inputSchema: zodToJsonSchema(AddCommentSchema),
  },
];

async function main() {
  let jiraClient: JiraClient;

  logger.log("[MCP]", "Starting Jira MCP Server...");

  try {
    const config = getConfig();
    logger.log("[MCP]", "Configuration loaded:", {
      baseUrl: config.baseUrl,
      authType: config.auth.type,
    });
    jiraClient = new JiraClient(config);
    console.error("[Jira MCP] Configuration loaded successfully");
  } catch (error) {
    logger.error("[MCP]", "Configuration error:", (error as Error).message);
    console.error("[Jira MCP] Configuration error:", (error as Error).message);
    process.exit(1);
  }

  const server = new Server(
    {
      name: "jira-mcp-server",
      version: "0.1.0",
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: TOOLS,
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    logger.log("[MCP]", `TOOL CALL: ${name}`);
    logger.log("[MCP]", "TOOL ARGS:", args);

    try {
      switch (name) {
        case "jira_search_issues": {
          const input = SearchIssuesSchema.parse(args);
          const result = await jiraClient.searchIssues(input.jql, {
            maxResults: input.maxResults,
            fields: input.fields,
          });
          logger.log("[MCP]", `TOOL RESULT (${name}): success, ${result.issues?.length || 0} issues found`);
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(result, null, 2),
              },
            ],
          };
        }

        case "jira_get_issue": {
          const input = GetIssueSchema.parse(args);
          const result = await jiraClient.getIssue(input.issueKey, {
            fields: input.fields,
            expand: input.expand,
          });
          logger.log("[MCP]", `TOOL RESULT (${name}): success, issue ${result.key}`);
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(result, null, 2),
              },
            ],
          };
        }

        case "jira_create_issue": {
          const input = CreateIssueSchema.parse(args);
          const result = await jiraClient.createIssue({
            project: { key: input.projectKey },
            summary: input.summary,
            issuetype: { name: input.issueType },
            description: input.description,
            priority: input.priority ? { name: input.priority } : undefined,
            assignee: input.assignee ? { name: input.assignee } : undefined,
            labels: input.labels,
            components: input.components?.map((name) => ({ name })),
          });
          logger.log("[MCP]", `TOOL RESULT (${name}): success, created ${result.key}`);
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(result, null, 2),
              },
            ],
          };
        }

        case "jira_add_comment": {
          const input = AddCommentSchema.parse(args);
          const result = await jiraClient.addComment(
            input.issueKey,
            input.body,
            input.visibility
          );
          logger.log("[MCP]", `TOOL RESULT (${name}): success, comment added`);
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(result, null, 2),
              },
            ],
          };
        }

        default:
          logger.error("[MCP]", `Unknown tool requested: ${name}`);
          throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
      }
    } catch (error) {
      if (error instanceof JiraClientError) {
        logger.error("[MCP]", `TOOL ERROR (${name}): JiraClientError - ${error.message}`, {
          statusCode: error.statusCode,
          jiraErrors: error.jiraErrors,
        });
        return {
          content: [
            {
              type: "text",
              text: `Jira API Error: ${error.message}`,
            },
          ],
          isError: true,
        };
      }
      if (error instanceof McpError) {
        logger.error("[MCP]", `TOOL ERROR (${name}): McpError - ${error.message}`);
        throw error;
      }
      // Zod validation errors or other errors
      const message =
        error instanceof Error ? error.message : "Unknown error occurred";
      logger.error("[MCP]", `TOOL ERROR (${name}): ${message}`, error);
      return {
        content: [
          {
            type: "text",
            text: `Error: ${message}`,
          },
        ],
        isError: true,
      };
    }
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);

  logger.log("[MCP]", "Server connected to stdio transport");
  console.error("[Jira MCP] Server running on stdio");
}

main().catch((error) => {
  console.error("[Jira MCP] Fatal error:", error);
  process.exit(1);
});
