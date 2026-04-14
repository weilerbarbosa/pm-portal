import { tool } from "ai";
import { z } from "zod/v4";

let cachedToken: { accessToken: string; instanceUrl: string; expiresAt: number } | null = null;

async function getSfAccessToken(): Promise<{
  accessToken: string;
  instanceUrl: string;
}> {
  // Return cached token if still valid (cache for 1 hour)
  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken;
  }

  const username = process.env.SALESFORCE_USERNAME;
  const password = process.env.SALESFORCE_PASSWORD;
  const instanceUrl = process.env.SALESFORCE_INSTANCE_URL;

  if (!username || !password || !instanceUrl) {
    throw new Error(
      "SALESFORCE_USERNAME, SALESFORCE_PASSWORD, and SALESFORCE_INSTANCE_URL env vars are required"
    );
  }

  // Use SOAP login to get session ID
  const soapBody = `<?xml version="1.0" encoding="utf-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
  xmlns:urn="urn:partner.soap.sforce.com">
  <soapenv:Body>
    <urn:login>
      <urn:username>${escapeXml(username)}</urn:username>
      <urn:password>${escapeXml(password)}</urn:password>
    </urn:login>
  </soapenv:Body>
</soapenv:Envelope>`;

  const res = await fetch(
    `${instanceUrl}/services/Soap/u/59.0`,
    {
      method: "POST",
      headers: {
        "Content-Type": "text/xml",
        SOAPAction: "login",
      },
      body: soapBody,
    }
  );

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Salesforce SOAP login failed ${res.status}: ${body}`);
  }

  const xml = await res.text();

  const sessionIdMatch = xml.match(/<sessionId>([^<]+)<\/sessionId>/);
  const serverUrlMatch = xml.match(/<serverUrl>([^<]+)<\/serverUrl>/);

  if (!sessionIdMatch) {
    throw new Error(`Salesforce login failed: no sessionId in response. Body: ${xml.slice(0, 500)}`);
  }

  const accessToken = sessionIdMatch[1];
  // Extract instance URL from server URL or use configured one
  const resolvedInstanceUrl = serverUrlMatch
    ? new URL(serverUrlMatch[1]).origin
    : instanceUrl;

  cachedToken = {
    accessToken,
    instanceUrl: resolvedInstanceUrl,
    expiresAt: Date.now() + 60 * 60 * 1000, // 1 hour
  };

  return cachedToken;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
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
