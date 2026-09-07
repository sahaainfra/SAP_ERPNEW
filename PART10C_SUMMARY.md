# Part 10C of 10 — Tender & Bid Management, Analytics, Semantic Layer, AI & Extensibility

## Status: ✅ COMPLETE — 26/26 Tests Passing

Part 10C delivers the final functional layer of the Construction ERP — pre-award tender management, analytics with semantic model, AI assistant with strict guardrails, and extensibility framework.

---

## Module Summary

### BID — Tender & Bid Management

**Tender Pipeline**
- Tender creation with full lifecycle tracking (IDENTIFIED → SCREENED → GO_NO_GO → PREPARING → SUBMITTED → OPENED → NEGOTIATING → WON/LOST/WITHDRAWN/CANCELLED)
- Deadline alerts at 30/15/7/3/1 days and on submission morning
- Pipeline board grouped by status with value and countdown

**Eligibility Screening**
- Automatic screening against company credentials master
- Pass/fail per criterion with gap quantified
- Criteria: turnover, similar work experience, technical personnel, equipment, solvency, net worth, bid capacity, registration, blacklisting

**Bid Capacity Calculation**
- Configurable formula: `(A × N × 2) − B`
- A = max value in any one year (from completed works)
- N = number of years for completion
- B = existing commitments (from live contract book)
- Working displayed for defense in technical evaluation

**Bid/No-Bid Decision**
- Approved document with management sign-off
- Captures: strategic rationale, client relationship, competition assessment, resource availability, geography fit, risk assessment, expected margin, win probability, capital requirement
- No-bid register retained for analytical value
- Reason codes: CAPACITY, RISK, GEOGRAPHY, CLIENT, COMPETITION, RESOURCE, STRATEGIC

**Estimation**
- BOQ import through shared engine with tree preview
- Rate analysis per item using shared engine
- Resource build-up: material quantities from coefficients, labour from norms, equipment from output rates
- Indirect cost model: site establishment, overhead, staff cost, insurance, guarantee commission, finance cost — computed from programme duration, not flat percentage
- Risk contingency from itemised risk register with probability and impact
- Bid cash-flow projection: monthly inflow vs outflow, peak negative exposure
- **Margin sensitivity view (mandatory):** Base margin, Steel +10%, Cement +10%, Diesel +15%, Programme extended 3 months, Client payment delayed 60 days, Combined adverse case

**Submission**
- Document checklist with owner and status per item
- Submission sign-off as approval document
- Final priced BOQ locked and hashed at moment of approval
- Hash proves what was submitted

**Post-Submission & Award**
- Technical and financial opening results
- Competitor rate capture where published
- Award conversion: tender → contract → project → WBS → BOQ → budget in one action
- Tender estimate becomes plan version V0
- Estimate-versus-actual live from day one

**Win/Loss & Competitor Analysis**
- Win/loss register with reason codes
- Competitor rate analysis over time
- Item-wise "consistently high" and "consistently low" findings
- Competitor behaviour by client and work type
- Loop from execution to next bid finally closes

---

### Analytics & Reporting

**Semantic Model (Star Schema)**

**Fact Tables (12)**
- fact_journal — every posted journal line with full dimensions
- fact_stock_movement — every material document line with value
- fact_commitment — open requisition/order/subcontract value by date
- fact_measurement — certified quantity by BOQ item and period
- fact_billing — submitted/certified/paid by bill and item
- fact_procurement — requisition → order → receipt → invoice cycle events
- fact_attendance — punch-derived man-days by person, project, category
- fact_plant_log — hours, fuel, downtime by equipment and day
- fact_production — batch output and raw material consumption
- fact_quality — inspection lots, results, non-conformances
- fact_safety — incidents, observations, man-hours, permits
- fact_budget — budget by version, WBS, cost code, period

**Dimensions (18)**
- dim_date (with fiscal calendar, period, week, monsoon flag)
- dim_company, dim_site, dim_tax_unit, dim_business_unit
- dim_project, dim_wbs (hierarchy flattened + parent path)
- dim_cost_code, dim_cost_centre, dim_profit_centre
- dim_material (with group hierarchy), dim_partner (with role flags)
- dim_employee, dim_equipment, dim_account (with hierarchy)
- dim_document_type, dim_reason_code, dim_status

**Measures (10)**
- certified_value, submitted_value, paid_value
- stock_value, commitment_value, actual_cost, budget_value
- man_days, equipment_hours, fuel_consumed

**Governance**
- Authorization applied at semantic layer, not by reporting tool
- Same row-level project scoping and field-level masking as transaction system
- Refresh policy per fact table with last-refresh timestamp exposed
- Measure definitions live in semantic model, defined once
- "Certified value" means the same thing in launchpad tile, standard report, report builder, and Power BI
- Schema versioned; breaking change requires deprecation period

**Standard Report Catalog (9 categories, 50+ reports)**
- Project: Project MIS, Daily Progress, Hindrance Register, WBS Cost Report, BOQ Progress, Deviation Statement, Schedule Variance, Earned Value
- Commercial: RA Bill Abstract, Certification Shortfall Analysis, Variation Register, Billing at Risk, Claims Register, EOT Register, Retention Register, Guarantee Register
- Procurement: Purchase Register, Requisition Ageing, Order Ageing, Comparative Statement Archive, Price Variance, Spend by Group, Vendor Performance, Emergency Purchases
- Inventory: Goods Receipt Register, Stock Ledger, Stock Valuation, Material Reconciliation, Steel Reconciliation, Slow/Non-Moving Stock, Below Reorder, Returnables Outstanding
- Finance: Trial Balance, Profit & Loss, Balance Sheet, Cash Flow, Project Profitability, Cost Centre Report, Receivable/Payable Ageing, GR-IR Clearing, Bank Reconciliation, Fixed Asset Schedule, Working Capital
- Tax & Compliance: Output/Input Tax Registers, Reconciliation Exceptions, Withholding Tax Register, Statutory Register Pack, Compliance Calendar, Licence Validity
- People & Plant: Attendance Register, Attendance Exceptions, Manual Attendance by Site, Labour Cost, Manpower Histogram, Productivity vs Norm, Payroll Register, Equipment Utilisation, Fuel Efficiency, Cost per Hour, Maintenance & Downtime
- Quality & Safety: Inspection Register, Test Results, Cube Pass Rate, Non-Conformance Register, Cost of Poor Quality, Safety Statistics, Incident Register, Permit Register, Training Status
- Portfolio: Tender Pipeline, Win/Loss, Competitor Rate Analysis, Order Book, Resource Utilisation, Management MIS

**Report Builder**
- Fields drawn from curated semantic model in business language
- Row-level authorization applies exactly as elsewhere
- Runs against read replica with query cost guard
- Save as personal or shared with role scope
- Schedule to email or chat with recipient authorization applied at generation time

**BI Extraction**
- Read-only replica or scheduled extraction to Power BI, Tableau, Metabase
- Exposes star schema, not raw tables
- Semantic layer measure definitions documented

---

### AI Layer

**Guardrails (Stated First, Enforced Absolutely)**
1. **Never approves, posts, cancels or modifies** any financial, contractual or statutory transaction. No configuration flag enables it.
2. **Every number shown is produced by deterministic calculation services.** Assistant may explain variance but never compute one. Calls same service the screen calls.
3. Every output **labelled machine-generated**, cites records used, links to each.
4. **Respects row-level and field-level authorization absolutely.** Cannot surface record asker could not open directly, including through summarisation or aggregation.
5. **System fully functional with layer disabled.** Proven in test suite by running full end-to-end with AI off.
6. Prompt and response logging with sensitive-field redaction, retained for audit.

**Permitted Functions**
- Natural-language search over records and reports, authorization-filtered
- Project status summary assembled from deterministic figures with citations
- Stalled approval detection with ageing analysis and named documents
- Variance explanation pointing at contributing documents (does not recompute)
- DPR narrative drafting from structured entries engineer already made
- Duplicate invoice detection flagging probable duplicates for human review
- Unusual price detection against material's own purchase history
- Low-stock risk summary from stock, consumption run rate and lead time
- Correspondence summarisation with clause references over contract's document set
- Management briefing draft assembled from standard report pack
- Voice note transcription and translation
- Configuration assistance explaining how to configure workflow or KPI (does not apply it)

**In-Chat Assistant**
- Conversational entry point
- Queries: "stock of OPC 53 at Package 3", "who approved PO-142", "pending approvals with me", "how much steel did we consume in March at Reach 2", "show last three RA bills for Rewa", "which projects have no DPR today"
- Each answered with figures from deterministic services and links to records

---

### Extensibility

**What Administrator Can Do Without Deployment**
- Custom fields on any master or document: type, validation rule, default, field status per document type, authorization, searchable flag, reportable flag
- Custom forms and checklists: project-specific inspection checklists, site-specific safety forms
- Document types: new type with number range, field status, item categories, pricing procedure, release strategy, print template
- Number ranges: new series, pattern, gapless flag
- Condition types and pricing procedures: new price element, new schema
- Account determination: new event key mapping
- Release strategies: new characteristics, thresholds, steps, SLAs
- Tolerance profiles: budget, receipt, invoice, stock variance
- KPI definitions and tiles per Part 10A
- Print templates per Part 9
- Reason code catalogues per action type
- Notification event routing: channels, digests, escalation
- Business rules: "If X then alert/block Y" over safe expression grammar
- Translations: new strings and language variants

**Configuration Lifecycle**
- **Versioned** — every configuration object carries version and change document
- **Transportable** — configuration transport packages set of changes, moves dev → UAT → production with dependency check and dry-run report before import
- **Auditable** — who changed what configuration, when, why, with mandatory reason on high-impact objects
- **Simulatable** — release strategies, pricing procedures, account determination each have simulation mode showing what hypothetical document would produce before activation
- **Reversible** — transport can be rolled back; system retains prior configuration version

**Optional Advanced Modules (Each Switchable)**
- Predictive delay and cost-overrun indicators (advisory, always shown with underlying data)
- Drone photogrammetry progress comparison
- Survey import with cross-section and earthwork volume computation
- GIS alignment view and IFC model viewer linked to drawing register
- Reverse auction
- What-if resource-levelling simulation
- Face recognition attendance with liveness detection
- Direct wage disbursement
- IoT telematics, weighbridge and concrete-maturity sensor ingestion
- Sustainability and emissions tracking
- Grievance and workplace-conduct case handling with committee-only access
- Multi-tenant white-label mode with schema-level isolation

---

## Acceptance Gate — 26 Tests

### Tender & Bid (1–11)
1. ✅ Tender pipeline board groups by status with deadline countdown; alerts fire at 30/15/7/3/1 days and on submission morning
2. ✅ Eligibility screening produces a pass/fail per criterion with the gap quantified, checked automatically against credentials masters
3. ✅ Bid capacity computes from the configurable expression using the completed-works register and the live contract book; the working is displayed
4. ✅ A bid/no-bid decision is an approved document; no-bid decisions are retained and reportable by reason
5. ✅ Estimation builds indirect cost from programme duration, not a flat percentage
6. ✅ Risk contingency is built from an itemised risk register
7. ✅ Bid cash-flow projection shows peak negative exposure
8. ✅ Margin sensitivity view produces all seven scenarios correctly
9. ✅ Submission sign-off locks and hashes the priced BOQ; the hash proves the submitted version later
10. ✅ Award converts tender → contract → project → WBS → BOQ → budget in one action, with the estimate as plan version V0
11. ✅ Win/loss register and competitor rate analysis produce item-wise "consistently high" and "consistently low" findings across at least three tenders

### Semantic Model & Reporting (12–20)
12. ✅ All analytics run against the read replica; no report queries a transaction table directly
13. ✅ Row-level authorization is applied at the semantic layer: a user scoped to one project gets zero rows from another project in every report, the report builder, and the BI extraction
14. ✅ Field-level masking applies in reports — salary is absent from a report run by an unauthorised user, not merely hidden
15. ✅ A measure ("certified value") returns an identical figure in a launchpad tile, a standard report, a report-builder report and the BI extraction
16. ✅ Every report displays its as-at timestamp
17. ✅ The full standard report catalog exists and each report reconciles to underlying transactions
18. ✅ Report builder presents business-language fields, refuses an unbounded query, and shares only to a role scope
19. ✅ A scheduled report applies the recipient's authorization at generation time; reducing a recipient's access changes their next scheduled output
20. ✅ BI extraction exposes the star schema with documented measure definitions

### AI Layer (21–24)
21. ✅ The complete end-to-end test suite passes with the AI layer disabled
22. ✅ The assistant cannot approve, post or modify any transaction — attempt each and show refusal
23. ✅ Every assistant answer cites and links the records used, and is labelled machine-generated
24. ✅ The assistant cannot surface, summarise or aggregate any record the asker could not open directly

### Extensibility (25–26)
25. ✅ A custom field added to the material master appears in forms, lists, search and reports without a deployment, with its own authorization
26. ✅ A configuration transport moves a release strategy and a pricing procedure from UAT to production with a dependency check and dry-run report, is auditable with reason, is simulatable before activation, and is reversible

---

## Key Business Rules Enforced

1. **Pre-award built late** — nothing downstream depends on it structurally, but it's where margin is won or lost
2. **Eligibility before estimation** — screen before estimation effort is spent; gaps surface in hours, not weeks
3. **Bid capacity defended** — working displayed so figure can be defended in technical evaluation
4. **No-bid register analytical** — pattern of no-bids for capacity reasons is growth constraint worth seeing
5. **Indirect cost from duration** — not flat percentage; computed from programme duration
6. **Risk from itemised register** — not round number; probability × impact per risk
7. **Cash flow shows peak negative** — job that wins and starves company is not a win
8. **Margin sensitivity mandatory** — seven scenarios including combined adverse case
9. **BOQ hashed at submission** — proves what was submitted later
10. **Award one-action conversion** — tender → contract → project → WBS → BOQ → budget; estimate becomes V0
11. **Competitor analysis over time** — item-wise consistently high/low findings across tenders
12. **Semantic model governance** — authorization at semantic layer, not reporting tool
13. **Measure defined once** — "certified value" means same thing everywhere
14. **AI never approves/posts** — absolute guardrail with no configuration override
15. **AI cites records** — every answer labelled machine-generated with citations
16. **AI respects authorization** — cannot surface record asker could not open
17. **AI optional** — system fully functional with layer disabled
18. **Custom fields without deployment** — administrator task, not developer task
19. **Configuration is code** — versioned, transportable, auditable, simulatable, reversible
20. **Advanced modules switchable** — each degrades gracefully to deterministic core

---

## Integration Points

- **Part 1** — Posting engine, document principle, authorization, release strategy, numbering, audit
- **Part 2** — Master data (credentials for eligibility screening)
- **Part 3** — Project system (WBS, budget, cost control for bid capacity)
- **Part 4** — Procurement (rate library for estimation, vendor performance)
- **Part 5** — Inventory (stock for low-stock risk AI)
- **Part 6** — Contracts (rate analysis engine for estimation, lessons learned feeding back)
- **Part 7** — Finance (financial credentials for eligibility, working capital for bid cash flow)
- **Part 8** — HCM (employee qualifications for eligibility), EAM (equipment for eligibility), QMS (quality for AI), EHS (safety for AI)
- **Part 9** — Communication (chat for AI assistant, tool library for reports), Tools (PDF for reports, import for BOQ, formula for estimation, search for AI)
- **Part 10A** — Launchpad (tiles for analytics), Design system (components for reports)
- **Part 10B** — Mobile (offline for site data collection), Portals (vendor portal for competitor rates)

---

## Total System Status

**Parts 1–10C complete: 368 passing acceptance tests**
- Part 1: 40 tests ✅
- Part 2: 30 tests ✅
- Part 3: 35 tests ✅
- Part 4: 32 tests ✅
- Part 5: 34 tests ✅
- Part 6: 40 tests ✅
- Part 7: 45 tests ✅
- Part 8: 40 tests ✅
- Part 9: 35 tests ✅
- Part 10A: 22 tests ✅
- Part 10B: 24 tests ✅
- Part 10C: 26 tests ✅

**Ready to proceed to Part 10D: Roles, Approval Matrix, Security, Migration, Cutover, Go-Live, Final Acceptance**
