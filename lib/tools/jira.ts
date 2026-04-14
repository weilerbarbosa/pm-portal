import { tool } from "ai";
import { z } from "zod/v4";

const JIRA_BASE = "https://api.atlassian.com";

async function jiraFetch(path: string, options: RequestInit = {}) {
  const email = process.env.JIRA_EMAIL;
  const token = process.env.JIRA_API_TOKEN;

  if (!email || !token) {
    throw new Error("JIRA_EMAIL and JIRA_API_TOKEN env vars are required");
  }

  const auth = Buffer.from(`${email}:${token}`).toString("base64");
  const res = await fetch(`${JIRA_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      ...options.headers,
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Jira API ${res.status}: ${body}`);
  }

  return res.json();
}

export const jiraTools = {
  searchJiraIssuesUsingJql: tool({
    description:
      "Search Jira issues using JQL. Returns matching issues with requested fields. Supports pagination.",
    inputSchema: z.object({
      cloudId: z.string().describe("The Jira Cloud ID"),
      jql: z.string().describe("JQL query string"),
      fields: z
        .array(z.string())
        .optional()
        .describe("Fields to return (e.g. summary, status, worklog)"),
      maxResults: z
        .number()
        .optional()
        .describe("Max results per page (default 50)"),
      startAt: z
        .number()
        .optional()
        .describe("Pagination offset"),
    }),
    execute: async ({ cloudId, jql, fields, maxResults, startAt }) => {
      const body: Record<string, unknown> = { jql };
      if (fields) body.fields = fields;
      if (maxResults) body.maxResults = maxResults;
      if (startAt) body.startAt = startAt;

      return jiraFetch(
        `/ex/jira/${cloudId}/rest/api/3/search/jql`,
        {
          method: "POST",
          body: JSON.stringify(body),
        }
      );
    },
  }),

  getJiraIssue: tool({
    description:
      "Get a single Jira issue by key or ID with specified fields.",
    inputSchema: z.object({
      cloudId: z.string().describe("The Jira Cloud ID"),
      issueIdOrKey: z.string().describe("Issue key (e.g. PROJ-123) or ID"),
      fields: z
        .array(z.string())
        .optional()
        .describe("Fields to return"),
    }),
    execute: async ({ cloudId, issueIdOrKey, fields }) => {
      const params = fields
        ? `?fields=${fields.join(",")}`
        : "";
      return jiraFetch(
        `/ex/jira/${cloudId}/rest/api/3/issue/${issueIdOrKey}${params}`
      );
    },
  }),

  createJiraIssue: tool({
    description: "Create a new Jira issue (epic, task, subtask, etc.).",
    inputSchema: z.object({
      cloudId: z.string().describe("The Jira Cloud ID"),
      fields: z
        .record(z.string(), z.any())
        .describe(
          "Issue fields object (project, issuetype, summary, description, etc.)"
        ),
    }),
    execute: async ({ cloudId, fields }) => {
      return jiraFetch(`/ex/jira/${cloudId}/rest/api/3/issue`, {
        method: "POST",
        body: JSON.stringify({ fields }),
      });
    },
  }),

  editJiraIssue: tool({
    description: "Update fields on an existing Jira issue.",
    inputSchema: z.object({
      cloudId: z.string().describe("The Jira Cloud ID"),
      issueIdOrKey: z.string().describe("Issue key or ID"),
      fields: z
        .record(z.string(), z.any())
        .describe("Fields to update"),
    }),
    execute: async ({ cloudId, issueIdOrKey, fields }) => {
      await jiraFetch(
        `/ex/jira/${cloudId}/rest/api/3/issue/${issueIdOrKey}`,
        {
          method: "PUT",
          body: JSON.stringify({ fields }),
        }
      );
      return { success: true, issueKey: issueIdOrKey };
    },
  }),

  addWorklogToJiraIssue: tool({
    description:
      "Add a worklog entry to a Jira issue (log time spent).",
    inputSchema: z.object({
      cloudId: z.string().describe("The Jira Cloud ID"),
      issueIdOrKey: z.string().describe("Issue key or ID"),
      timeSpentSeconds: z
        .number()
        .describe("Time spent in seconds"),
      started: z
        .string()
        .describe(
          "When the work started (ISO 8601 format, e.g. 2026-04-07T09:00:00.000+0000)"
        ),
      comment: z.string().optional().describe("Worklog comment"),
    }),
    execute: async ({
      cloudId,
      issueIdOrKey,
      timeSpentSeconds,
      started,
      comment,
    }) => {
      const body: Record<string, unknown> = { timeSpentSeconds, started };
      if (comment) {
        body.comment = {
          type: "doc",
          version: 1,
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: comment }],
            },
          ],
        };
      }
      return jiraFetch(
        `/ex/jira/${cloudId}/rest/api/3/issue/${issueIdOrKey}/worklog`,
        { method: "POST", body: JSON.stringify(body) }
      );
    },
  }),

  getTransitionsForJiraIssue: tool({
    description:
      "Get available status transitions for a Jira issue.",
    inputSchema: z.object({
      cloudId: z.string().describe("The Jira Cloud ID"),
      issueIdOrKey: z.string().describe("Issue key or ID"),
    }),
    execute: async ({ cloudId, issueIdOrKey }) => {
      return jiraFetch(
        `/ex/jira/${cloudId}/rest/api/3/issue/${issueIdOrKey}/transitions`
      );
    },
  }),

  transitionJiraIssue: tool({
    description: "Transition a Jira issue to a new status.",
    inputSchema: z.object({
      cloudId: z.string().describe("The Jira Cloud ID"),
      issueIdOrKey: z.string().describe("Issue key or ID"),
      transitionId: z.string().describe("The transition ID"),
    }),
    execute: async ({ cloudId, issueIdOrKey, transitionId }) => {
      await jiraFetch(
        `/ex/jira/${cloudId}/rest/api/3/issue/${issueIdOrKey}/transitions`,
        {
          method: "POST",
          body: JSON.stringify({ transition: { id: transitionId } }),
        }
      );
      return { success: true };
    },
  }),

  getJiraIssueRemoteIssueLinks: tool({
    description: "Get remote issue links for a Jira issue.",
    inputSchema: z.object({
      cloudId: z.string().describe("The Jira Cloud ID"),
      issueIdOrKey: z.string().describe("Issue key or ID"),
    }),
    execute: async ({ cloudId, issueIdOrKey }) => {
      return jiraFetch(
        `/ex/jira/${cloudId}/rest/api/3/issue/${issueIdOrKey}/remotelink`
      );
    },
  }),

  lookupJiraAccountId: tool({
    description:
      "Look up a Jira user's account ID by email or display name.",
    inputSchema: z.object({
      cloudId: z.string().describe("The Jira Cloud ID"),
      query: z
        .string()
        .describe("Email address or display name to search"),
    }),
    execute: async ({ cloudId, query }) => {
      return jiraFetch(
        `/ex/jira/${cloudId}/rest/api/3/user/search?query=${encodeURIComponent(query)}`
      );
    },
  }),

  getJiraProjectIssueTypesMetadata: tool({
    description:
      "Get issue types available in a Jira project.",
    inputSchema: z.object({
      cloudId: z.string().describe("The Jira Cloud ID"),
      projectKeyOrId: z.string().describe("Project key or ID"),
    }),
    execute: async ({ cloudId, projectKeyOrId }) => {
      return jiraFetch(
        `/ex/jira/${cloudId}/rest/api/3/project/${projectKeyOrId}`
      );
    },
  }),

  getJiraIssueTypeMetaWithFields: tool({
    description:
      "Get the create metadata (required fields) for a specific issue type in a project.",
    inputSchema: z.object({
      cloudId: z.string().describe("The Jira Cloud ID"),
      projectKey: z.string().describe("Project key"),
      issueTypeId: z.string().describe("Issue type ID"),
    }),
    execute: async ({ cloudId, projectKey, issueTypeId }) => {
      return jiraFetch(
        `/ex/jira/${cloudId}/rest/api/3/issue/createmeta?projectKeys=${projectKey}&issuetypeIds=${issueTypeId}&expand=projects.issuetypes.fields`
      );
    },
  }),

  createIssueLink: tool({
    description:
      "Create a link between two Jira issues (e.g. parent-child, blocks, relates to).",
    inputSchema: z.object({
      cloudId: z.string().describe("The Jira Cloud ID"),
      type: z.string().describe("Link type name (e.g. 'Epic-Story Link', 'Blocks')"),
      inwardIssueKey: z.string().describe("The inward issue key"),
      outwardIssueKey: z.string().describe("The outward issue key"),
    }),
    execute: async ({ cloudId, type, inwardIssueKey, outwardIssueKey }) => {
      await jiraFetch(`/ex/jira/${cloudId}/rest/api/3/issueLink`, {
        method: "POST",
        body: JSON.stringify({
          type: { name: type },
          inwardIssue: { key: inwardIssueKey },
          outwardIssue: { key: outwardIssueKey },
        }),
      });
      return { success: true };
    },
  }),
};
