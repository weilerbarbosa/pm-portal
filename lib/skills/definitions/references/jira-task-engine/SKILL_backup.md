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

This skill takes any input (a SOW document, PRD, spec, list of requirements, or free-text
description) and produces a fully structured Jira issue hierarchy: **Feature > Epic > Task**,
then creates all issues in the user's Jira project with correct linking, role assignments, and
descriptions that replicate Weiler's established writing patterns.

The style patterns were extracted from analysis of 550+ real Jira issues (50 Features, 100 Epics,
~400 Tasks) and reflect the latest conventions including the recent shift to pipe-based separators.

## Workflow Overview

The engine operates in 3 phases:

1. **Discover** — Understand the Jira environment (project, issue types, required fields)
2. **Decompose** — Break the input into a Feature > Epic > Task hierarchy with descriptions
3. **Create** — Preview the plan, get user confirmation, then create all issues in Jira

---

## Phase 1: Discover the Jira Environment

Before creating anything, understand the target project's configuration.

### Step 1.1 — Identify the Target Project

Ask the user which Jira project to use, or infer it from context. Then fetch the project details
using `getVisibleJiraProjects`. Record the project key, project ID, and cloud ID.

If you don't have the cloud ID yet, call `getAccessibleAtlassianResources` first.

### Step 1.2 — Discover Issue Types and Required Fields

Each Jira project may have different issue types and required custom fields:

1. Call `getJiraProjectIssueTypesMetadata` to get all issue types for the project
2. For each issue type you'll use (Feature, Epic, Task), call `getJiraIssueTypeMetaWithFields`
   to discover required fields and their allowed values

Pay special attention to custom fields that are **required** — these cause creation failures if
omitted. Common examples: "Stack", "Team", "Sprint". Record field IDs and allowed values.

### Step 1.3 — Identify the User

Call `atlassianUserInfo` to get the current user's account ID for reporter fields.

**IMPORTANT: NEVER set an assignee** on any created task — always leave the assignee blank.
Do NOT pass `assignee_account_id` when calling `createJiraIssue`.

---

## CRITICAL: Source Fidelity Rules

These rules prevent fabrication and ensure every task is grounded in the source document.
They apply to ALL decompositions, regardless of input type.

### Rule 1 — Only Write What the Document Says

Every claim, requirement, and acceptance criterion in a task description MUST be traceable
to a specific section, business rule, use case, or explicit statement in the source document.

**NEVER:**
- Invent technical details not in the document (specific timeouts, TTLs, intervals, retry counts, cache durations)
- Assume a specific vendor/technology unless the document names it
- Add features or capabilities the document doesn't describe
- Fill in gaps with "reasonable defaults" — flag them as TBD instead
- Describe implementation mechanisms the document doesn't specify (e.g., webhooks vs polling)

**INSTEAD:**
- Quote or paraphrase the document's own language
- Reference specific business rules (e.g., "Per BR13, no MOQ rules apply")
- When the document says something is TBC/TBD, reflect that status in the task
- When the document explicitly says Yalo does NOT do something, do NOT include it as a task

### Rule 2 — Respect Explicit Boundaries

Source documents often define what is IN scope and what is OUT of scope or delegated to
another system. Pay close attention to:

- "Yalo does not..." / "System X handles..." — means Yalo doesn't implement this
- "TBC" / "TBD" / "To Be Confirmed" — means the detail is unresolved, reflect this
- "Not exposed via API" — means the integration doesn't exist yet
- Business rules that say "no X applies" — means do NOT add X to acceptance criteria
- Gaps/assumptions sections — these are NOT requirements, they are open questions

### Rule 3 — Flag Uncertainty Explicitly

When the source document is ambiguous or incomplete, don't fill in the blanks. Instead:

- Add `[TBD - not specified in SOW]` for values the document doesn't define
- Add `[ASSUMPTION]` prefix if making a reasonable inference, so reviewers can validate
- In the task description, note: "Pending SOW clarification on X" when details are missing
- Use the `**Gaps:**` metadata field when known gaps affect the task

### Rule 4 — Cross-Reference Business Rules for EVERY Task

Before writing any task description or acceptance criterion, systematically check if the
source document has a business rule that explicitly addresses it. Do NOT rely on "what makes
sense technically" — the BR is the authority.

**High-risk areas where BRs commonly override assumptions:**

- **Authentication/Identity**: How are customers identified? Phone number? Customer code? Email?
  → A BR will often specify the EXACT identifier. Do NOT assume phone-based auth just because
  WhatsApp provides phone numbers. Check the customer identifier BR explicitly.
- **Pricing**: Does Yalo calculate prices, or does the ERP? → Check business rules
- **Validation**: Does Yalo validate (credit, stock, MOQ), or does the ERP? → Check business rules
- **Integration mechanism**: Does the ERP provide webhooks, or must Yalo poll? → Check gaps section
- **Payment**: Is the gateway defined, or TBC? → Check business rules and gaps
- **Quantities**: Are there MOQ/max rules, or not? → Check business rules explicitly
- **Data ownership**: Which system is the source of truth? → Check business rules

**Lesson learned:** In the Menabev MKSA project, the authentication task was initially written
as "phone-based SalesBuzz lookup" because WhatsApp naturally provides phone numbers. But BR23
explicitly stated: "Yalo will rely exclusively on the CustomerCode provided by SalesBuzz as
the unique identifier for all operations. Phone numbers are treated strictly as contact
attributes and not as primary identifiers." This required correcting 6 issues across the
project. Always check the BRs FIRST.

### Rule 5 — Preserve Document Terminology

Use the same terms the document uses. Don't rename concepts:
- If the document says "PositiveVisit indicator", don't write "preseller GPS check-in"
- If the document says "SimulateOrder API", don't write "local pricing engine"
- If the document says "CustomerCode", don't write "customer ID" (unless it maps directly)

### Rule 6 — Never Assume Authentication Mechanisms

Authentication and customer identification are among the most commonly miswritten task areas.
Every project may have a different approach, and business rules often specify non-obvious
choices.

**Before writing ANY authentication-related task:**
1. Find the BR that defines the customer identifier (it may be called "Customer Identifier",
   "Authentication Method", "User Identification", or similar)
2. Check whether the identifier is: phone number, customer code, email, account ID, or other
3. Check if OTP is required or explicitly excluded
4. Check if the identifier is auto-detected (e.g., from WhatsApp) or manually entered by user
5. Propagate the correct mechanism to ALL tasks that reference authentication — including
   recovery flows, telesales flows, and any flow that "reuses the auth pattern"

**Common trap:** WhatsApp projects seem like they should use phone-based auth (since WhatsApp
provides the number automatically), but many B2B projects use customer codes, account numbers,
or other identifiers instead. Never assume — always verify against the BRs.

---

## CRITICAL: Yalo Platform Architecture Rules

These rules encode platform behaviors that affect how tasks are scoped and assigned. Violating
them produces invalid or redundant tasks.

### Commerce ↔ CDP Auto-Sync

**The Yalo Platform automatically syncs data between Commerce and CDP.**

- **Integration Platform syncs ALL entities to Commerce (Data Entities)** — products, prices,
  categories, customers, sales reps, orders
- **The Yalo Platform automatically propagates Customers and Sales Reps from Commerce to CDP**
  — this is built-in platform behavior, NOT manual work
- **All attributes are automatically synced between CDP and Commerce** — no manual configuration
  needed for entity data
- **NEVER create tasks for "CDP data ingestion"** or "sync entities to CDP" — this happens
  automatically

#### What IS valid CDP work (requires manual configuration):

- Creating **Segments** (by route, territory, customer type, etc.)
- Configuring **Events** tracking (order placed, cart abandoned, etc.)
- Creating **Audiences** for campaign targeting
- Defining **derived/computed custom Attributes** (e.g., order frequency tier)

#### What is NOT valid CDP work (automatic — never create tasks for these):

- Stores entity population → automatic from Commerce
- Contacts creation → automatic from Commerce
- Contact Channels setup → automatic from Commerce
- Store-Contact Relations → automatic from Commerce
- Base entity Attributes → automatic from Commerce

#### When referencing CDP in tasks:

- If the task is about syncing entity data → it goes to **Commerce**, not CDP
- If the task is QA → can verify auto-sync works, but frame it as "verify automatic propagation"
  not "test CDP configuration"
- If the task is about Segments, Events, Audiences → this is valid CDP manual work

### WhatsApp Template Rules

**WhatsApp message template design and Meta approval = CS team responsibility.**

- **NEVER include WhatsApp template design** as a delivery team task unless there is a very
  explicit use case in the SOW description
- The CS (Customer Success) team handles template creation, content design, and Meta approval
- Delivery team tasks should focus on:
  - **Marketing module configuration**: campaign setup, segment targeting, trigger mechanisms
  - **Conversational UX**: the experience AFTER a customer responds to a proactive message
  - **Builder flows**: the CTA response handling and authentication
- If referencing templates in a task, frame it as "use the template configured by CS" not
  "design the template"

#### What IS valid delivery team work for proactive messages:

- Configure Marketing campaign (targeting, triggers, scheduling)
- Build Builder flow triggered by CTA response
- Configure CDP segments/audiences for campaign targeting
- Design the conversational flow AFTER the user engages

#### What is NOT delivery team work:

- WhatsApp template content design
- Template layout and formatting
- Meta approval submission
- Template variant creation (Arabic/English)

### Oris Agent Configuration = UX Team

**All Oris agent configuration tasks are UX team responsibilities, NEVER DEV.**

The following are **always UX**, never DEV:
- Agent Profile (system prompt, persona, context)
- Brand Communication Guidelines
- Guardrails (topic restrictions, compliance rules)
- Knowledge Sources configuration
- Predefined Skill configuration (skills setup)
- General Agent Settings
- Transitions and handoff configuration
- Skill prompts and interaction pattern design (prompt engineering is UX work)

### Task Scope — Split When Too Large

When a task covers multiple distinct disciplines or deliverables, split it:

- **Conversational UX design** (flow wireframes, message copy, interaction design) → separate task
- **Skill prompt design** (prompt engineering, interaction patterns per skill) → separate task
- **Template design** → CS team, not a task at all (unless SOW is explicit)

**Example of a good split:**
- **Before**: One task covering "Conversational Experience, Skill Prompts, and WhatsApp Templates"
- **After**:
  - Task A: `UX | Design Conversational Experience, Flow Wireframes, and Message Copy`
  - Task B: `UX | Design Oris Skill Prompts and Interaction Patterns`
  - Templates: Removed entirely (CS team)

---

## Phase 2: Decompose the Input

This is the core intellectual work — transforming a document into a structured issue hierarchy.

### Step 2.1 — Read and Understand the Input

Read the entire input document. If it's a PDF, read ALL pages. For a SOW, focus on:
scope sections, feature descriptions, technical requirements, integration points, timelines,
phasing/milestones, **business rules**, and **gaps/assumptions sections**.

#### MANDATORY: Extract ALL Business Rules First

**Before writing a single task**, you MUST read and extract every business rule in the document.
Business rules are the authoritative source of truth — they override any assumptions you might
make based on "how things usually work" or common patterns from other projects.

Create a mental (or written) index of every BR, noting:
- **What it defines** (identifier, pricing, validation, scope boundary, etc.)
- **What it explicitly excludes** (what Yalo does NOT do, what another system handles)
- **What it constrains** (specific mechanisms, specific identifiers, specific flows)

**Why this matters:** Business rules often contradict "reasonable assumptions." For example,
a B2B WhatsApp commerce project might seem like it should use phone-number-based authentication
(since WhatsApp provides phone numbers automatically), but if a BR says "CustomerCode is the
exclusive identifier," then the auth flow MUST be CustomerCode-based. The BR wins, always.

**CRITICAL**: Before writing any task, extract and internalize:
1. All business rules (BR1, BR2, etc.) — these define what the system does and does NOT do
2. All explicit scope exclusions — what Yalo is NOT responsible for
3. All gaps/TBC items — what is still undefined
4. Integration boundaries — what is Yalo's responsibility vs the ERP/partner system
5. Exact terminology for key concepts (visit outcomes, order types, pricing models)
6. **Identity and authentication rules** — how customers are identified (phone, code, email, etc.)
7. **Data ownership rules** — which system is the source of truth for each entity

### Step 2.2 — Identify the Hierarchy

**Features** (highest level) — Major project phases or capability groups. Typically 2-5 per
project. Each represents a significant deliverable or milestone.

**Epics** (middle level) — Functional domains within a feature. Groups related work around a
coherent capability (e.g., "User Authentication", "Order Entry", "Payment Gateway").

**Tasks** (lowest level) — Individual work items within an epic. Assignable to one person/role,
completable in a reasonable timeframe.

#### CRITICAL: Epic Structure — Always Use Platform-Workstream Approach

Epics MUST be organized by **Yalo platform area or functional workstream**, NOT by SOW feature
or section. This means each epic groups all work related to a specific platform capability,
regardless of which SOW section or feature it supports.

**CORRECT (platform-workstream approach):**
- `SalesBuzz Integration` — All integration sync jobs and Agent Tools
- `Commerce Storefront` — Catalog, branding, business rules, product display
- `Oris Sales Agent` — Profile, skills, guardrails, knowledge, transitions
- `Payment Gateway` — Payment link generation, webhooks, status tracking
- `MSL Recovery` — Preseller order polling, comparison logic, proactive outreach
- `Visit Recovery` — Visit data ingestion, missed visit detection, notifications
- `Telesales` — Schedule ingestion, trigger mechanism, outreach flow

**INCORRECT (feature-based approach — NEVER use this):**
- `Feature 1: Core Commerce` → too broad, mixes platform areas
- `SOW Section 3: Order Taking` → mirrors the document structure instead of the platform
- `Authentication & Ordering` → groups unrelated platform areas by user journey

The platform-workstream approach ensures that tasks within an epic are coherent and can be
worked on by a focused team, since each Yalo platform area typically has its own specialists.

When decomposing, ask: "Which Yalo platform component does this work primarily belong to?"
and group accordingly. If a SOW feature touches multiple platform areas (e.g., "Order Taking"
involves Builder + Oris + Agent Tools + Commerce), distribute the tasks across the relevant
platform-workstream epics rather than creating one monolithic epic.

### Step 2.3 — Assign Roles to Tasks

Every task gets a role prefix. The three standard roles cover the vast majority of tasks:

| Prefix | Role | When to Use |
|--------|------|-------------|
| DEV | Engineering/Development | Backend, frontend, API, infrastructure, integrations, Builder flows, Commerce config |
| UX | User Experience/Design | Conversational design, UX flows, content, copy writing, **all Oris agent configuration** (profile, persona, skills, guardrails, transitions, knowledge sources, brand guidelines), skill prompt design |
| QA | Quality Assurance | Dedicated test plans, E2E testing, validation, regression suites — typically one QA task per epic. **IMPORTANT: QA tasks MUST be created as `Test Plan` issue type** (not `Task`). Their descriptions must include structured test cases derived from the SOW/CR. See Step 2.5 for the QA description template. |

Rarely used (only when truly needed):

| Prefix | Role | When to Use |
|--------|------|-------------|
| PM | Project Management | Coordination tasks, kickoffs, stakeholder alignment |

**CRITICAL**: Oris agent configuration is ALWAYS UX, never DEV. See the "Oris Agent
Configuration = UX Team" section above for the full list.

The role prefix appears in the task summary as `ROLE | Action Description` (pipe separator).

If the Jira project has a "Stack" or similar field, map roles to the correct field values
discovered in Phase 1.

### Step 2.4 — Write Summaries

Each issue type follows a specific summary format. Read `references/description_templates.md`
for full templates with real examples.

**Feature summaries** use temporal or categorical prefixes with pipe separators (46%) or
plain descriptive text (40%):
- `Phase 1 | Launch + Engagement + AI Connected Commerce`
- `Q3 2025 | Improvements to Checkout Flow`
- `Commerce Migration`

**Epic summaries** are plain descriptive text with NO separators (94% of epics):
- `User Authentication`
- `Payment Gateway Integration`
- `Small Improvements & Bug Fixes`

**Task summaries** always use `ROLE | Action` format (pipe separator):
- `DEV | Implement OTP generation and verification flow`
- `UX | Design authentication conversational flow`
- `QA | End-to-end testing of authentication flow`

### Step 2.5 — Write Descriptions

Description presence varies by type — Features rarely have them, Tasks almost always do:

**Feature descriptions** (optional, only ~18% have them) — When provided, a brief paragraph
or bullet list explaining scope. Most features have NO description.

**Epic descriptions** (optional, ~35% have them) — When provided, 1-2 paragraphs of plain
text explaining the epic's scope. No structured sections needed.

**Task descriptions** (recommended, ~80% should have them) — Use the **enriched format**:

```
## Objective

[1-2 sentences: what this task delivers and why it matters]

## Scope

[Bullet list of what's included in this task — clear boundaries]

## Yalo Product Components

[Which Yalo platform products/modules are involved — e.g., Integration Platform, Commerce,
Builder, Oris Sales Agent, CDP, Marketing, etc.]

## Technical Notes

[Implementation guidance, API references, or important platform behavior notes.
Use blockquote notes for critical platform behavior clarifications:]

> **Note:** [Important platform behavior, e.g., "The Yalo Platform automatically
> propagates Customers and Sales Reps from Commerce to CDP — no manual sync needed."]

## Acceptance Criteria

1. First testable criterion with specific values
2. Second criterion covering happy path behavior
3. Third criterion for edge cases
4. Fourth criterion for error handling
5. Fifth criterion for performance/SLA if applicable

**SOW Source:** Section X.X — [Section Name]
```

**QA Test Plan descriptions** — QA tasks use the `Test Plan` issue type and MUST include
structured test cases derived directly from the SOW/CR. Use this template:

```
## Objective

[1-2 sentences: what this test plan validates and which epic/feature it covers]

## Scope

[Bullet list of what's being tested — map to the acceptance criteria of the related tasks]

## Yalo Product Components

[Which Yalo platform products/modules are under test]

## Test Cases

### TC-01: [Test case name]
- **Preconditions:** [Setup required before executing]
- **Steps:**
  1. [Step 1]
  2. [Step 2]
  3. [Step 3]
- **Expected Result:** [What should happen]
- **SOW Reference:** [Section/BR that defines this behavior]

### TC-02: [Test case name]
- **Preconditions:** [Setup required]
- **Steps:**
  1. [Step 1]
  2. [Step 2]
- **Expected Result:** [What should happen]
- **SOW Reference:** [Section/BR that defines this behavior]

[Continue for all test cases — derive each from specific SOW requirements, business rules,
or acceptance criteria of the tasks in the same epic]

## Edge Cases & Negative Tests

1. [Error scenario derived from SOW gaps or business rule boundaries]
2. [Boundary condition from acceptance criteria]

## Exit Criteria

1. All test cases pass on staging environment
2. No critical or high-severity defects remain open
3. [Any SOW-specific quality gates]

**SOW Source:** Section X.X — [Section Name]
```

**CRITICAL for QA Test Plans:**
- Every test case MUST trace back to a specific SOW section, business rule, or acceptance
  criterion from a sibling task in the same epic
- Do NOT invent test scenarios that go beyond what the SOW defines — apply Rule 1
  (Only Write What the Document Says)
- Include both happy-path and negative/edge-case tests when the SOW defines error behaviors
- Use the naming convention `TC-01`, `TC-02`, etc. for easy reference during execution

The key points about task descriptions:
- Use `##` level headers (not `###`) for section breaks
- Acceptance criteria use **numbered lists** (70% of real examples) — not bullets
- Use blockquote `> **Note:**` for critical platform behavior clarifications
- The enriched format (Objective → Scope → Product Components → Technical Notes →
  Acceptance Criteria → SOW Source) is preferred for complex/new projects
- The simpler format (context paragraph → Acceptance Criteria → Source) is acceptable
  for straightforward tasks
- English is preferred for new work (85% in newest batch)

### Step 2.6 — Verify Source Fidelity (MANDATORY)

Before saving, audit every task against the source document:

1. **For each acceptance criterion**: Can you point to a specific section, business rule, or
   use case that supports it? If not, either remove it or mark it as `[ASSUMPTION]`
2. **Check business rules**: Do any BRs explicitly contradict what you wrote? (e.g., "no MOQ",
   "Yalo does not calculate pricing", "stock validated after order creation")
3. **Check gaps section**: Did you fill in details that the document marks as TBC/undefined?
4. **Check specific values**: Every number (timeouts, intervals, limits, counts) must come from
   the document. If invented, replace with `[TBD]` or remove
5. **Check integration mechanisms**: Does the document specify webhooks, polling, or API calls?
   Don't assume one if the document doesn't state it
6. **Check scope boundaries**: Does the document say another system handles something you
   assigned to Yalo? (credit checks, pricing logic, stock validation, etc.)

This step prevents the most common failure mode: writing plausible-sounding requirements
that are not actually in the source document.

### Step 2.7 — Save the Decomposition

Write the full decomposition to a markdown file for review and audit trail.
See `references/description_templates.md` for the file structure template.

---

## Phase 3: Create Issues in Jira

### Step 3.1 — Present the Preview

Show the user the full decomposition with counts. Highlight: total issue count, hierarchy
structure, role distribution. **Wait for explicit confirmation before creating anything.**

### Step 3.2 — Create Issues Top-Down

Create issues in strict hierarchical order so parent IDs are available for linking:

1. **Create all Features first** — record their issue keys
2. **Create all Epics** — link each to its parent Feature via the `parent` field
3. **Create all Tasks** — link each to its parent Epic via the `parent` field
4. **Create all QA Test Plans** — use `Test Plan` issue type, link each to its parent Epic via the `parent` field

For each issue, use `createJiraIssue` with:
- `cloudId`: discovered cloud ID
- `projectKey`: project key
- `issueTypeName`: "Feature" | "Epic" | "Task" | "Test Plan" (use `Test Plan` for QA tasks)
- `summary`: the summary text
- `description`: the description text (markdown format)
- `parent`: parent issue key (for Epics, Tasks, and Test Plans)
- `additional_fields`: any required custom fields (like Stack)

**NEVER set `assignee_account_id`** — all tasks must be created with blank assignee.

### Team Field Assignment

The Jira native **Team** field (`customfield_10001`) must be set on every Task. The team
assignment is based on the task's role prefix.

**IMPORTANT: For every NEW project, always ASK the user which team to assign for each role
type (DEV, UX, QA).** Do not assume teams carry over between projects.

Once the user confirms team assignments, set the team field on each task after creation using
`editJiraIssue`. The field accepts a plain UUID string (NOT an object format):

```
// CORRECT — plain string UUID
{"customfield_10001": "082e58b6-7276-4d36-af4f-6b75e3f84fcc"}

// INCORRECT — object format (returns Bad Request)
{"customfield_10001": {"id": "082e58b6-7276-4d36-af4f-6b75e3f84fcc"}}
```

**Known team mappings** (for reference — always confirm with the user for new projects):

| Role | Team Name (Jira) | Team UUID |
|------|-------------------|-----------|
| DEV | Delivery Devs Fer Team | `082e58b6-7276-4d36-af4f-6b75e3f84fcc` |
| UX | Delivery LATAM Uxers | `be5ddcdb-5f93-4fe4-8b96-e3c43e890867` |
| QA | Delivery QAs | `2254e489-e582-41fa-98fb-843c5961b568` |

To find team UUIDs for teams not listed above, navigate to the Atlassian Teams directory at
`https://home.atlassian.com/o/{org-id}/people/team/{team-uuid}` or search for issues already
assigned to that team using JQL: `team = "Team Name"`.

After creating all Tasks in Step 3.2, batch-update them with the correct team field using
`editJiraIssue`. You can parallelize these calls for efficiency.

For the **Stack** custom field, map roles as follows (field ID and values may vary by project):

| Role Prefix | Stack Value |
|-------------|-------------|
| DEV | DEV |
| UX | UX/CUX |
| QA | QA |
| PM | PMO |

Create sibling tasks in parallel when the parent epic already exists.

### Step 3.3 — Handle Errors

**"Field X is required"** — Call `getJiraIssueTypeMetaWithFields` to discover the field's
allowed values, add it to `additional_fields`, and retry.

**Parent linking fails** — Use the issue KEY (e.g., "PROJ-1"), not the numeric ID.

### Step 3.4 — Report Results

After all issues are created, present a summary with issue key ranges and role distribution.

---

## Important Conventions

- **Task separator**: Always ` | ` (space-pipe-space) — this is the current standard
- **Task roles**: `DEV`, `UX`, and `QA` are the three standard stacks. Use PM sparingly
- **QA = Test Plan issue type**: All QA tasks MUST be created as `Test Plan` (not `Task`), with structured test cases in the description derived from SOW/CR requirements
- **Oris config = UX**: All Oris agent configuration (profile, skills, guardrails, transitions, knowledge sources) is UX, never DEV
- **No assignee**: NEVER set an assignee on created tasks — always leave blank
- **Team field**: Always set `customfield_10001` on Tasks after creation — ask the user for team assignments on each new project
- **Epic structure**: Always use platform-workstream epics (e.g., SalesBuzz Integration, Commerce Storefront, Oris Sales Agent), NEVER feature-based epics that mirror SOW structure
- **Feature/Epic summaries**: No role prefix. Epics use plain text (no separators)
- **Description headers**: Use `##` (not `###`) for section breaks in tasks
- **Description format**: Prefer enriched format (Objective → Scope → Product Components → Technical Notes → Acceptance Criteria → SOW Source) for complex projects
- **Acceptance criteria**: Numbered lists (1. 2. 3.) — not bullets
- **Platform notes**: Use blockquote `> **Note:**` for critical platform behavior clarifications
- **Language**: English for new cross-project work
- **Casing**: Title Case for summaries throughout
- **CDP auto-sync**: Never create tasks for CDP data ingestion — the platform handles this automatically
- **WhatsApp templates**: CS team responsibility — never include as delivery team tasks unless SOW explicitly requires it
- **Authentication**: NEVER assume phone-based auth — always check the customer identifier BR first. Propagate the correct mechanism to ALL tasks that reference authentication (including recovery and telesales flows)
- **Task scope**: Split tasks when they cover multiple disciplines (e.g., conversational UX + prompt design should be separate tasks)

## Default Time Estimates (P80)

Based on analysis of 1,252 completed Delivery tasks (last 12 months, 73 projects), these are the
P80 estimates to set as `timeoriginalestimate` when creating tasks. P80 means 80% of tasks of
this type complete within this timeframe.

### By Stack

| Stack | Default Estimate | P80 Spent | P80 Ratio | Notes |
|-------|-----------------|-----------|-----------|-------|
| DEV | 8h | 12h | 1.60x | Median finishes at 5h but hard tasks take 60% more |
| UX | 6h | 8h | 1.50x | Historically underestimated by ~50% |
| QA | 12h | 16h | 2.00x | Most underestimated stack — can take double |
| PM | 4h | 10h | 1.07x | Small sample, low variance |

### By Task Subtype

```
DEV Tasks:
  - Standard DEV task:        8h   (P50=5h, P80=12h)
  - DEV Integration/API:     12h   (P80=10h, ratio P80=1.80x — highest risk)
  - DEV Release/Deploy:       4h   (P80=6h, good accuracy 89%)
  - DEV Bug Fix:              2h   (P80=4h, small scope)
  - DEV Config/Setup:         4h   (small sample, low risk)

UX Tasks:
  - Standard UX task:         6h   (P50=4.5h, P80=10h)
  - UX Content/Copy:          4h   (limited sample, moderate variance)
  - UX Design/Wireframe:      8h   (complex design work)

QA Tasks (Test Plans):
  - Standard QA task:        12h   (P50=8h, P80=15-16h)
  - QA Test Plan:             8h   (planning phase)
  - QA Test Execution:       10h   (execution takes longer than planning)

PM Tasks:
  - Standard PM task:         4h   (P50=4h, limited sample)
  - PM Documentation:         6h   (P80=7.6h, small sample)
```

### By Estimate Size — Buffer Guidance

Smaller tasks have higher relative variance. When in doubt about scope:

| Estimate Size | P80 Ratio | Guidance |
|--------------|-----------|----------|
| Micro (≤2h) | 2.00x | Small tasks often double — consider estimating at 4h |
| Small (2-4h) | 1.67x | Most common size, decent accuracy |
| Medium (4-8h) | 1.50x | Sweet spot for estimation accuracy |
| Large (8-16h) | 1.42x | Consider splitting if scope is unclear |
| XL (16-24h) | 1.44x | Multi-day tasks, reasonable accuracy |
| XXL (24-40h) | 1.28x | Best accuracy — well-scoped full-week work |

### How to Apply

When creating tasks in Phase 3:
1. Determine the task's stack (DEV/UX/QA/PM) from the role prefix
2. Look up the subtype (Integration, Release, Config, Content, etc.) from the summary
3. Set `timeoriginalestimate` in seconds (hours × 3600) using the table above
4. For ambiguous tasks, use the stack default
5. **Never estimate lower than 2h** — micro tasks have the highest variance

Example: A `DEV | Implement OTP generation and verification flow` is a standard DEV task → 8h → `timeoriginalestimate: 28800`

### Data Source

Analysis of 1,839 issues from Jira Cloud (yalochat.atlassian.net), Delivery category, last 12 months.
1,252 with both estimate and time spent. Outliers (ratio > 3x or < 0.25x) excluded.
Real-data subset (589 tasks where spent ≠ estimate) used for ratio calculations.
Full report: `~/Desktop/Claude/Project Management/Yalo_Delivery_Estimation_Analysis_2026.md`

---

## Yalo Product Knowledge Base

**MANDATORY**: Before decomposing any SOW/PRD, read the full Yalo product reference at:
`~/.claude/projects/-Users-weilerbarbosa/memory/reference_yalo_products.md`

This file contains the complete documentation of all 13 Yalo products, their features, sub-features,
capabilities, and how they interconnect. Use it to:

- **Map tasks to the correct Yalo product area** in the "Yalo Product Components" section of task descriptions
- **Understand what's possible** — don't create tasks for features that don't exist in the platform
- **Identify the right product names** — use official terminology (e.g., "Oris" not "sales bot", "CDP Segments" not "customer filters")
- **Know integration points** — which products connect to which (e.g., CDP auto-syncs from Commerce, Marketing uses CDP audiences)
- **Scope promotions correctly** — there are 5 specific types (Total, Direct, Combo, Volume, Complex)
- **Understand Yalo Force** — Standard vs Pro features for sales rep enablement
- **Reference Commerce capabilities** — multi-packaging, bundles, banners, business rules like jumpQuantities

### Quick Product Reference (summary)

1. **Yalo Studio** — Central web platform (auth, team, API keys, Meta tools)
2. **Integration Platform** — Generic API connectors, VTEX, MC1, SFTP, CSV, sync jobs
3. **Data Entities** — Products, Prices, Stock, Categories, Customers, Sales Reps, Orders, Promotions, Distributors
4. **ML Recommendations** — Recommended products, prefilled cart, frequently bought together
5. **CDP** — Stores, Contacts, Attributes, Events, Segments, Audiences (auto-synced from Commerce)
6. **Marketing** — WhatsApp templates, campaigns, Notification API, Marketing Flows, Conversational Templates
7. **Builder** — Flow canvas, WhatsApp Flows, authentication, menu, transitions
8. **Agents** — Oris (B2B Sales Agent), Custom Agents, Knowledge Agent (Genie), Agent Builder
9. **Sales Desk** — Human agent handoff, admin panel, queue routing, CSAT
10. **Commerce** — Storefront settings, branding, banners, promotions (5 types), multi-packaging, bundles, business rules
11. **Yalo Force** — Sales rep tools (Standard: store activation; Pro: order taking, suggested orders, ML recommendations, customer profiler, lead gen)
12. **Channels** — WhatsApp, Messenger, Telegram, Instagram
13. **Analytics** — Engagement dashboards, Sales Desk dashboards, WhatsApp Conversion API
14. **Agent Tools / MCP Servers** — Transactional APIs (SimulateOrder, CreateOrder, ConfirmOrder)
15. **Custom Skills** — Photo-Assisted Ordering, any custom Oris skills

## References

- `references/description_templates.md` — Full templates with real examples for each issue type
- `references/style_analysis.md` — Complete writing style analysis from 550+ issues
