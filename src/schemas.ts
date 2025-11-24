import { z } from "zod";

/**
 * Schema for jira_search_issues tool
 */
export const SearchIssuesSchema = z.object({
  jql: z
    .string()
    .describe('JQL query string (e.g., "project = TEST AND status = Open")'),
  maxResults: z
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .default(50)
    .describe("Maximum results to return (default: 50, max: 100)"),
  fields: z
    .array(z.string())
    .optional()
    .describe(
      "Issue fields to include (default: key, summary, status, assignee, issuetype, priority)"
    ),
});

/**
 * Schema for jira_get_issue tool
 */
export const GetIssueSchema = z.object({
  issueKey: z.string().describe('Issue key (e.g., "PROJ-123")'),
  fields: z.array(z.string()).optional().describe("Specific fields to retrieve"),
  expand: z
    .array(z.string())
    .optional()
    .describe(
      'Additional data to expand (e.g., "changelog", "transitions", "renderedFields")'
    ),
});

/**
 * Schema for jira_create_issue tool
 */
export const CreateIssueSchema = z.object({
  projectKey: z.string().describe('Project key (e.g., "TEST")'),
  summary: z.string().describe("Issue summary/title"),
  issueType: z.string().describe('Issue type (e.g., "Bug", "Task", "Story")'),
  description: z.string().optional().describe("Issue description"),
  priority: z
    .string()
    .optional()
    .describe('Priority name (e.g., "High", "Medium", "Low")'),
  assignee: z.string().optional().describe("Username to assign the issue to"),
  labels: z.array(z.string()).optional().describe("Labels to add"),
  components: z.array(z.string()).optional().describe("Component names"),
});

/**
 * Schema for jira_add_comment tool
 */
export const AddCommentSchema = z.object({
  issueKey: z.string().describe('Issue key (e.g., "PROJ-123")'),
  body: z.string().describe("Comment text (supports Jira wiki markup)"),
  visibility: z
    .object({
      type: z.enum(["group", "role"]).describe("Visibility type"),
      value: z.string().describe("Group name or role name"),
    })
    .optional()
    .describe("Optional visibility restriction"),
});

export type SearchIssuesInput = z.infer<typeof SearchIssuesSchema>;
export type GetIssueInput = z.infer<typeof GetIssueSchema>;
export type CreateIssueInput = z.infer<typeof CreateIssueSchema>;
export type AddCommentInput = z.infer<typeof AddCommentSchema>;
