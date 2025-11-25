import type {
  JiraConfig,
  JiraIssue,
  JiraSearchResponse,
  JiraCreateIssueResponse,
  JiraComment,
  JiraErrorResponse,
  CreateIssueFields,
} from "./types.js";
import { logger } from "./logger.js";

export class JiraClientError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public jiraErrors?: JiraErrorResponse
  ) {
    super(message);
    this.name = "JiraClientError";
  }
}

export class JiraClient {
  private baseUrl: string;
  private authHeader: string;

  constructor(config: JiraConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, "");

    if (config.auth.type === "pat") {
      this.authHeader = `Bearer ${config.auth.token}`;
    } else {
      const credentials = Buffer.from(
        `${config.auth.username}:${config.auth.password}`
      ).toString("base64");
      this.authHeader = `Basic ${credentials}`;
    }
  }

  private async request<T>(
    method: string,
    endpoint: string,
    body?: unknown
  ): Promise<T> {
    const url = `${this.baseUrl}/rest/api/2${endpoint}`;

    const headers: Record<string, string> = {
      Authorization: this.authHeader,
      "Content-Type": "application/json",
      Accept: "application/json",
    };

    const options: {
      method: string;
      headers: Record<string, string>;
      body?: string;
    } = {
      method,
      headers,
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    logger.log("[JiraClient]", `REQUEST: ${method} ${url}`);
    if (body) {
      logger.log("[JiraClient]", "REQUEST BODY:", body);
    }

    let response: Response;
    try {
      response = await fetch(url, options);
    } catch (fetchError) {
      logger.error("[JiraClient]", "FETCH ERROR:", fetchError);
      throw fetchError;
    }

    logger.log("[JiraClient]", `RESPONSE: ${response.status} ${response.statusText}`);
    logger.log("[JiraClient]", "RESPONSE HEADERS:", Object.fromEntries(response.headers.entries()));

    // Clone response so we can read body twice if needed
    const responseText = await response.text();
    logger.log("[JiraClient]", "RESPONSE BODY RAW:", responseText.substring(0, 2000));

    if (!response.ok) {
      let errorData: JiraErrorResponse | undefined;
      try {
        errorData = JSON.parse(responseText) as JiraErrorResponse;
        logger.error("[JiraClient]", "ERROR RESPONSE BODY:", errorData);
      } catch {
        // Response body is not JSON
        logger.error("[JiraClient]", "ERROR RESPONSE: Non-JSON body");
      }

      const errorMessages = [
        ...(errorData?.errorMessages || []),
        ...Object.entries(errorData?.errors || {}).map(
          ([field, msg]) => `${field}: ${msg}`
        ),
      ];

      const message =
        errorMessages.length > 0
          ? errorMessages.join("; ")
          : `HTTP ${response.status}: ${response.statusText}`;

      throw new JiraClientError(message, response.status, errorData);
    }

    // Handle 204 No Content
    if (response.status === 204 || !responseText) {
      return {} as T;
    }

    const responseData = JSON.parse(responseText) as T;
    return responseData;
  }

  /**
   * Search for issues using JQL
   */
  async searchIssues(
    jql: string,
    options: {
      maxResults?: number;
      startAt?: number;
      fields?: string[];
    } = {}
  ): Promise<JiraSearchResponse> {
    const body = {
      jql,
      maxResults: options.maxResults ?? 50,
      startAt: options.startAt ?? 0,
      fields: options.fields ?? [
        "key",
        "summary",
        "status",
        "assignee",
        "issuetype",
        "priority",
        "project",
        "created",
        "updated",
      ],
    };

    return this.request<JiraSearchResponse>("POST", "/search", body);
  }

  /**
   * Get a single issue by key or ID
   */
  async getIssue(
    issueIdOrKey: string,
    options: {
      fields?: string[];
      expand?: string[];
    } = {}
  ): Promise<JiraIssue> {
    const params = new URLSearchParams();

    if (options.fields && options.fields.length > 0) {
      params.set("fields", options.fields.join(","));
    }

    if (options.expand && options.expand.length > 0) {
      params.set("expand", options.expand.join(","));
    }

    const queryString = params.toString();
    const endpoint = `/issue/${issueIdOrKey}${queryString ? `?${queryString}` : ""}`;

    return this.request<JiraIssue>("GET", endpoint);
  }

  /**
   * Create a new issue
   */
  async createIssue(fields: CreateIssueFields): Promise<JiraCreateIssueResponse> {
    return this.request<JiraCreateIssueResponse>("POST", "/issue", { fields });
  }

  /**
   * Add a comment to an issue
   */
  async addComment(
    issueIdOrKey: string,
    body: string,
    visibility?: {
      type: "group" | "role";
      value: string;
    }
  ): Promise<JiraComment> {
    const payload: { body: string; visibility?: { type: string; value: string } } =
      { body };

    if (visibility) {
      payload.visibility = visibility;
    }

    return this.request<JiraComment>(
      "POST",
      `/issue/${issueIdOrKey}/comment`,
      payload
    );
  }
}
