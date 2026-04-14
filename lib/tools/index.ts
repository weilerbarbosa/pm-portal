import { jiraTools } from "./jira";
import { salesforceTools } from "./salesforce";

// All available tools, keyed by integration
export const allTools = {
  ...jiraTools,
  ...salesforceTools,
};

// Map of which tools each skill needs
const skillToolMap: Record<string, string[]> = {
  "pm-hours-distributor": [
    "searchJiraIssuesUsingJql",
    "getJiraIssue",
    "editJiraIssue",
    "addWorklogToJiraIssue",
    "lookupJiraAccountId",
  ],
  "continuous-improvement-tracker": [
    "searchJiraIssuesUsingJql",
    "getJiraIssue",
    "salesforce_query_records",
    "salesforce_dml_records",
    "salesforce_execute_anonymous",
    "salesforce_describe_object",
  ],
  "jira-task-engine": [
    "searchJiraIssuesUsingJql",
    "getJiraIssue",
    "createJiraIssue",
    "editJiraIssue",
    "getJiraProjectIssueTypesMetadata",
    "getJiraIssueTypeMetaWithFields",
    "createIssueLink",
    "lookupJiraAccountId",
    "getTransitionsForJiraIssue",
    "transitionJiraIssue",
  ],
  "tech-assist-filler": [
    "searchJiraIssuesUsingJql",
    "getJiraIssue",
    "salesforce_query_records",
    "salesforce_dml_records",
    "salesforce_execute_anonymous",
    "salesforce_describe_object",
    "salesforce_search_all",
  ],
  "weekly-status-report": [
    "searchJiraIssuesUsingJql",
    "getJiraIssue",
    "salesforce_query_records",
    "salesforce_dml_records",
  ],
};

export function getToolsForSkill(skillId: string) {
  const toolNames = skillToolMap[skillId] || Object.keys(allTools);
  const tools: Record<string, (typeof allTools)[keyof typeof allTools]> = {};

  for (const name of toolNames) {
    const t = allTools[name as keyof typeof allTools];
    if (t) {
      tools[name] = t;
    }
  }

  return tools;
}
