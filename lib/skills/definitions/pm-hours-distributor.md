---
name: pm-hours-distributor
description: >
  Distribute PM's 40 weekly hours proportionally across Jira epics based on team worklogs.
  First finds all Epics where the user is the reporter, then queries child tasks that had
  logged hours in the week, groups them by Project and Epic, and calculates a proportional
  hour distribution. Use this skill whenever the user mentions 'distribute hours', 'pm hours',
  'my hours', 'log my hours', 'hours distribution', 'worklog distribution', 'spread my hours',
  'distribuir horas', 'minhas horas', 'horas do PM', or wants to see how their 40h
  should be allocated across projects/epics.
---

# PM Hours Distributor

Distributes the PM's 40 weekly hours proportionally across Jira epics, based on where the team actually logged work that week.

## Context

- **Jira Account ID:** `712020:7745fbc3-d130-433f-8d04-8db407c9f1ab`
- **Cloud ID:** `e00406a0-58b2-420b-91c5-399d29821b17`
- **Weekly target:** 40 hours (8h/day, Mon–Fri)
- **Grouping:** Project → Epic (based on epics where the user is the reporter)
- **Excluded projects (user is NOT the PM/owner):** GRHE, TEM, NMX, PSTBN, UEICE, NM
  - The user created epics in these projects (e.g., as backup PM or during transitions) but should not log hours to them
  - Update this list if projects change ownership

## Step 1: Determine the Week

Ask the user which week to distribute, or default to the current week (Monday–Friday).

Calculate the exact dates:
- `weekStart` = Monday of the target week (YYYY-MM-DD)
- `weekEnd` = Friday of the target week (YYYY-MM-DD)

If the user says "this week", "esta semana", or doesn't specify, use the current week.
If the user says "last week", "semana passada", calculate the previous Mon–Fri.

## Step 2: Find All Epics Where User Is Reporter

This is a two-step process. First, find all epics the PM owns, then find child tasks with worklogs.

### Step 2.1 — Get All PM's Epics

Use `searchJiraIssuesUsingJql` to find all epics where the user is the reporter.

**JQL:**
```
reporter = "712020:7745fbc3-d130-433f-8d04-8db407c9f1ab" AND issuetype = Epic AND status NOT IN (Done, Canceled, Cancelled) AND project NOT IN (GRHE, TEM, NMX, PSTBN, UEICE, NM)
```

**Why filter by status:** Epics that are Done or Canceled represent completed/abandoned work. Even if child tasks still have open worklogs, the PM should not distribute hours to closed-out epics.

**Parameters:**
- `cloudId`: `e00406a0-58b2-420b-91c5-399d29821b17`
- `fields`: `["summary", "project"]`
- `maxResults`: 100

**IMPORTANT — Pagination:** The user has 100+ epics across all projects. If `totalCount` > returned count, paginate using `nextPageToken` until all epic keys are collected.

Collect all epic keys into a list (e.g., `MKSA-5, MKSA-3, KB-256, NESP-217, ...`).

### Step 2.2 — Find Child Tasks with Worklogs in the Period

Now query for all tasks under those epics that had worklogs in the target week.

**JQL:**
```
parent in ({EPIC_KEY_1}, {EPIC_KEY_2}, ...) AND worklogDate >= "{weekStart}" AND worklogDate <= "{weekEnd}"
```

**Parameters:**
- `cloudId`: `e00406a0-58b2-420b-91c5-399d29821b17`
- `fields`: `["summary", "parent", "project", "issuetype", "worklog"]`
- `maxResults`: 100

**IMPORTANT — JQL length limit:** If the `parent in (...)` clause has too many keys, Jira may reject the query. In that case, split into multiple queries by project or batches of ~50 epic keys each, then merge results.

If there are more than 100 results, paginate using `nextPageToken`.

## Step 3: Extract Worklog Hours Per Issue

For each issue returned in Step 2.2:

1. Check the `worklog` field from the issue data
2. **Filter worklogs by date**: Only count worklogs where the `started` date falls within `weekStart` to `weekEnd` (inclusive). The `started` field is in ISO format — compare just the date portion.
3. **Sum `timeSpentSeconds`** for all matching worklogs on that issue and convert to hours (`timeSpentSeconds / 3600`)
4. Record: `issueKey`, `summary`, `projectKey`, `projectName`, `parentKey` (epic), `parentSummary` (epic name), `totalHours`

**Important:** If the `worklog` field shows `maxResults` < `total`, it means there are more worklogs than returned. In that case, use the `getJiraIssue` tool with `fields: ["worklog"]` to get the full list. Alternatively, note the truncation and work with available data.

### Handling the Tool Result Size

The Jira MCP tool may return results too large for direct consumption. When this happens, the result is saved to a file. Use `bash` with `python3` to parse the JSON file and extract the needed data (issue keys, parent info, worklog hours). See the pattern:

```bash
cat /path/to/tool-result.txt | python3 -c "
import json, sys
from collections import defaultdict

data = json.load(sys.stdin)
issues = data['issues']['nodes']
# ... process issues
"
```

## Step 4: Group and Calculate Distribution

### 4.1 — Group by Project → Epic

Build a nested structure:

```
Project A (PROJ)
  ├── Epic 1 (PROJ-10: "User Auth")     → 45h team work
  ├── Epic 2 (PROJ-20: "Payments")      → 30h team work
Project B (OTHER)
  └── Epic 3 (OTHER-5: "Onboarding")    → 20h team work
```

All tasks are grouped under their parent epic. Since we query by `parent in (epics)`, every result has an epic — no "Ordinary" bucket needed in this approach.

### 4.2 — Calculate Proportional Distribution

1. **Total team hours** = sum of all hours across all issues
2. For each epic: `epicPercentage = epicHours / totalTeamHours`
3. **PM hours per epic** = `epicPercentage × 40`
4. Round to nearest 0.5h for cleanliness. Ensure the total still sums to 40h (adjust the largest bucket if rounding causes drift).

## Step 5: Generate the Report

Output a clean, formatted report. Use this structure:

```
## PM Hours Distribution — Week of {weekStart} to {weekEnd}

**Total team hours tracked:** {totalHours}h across {issueCount} issues
**Your 40h distributed across:** {epicCount} epics in {projectCount} projects

### {Project Name} ({ProjectKey})

| Epic | Team Hours | % | Your Hours |
|------|-----------|---|------------|
| PROJ-10: User Auth | 45h | 45.0% | 18.0h |
| PROJ-20: Payments | 30h | 30.0% | 12.0h |
| **Subtotal** | **80h** | **80.0%** | **32.0h** |

### {Other Project} ({OtherKey})

| Epic | Team Hours | % | Your Hours |
|------|-----------|---|------------|
| OTHER-5: Onboarding | 20h | 20.0% | 8.0h |
| **Subtotal** | **20h** | **20.0%** | **8.0h** |

---
**Grand Total:** {totalHours}h team → **40.0h PM** ✓
```

### Additional Details Section

After the main table, show a detail of which issues contributed to each epic:

```
### Detail: PROJ-10 — User Auth (45h team → 18.0h PM)

| Issue | Summary | Hours |
|-------|---------|-------|
| PROJ-11 | Implement login flow | 20h |
| PROJ-12 | Add password reset | 15h |
| PROJ-13 | Session management | 10h |
```

## Step 6: Save the Report

Save the report as a markdown file to:
```
~/Desktop/Claude/Project Management/PM Hours/pm-hours-{weekStart}.md
```

Create the directory if it doesn't exist.

## Phase 2 (Future): Auto-Log Worklogs

When the user is ready to move to Phase 2, the skill will:

1. Run Steps 1–4 as above
2. For each epic, use `addWorklogToJiraIssue` to log hours directly on the epic
3. Spread hours across weekdays (e.g., if an epic gets 20h → log 4h on each day Mon–Fri)
4. Confirm all worklogs were created
5. Output a summary of what was logged

**Do NOT auto-log unless the user explicitly asks to move to Phase 2.**

## Tips

- If the child task query returns 0 results, it means no team member logged hours on tasks under the PM's epics that week. Flag this to the user.
- If worklogs are sparse (e.g., only 10h total team work), flag this — the distribution still works but the user should know the sample is small.
- Some projects may use different workflow names — adapt JQL if needed.
- The 40h target is configurable — if the user asks for a different total, use that instead.
- When paginating epics, batch the `parent in (...)` clause by project to avoid JQL length limits and keep queries efficient.
