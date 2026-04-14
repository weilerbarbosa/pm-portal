export interface SkillInput {
  name: string;
  type: "text" | "date" | "dateRange" | "select" | "file";
  label: string;
  required: boolean;
  placeholder?: string;
  options?: { label: string; value: string }[];
  default?: string;
}

export interface SkillDefinition {
  id: string;
  name: string;
  description: string;
  category: "sync" | "report" | "automation" | "analysis";
  icon: string;
  requiredTools: string[];
  inputs: SkillInput[];
  estimatedDuration: string;
}

export const skills: SkillDefinition[] = [
  {
    id: "pm-hours-distributor",
    name: "PM Hours Distributor",
    description:
      "Distribute your 40 weekly hours proportionally across Jira epics based on where your team logged work that week.",
    category: "automation",
    icon: "clock",
    requiredTools: ["jira"],
    inputs: [
      {
        name: "weekSpec",
        type: "select",
        label: "Week",
        required: true,
        options: [
          { label: "This week", value: "this week" },
          { label: "Last week", value: "last week" },
        ],
        default: "last week",
      },
    ],
    estimatedDuration: "1-2 min",
  },
  {
    id: "continuous-improvement-tracker",
    name: "Continuous Improvement Tracker",
    description:
      "Process monthly Improvement Epics from Jira, create/update PM Assists and Projects in Salesforce, and post Chatter reports with task breakdowns.",
    category: "sync",
    icon: "trending-up",
    requiredTools: ["jira", "salesforce"],
    inputs: [
      {
        name: "scope",
        type: "text",
        label: "Scope (optional)",
        required: false,
        placeholder:
          'e.g. "April 2026" or "all pending months" — leave blank for auto-detect',
      },
    ],
    estimatedDuration: "2-4 min",
  },
  {
    id: "jira-task-engine",
    name: "Jira Task Engine",
    description:
      "Decompose a SOW, PRD, spec, or free-text requirements into a structured Feature > Epic > Task hierarchy and create all issues in Jira.",
    category: "automation",
    icon: "layers",
    requiredTools: ["jira"],
    inputs: [
      {
        name: "document",
        type: "text",
        label: "Requirements / SOW / PRD",
        required: true,
        placeholder:
          "Paste the document text, requirements, or describe what needs to be built...",
      },
      {
        name: "projectKey",
        type: "text",
        label: "Jira Project Key",
        required: true,
        placeholder: "e.g. PROJ",
      },
    ],
    estimatedDuration: "3-5 min",
  },
  {
    id: "tech-assist-filler",
    name: "Tech Assist Filler",
    description:
      "Complete a Salesforce Tech Assist record: calculate Amount, generate a Change Request document, create closure details, and update all fields.",
    category: "automation",
    icon: "file-check",
    requiredTools: ["jira", "salesforce"],
    inputs: [
      {
        name: "prompt",
        type: "text",
        label: "Work Description",
        required: true,
        placeholder:
          "Short description of the work scope (what was done, for which client, flows/integrations involved)...",
      },
      {
        name: "effortHours",
        type: "text",
        label: "Effort Hours",
        required: true,
        placeholder: "e.g. 40",
      },
      {
        name: "techAssistLink",
        type: "text",
        label: "Tech Assist Link or Record ID",
        required: true,
        placeholder: "Salesforce URL or record ID (starts with a0L)",
      },
    ],
    estimatedDuration: "2-4 min",
  },
  {
    id: "weekly-status-report",
    name: "Weekly Status Report",
    description:
      "Generate a polished PPTX weekly status deck from live Jira and Slack data for any project.",
    category: "report",
    icon: "presentation",
    requiredTools: ["jira", "salesforce"],
    inputs: [
      {
        name: "projectKey",
        type: "text",
        label: "Jira Project Key",
        required: true,
        placeholder: "e.g. PROJ",
      },
      {
        name: "weekSpec",
        type: "select",
        label: "Week",
        required: true,
        options: [
          { label: "This week", value: "this week" },
          { label: "Last week", value: "last week" },
        ],
        default: "last week",
      },
    ],
    estimatedDuration: "3-5 min",
  },
];

export function getSkill(id: string): SkillDefinition | undefined {
  return skills.find((s) => s.id === id);
}
