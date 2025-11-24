/**
 * TypeScript types for Jira Server REST API v2 responses
 */

export interface JiraConfig {
  baseUrl: string;
  auth:
    | { type: "pat"; token: string }
    | { type: "basic"; username: string; password: string };
}

export interface JiraUser {
  self: string;
  key: string;
  name: string;
  displayName: string;
  emailAddress?: string;
  active: boolean;
}

export interface JiraStatus {
  self: string;
  id: string;
  name: string;
  description?: string;
  statusCategory: {
    self: string;
    id: number;
    key: string;
    name: string;
    colorName: string;
  };
}

export interface JiraPriority {
  self: string;
  id: string;
  name: string;
  iconUrl?: string;
}

export interface JiraIssueType {
  self: string;
  id: string;
  name: string;
  description?: string;
  subtask: boolean;
  iconUrl?: string;
}

export interface JiraProject {
  self: string;
  id: string;
  key: string;
  name: string;
}

export interface JiraComponent {
  self: string;
  id: string;
  name: string;
  description?: string;
}

export interface JiraComment {
  self: string;
  id: string;
  author: JiraUser;
  body: string;
  created: string;
  updated: string;
  visibility?: {
    type: "group" | "role";
    value: string;
  };
}

export interface JiraIssueFields {
  summary: string;
  description?: string;
  status: JiraStatus;
  issuetype: JiraIssueType;
  project: JiraProject;
  priority?: JiraPriority;
  assignee?: JiraUser;
  reporter?: JiraUser;
  labels?: string[];
  components?: JiraComponent[];
  created: string;
  updated: string;
  comment?: {
    comments: JiraComment[];
    total: number;
  };
  [key: string]: unknown;
}

export interface JiraIssue {
  self: string;
  id: string;
  key: string;
  fields: JiraIssueFields;
  expand?: string;
}

export interface JiraSearchResponse {
  expand?: string;
  startAt: number;
  maxResults: number;
  total: number;
  issues: JiraIssue[];
}

export interface JiraCreateIssueResponse {
  id: string;
  key: string;
  self: string;
}

export interface JiraErrorResponse {
  errorMessages?: string[];
  errors?: Record<string, string>;
}

export interface CreateIssueFields {
  project: { key: string };
  summary: string;
  issuetype: { name: string };
  description?: string;
  priority?: { name: string };
  assignee?: { name: string };
  labels?: string[];
  components?: Array<{ name: string }>;
}
