---
name: tech-assist-filler
description: "Automate Salesforce Tech Assist completion: given a short prompt describing the work, effort hours, and a Tech Assist Salesforce link, this skill calculates Amount ($125/hr), determines Fit % from subtype, generates a professional Change Request .docx document following Yalo's exact template (with embedded fonts, logo, and formatting), creates Assist Closure Details with effort breakdown, and updates all fields on the Salesforce record. Use this skill whenever the user mentions 'tech assist', 'fill tech assist', 'complete tech assist', 'change request document', 'CR document', 'assist closure', 'tech assist fields', or wants to fill/complete/update a Tech_Assist__c record in Salesforce. Also trigger when the user says 'preencher tech assist', 'fechar tech assist', 'documento de change request', or similar phrases in Portuguese."
---

# Tech Assist Filler

Automates the completion of Yalo's Salesforce `Tech_Assist__c` records by generating all required fields from minimal input.

## Inputs

The user provides:

1. **Prompt** — A short description of the work scope (what was done, for which client, which flows/integrations were involved). **OR** the user can say "use request details" to use the `Request_Details__c` field from the Salesforce record as the scope input.
2. **Effort Hours** — Total hours for the work
3. **Tech Assist Link** — A Salesforce URL or record ID for the `Tech_Assist__c` object

## Workflow

### Step 1: Query the Tech Assist Record

Extract the record ID from the provided link. Salesforce Tech Assist IDs start with `a0L` (not `a1q`).

Query the record:
```
Object: Tech_Assist__c
Fields: Name, Account__c, Account__r.Name, Subtype__c, Assist_type__c, Status__c,
        Amount__c, Effort__c, Fit__c, Change_Request__c, PM_Assist_Closure_Details__c,
        Request_Details__c, Project_Size__c
Where: Id = '<record_id>'
```

**Important**: The fields `Description__c` and `Acceptance_Criteria__c` do NOT exist on `Tech_Assist__c`. Use `Request_Details__c` instead — it contains the full scope/request details as HTML.

When the user says "use request details" (or similar), use the `Request_Details__c` field content as the prompt/scope instead of requiring a separate description.

### Step 2: Calculate Fields

**Amount**: `Effort Hours × 125` (USD)

**Fit %**: Rule-based by Subtype:
- **99%** (0.99) → Product Enablement, Flow, Data, Continuous_Improvement, Product, Custom
- **50%** (0.50) → Integration
- **70%** (0.70) → Discovery, Others, Dedicated Cell, null, or mixed scope

**Effort**: Hours provided by the user (numeric).

**Project Size** (`Project_Size__c`): Rule-based by Effort:
- **Small** → Effort < 40 hours
- **Medium** → Effort between 40 and 80 hours (inclusive)
- **Large** → Effort > 80 hours

### Yalo Product Knowledge Base

**MANDATORY**: Before generating scope items, read the Yalo product reference at:
`~/.claude/projects/-Users-weilerbarbosa/memory/reference_yalo_products.md`

Use this knowledge to:
- **Write accurate scope descriptions** using correct product names and capabilities
- **Reference the right platform areas** (e.g., "Oris Sales Agent" not "chatbot", "CDP Segments" not "customer filters")
- **Understand feature boundaries** — what Yalo can and cannot do, what requires configuration vs development
- **Map work to products** — Integration Platform, Commerce, Builder, Agents, CDP, Marketing, etc.
- **Use correct terminology** for promotions (5 types), Yalo Force (Standard vs Pro), Commerce features (banners, bundles, multi-packaging)

This ensures CR documents accurately reflect Yalo's product capabilities and use official product language.

### Step 3: Generate the Change Request Document

The CR document uses a **template-based approach** — the script copies a real Yalo .docx template, unpacks it, builds new XML content, and repacks. This preserves embedded fonts (Darker Grotesque), Yalo logos, footers, and all formatting.

#### JSON Input Schema

```json
{
  "title": "Descriptive title",
  "client": "Client Name",
  "date": "DD/MM/YYYY",
  "author": "Weiler Barbosa",
  "scopeItems": [
    {
      "number": "01",
      "title": "Scope item title",
      "actors": ["Client (role)", "Yalo (role)"],
      "description": "Detailed description in Portuguese...",
      "flowSteps": ["Optional step 1", "Optional step 2"],
      "descriptionParagraphs": ["Optional extra paragraphs"],
      "acceptanceCriteria": ["Criterion 1", "Criterion 2"],
      "requirements": ["Req 1", "Req 2"]
    }
  ],
  "effortTable": [
    { "activity": "01 – Activity", "hours": "30", "cost": "3750" }
  ],
  "totalHours": 50,
  "totalCost": 6250,
  "estimatedWeeks": 2
}
```

All content in **Portuguese (PT-BR)**. Break prompt into logical scope items. estimatedWeeks ≈ 1 week per 40hr, min 2 weeks.

#### Running the Generator

```bash
cd <skill-path>
node scripts/generate_cr.js input.json output.docx
```

Output: ~106KB .docx with embedded fonts, Yalo logo, branded footer.

### Step 4: Generate Assist Closure Details

List the total effort per scope item/use case (matching the CR document's scope items), then the total and amount. No role-based breakdown (no Engineering, UX, PM, QA split).

**Format:**
```
Effort per use case:
- 01 – <Scope Item Title>: Xhr
- 02 – <Scope Item Title>: Yhr
- 03 – <Scope Item Title>: Zhr
Total: <total>hr | Amount: $<amount> USD

Scope: <1-2 sentence summary>
```

### Step 5: Update Salesforce

Update `Tech_Assist__c` fields: `Amount__c`, `Effort__c`, `Fit__c`, `Project_Size__c`, `PM_Assist_Closure_Details__c`, `Change_Request__c`.

**Always show summary and ask for confirmation before updating.**

### Step 6: Upload CR Document to Google Drive

Upload the generated .docx to the client's folder in Google Drive, set sharing permissions, and use the link as `Change_Request__c`.

#### Prerequisites
- `gcloud` CLI installed at `/opt/homebrew/bin/gcloud`
- Application Default Credentials with Drive scope. If token only has `drive.file` scope, re-auth:
  ```bash
  export PATH="/opt/homebrew/bin:/opt/homebrew/share/google-cloud-sdk/bin:$PATH"
  gcloud auth application-default login --scopes="https://www.googleapis.com/auth/drive,https://www.googleapis.com/auth/cloud-platform"
  ```
- Quota project: `arched-photon-194421`

#### Finding the Client Folder

Search starred/favorite folders to find the client's folder:
```bash
export PATH="/opt/homebrew/bin:/opt/homebrew/share/google-cloud-sdk/bin:$PATH"
TOKEN=$(gcloud auth application-default print-access-token)
QUOTA_PROJECT="arched-photon-194421"

curl -s "https://www.googleapis.com/drive/v3/files?q=starred%3Dtrue%20and%20mimeType%3D'application%2Fvnd.google-apps.folder'%20and%20trashed%3Dfalse&fields=files(id%2Cname%2Cparents)&pageSize=30&corpora=allDrives&includeItemsFromAllDrives=true&supportsAllDrives=true" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-goog-user-project: $QUOTA_PROJECT"
```

Known client folder IDs (starred):
| Client | Folder ID |
|--------|-----------|
| Kellanova | `1RJCxCOrCx680dCgplxvLTGIHR2M_xXEg` |
| Nespresso | `13GWgzfvwfZIDd1H-cp3u-mwnfPbLhBC4` |
| Nestlé BR | `1vPV8USF6Pt1Ip0iqxlwLwGWmqeAMTlth` |
| Grupo Herdez - MEX | `1YULDzGZUzEMHOcJc00-mcYQaE0daQklD` |
| Unilever Kibon Brasil | `1_fQkabpkk43lRwcoKMHhti0zhenpvkhJ` |
| Raizen BR | `1eomdtDnwsGx4cAk-nIZzegtlWcyTvqQ7` |
| Fruki | `1u2ak4lRo8Ssx8H2uvq4fERn3fXS-2VJK` |
| Reckitt - Reppos (IFC) | `16ADxlCry_U8RWEwxLvt5z64i9PgAYLOQ` |
| Positivo | `1la-ojk7AUkjDpF4C2gUQniUnrATzW_xt` |
| Insider Store | `1Z8IcaZcT736tOu7TkzbWauy5p7W2Cjb-` |
| Rommac | `169lkH_IG3fBWbeovhGpZmYpGpRrf70R8` |

Match the client from `Account__r.Name` to the folder. If no match, search starred folders dynamically.

#### Uploading

```bash
FOLDER_ID="<matched_folder_id>"
FILE_PATH="/path/to/CR_document.docx"

# Upload
curl -s -X POST "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,name,webViewLink" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-goog-user-project: $QUOTA_PROJECT" \
  -F "metadata={\"name\":\"<filename>.docx\",\"parents\":[\"$FOLDER_ID\"]};type=application/json;charset=UTF-8" \
  -F "file=@$FILE_PATH;type=application/vnd.openxmlformats-officedocument.wordprocessingml.document"

# Set shareable (anyone with link can view)
FILE_ID="<id_from_upload_response>"
curl -s -X POST "https://www.googleapis.com/drive/v3/files/$FILE_ID/permissions?supportsAllDrives=true" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-goog-user-project: $QUOTA_PROJECT" \
  -H "Content-Type: application/json" \
  -d '{"role":"reader","type":"anyone"}'
```

Use the `webViewLink` from the upload response as the `Change_Request__c` value.

#### CR File Naming Convention
`CR_<Tech_Assist_Name>_<Short_Description>.docx` — e.g., `CR_A-3868_Integracao_Yalisto.docx`

#### Local Save Path
Always also save a local copy at: `~/Desktop/Claude/Project Management/<Client Subfolder>/`

## Subtype Reference

| Subtype | Fit % | Typical Work |
|---------|-------|--------------|
| Product Enablement | 99% | Enabling existing platform features |
| Flow | 99% | Configuring conversational flows |
| Data | 99% | Data configuration, analytics |
| Continuous_Improvement | 99% | Iterative improvements |
| Integration | 50% | Custom API integrations |
| Product | 99% | Product-level configurations |
| Custom | 99% | Custom product-native work |
| Discovery | 70% | Exploratory/scoping work |
| Others | 70% | Mixed or unclassified work |
| Dedicated Cell | 70% | Dedicated team allocations |
| null/empty | 70% | Default when subtype not set |
