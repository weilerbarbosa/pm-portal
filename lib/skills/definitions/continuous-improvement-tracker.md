---
name: continuous-improvement-tracker
description: "Track and process Continuous Improvement monthly Epics from Jira FY2027 Improvement Features. For each monthly Epic with logged hours, creates or updates a PM Assist (Tech_Assist__c) in Salesforce with Continuous_Improvement subtype, posts a Chatter task breakdown, and creates/updates the linked Project__c. Use this skill whenever the user mentions 'continuous improvement', 'improvement tracker', 'monthly improvements', 'improvements FY2027', 'melhoria contínua', 'mejora continua', 'process improvements', 'CI tracker', 'improvement assists', 'create improvement assists', or wants to sync Jira improvement epics to Salesforce PM Assists and Projects."
---

# Continuous Improvement Tracker

Finds "Improvements FY2027" Features in Jira, processes monthly Epics, creates/updates PM Assists and Projects in Salesforce, and posts Chatter reports with task breakdowns.

## HARDCODED CONFIGURATION *(never ask the user for these)*

| Parameter | Value |
|-----------|-------|
| Jira instance URL | `https://yalochat.atlassian.net` |
| Jira Cloud ID | `e00406a0-58b2-420b-91c5-399d29821b17` |
| Jira Account ID | `712020:7745fbc3-d130-433f-8d04-8db407c9f1ab` |
| Hourly rate (USD) | `125` |
| Weiler SF User ID | `005Ns000002Lc5xIAC` |
| SF PM Assist RecordType ID | `012Ns000008y9BvIAI` |
| SF PM Assist object | `Tech_Assist__c` |
| SF Project object | `Project__c` |
| SF Project lookup to Assist | `Tech_Assist__c` (lookup field on Project__c) |
| SF Project fields to update | `Effort_informed_by_PM__c` (hours), `Amount_informed_by_PM__c` (hours × $130 rate for projects) |
| PM Assist rate | `$125/hr` (for Assist Amount) |
| Project rate | `$130/hr` (for Project Amount — same as jira-sf-hours-report) |

---

## BEFORE STARTING — ASK FOR SCOPE

Before executing, ask the user which projects to process. Display the list of detected "Improvements" Features and let them confirm, filter, or expand:

```
Found these Improvement Features for FY2027:
• NESP-315: Improvements FY2027 (Nespresso BR)
• NPBR-255: Improvements FY2027 (Nestle Professional BR)
• KB-233: Continuous Improvement FY2027 (Kellanova BR)
• GR-525: [FY2027] Improvements (Grupo Real)
• FRUKI-235: Improvements FY2027 (Fruki)
• RC-192: Improvements FY2027 (Reckitt)
... (list all found)

Process all, or select specific ones?
```

Also ask:
```
Which months should I process? (e.g., "January to March 2026", "all", or specific months)
```

Once confirmed, proceed immediately.

---

## STEP 1 — FIND IMPROVEMENT FEATURES

Run JQL via `searchJiraIssuesUsingJql`:

```
issuetype = Feature AND summary ~ "Improvement" AND status not in (Done, Cancelled, Canceled)
```

Requested fields: `summary, status, project`

**Filter results** to Features matching these summary patterns (case-insensitive):
- `Improvements FY2027`
- `Continuous Improvement FY2027`
- `[FY2027] Improvements`
- `Improvements 2027`

Also include generic "Improvements" or "Continuos Improvement" Features if the user confirms them.

**EXCLUDE** Features whose summary contains any of these patterns:
- `After Go Live`
- `After GoLive`
- `Post Go Live`

These are post-launch improvement backlogs, not monthly continuous improvement cycles.

---

## STEP 2 — FIND MONTHLY EPICS

For each confirmed Feature, fetch child Epics via JQL:

```
issuetype = Epic AND parent = {FEATURE_KEY}
```

Requested fields: `summary, status, aggregatetimespent, customfield_11132`

**Filter to monthly Epics** matching patterns like:
- `Improvements January 2026`
- `Improvements Feb 26`
- `Improvements March 2026`
- `Improvements {Month} {Year}` (any month/year variation)

Extract the **month** and **year** from the summary for naming the Assist.

Skip Epics with `aggregatetimespent = 0` or `null` (no hours logged).

---

## STEP 3 — FETCH TASK BREAKDOWN FOR EACH EPIC

For each monthly Epic with logged hours, fetch its child tasks:

```
issuetype in (Task, Sub-task, Story) AND parent = {EPIC_KEY} AND timespent > 0
```

Requested fields: `summary, status, timespent, assignee`

Build a task list showing:
- Task key and summary
- Hours logged per task
- Assignee name

This list will be used for the Chatter post and Assist Closure Details.

---

## STEP 4 — RESOLVE SALESFORCE ACCOUNT

For each Jira project key, determine the Salesforce Account ID. Use this approach:

1. **Check existing Tech_Assist__c or Project__c** records that reference the same Jira project (search by Jira_Link__c containing the project key, or by known mappings).
2. **If not found**, search Salesforce Accounts by name matching the Jira project name.
3. **If still not found**, ask the user for the Account ID.

Cache the mapping for the session to avoid repeated lookups.

**Known Jira Project → SF Account mappings** (update as discovered):

| Jira Project | Account Name | Account ID |
|---|---|---|
| NESP | Nespresso BR | `0013g00000cm1rIAAQ` |
| NPBR | Nestlé Professional Brasil | `0013g000005JV0dAAG` |
| KB | Kellanova (Kellogs) - BR | `0013g00000VfC4GAAV` |
| GR | Grupo Real | *(look up at runtime)* |
| FRUKI | Fruki | `0013g00000qzrMjAAI` |
| RC | Rommac BR | `0013g00000QpuxcAAB` |

---

## STEP 5 — CHECK IF PM ASSIST AND PROJECT ALREADY EXIST

For each monthly Epic, check Salesforce:

### 5.1 — Check for existing PM Assist

Query `Tech_Assist__c`:
```
SELECT Id, Name, Status__c, Effort__c, Amount__c, Change_Request__c, PM_Assist_Closure_Details__c
FROM Tech_Assist__c
WHERE RecordTypeId = '012Ns000008y9BvIAI'
AND Subtype__c = 'Continuous_Improvement'
AND Account__c = '{ACCOUNT_ID}'
AND Change_Request__c = '{EPIC_JIRA_URL}'
```

If found → update it (Step 6B).
If not found → create it (Step 6A).

### 5.2 — Check for existing Project

Query `Project__c`:
```
SELECT Id, Name, Effort_informed_by_PM__c, Amount_informed_by_PM__c, Effort_from_tech_assist__c
FROM Project__c
WHERE Tech_Assist__c = '{ASSIST_ID}'
```

If found → update it (Step 7).
If not found → it will be auto-created by SF automation after the Assist is completed.

---

## STEP 6A — CREATE PM ASSIST

**IMPORTANT: Two-step insert required** due to SF Flow triggers on Tech_Assist__c.

### Step 6A.1 — Insert with minimal fields via Apex (`salesforce_execute_anonymous`)

The SF org has Flow triggers ("[Tech Assist] Notifications and Owner Assignment" and "[Tech Assist] PM Assist Subtype Router") that fail if `Assist_Owner__c`, `User__c`, and `Requested_by__c` are not set. **Always use Apex insert** (not DML tool) and include these owner fields.

Insert with these fields:

| Field | Value |
|---|---|
| `RecordTypeId` | `012Ns000008y9BvIAI` (PM Assist) |
| `Account__c` | Resolved Account ID |
| `Assist_type__c` | `Change Request` |
| `Subtype__c` | `Continuous_Improvement` |
| `Status__c` | `Received` ← **NOT Completed on insert** |
| `CurrencyIsoCode` | `USD` |
| `Change_Request__c` | `https://yalochat.atlassian.net/browse/{EPIC_KEY}` |
| `Assist_Owner__c` | `005Ns000002Lc5xIAC` (Weiler Barbosa) |
| `User__c` | `005Ns000002Lc5xIAC` |
| `Requested_by__c` | `005Ns000002Lc5xIAC` |

Can batch up to ~5 inserts per Apex call. After insert, query back by `Change_Request__c` to retrieve IDs and auto-generated Names (A-XXXX).

### Step 6A.2 — Update with full details via DML tool

Once created, update via `salesforce_dml_records` (update works fine, only insert triggers the flow issue):

| Field | Value |
|---|---|
| `Effort__c` | Total hours from Epic's aggregatetimespent ÷ 3600 |
| `Amount__c` | Effort × $125 |
| `Fit__c` | `0.99` (99% — Continuous Improvement rule) |
| `Project_Size__c` | `Small` if < 40h, `Medium` if 40-80h, `Large` if > 80h |
| `PM_Assist_Closure_Details__c` | Formatted task list (see Step 6C) |
| `Jira_Link__c` | `https://yalochat.atlassian.net/browse/{EPIC_KEY}` |
| `Status__c` | `Completed` |

This two-step approach ensures the SF automation creates the linked Project__c on completion.

---

## STEP 6B — UPDATE EXISTING PM ASSIST

Update the existing `Tech_Assist__c`:

| Field | Value |
|---|---|
| `Effort__c` | Updated hours |
| `Amount__c` | Updated hours × $125 |
| `Project_Size__c` | Recalculated |
| `PM_Assist_Closure_Details__c` | Updated task list |
| `Status__c` | `Completed` (if not already) |

---

## STEP 6C — FORMAT ASSIST CLOSURE DETAILS

Build the `PM_Assist_Closure_Details__c` text:

```
Effort per task:
- {TASK_KEY} – {Task Summary}: {X}hr
- {TASK_KEY} – {Task Summary}: {Y}hr
- {TASK_KEY} – {Task Summary}: {Z}hr
Total: {total}hr | Amount: ${amount} USD

Scope: Continuous Improvement — {Month} {Year} for {Account Name}. Includes {N} tasks: {brief summary of top tasks}.
```

---

## STEP 6D — POST CHATTER ON THE ASSIST

Use `salesforce_execute_anonymous` to insert a `FeedItem` on the `Tech_Assist__c` record.

**Detect language** from Account's BillingCountryCode (same rules as jira-sf-hours-report):

| Country Code | Language |
|---|---|
| BR / BRA | Portuguese (pt-BR) |
| MX / MEX | Spanish (es-MX) |
| CO / COL | Spanish (es-CO) |
| CL / CHL | Spanish (es-CL) |
| Other | English (en-US) |

**Chatter format (Portuguese example for BR accounts):**

```
📋 MELHORIA CONTÍNUA — {MONTH} {YEAR}
═══════════════════════════════════════════
RESUMO
═══════════════════════════════════════════
✅ Total de Horas: {total}h {min}min
💰 Valor: ${amount} USD
📊 Tarefas Concluídas: {N}

═══════════════════════════════════════════
DETALHAMENTO DE TAREFAS
═══════════════════════════════════════════
🔹 {TASK-KEY}: {Task Summary} — {X}h {Y}min ({Assignee})
🔹 {TASK-KEY}: {Task Summary} — {X}h {Y}min ({Assignee})
...
─────────────────────────────────
TOTAL: {total}h {min}min

═══════════════════════════════════════════
Epic Jira: {EPIC_JIRA_URL}
```

**Spanish equivalent:** Use "MEJORA CONTINUA", "Resumen", "Desglose de Tareas", "Tareas Completadas".
**English equivalent:** Use "CONTINUOUS IMPROVEMENT", "Summary", "Task Breakdown", "Completed Tasks".

---

## STEP 7 — CHECK AND UPDATE PROJECT

After the Assist is created/updated:

1. Query for a `Project__c` linked to this Assist:
   ```
   SELECT Id, Name, Effort_informed_by_PM__c, Amount_informed_by_PM__c, Effort_from_tech_assist__c, Status__c, Project_Manager__c
   FROM Project__c
   WHERE Tech_Assist__c = '{ASSIST_ID}'
   ```

2. **If Project exists** → Update:
   - `Effort_informed_by_PM__c` = total hours (2 decimal places)
   - `Amount_informed_by_PM__c` = total hours × $130 (Project rate)
   - `Project_Manager__c` = `005Ns000002Lc5xIAC` (Weiler Barbosa) — **always set PM on new projects**
   - `Status__c` = `Completed` **only if the Epic's month is NOT the current month**. If the Epic is for the current month, leave the status as-is (the work may still be in progress).

3. **If Project does NOT exist** → The SF automation should create it once the Assist is set to `Completed`. Log this in the final report as "Project pending creation".

**Note:** SF automation auto-creates the Project__c immediately when the Assist is set to Completed. All 10 Projects were created instantly in the first run — no delay expected.

---

## STEP 7B — UPDATE JIRA EPIC WITH SF PROJECT LINK

After the Project__c is created/found, **always update the Jira Epic** with the SF Project URL in `customfield_11132` (SF Project field). This ensures the `jira-sf-hours-report` skill can pick up these Epics in future runs.

Use `editJiraIssue` for each Epic:

```
issueIdOrKey: {EPIC_KEY}
fields: {
  "customfield_11132": "https://yalo.lightning.force.com/lightning/r/Project__c/{PROJECT_ID}/view"
}
```

This is a **critical step** — without it, the Jira-SF link is broken and the hours report skill won't find these Epics.

---

## STEP 8 — FINAL REPORT

Display a summary table for all processed Epics:

| Field | Value |
|---|---|
| Feature (parent) | |
| Epic key and month | |
| Total hours | |
| PM Assist (created/updated) | Name (A-XXXX) |
| Assist Amount ($125/hr) | |
| Project (found/pending) | Name (P-XXXX) or "pending" |
| Project Amount ($130/hr) | |
| Chatter language | |
| Errors | |

---

## FORMATTING RULES

- **Hours:** always `Xh Ymin` (e.g.: `8h 30min`)
- **Amounts:** USD with 2 decimal places
- **Dates:** DD/MM/YYYY
- **Task lists:** sorted by hours descending

## ERROR HANDLING

- Epic with 0 hours → skip and note in report
- Account not found → ask user and cache for session
- Assist creation failure → log error, continue with next
- Project not found after Assist completion → log as "pending creation"
- Duplicate Assist detection → update instead of create
