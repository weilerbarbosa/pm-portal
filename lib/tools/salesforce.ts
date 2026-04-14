import { tool } from "ai";
import { z } from "zod/v4";

async function getSfAccessToken(): Promise<{
  accessToken: string;
  instanceUrl: string;
}> {
  const clientId = process.env.SF_CLIENT_ID;
  const clientSecret = process.env.SF_CLIENT_SECRET;
  const refreshToken = process.env.SF_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error(
      "SF_CLIENT_ID, SF_CLIENT_SECRET, and SF_REFRESH_TOKEN env vars are required"
    );
  }

  const res = await fetch(
    "https://login.salesforce.com/services/oauth2/token",
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
      }),
    }
  );

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Salesforce auth failed ${res.status}: ${body}`);
  }

  const data = await res.json();
  return {
    accessToken: data.access_token,
    instanceUrl: data.instance_url,
  };
}

async function sfFetch(
  path: string,
  options: RequestInit = {}
): Promise<unknown> {
  const { accessToken, instanceUrl } = await getSfAccessToken();

  const res = await fetch(`${instanceUrl}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Salesforce API ${res.status}: ${body}`);
  }

  const text = await res.text();
  return text ? JSON.parse(text) : { success: true };
}

export const salesforceTools = {
  salesforce_query_records: tool({
    description:
      "Execute a SOQL query against Salesforce. Returns matching records.",
    inputSchema: z.object({
      query: z.string().describe("SOQL query string"),
    }),
    execute: async ({ query }) => {
      return sfFetch(
        `/services/data/v59.0/query/?q=${encodeURIComponent(query)}`
      );
    },
  }),

  salesforce_dml_records: tool({
    description:
      "Insert, update, or delete Salesforce records. For insert, omit recordId. For update/delete, provide recordId.",
    inputSchema: z.object({
      operation: z
        .enum(["insert", "update", "delete"])
        .describe("DML operation"),
      objectType: z
        .string()
        .describe("Salesforce object API name (e.g. Tech_Assist__c)"),
      recordId: z
        .string()
        .optional()
        .describe("Record ID (required for update/delete)"),
      fields: z
        .record(z.string(), z.any())
        .optional()
        .describe("Field values (for insert/update)"),
    }),
    execute: async ({ operation, objectType, recordId, fields }) => {
      switch (operation) {
        case "insert":
          return sfFetch(`/services/data/v59.0/sobjects/${objectType}`, {
            method: "POST",
            body: JSON.stringify(fields),
          });
        case "update":
          if (!recordId) throw new Error("recordId required for update");
          return sfFetch(
            `/services/data/v59.0/sobjects/${objectType}/${recordId}`,
            {
              method: "PATCH",
              body: JSON.stringify(fields),
            }
          );
        case "delete":
          if (!recordId) throw new Error("recordId required for delete");
          return sfFetch(
            `/services/data/v59.0/sobjects/${objectType}/${recordId}`,
            { method: "DELETE" }
          );
      }
    },
  }),

  salesforce_describe_object: tool({
    description:
      "Get metadata (fields, types, picklist values) for a Salesforce object.",
    inputSchema: z.object({
      objectType: z
        .string()
        .describe("Salesforce object API name"),
    }),
    execute: async ({ objectType }) => {
      return sfFetch(
        `/services/data/v59.0/sobjects/${objectType}/describe`
      );
    },
  }),

  salesforce_execute_anonymous: tool({
    description:
      "Execute anonymous Apex code on Salesforce.",
    inputSchema: z.object({
      code: z.string().describe("Apex code to execute"),
    }),
    execute: async ({ code }) => {
      return sfFetch(
        `/services/data/v59.0/tooling/executeAnonymous/?anonymousBody=${encodeURIComponent(code)}`
      );
    },
  }),

  salesforce_search_all: tool({
    description: "Execute a SOSL search across Salesforce objects.",
    inputSchema: z.object({
      searchQuery: z
        .string()
        .describe("SOSL search string"),
    }),
    execute: async ({ searchQuery }) => {
      return sfFetch(
        `/services/data/v59.0/search/?q=${encodeURIComponent(searchQuery)}`
      );
    },
  }),
};
