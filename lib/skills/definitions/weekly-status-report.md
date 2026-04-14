---
name: weekly-status-report
description: "Generate a Weekly Status Report as a polished PPTX presentation for any Jira project. Fetches live data from Jira (any project key) and optionally from Slack channels, then builds a professional slide deck using PptxGenJS. Use this skill whenever the user mentions 'weekly status', 'weekly report', 'status report', 'weekly deck', 'project update deck', 'sprint report', or asks to generate/update a status presentation for any project. Also trigger when the user says 'gerar relatório semanal', 'weekly do projeto', 'deck semanal', 'relatório de status', or similar phrases in any language. This skill should be the default for any project status reporting task that involves Jira data and a slide deck output."
---

# Weekly Status Report Generator

Generates a professional PPTX weekly status deck from live Jira + Slack data for any project.

## Architecture — Data-Driven Scripts

Both `build-deck.js` and `render-gantt.js` are **data-driven**. Claude never edits these scripts. Instead, Claude:

1. Fetches data from Jira/Slack
2. Writes a single `data.json` file with all the content
3. Runs `render-gantt.js data.json` → produces `gantt-slide.png`
4. Runs `build-deck.js data.json` → produces the final `.pptx`

This eliminates the old copy-and-edit-scripts workflow, cutting execution time significantly.

## Step 0: Setup Dependencies (Run Once Per Session)

**CRITICAL: Run this BEFORE any data fetching or deck building.** This ensures all npm and pip packages are pre-installed so that the build steps execute instantly.

```bash
SESSION=/sessions/$(basename $PWD)
npm install --prefix $SESSION pptxgenjs @resvg/resvg-js 2>&1 | tail -3
pip install markitdown Pillow --break-system-packages -q 2>&1 | tail -2
```

Alternatively, run the bundled setup script:
```bash
bash <skill-path>/scripts/setup.sh
```

> **Why up front?** Installing during execution adds 15-20 seconds of dead time. Pre-installing means the Gantt render + deck build take ~3 seconds total.

## Step 1: Gather Context from the User

Before doing anything, you need to know which project and channels to pull from. Ask the user for:

1. **Jira project key** (e.g., `GR`, `PLAT`, `ENG`) — required
2. **Feature key** (e.g., `MKSA-1`, `GR-5`) — optional. If provided, scope the entire report to issues under this Feature (hierarchy: Feature → Epic → Task). If omitted, report on the whole project.
3. **Slack channels** to scan for context (e.g., `#warroom-project`, `#team-updates`) — optional but recommended
4. **Reporting period** — default to "last 7 days" if not specified
5. **Audience / recipients** — who will receive this deck? (e.g., "executive leadership", "engineering team", "client stakeholders"). This shapes the tone, level of detail, **and the language of the email draft** (see Step 6).
6. **Any specific highlights or callouts** they want included

If the user already provided some of this in their message, extract it and confirm — don't re-ask for things they already told you.

## Step 2: Fetch Data (Always Fresh)

### Guaranteeing Fresh Data

Every JQL query **MUST** use real-time filters. Never rely on cached results or previously fetched data from earlier in the conversation. Specifically:

- Always use `status changed to Done DURING (startOfWeek(), now())` for recently completed — this is evaluated server-side at query time.
- Always set `orderBy updated DESC` on all queries to surface the most recent changes first.
- If re-running the report in the same session (e.g., after fixing a slide), **re-fetch all Jira data** — do not reuse stale variables.
- Fetch the **latest comment** from each blocker issue (for block reason) — comments change frequently.

### Jira Data

Use the Jira MCP tools to pull data for the specified project.

#### Scope: whole project vs. feature

If the user provided a **Feature key**, scope all queries to that Feature's descendants:

1. **Get epics under the Feature:**
   ```
   parent = {FEATURE_KEY} ORDER BY updated DESC
   ```
   Collect all epic keys.

2. **Build a scope filter:**
   ```
   parent in ({EPIC_KEY_1}, {EPIC_KEY_2}, ...)
   ```

3. **Also include the epics themselves** in "In Progress" and metrics views.

> **Note:** The `childIssuesOf()` JQL function may not work in all Jira configurations. Prefer `parent = {KEY}` for direct children queries.

If no Feature key was provided, use `project = {PROJECT_KEY}` for all queries.

#### JQL Queries

For each query below, apply the appropriate scope filter.

**Recently completed issues:**
```
{SCOPE_FILTER} AND status changed to Done DURING (startOfWeek(), now()) ORDER BY updated DESC
```

**Currently in progress:**
```
{SCOPE_FILTER} AND status = "In Progress" ORDER BY updated DESC
```

**Blockers and flagged items:**
```
{SCOPE_FILTER} AND (status = Blocked OR flagged = impediment OR priority = Blocker) AND status != Done ORDER BY updated DESC
```
For each blocker, **fetch the latest comment** from the issue. The comment text becomes the `comment` field in the blocker data structure.

**Upcoming / next sprint:**
```
{SCOPE_FILTER} AND status = "To Do" ORDER BY updated DESC
```

**All tasks with dates** (for Gantt chart):
Fetch every task in scope with start date, due date, status, and release/epic grouping.

**Overall metrics** (use aggregate queries where possible):
- Total issues completed this period vs. last period
- Issues by status
- Issues by priority / by epic (for feature-scoped reports)

When reporting on a Feature, include an **Epic Progress** breakdown showing each epic's status and tasks done vs. total.

Adapt JQL to the project's actual workflow. If a query returns 0 results, try variations (e.g., "Closed" instead of "Done", "In Review" instead of "In Progress").

### Slack Data (Optional)

If the user provided Slack channels, search for messages from the reporting period. Look for key decisions, blockers discussed, wins, and risk items. Summarize themes — don't dump raw messages.

## Step 3: Analyze and Structure

Synthesize the data into a narrative:

1. **Executive summary** — dynamically computed from the data
2. **Key accomplishments** — group completed work into 3-5 themes (don't list every ticket)
3. **In-progress work** — organized by priority or workstream
4. **Risks & blockers** — actual block reason from Jira comments, ETA, risk level, mitigation
5. **Metrics snapshot** — total, done, in progress, blocked (computed from timelineTasks)
6. **Next week outlook** — planned work, upcoming milestones

Tell a story, not list tickets. Group related work, highlight impact, surface what stakeholders care about.

## Step 4: Write data.json and Build the Deck

### 4a. Write the data.json file

Write a single JSON file with ALL the slide data. Both `render-gantt.js` and `build-deck.js` read from this same file.

```bash
cat > /sessions/$SESSION/data.json << 'DATAJSON'
{
  "projectName": "Menabev KSA",
  "phaseDescription": "Phase 1 · Launch + Engagement\n+ Connected AI C-Commerce",
  "dateRange": "Mar 24 – 30, 2026",
  "closingBadgeText": "Menabev KSA × Yalo 2026",
  "doneThisWeekCount": 8,

  "chartStart": "2026-02-21",
  "chartEnd": "2026-05-20",
  "today": "2026-03-30",
  "ganttPngPath": "/sessions/$SESSION/gantt-slide.png",
  "outputPath": "/sessions/$SESSION/output.pptx",

  "releases": [
    { "id": "1.1", "name": "1.1 - Registration Phase", "date": "2026-03-30", "color": "#D75DFF" },
    { "id": "1.2", "name": "1.2 - Commerce",           "date": "2026-05-15", "color": "#486CE9" }
  ],

  "blockers": [
    { "key": "MKSA-70", "summary": "Move Registration to prod blocked", "comment": "Waiting for production number from client", "eta": "2026-04-02" }
  ],

  "doneThisWeek": [
    { "key": "MKSA-14 · 15", "title": "Commerce APIs & Order Sync", "desc": "Built transactional APIs and order history sync." }
  ],

  "inProgressTasks": [
    { "key": "MKSA-70", "title": "Move Registration Flow to Production", "type": "DEV", "status": "In Progress" }
  ],

  "nextWeekTasks": [
    { "key": "MKSA-20", "title": "Design Storefront Branding", "type": "UX", "status": "In Progress" }
  ],

  "timelineTasks": [
    { "key": "MKSA-10", "summary": "Configure SalesBuzz API Connector", "status": "Done", "release": "1.1", "start": "2026-02-21", "end": "2026-02-27" }
  ]
}
DATAJSON
```

#### data.json Schema Reference

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `projectName` | string | yes | Project display name (title slide) |
| `phaseDescription` | string | yes | Phase subtitle (supports `\n`) |
| `dateRange` | string | yes | Human-readable date range |
| `closingBadgeText` | string | no | Closing slide badge (defaults to `{projectName} × Yalo 2026`) |
| `doneThisWeekCount` | number | no | Override count for "Done This Week" metric |
| `chartStart` | string | yes | Gantt chart start date (YYYY-MM-DD) |
| `chartEnd` | string | yes | Gantt chart end date (YYYY-MM-DD) |
| `today` | string | yes | Today's date for Gantt "today" marker (YYYY-MM-DD) |
| `ganttPngPath` | string | no | Output path for Gantt PNG (defaults to `./gantt-slide.png`) |
| `outputPath` | string | no | Output path for PPTX (defaults to `./output.pptx`) |
| `releases` | array | yes | Releases with `id`, `name`, `date`, `color` |
| `blockers` | array | yes | Blockers with `key`, `summary`, `comment`, `eta` (can be `[]`) |
| `doneThisWeek` | array | yes | Accomplishment cards with `key`, `title`, `desc` |
| `inProgressTasks` | array | yes | Current sprint tasks with `key`, `title`, `type`, `status` |
| `nextWeekTasks` | array | yes | Next sprint tasks with `key`, `title`, `type`, `status` |
| `timelineTasks` | array | yes | ALL tasks for Gantt with `key`, `summary`, `status`, `release`, `start`, `end` |

### 4b. Copy assets to working directory

```bash
cp <skill-path>/scripts/build-deck.js /sessions/$SESSION/build-deck.js
cp <skill-path>/scripts/render-gantt.js /sessions/$SESSION/render-gantt.js
cp <skill-path>/assets/*.png /sessions/$SESSION/
```

### 4c. Render Gantt chart, then build deck

```bash
# Render Gantt (SVG → PNG via resvg-js, ~1s)
NODE_PATH=/sessions/$SESSION/node_modules node /sessions/$SESSION/render-gantt.js /sessions/$SESSION/data.json

# Build deck (~2s)
NODE_PATH=/sessions/$SESSION/node_modules node /sessions/$SESSION/build-deck.js /sessions/$SESSION/data.json
```

> **Why not Playwright?** Playwright requires Chromium which fails on ARM64/aarch64. The SVG+resvg-js approach produces identical output without a browser.

### Slide Structure (7 slides)

| # | Slide | Background | Content |
|---|-------|-----------|---------|
| 1 | **Title / Cover** | Dark + dot grid + arcs | Project name, phase, date range, "Presented by Yalo" |
| 2 | **Executive Summary + Accomplishments** | Cream + dot grid | Health indicator + 2×2 metrics + accomplishment cards |
| 3 | **Gantt Chart Timeline** | Full-bleed PNG | Tasks grouped by release, today marker, summary stats |
| 4 | **Risks & Blockers** | Cream + dot grid | Risk legend + blocker cards with risk pill, ETA, mitigation |
| 5 | **Current Week** | Cream + dot grid | Compact row list — status dot, key, title, type badge |
| 6 | **Next Week** | Cream + dot grid | Same compact row list layout |
| 7 | **Closing** | Dark + dot grid + arcs | "Thank You" + project badge |

### Compact List Layout (Slides 5 & 6)

**Row sizing** — tuned for `LAYOUT_16x9` (slide height = 5.625"):
```
ROW_H = 0.33"   ROW_GAP = 0.02"   ROW_STEP = 0.35"   LIST_START_Y = 1.10"
```
Maximum safe capacity: **11 items per slide.**

**Row anatomy**: row background (alternating white/off-white) → status dot (amber=In Progress, gray=other) → issue key → title → type badge (purple=UX, amber=QA, blue=DEV).

**Rules — never break:**
- ❌ No sprint name / sprint badge
- ❌ No assignee column
- ❌ No "In Progress" pill text

### Sprint-Based Week Guidance

- **Current Week** = tasks in the currently running sprint
- **Next Week** = tasks in the sprint immediately following

Use JQL to scope by sprint name. Sprint names are only used as a JQL filter — **never** on the slide itself.

### Health Indicator (Auto-Computed)

| Condition | Color | Label |
|-----------|-------|-------|
| No blockers | Green | On Track |
| Only Medium/Low blockers | Amber | On Track* |
| Any High/Critical, all ETAs in future | Red | At Risk |
| Any High/Critical AND overdue ETAs | Bold Red | Delayed |

### Blocker Cards & Risk Classification

| Risk Level | Days to ETA | Pill Color |
|------------|-------------|------------|
| CRITICAL | ≤ 0 (past due) | Red (`CC0000`) |
| HIGH | 1–5 days | Coral (`E46962`) |
| MEDIUM | 6–10 days | Amber (`EDAE3E`) |
| LOW | > 10 days | Green (`40E4A9`) |

Each card: risk pill → title → block reason (from Jira comments) → ETA + days remaining → auto-generated mitigation.

### Yalo Brand Design System

**Colors**: Cream `FAF8F4` · Dark `111111` · Cyan `00C2EE` · Purple `D75DFF` · Peach `FFB87B` · Green `40E4A9` · Amber `EDAE3E` · Coral `E46962` · Blue `486CE9`

**Typography**: DM Sans exclusively.

**Cards**: White fill on cream bg, dark fill on dark bg. Radius `0.15"`. Gradient accent line inside top (cyan→purple→peach).

**Backgrounds**: Dot-grid PNGs with 4 thin border lines. Dark slides use `bg-dots-dark.png`, light slides use `bg-dots-light.png`.

## Step 5: QA — Visual Verification

**CRITICAL FOR UX:** After building the deck, always convert to images and present them to the user so they can see the slides without leaving the conversation.

### QA Workflow

1. **Extract text** to verify content accuracy:
   ```bash
   python -m markitdown /sessions/$SESSION/output.pptx
   ```

2. **Convert to slide images** and present to user:
   ```bash
   python3 << 'PYEOF'
   import subprocess, zipfile, os, glob
   pptx = "/sessions/$SESSION/output.pptx"
   outdir = "/sessions/$SESSION/slide-previews"
   os.makedirs(outdir, exist_ok=True)
   subprocess.run(["libreoffice", "--headless", "--convert-to", "pdf", "--outdir", outdir, pptx], capture_output=True)
   pdf = os.path.join(outdir, "output.pdf")
   if os.path.exists(pdf):
       subprocess.run(["pdftoppm", "-png", "-r", "150", pdf, os.path.join(outdir, "slide")], capture_output=True)
       for f in sorted(glob.glob(os.path.join(outdir, "slide-*.png"))):
           print(f)
   PYEOF
   ```
   Then use the Read tool to show each slide image to the user.

3. **Fix any issues** found and re-build + re-verify.

> The goal is that the user sees every slide inline and can approve or request changes without having to open PowerPoint. This is the best UX.

## Step 6: Save to Project Folder

```bash
mkdir -p "/sessions/$SESSION/mnt/weekly reports/{Project Name}/"
cp /sessions/$SESSION/output.pptx "/sessions/$SESSION/mnt/weekly reports/{Project Name}/{filename}.pptx"
```

Use a descriptive filename like `{project-key}-phase1-weekly-status.pptx`.

## Step 7: Create Gmail Draft

After the deck passes QA, create a Gmail draft for the user to review and send.

### Language Detection

The email **must match the language of the audience/recipients**:
- Portuguese audience → Portuguese email
- International/English audience → English email
- Match the language most Jira ticket titles are written in when in doubt

### Email Format — Simple Plain Text

Use `contentType: "text/html"` so Gmail auto-appends the user's signature, but keep the body **minimal and plain**. No heavy HTML, no tables, no inline styles — just `<p>` tags.

The email must clearly communicate:

1. **The reporting period** (prominently in the first line)
2. **Overall project health** (one sentence: On Track / At Risk / Delayed)
3. **2-3 headline points to impress** — the biggest wins or most critical items, written to make the reader want to open the deck
4. **A note that the deck is attached** (user attaches manually from the saved folder)

### Example (English)

```
Subject: Menabev KSA – Weekly Report – Mar 24–30, 2026

Hi team,

Please find attached the weekly status report for Menabev KSA covering Mar 24–30, 2026.

Project status: On Track. This week we completed the full Commerce storefront setup including business rules and API tools, and finalized all Registration phase UX flows. The team is now focused on moving Registration to production and ramping up the Commerce phase.

The deck has full details on the timeline, current sprint, and next steps.

Best regards,
```

### Example (Portuguese)

```
Subject: Grupo Real – Relatório Semanal – 24–30 Mar 2026

Olá pessoal,

Segue em anexo o relatório semanal do projeto Grupo Real referente ao período de 24 a 30 de março de 2026.

Status do projeto: No Prazo. Esta semana concluímos a integração completa do catálogo de produtos e configuramos todas as regras de negócio do Commerce. O foco agora está nos testes end-to-end e preparação para go-live.

O deck completo está em anexo com timeline, sprint atual e próximos passos.

Abraços,
```

Use `gmail_create_draft` to create the draft.

## Step 8: Notify via Slack

Post a message in **#weiler-and-claude** (ID: `C0AJW64QELC`) confirming everything is ready:

```
📊 Weekly status report ready!

*Project:* {Project Name} ({KEY}) — {date range}
✅ Deck generated (7 slides)
✅ Gmail draft created
✅ Saved to weekly reports folder

*Next step:* Review the Gmail draft and send when ready.
```

## Output

Present to the user:
- Inline slide preview images (from QA step)
- Brief summary of what's in the deck
- Confirmation: deck saved, Gmail draft created, Slack notified
- Link to the saved file

## Tips

- **Adapt JQL to reality.** If a query returns nothing, inspect available statuses/fields.
- **Don't overload slides.** Group 40 tickets into 3-5 themes.
- **Make numbers meaningful.** "23 tickets completed (up 35% from last week)" beats "23 tickets completed."
- **Fetch actual blocker details.** Always pull from Jira comments — never fabricate.
- **Re-fetch on re-run.** If rebuilding the report, always pull fresh data from Jira.
