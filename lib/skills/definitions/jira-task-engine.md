---
name: jira-task-engine
description: >
  Jira Task Creation Engine that decomposes input documents (SOW, PRD, spec, or free-text requirements)
  into a structured Feature, Epic, and Task hierarchy and creates all issues in Jira, following Weiler's
  exact writing style based on analysis of 550+ real issues. Use this skill whenever the user wants to:
  create Jira issues from a document or requirements, decompose a SOW/PRD into tasks, bulk-create
  Jira tickets, or generate a task breakdown for a project. Also trigger when the user mentions
  "Jira", "tickets", "issues", "tasks", "epics", "features", "SOW decomposition", "task breakdown",
  "backlog creation", or "project planning into Jira". Even if the user just says "break this down
  into tasks" or "create tickets for this" — use this skill.
---

# Jira Task Creation Engine

Transforms any input (SOW, PRD, spec, requirements list, or free-text) into a structured
**Feature > Epic > Task** hierarchy in Jira, with correct linking, role assignments, and
descriptions that replicate Weiler's writing patterns (extracted from 550+ real issues).

## Workflow Overview

1. **Discover** — Understand the Jira environment (project, issue types, required fields)
2. **Decompose** — Break input into Feature > Epic > Task hierarchy with descriptions
3. **Create** — Preview, confirm with user, then create all issues in Jira

---

## Phase 1: Discover the Jira Environment

### Step 1.1 — Identify the Target Project

Ask the user which Jira project to use (or infer from context). Fetch project details
with `getVisibleJiraProjects`. Record project key, project ID, and cloud ID.
If cloud ID is unknown, call `getAccessibleAtlassianResources` first.

### Step 1.2 — Discover Issue Types and Required Fields

1. Call `getJiraProjectIssueTypesMetadata` for all issue types
2. For each type you'll use (Feature, Epic, Task, Test Plan), call `getJiraIssueTypeMetaWithFields`
   to discover required fields and allowed values

Pay attention to **required** custom fields (Stack, Team, Sprint) — missing fields cause creation failures.

### Step 1.3 — Identify the User

Call `atlassianUserInfo` for the current user's account ID (used as reporter).

### Step 1.4 — Inherit Project Conventions (Existing Projects Only)

When the target project **already has issues**, automatically learn its conventions before creating tasks:

1. Fetch the last 20-30 issues via JQL: `project = PROJ ORDER BY created DESC`
2. Extract the most frequent values of `customfield_10001` (Team) grouped by Stack/Role
3. Extract the most frequent assignees grouped by Stack/Role
4. **If patterns are clear** (≥80% consistency for a given role): use those teams and assignees
   automatically on new tasks without asking
5. **If ambiguous or insufficient data** (new project or <10 issues): ask the user which teams
   and assignees to use — same as the default flow

This step replaces the blanket "never set assignee" rule. The updated policy:
- **New projects or no clear pattern** → leave assignee blank, ask user for teams
- **Existing projects with clear conventions** → inherit both team and assignee automatically
- **When in doubt** → ask the user

---

## Source Fidelity Rules

Every task must be grounded in the source document. These rules prevent fabrication.

### Rule 1 — Only Write What the Document Says

Every claim, requirement, and acceptance criterion must trace to a specific section, BR, or
use case in the source. **Never** invent technical details (timeouts, TTLs, retry counts),
assume vendors/technologies, add undescribed features, or fill gaps with defaults — flag
unknowns as `[TBD]` instead. Quote or paraphrase the document's own language; reference
specific BRs (e.g., "Per BR13, no MOQ rules apply").

### Rule 2 — Respect Explicit Boundaries

Pay attention to scope delimiters: "Yalo does not..." / "System X handles..." means Yalo
doesn't implement it. "TBC/TBD" means unresolved — reflect this. "Not exposed via API" means
integration doesn't exist. Gaps/assumptions sections are open questions, not requirements.

### Rule 3 — Flag Uncertainty

When the source is ambiguous or incomplete: add `[TBD - not specified in SOW]` for undefined
values, prefix inferences with `[ASSUMPTION]`, and note "Pending SOW clarification on X" in
descriptions. Use the `**Gaps:**` metadata field when gaps affect the task.

### Rule 4 — Cross-Reference Business Rules

Before writing any task, check if a BR addresses it. Do NOT rely on technical intuition.
High-risk areas: authentication/identity mechanisms, pricing ownership (Yalo vs ERP),
validation responsibility, integration mechanisms (webhooks vs polling), payment gateways,
quantity rules (MOQ/max), and data ownership.

> **Lesson learned (Menabev MKSA):** Auth was initially written as "phone-based lookup" because
> WhatsApp provides phone numbers, but BR23 specified CustomerCode as the exclusive identifier.
> Always check the BRs first.

### Rule 5 — Preserve Document Terminology

Use the document's exact terms. Don't rename "PositiveVisit indicator" to "preseller GPS
check-in", "SimulateOrder API" to "local pricing engine", or "CustomerCode" to "customer ID".

### Rule 6 — Never Assume Authentication Mechanisms

Before writing any auth task: find the BR defining the customer identifier, check if it's
phone/code/email/other, check OTP requirements, check if auto-detected or manual entry, and
propagate the correct mechanism to ALL tasks referencing auth (including recovery and telesales).

---

## Yalo Platform Architecture Rules

These encode platform behaviors that affect task scoping. Violating them produces invalid
or redundant tasks.

### Commerce ↔ CDP Auto-Sync

The Yalo Platform automatically syncs data between Commerce and CDP:
- Integration Platform syncs all entities to Commerce (products, prices, categories, customers, sales reps, orders)
- Customers and Sales Reps auto-propagate from Commerce to CDP — built-in behavior, not manual work

**Valid CDP work** (manual configuration): Segments, Events, Audiences, derived/computed Attributes

**Never create tasks for**: CDP data ingestion, entity sync to CDP, Stores/Contacts/Channels setup, base Attributes — all automatic from Commerce

When referencing CDP: entity sync → Commerce task; QA → "verify automatic propagation"; Segments/Events/Audiences → valid CDP task.

### WhatsApp Templates = CS Team

Template design and Meta approval are CS (Customer Success) responsibilities.
Never include as delivery team tasks unless the SOW explicitly requires it.

**Valid delivery work**: Marketing campaign configuration, Builder CTA response flows, CDP segment targeting, conversational flows after engagement.

### Oris Agent Configuration = UX Team (Never DEV)

All Oris config is UX: Agent Profile, Brand Guidelines, Guardrails, Knowledge Sources,
Predefined Skills, General Settings, Transitions, Skill prompts and interaction patterns.

### Task Scope — Split When Too Large

When a task covers multiple disciplines, split it: conversational UX design → separate task,
skill prompt design → separate task, template design → CS team (not a task at all unless SOW is explicit).

---

## Phase 2: Decompose the Input

### Step 2.0 — Context Gathering for Existing Hierarchies

When the user asks to create tasks inside an **existing** Epic or Feature (not a full SOW decomposition):

1. Fetch the parent issue using `getJiraIssue` — read its summary and description
2. Fetch existing sibling tasks via JQL: `parent = EPIC-KEY ORDER BY created ASC`
3. Use this context to:
   - Match the naming pattern of existing tasks (same summary style)
   - Avoid duplicating scope already covered by sibling tasks
   - Match the description detail level (simple format if siblings are simple, enriched if enriched)
   - Reference the same "SOW Source" if sibling tasks do so
   - Inherit any project-specific conventions (language, terminology, labels)

This ensures new tasks feel cohesive with the existing hierarchy rather than jarring outliers.

### Step 2.1 — Read and Understand the Input

Read the entire input document (all pages for PDFs). For SOWs, focus on: scope, feature
descriptions, technical requirements, integrations, timelines, phasing, **business rules**,
and **gaps/assumptions**.

**Before writing any task**, extract and index every BR noting: what it defines, what it
excludes, what it constrains. Also extract: scope exclusions, gaps/TBC items, integration
boundaries, exact terminology, identity/auth rules, and data ownership rules.

### Step 2.2 — Identify the Hierarchy

- **Features** — Major project phases or capability groups (typically 2-5 per project)
- **Epics** — Functional domains within a feature, grouped by Yalo platform area
- **Tasks** — Individual work items, assignable to one person/role

#### Epic Structure: Always Platform-Workstream

Epics MUST be organized by **Yalo platform area**, not by SOW section or feature.

**Correct**: `SalesBuzz Integration`, `Commerce Storefront`, `Oris Sales Agent`, `Payment Gateway`
**Incorrect**: `Feature 1: Core Commerce`, `SOW Section 3: Order Taking`, `Authentication & Ordering`

Ask: "Which Yalo platform component does this work belong to?" and group accordingly. If a
SOW feature touches multiple platform areas, distribute tasks across relevant platform-workstream epics.

### Step 2.3 — Assign Roles

Every task gets a role prefix:

| Prefix | Role | When to Use |
|--------|------|-------------|
| DEV | Engineering | Backend, frontend, API, integrations, Builder flows, Commerce config |
| UX | UX/Design | Conversational design, content, copy, **all Oris agent config** (profile, persona, skills, guardrails, transitions, knowledge, brand guidelines), skill prompt design |
| QA | Quality Assurance | Test plans (E2E, validation, regression). **Must use `Test Plan` issue type.** Descriptions include structured test cases from SOW/CR. See Step 2.5 for template. |
| PM | Project Management | Coordination, kickoffs, alignment (rare) |

The role prefix appears in summaries as `ROLE | Action Description` (pipe separator).
Map roles to Stack field values discovered in Phase 1.

### Step 2.4 — Write Summaries

See `references/description_templates.md` for full templates with real examples.

- **Feature**: Temporal/categorical prefix with pipe (46%) or plain text (40%). Ex: `Phase 1 | Launch + AI Commerce`
- **Epic**: Plain descriptive text, NO separators (94%). Ex: `User Authentication`
- **Task**: Always `ROLE | Action` format. Ex: `DEV | Implement OTP generation and verification flow`

### Step 2.5 — Write Descriptions

See `references/description_templates.md` for full templates.

**Feature** (optional, ~18% have them) — Brief paragraph or bullet list when provided.

**Epic** (recommended) — Epics carry the context that tasks don't repeat. Use a structured
description with Scope, Yalo Product Components, and Expected Outcome so anyone reading the
epic understands the full picture without needing to open every child task:

```
## Objective
[1-2 sentences: what this epic delivers and why it matters]

## Scope
[Bullet list of what's included and what's explicitly excluded]

## Yalo Product Components
[Which platform products/modules are involved across all tasks in this epic]

## Expected Outcome
[What "done" looks like — the tangible deliverable or behavior change the client will see]

## Risks & Dependencies
[Key risks, external dependencies, or open questions — optional but recommended]
```

**Task** (recommended, ~80%) — Tasks are lean and action-oriented. They focus on what to do
and how to verify it's done. Scope and Yalo Product Components live on the parent Epic — do
NOT repeat them on tasks (it makes descriptions verbose and tiring to read). Use this format:

```
## Objective
[1-2 sentences: what this task delivers and why]

## Technical Notes
[Implementation guidance, API references, constraints — keep it brief]
> **Note:** [Critical platform behavior clarification if needed]

## Acceptance Criteria
1. First testable criterion with specific values
2. Second criterion (happy path)
3. Third criterion (edge cases)
4. Fourth criterion (error handling)
5. Fifth criterion (performance/SLA if applicable)

**SOW Source:** Section X.X — [Section Name]
```

**QA Test Plan** — Use `Test Plan` issue type with structured test cases:

```
## Objective
[What this test plan validates]

## Scope
[What's being tested — map to related tasks' acceptance criteria]

## Yalo Product Components
[Modules under test]

## Test Cases

### TC-01: [Name]
- **Preconditions:** [Setup]
- **Steps:** 1. ... 2. ... 3. ...
- **Expected Result:** [What should happen]
- **SOW Reference:** [Section/BR]

### TC-02: [Name]
[Same structure]

## Edge Cases & Negative Tests
1. [Error scenario from SOW gaps or BR boundaries]

## Exit Criteria
1. All test cases pass on staging
2. No critical/high defects open

**SOW Source:** Section X.X — [Section Name]
```

**Key formatting rules**: `##` headers (not `###`), numbered acceptance criteria (not bullets),
blockquote `> **Note:**` for platform behavior, English preferred for new work.

### Step 2.6 — Verify Source Fidelity (Mandatory)

Audit every task against the source:
1. Each acceptance criterion traceable to a section, BR, or use case? If not → remove or mark `[ASSUMPTION]`
2. Any BR contradicts what you wrote?
3. Filled in TBC/undefined details? → Replace with `[TBD]`
4. Every number (timeouts, limits) from the document? If invented → `[TBD]` or remove
5. Integration mechanism specified? Don't assume webhooks vs polling
6. Scope boundaries correct? Another system handles something you assigned to Yalo?

### Step 2.7 — Save the Decomposition

Write the full decomposition to a markdown file for review and audit trail.
See `references/description_templates.md` for the file structure template.

---

## Phase 3: Create Issues in Jira

### Step 3.1 — Present the Preview

Show the user the full decomposition with counts: total issues, hierarchy structure, role
distribution. **Wait for explicit confirmation before creating anything.**

### Step 3.2 — Create Issues Top-Down

Create in strict hierarchical order so parent IDs are available:

1. **Features** — record issue keys
2. **Epics** — link to parent Feature via `parent` field
3. **Tasks** — link to parent Epic via `parent` field
4. **QA Test Plans** — use `Test Plan` issue type, link to parent Epic

For each issue, use `createJiraIssue` with: `cloudId`, `projectKey`, `issueTypeName`
("Feature" | "Epic" | "Task" | "Test Plan"), `summary`, `description`, `parent` (parent key),
`additional_fields` (required custom fields like Stack). **Do NOT include `timeoriginalestimate`
in `additional_fields`** — it will fail. Estimates are set separately after creation (see
"Applying Estimates" section).

**Assignee policy** (see Step 1.4):
- Existing projects with clear patterns → use inherited assignees
- New projects or unclear patterns → leave blank

Create sibling tasks in parallel when the parent epic already exists.

**Time estimates**: After all tasks are created, batch-update them with `editJiraIssue` using
`{"timetracking": {"originalEstimate": "Xh"}}` (see "Applying Estimates" for details).

### Step 3.3 — Team Field Assignment

The Team field (`customfield_10001`) must be set on every Task. Read `references/delivery_teams.md`
for the full team list with UUIDs and formatting instructions.

**For every new project**, ask the user which team to assign per role (DEV, UX, QA).
For existing projects, inherit from Step 1.4 if patterns are clear.

After creating all Tasks, batch-update them with the correct team using `editJiraIssue`.

For the **Stack** custom field, map roles:

| Role Prefix | Stack Value |
|-------------|-------------|
| DEV | DEV |
| UX | UX/CUX |
| QA | QA |
| PM | PMO |

### Step 3.4 — Handle Errors

- **"Field X is required"** — Call `getJiraIssueTypeMetaWithFields`, add the field, retry
- **Parent linking fails** — Use the issue KEY (e.g., "PROJ-1"), not the numeric ID

### Step 3.5 — Report Results

Present a summary with issue key ranges and role distribution.

---

## Important Conventions

- **Separator**: Always ` | ` (space-pipe-space)
- **Roles**: DEV, UX, QA are standard. PM is rare
- **QA = Test Plan issue type**: With structured test cases derived from SOW/CR
- **Oris config = UX**: Always, never DEV
- **Assignee**: Inherit from existing projects when clear; leave blank for new projects; ask when unsure
- **Team field**: Always set on Tasks — read `references/delivery_teams.md` for UUIDs
- **Epic structure**: Platform-workstream epics, never feature-based
- **Description format**: Enriched (Objective → Scope → Components → Notes → Criteria → Source) for complex projects
- **Headers**: `##` (not `###`); numbered acceptance criteria
- **Language**: English for new cross-project work
- **Casing**: Title Case for summaries
- **CDP**: Never create tasks for auto-synced data
- **WhatsApp templates**: CS team — never delivery unless SOW is explicit
- **Auth**: Never assume phone-based — check BR first, propagate to all auth-referencing tasks
- **Split large tasks**: Separate disciplines into separate tasks

## Default Time Estimates (P80)

Based on 1,252 completed tasks (last 12 months, 73 projects). P80 = 80% complete within this time.

### By Stack

| Stack | Default | P80 Spent | P80 Ratio | Notes |
|-------|---------|-----------|-----------|-------|
| DEV | 8h | 12h | 1.60x | Median 5h, hard tasks +60% |
| UX | 6h | 8h | 1.50x | Historically underestimated ~50% |
| QA | 12h | 16h | 2.00x | Most underestimated — can double |
| PM | 4h | 10h | 1.07x | Small sample, low variance |

### By Subtype

```
DEV: Standard 8h | Integration/API 12h | Release/Deploy 4h | Bug Fix 2h | Config 4h
UX:  Standard 6h | Content/Copy 4h | Design/Wireframe 8h
QA:  Standard 12h | Test Plan 8h | Test Execution 10h
PM:  Standard 4h | Documentation 6h
```

### Buffer Guidance

| Size | P80 Ratio | Guidance |
|------|-----------|----------|
| Micro (≤2h) | 2.00x | Consider estimating 4h |
| Small (2-4h) | 1.67x | Most common, decent accuracy |
| Medium (4-8h) | 1.50x | Best estimation sweet spot |
| Large (8-16h) | 1.42x | Consider splitting if unclear |
| XL (16-24h) | 1.44x | Multi-day, reasonable accuracy |
| XXL (24-40h) | 1.28x | Best accuracy — well-scoped work |

### Applying Estimates

1. Determine stack from role prefix
2. Look up subtype from summary
3. Set the estimate using `timetracking.originalEstimate` with human-readable format (e.g., "8h", "12h").
   **Do NOT use `timeoriginalestimate`** — this field is not on the create/edit screen in most Yalo
   projects and will cause a "Field cannot be set" error. Instead, after creating the issue, use
   `editJiraIssue` with:
   ```json
   {"timetracking": {"originalEstimate": "8h"}}
   ```
   If `timetracking` also fails (field not on screen), the project does not support time tracking
   via API — skip silently, do not retry with `timeoriginalestimate`.
4. Use stack default for ambiguous tasks
5. Never estimate below 2h (highest variance)

---

## Yalo Product Knowledge Base

**Before decomposing any SOW/PRD**, read the full Yalo product reference at:
`~/.claude/projects/-Users-weilerbarbosa/memory/reference_yalo_products.md`

Use it to map tasks to correct products, understand platform capabilities, use official
terminology, know integration points, scope promotions correctly (5 types), understand
Yalo Force (Standard vs Pro), and reference Commerce capabilities.

### Quick Product Reference

1. **Yalo Studio** — Central web platform (auth, team, API keys, Meta tools)
2. **Integration Platform** — API connectors, VTEX, MC1, SFTP, CSV, sync jobs
3. **Data Entities** — Products, Prices, Stock, Categories, Customers, Sales Reps, Orders, Promotions, Distributors
4. **ML Recommendations** — Recommended products, prefilled cart, frequently bought together
5. **CDP** — Stores, Contacts, Attributes, Events, Segments, Audiences (auto-synced from Commerce)
6. **Marketing** — WhatsApp templates, campaigns, Notification API, Marketing Flows
7. **Builder** — Flow canvas, WhatsApp Flows, authentication, menu, transitions
8. **Agents** — Oris (B2B Sales), Custom Agents, Knowledge Agent (Genie), Agent Builder
9. **Sales Desk** — Human agent handoff, admin panel, queue routing, CSAT
10. **Commerce** — Storefront, branding, banners, promotions (5 types), multi-packaging, bundles, business rules
11. **Yalo Force** — Sales rep tools (Standard: store activation; Pro: orders, suggestions, ML, profiler, lead gen)
12. **Channels** — WhatsApp, Messenger, Telegram, Instagram
13. **Analytics** — Engagement dashboards, Sales Desk dashboards, WhatsApp Conversion API
14. **Agent Tools / MCP Servers** — Transactional APIs (SimulateOrder, CreateOrder, ConfirmOrder)
15. **Custom Skills** — Photo-Assisted Ordering, custom Oris skills

## References

- `references/description_templates.md` — Full templates with real examples for each issue type
- `references/style_analysis.md` — Complete writing style analysis from 550+ issues
- `references/delivery_teams.md` — Delivery team names and UUIDs (cached, refreshable)
