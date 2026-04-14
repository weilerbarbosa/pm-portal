# Description Templates & Examples

This reference contains the full description templates for each Jira issue type, based on
analysis of 550+ real issues (50 Features, 100 Epics, ~400 Tasks). Patterns reflect the
latest conventions observed in the newest batch of work.

---

## Feature Summary & Description

### Summary Format

Features use temporal or categorical prefixes. Three patterns observed:

**Pattern 1 — Temporal + Pipe (46% of features):**
- `Q3 2025 | Improvements to Checkout Flow`
- `2025 Q4 | CRs & Small Changes`
- `Q1 2026 | Dedicated Cell`

**Pattern 2 — Plain descriptive text (40%):**
- `Commerce Migration`
- `Custom Agent`
- `Yalo Force`

**Pattern 3 — Phase + Dash (14%):**
- `Phase 4 - Marketing Automation`
- `Phase 1 | Launch + Engagement + AI Connected Commerce`

### Description (Optional — only 18% have them)

Most features have NO description. When provided, use one of these formats:

**Brief paragraph (most common):**
> Deliver the foundational WhatsApp commerce experience including user authentication
> via phone-number-based SalesBuzz customer matching, a dynamic main menu as the central
> navigation hub, and a complete order entry flow with catalog browsing, cart management,
> suggested orders, and photo-assisted ordering through OCR/Vision integration with the ERP.

**Bullet list of scope items:**
> This feature groups all planned improvements including:
> - Support for biometric login
> - Enhanced session management
> - Reduced timeout configuration

**Link to external doc:**
> See detailed spec: [link to Google Doc or Confluence page]

---

## Epic Summary & Description

### Summary Format

Epics use plain descriptive text with **NO separators** (94% of epics). Keep it short
(average 23 characters). Focus on WHAT is being built.

**Good examples:**
- `User Authentication`
- `Payment Gateway Integration`
- `Main Menu`
- `Small Improvements & Bug Fixes`
- `Conversational Commerce Flow`
- `Check-in/Check-out Validation`

**Start with:** Action verbs (Integrate, Implement, Apply) or feature nouns (Commerce,
Authentication, Payments)

### Description (Recommended — the epic is the context hub)

Epics carry the scope and platform context so that child tasks don't have to repeat it.
A well-written epic description lets anyone understand the full picture without opening
every child task. Use this structured format:

```markdown
## Objective

[1-2 sentences: what this epic delivers and why it matters]

## Scope

- [Bullet list of what's included]
- [What's explicitly excluded or deferred]

## Yalo Product Components

- [Which platform products/modules are involved across all tasks]

## Expected Outcome

[What "done" looks like — the tangible deliverable or behavior change the client will see.
Be specific: "Users can see segmented coupons in the Ofertas menu" not "Coupon feature delivered."]

## Risks & Dependencies

- [Key risks, external dependencies, open questions — optional but recommended]
```

**Example:**

```markdown
## Objective

Enable CNPJ-segmented coupon delivery via WhatsApp for retail customers, starting with SFTP
ingestion and migrating to Data Cloud in May.

## Scope

- SFTP file ingestion (daily/differential) with coupon data per CNPJ
- "Cupons" section in the Ofertas menu with adaptive display (1 vs N coupons)
- Deep link to e-commerce site and copy-coupon button (if supported)
- Campaign expiration handling with disclaimer for data freshness
- Not included: vendedor segment (future phase), Data Cloud integration (May)

## Yalo Product Components

- Integration Platform — SFTP connector, data entities
- Builder — Menu navigation, coupon rendering, conditional logic
- Commerce — Ofertas menu integration

## Expected Outcome

Retail users (varejo) authenticated via CNPJ can access personalized coupons in the
Ofertas > Cupons menu. Each coupon shows the site description and a link to apply it.
Expired or budget-exhausted campaigns are filtered out with a disclaimer when data
freshness cannot be guaranteed.

## Risks & Dependencies

- Magento→Data Lake delay (up to 3h) may cause stale coupon display
- Copy button and carousel may not be supported in all WhatsApp contexts
- Client must deliver sample SFTP file by April 8 to validate schema
```

---

## Task Summary & Description

### Summary Format

Tasks ALWAYS use the `ROLE | Action` format with pipe separator:

```
ROLE | Action Description
```

**Standard roles (95% of all tasks):**
- `DEV | Implement OTP generation and verification flow`
- `DEV | Create Validations in Profiller WFLOW`
- `UX | Design authentication conversational flow`
- `UX | Add Salesman Vacations`

**Rare roles (5%):**
- `QA | End-to-end testing of authentication flow`
- `PM | Coordinate testing schedule with QA`

**Summary rules:**
- Use ` | ` (space-pipe-space) as separator
- Start the action with a verb: Create, Implement, Design, Configure, Add, Review, Adjust
- Title Case after the prefix
- Average length: 35-45 characters
- No punctuation at end

### Description Template — Standard Format

Tasks are lean and action-oriented. Scope and Yalo Product Components belong on the parent
Epic — **do NOT repeat them on tasks**. This keeps descriptions concise and avoids the
fatigue of reading the same context on every child issue.

```markdown
## Objective

[1-2 sentences: what this task delivers and why]

## Technical Notes

[Implementation guidance, API references, constraints — keep it brief and relevant.]

> **Note:** [Critical platform behavior clarification if needed — use blockquote format.]

## Acceptance Criteria

1. First testable criterion with specific values
2. Second criterion covering happy path behavior
3. Third criterion for edge cases
4. Fourth criterion for error handling
5. Fifth criterion for performance/SLA if applicable

**SOW Source:** Section X.X — [Section Name]
```

### Description Template — Simple Format (for straightforward tasks)

```markdown
[Context paragraph — plain text explaining what and why. Keep it to 1-2 sentences.]

## Acceptance Criteria

1. First testable criterion with specific values
2. Second criterion covering happy path behavior
3. Third criterion for edge cases

**Source:** SOW Section X.X — [Section Name]
```

### When to use which format:
- **Standard format**: Most tasks — complex projects, SOW decompositions, integration work
- **Simple format**: Bug fixes, small config changes, tasks where the summary says it all

Key points (both formats):
- Use `##` headers (not `###`)
- Acceptance criteria use **numbered lists** (not bullets)
- Use blockquote `> **Note:**` for critical platform behavior clarifications
- **Never** include Scope or Yalo Product Components sections on tasks — these live on the Epic
- 4-6 criteria per task is typical (don't pad with obvious criteria)

### Task Example 1 — DEV Task (Well-Grounded)

**Summary:** `DEV | Implement SalesBuzz Customer Matching via API`

**Description:**

Once the user's phone number is captured from WhatsApp metadata, the system queries SalesBuzz's customer lookup endpoint to retrieve associated customer profiles (per BR19). A phone number may match zero, one, or multiple customer accounts (per BR20). The matching result determines the user's access to catalog, pricing, and ordering features.

## Acceptance Criteria

1. System calls SalesBuzz customer search API with the user's phone number (per BR19 — phone as primary identifier)
2. Single-match: user is automatically associated with the matched customer profile
3. Multi-match: user is presented with a selection list to choose their active account (per BR20 — multiple customers per phone)
4. No-match: user sees a message indicating no account found and is offered next steps
5. Customer profile data (CustomerCode per BR23) is cached in session for downstream flows
6. API errors and timeouts are handled with retry logic and user-facing fallback messages

**Source:** SOW Section 4.3.1 — User Authentication (BR19, BR20, BR23)
**Estimation:** M

**Why this is well-grounded:** Every criterion references a specific business rule. No invented timeouts, retry counts, or technical specifics.

---

### Task Example 2 — UX Task (Well-Grounded)

**Summary:** `UX | Design Order Entry Conversational Flow`

**Description:**

The order entry flow is the core commerce experience. The UX design must optimize for speed, handle the Arabic/English bilingual context, and accommodate both power users (suggested orders) and new users (guided catalog browsing). The flow must work within WhatsApp message and button constraints.

## Acceptance Criteria

1. Flow covers: catalog entry → category selection → subcategory → product selection → quantity → add to cart → cart review → confirm order → confirmation message
2. Shortcut paths: "Reorder" from main menu → suggested order → confirm
3. Cart modification flow: view cart → select item → edit/remove → updated cart summary
4. Arabic and English variants for all messages, buttons, and product names
5. Error handling: empty catalog category, API failures — with clear user-facing messages
6. Flow diagram documented and approved by UX lead

**Source:** SOW Section 4.3.3 — Order Entry
**Estimation:** L

**Why this is well-grounded:** Does not mention MOQ (BR13 says none), stock validation (BR28 says not exposed), or credit limits (BR24 says SalesBuzz handles). Only includes what the SOW describes.

---

### Task Example 3 — QA Task (Well-Grounded)

**Summary:** `QA | End-to-End Testing of Authentication Flow`

**Description:**

The authentication flow is the gatekeeper to all commerce functionality. QA must validate both happy paths and edge cases across the entire flow to ensure no user is blocked from accessing the platform.

## Acceptance Criteria

1. Test plan covers: new user opt-in, returning user, phone number capture, single customer match, multiple customer matches (BR20), no customer match, account switching
2. API mock/sandbox tests validate SalesBuzz integration behavior for each matching scenario
3. All test cases documented in Xray with pass/fail results linked to this task
4. Regression suite created for inclusion in CI/CD pipeline

**Source:** SOW Section 4.3.1 — User Authentication
**Estimation:** M

**Why this is well-grounded:** Removed OTP references (not in SOW), removed specific SLA numbers (not in SOW), kept only what the document describes.

---

### Task Example 4 — DEV Task (Standard Format)

**Summary:** `DEV | Configure SalesBuzz API Connector and Entity Sync Jobs`

**Description:**

## Objective

Configure the Integration Platform connector to SalesBuzz ERP and set up automated sync jobs for all required data entities, enabling the Commerce module to serve accurate product catalogs, pricing, and customer data.

## Technical Notes

API reference: SalesBuzz Postman collection (see project files).

> **Note:** The Yalo Platform automatically propagates Customers and Sales Reps from Commerce to CDP — no manual CDP data ingestion is needed. This task only covers sync TO Commerce.

## Acceptance Criteria

1. SalesBuzz API connector configured with authentication and base URL
2. Sync jobs created for all 5 entity types: Products, Prices, Categories, Customers, Sales Reps
3. Field mappings documented and validated against SalesBuzz data model
4. Sync jobs execute on schedule with error logging and retry logic
5. Data validation confirms entities appear correctly in Commerce after sync
6. API errors and timeouts are handled gracefully with alerts

**SOW Source:** Section 4.2 — Integration and Data Setup

**Why this works without Scope/Components:** The parent Epic already defines that this epic covers Integration Platform + Data Entities for SalesBuzz. Repeating it here would be redundant.

---

### Task Example 5 — UX Task (Oris Agent Config)

**Summary:** `UX | Configure Oris Sales Agent Profile, Persona, and Brand Guidelines`

**Description:**

## Objective

Set up the Oris AI Sales Agent identity including its system prompt, persona characteristics, brand communication guidelines, and general settings to ensure the agent communicates consistently with the Menabev brand voice.

## Technical Notes

This is a UX/CUX team responsibility. The conversational personality and brand alignment are design decisions, not development work.

## Acceptance Criteria

1. Agent profile configured with system prompt reflecting Menabev brand voice
2. Persona characteristics defined (friendly, professional, bilingual Arabic/English)
3. Brand communication guidelines documented and applied to agent settings
4. Knowledge sources connected (product catalog, FAQ)
5. General settings configured (language, response length preferences)
6. Agent tested in staging for brand consistency across sample conversations

**SOW Source:** Section 4.4 — Oris Agent Configuration

**Why this is UX, not DEV:** All Oris agent configuration (profile, persona, skills, guardrails, transitions, knowledge sources, brand guidelines) is UX team responsibility.

---

### Anti-Pattern Examples — What NOT to Write

**BAD: Inventing technical specifics**
> "Catalog is cached with a configurable TTL (default: 1 hour)"
→ The SOW doesn't specify cache duration. Use: "Catalog is cached for performance [TTL TBD]"

**BAD: Adding validation the SOW says another system handles**
> "Cart enforces MOQ rules from SalesBuzz per product"
→ BR13 says "No minimum, maximum, or jump quantity rules apply." Remove this criterion.

**BAD: Assuming integration mechanisms**
> "Order status change webhooks from SalesBuzz trigger notifications"
→ SOW Gaps section says "SalesBuzz does not expose webhook mechanisms." Use: "Order status monitored via periodic polling of Order History API"

**BAD: Filling in TBC items as if confirmed**
> "HyperPay payment gateway integrated with Mada, Visa, Mastercard, Apple Pay"
→ SOW BR35 says online payment is TBC. Use: "Online payment gateway integration [provider TBC per BR35]"

**BAD: Adding scope Yalo doesn't own**
> "Credit limit validation: cart total must not exceed available credit"
→ BR24 says "Yalo does not perform credit checks." Remove or note: "Credit validation handled by SalesBuzz at order creation time (per BR24)"

**BAD: Creating CDP data ingestion tasks**
> "Configure CDP data ingestion for Customers and Sales Reps"
→ The Yalo Platform automatically syncs Customers and Sales Reps from Commerce to CDP. NEVER create tasks for this. Valid CDP work: Segments, Events, Audiences only.

**BAD: Assigning Oris agent config to DEV**
> "DEV | Configure Oris Agent Profile and Guardrails"
→ All Oris agent configuration is UX team work, never DEV. Use: "UX | Configure Oris Agent Profile and Guardrails"

**BAD: Including WhatsApp template design as delivery team work**
> "UX | Design WhatsApp Message Templates and Submit for Meta Approval"
→ Template design and Meta approval are CS team responsibilities. Remove entirely unless the SOW explicitly assigns this to the delivery team.

**BAD: Combining too many disciplines in one task**
> "UX | Design Conversational Experience, Skill Prompts, and WhatsApp Templates"
→ Split into separate focused tasks: one for conversational UX, one for skill prompts. Remove templates (CS team).

---

## Decomposition File Structure

When saving the full decomposition, use this structure:

```markdown
# SOW Decomposition: [Client/Project Name]

**Project:** [Jira Project Name] ([KEY])
**SOW:** [Document reference and title]

---

## FEATURES (N)

### Feature 1: [Name]
**Summary:** `[Summary text with pipe or plain]`
**Description:** [Optional paragraph]
**Epics:** [List of epic names]

---

## EPICS (N)

### Epic 1: [Name] (> Feature X)
**Summary:** `[Plain descriptive text, no separator]`
**Description:** [Optional 1-2 sentences]

---

## TASKS (N)

### EPIC 1 — [Name] (N tasks)

#### Task 1.1
**Summary:** `ROLE | [Action Description]`
**Description:**
[Context paragraph]

## Acceptance Criteria

1. Criterion one
2. Criterion two
3. Criterion three

**Source:** [Document reference]
**Estimation:** [T-shirt size]

---

## SUMMARY TABLE

| Type | Count | Details |
|------|-------|---------|
| Features | X | [Phase breakdown] |
| Epics | X | [Epic names] |
| Tasks | X | [Per-epic breakdown] |
| **Total** | **X** | |

### Task Breakdown by Role
| Role | Count |
|------|-------|
| DEV | X |
| UX | Y |
| QA | Z |
```
