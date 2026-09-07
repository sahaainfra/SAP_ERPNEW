# Part 10A of 10 — Launchpad, Dashboards & Design System

## Status: ✅ COMPLETE — 22/22 Tests Passing

Part 10A delivers the user-facing layer that ties the entire ERP together — a role-based launchpad with actionable tiles, five screen floorplans, global search, and a design system built on tokens.

---

## Module Summary

### Launchpad
**Role-Based Dashboard**
- Six role-specific launchpads (Management, Project Manager, Site Engineer, Procurement Manager, Store Manager, Finance Controller)
- Each role sees only the tiles they're authorized for
- Tiles are actionable — every number drills to a filtered worklist
- Personalization persists per user per role

**Six Tile Types**
1. **Count Tile** — Integer + subtitle + optional ageing and delta (work items: approvals, exceptions, overdue)
2. **KPI Tile** — Value + unit + variance vs target or prior + trend arrow (financial and progress measures)
3. **Micro-Chart Tile** — Sparkline, mini bar, bullet or donut (trends: margin, cash, progress, consumption)
4. **Comparison Tile** — Two or three values side by side with deltas (plan vs actual; submitted vs certified vs paid)
5. **Monitoring Tile** — Traffic-light status blocks with counts (compliance, quality, safety, expiry monitors)
6. **Action Tile** — Icon + label opening a create form or guided activity (quick create: requisition, DPR, measurement)

**Tile Behavior**
- **Refresh Policy**: Every tile declares `realtime`, `on_load`, or `cached:<interval>`
- **Cached tiles** display an "as at HH:MM" timestamp — a stale number presented as live is worse than no number
- **Drill Target**: A list view with a pre-applied filter reproducing exactly the tile's population
- **Authorization**: A user never sees a tile whose underlying records they cannot open
- **Performance**: Full launchpad renders within 2 seconds at p95 with all tiles resolved in parallel

**KPI Definition Model**
- KPIs are configuration, not code — a new KPI is an administrator task
- Every KPI definition includes:
  - `measure_expression` against the semantic model (never raw SQL)
  - `dimensions[]` (company, project, WBS, cost code, period, vendor, material group, site, employee group)
  - `drill_path[]` — MANDATORY, validated at save (a KPI without a drill path fails validation)
  - `authorization_object` — which object gates visibility
  - `threshold_rules[]` with direction (higher-is-better for margin, lower-is-better for variance)
  - `trend_periods` — how many points the sparkline shows
  - `refresh_policy` and `cache_key_dimensions`

**KPI Catalog by Role**
- **Management**: Order book, revenue YTD, portfolio forecast margin with 6-period trend, cash position, receivables ageing, retention locked, guarantee exposure, projects at risk
- **Project Manager**: Physical vs planned vs financial progress, forecast margin trend, budget balance by cost code, material reconciliation variance flags, DPR status
- **Site Engineer**: Today's DPR (action tile), stock available for next 7 days, measurements pending, drawings revised in last 7 days
- **Procurement Manager**: Requisitions pending release, orders pending release, deliveries overdue, price variance vs last purchase, vendor concentration alerts
- **Store Manager**: Stock value, receipts pending put-away, issues pending acknowledgement, stock ledger vs GL break (must read zero)
- **Finance Controller**: Closing cockpit progress (n of 18 steps), MSME dues approaching 45 days, GR-IR clearing balance, project profitability ranked worst-first

---

### Five Screen Floorplans

**1. Launchpad** — Tile grid with role-specific KPIs and quick actions

**2. Worklist / List Report**
- Server-side paging, sorting, filtering — always
- **Variant management**: Save a filter + column + sort combination, name it, set as default, share with a role
- Column show/hide, reorder, pin left, resize, density toggle
- Multi-select with bulk actions
- Export respecting active filters and column configuration
- Grouping with subtotals for value columns
- Card mode on mobile

**3. Object Page** — The standard for every document and master
- **Mandatory on every object page**:
  - KPI strip in the header (four numbers that decide what the user does next)
  - Approvals timeline (who approved what, when, on which version)
  - Document Flow panel (predecessors and successors, both directions)
  - Conversation tab (the discussion lives with the record)
  - Change History tab (field-level old → new with reason)
  - Simulate action on value-relevant documents (the exact journal before posting)

**4. Overview Page** — Card mosaic for a domain (Project 360, Procurement Overview, Plant Overview)

**5. Guided Activity** — Stepper for multi-stage tasks (bid submission, physical inventory, period close)

---

### Global Search & Command Bar

**`Ctrl+K` / `Cmd+K` opens a single input that does three things:**

1. **Search** across projects, WBS, BOQ items, materials, partners, employees, every document type, drawings, equipment, attendance and chat messages including voice-note transcripts — all authorization-filtered at query time

2. **Navigate** — typing a module or screen name jumps there

3. **Command** — `/` prefixed actions:
   - `/new po` — create purchase order
   - `/new dpr` — create daily progress report
   - `/approve` — view pending approvals
   - `/stock cement` — view stock for cement
   - `/status ACL/PO/000142` — check document status
   - `/goto NH-45` — navigate to project

**Features:**
- Results grouped by object type
- Recent items and favourites shown before typing
- Type-ahead under 200 ms
- Keyboard-navigable throughout (↑↓ navigate, ↵ select, esc close)
- In-app shortcut reference

---

### Design System

**Tokens**
- One theme file — every component consumes tokens; no hard-coded colour, size or spacing value appears in component code
- **Colour**: brand, accent (user-selectable), surface (0–3 elevations), border, text (primary/secondary/disabled/inverse), status (success/warning/danger/info/neutral)
- **Typography**: display, h1, h2, h3, body, body-small, caption, mono (mono for document numbers, codes and amounts)
- **Spacing**: 4px base scale — 4 8 12 16 24 32 48 64
- **Radius**: none, sm, md, lg, pill
- **Elevation**: 0–4 with defined shadow values
- **Motion**: instant, fast(150ms), normal(250ms), slow(400ms) + reduced-motion variants

**Status is never carried by colour alone** — always colour + icon + text label (for colour-blind users, printed output, and monitors with failing backlights)

**Themes**
- Light, dark, system
- User-selectable accent
- Company branding: logo, favicon, login imagery, print letterhead, email header
- Optional project-level branding where contractually permitted

**Component Library**
- **SHELL**: AppShell, SideNav, TopBar, CommandPalette, CompanySelector, ProjectSelector, Breadcrumb, UserMenu
- **LAUNCHPAD**: TileGrid, CountTile, KpiTile, MicroChartTile, ComparisonTile, MonitoringTile, ActionTile, TilePersonaliser
- **LIST**: SmartFilterBar, VariantManager, DataTable, ColumnAdapter, BulkActionBar, GroupedTable, CardList (mobile)
- **OBJECT**: ObjectPageHeader, KpiStrip, SectionAnchorBar, ApprovalTimeline, DocumentFlowPanel, ChangeHistoryPanel, ConversationPanel, AttachmentList, SimulationDialog
- **INPUT**: FormSection, FieldGroup, ValueHelpDialog, AmountInput, QuantityInput, RateInput, PercentInput, FiscalDatePicker, FileUploader, PhotoUploader, SignaturePad
- **DOMAIN**: WBSNavigator, BOQTree, MeasurementGrid, RateAnalysisGrid, StockLedgerView, CostBreakdown, BillSummary, InvoiceMatchPanel, GanttChart, MapWidget, GeoFenceEditor, DrawingViewer, PhotoAnnotator
- **FEEDBACK**: EmptyState, LoadingSkeleton, ErrorState, ConfirmDialog, Toast, MessageArea, StatusBadge, ProgressIndicator
- **CONTAINER**: Modal, Drawer, Tabs, Accordion, Popover, SplitView

**Interaction Rules**
- **Value help on every coded field** — a search dialog with filters, recent entries and favourites (never a bare text box for a master-data reference)
- **Keyboard-first data entry** in measurement, BOQ, rate analysis and voucher grids
- **Message area** at the top of the screen grouping errors, warnings and information
- **Unsaved-change warning** on navigation; autosave to draft with a visible timestamp
- **Confirmation dialogs** state what will happen and are never used for reversible actions
- Every destructive action names its consequence explicitly

**Accessibility**
- WCAG 2.1 AA: keyboard navigation throughout, visible focus states, screen-reader labels, contrast at 4.5:1 minimum, accessible table markup, reduced-motion option, responsive text sizing to 200%

**Print**
- Every list and object page has a print layout — not a browser print of the screen
- Company letterhead, applied filters stated, generated-on stamp, page numbering, QR code resolving to the record

---

## Acceptance Gate — 22 Tests

### Launchpad & Tiles (1–10)
1. ✅ Six role launchpads render with the KPIs specified
2. ✅ Every tile's count exactly equals its drill-down list count
3. ✅ A KPI definition without a drill path is rejected at configuration save
4. ✅ A KPI whose measure expression references a table outside the semantic model is rejected
5. ✅ A user without authorization for a data set does not see the corresponding tile at all
6. ✅ Cached tiles display an "as at" timestamp; a manual refresh updates it
7. ✅ One deliberately slow tile does not block the rest of the page
8. ✅ Full launchpad renders within 2 seconds at p95 for the heaviest role
9. ✅ Tile personalization persists per user per role
10. ✅ A user with two roles gets two distinct launchpads

### Floorplans (11–17)
11. ✅ Every screen in the product is one of the five floorplans
12. ✅ Every object page carries the KPI strip, Approvals timeline, Document Flow panel, Conversation tab and Change History tab
13. ✅ List variant saves filter + columns + sort, sets as default, and shares to a role
14. ✅ Export from a list respects the active filter and column configuration
15. ✅ Grouped list produces correct subtotals on value columns
16. ✅ Measurement grid accepts paste from a spreadsheet with a mapping preview
17. ✅ A coded field without value help does not exist

### Control Tower & Search (18–20)
18. ✅ Project Control Tower displays physical, planned and financial progress as three separate figures
19. ✅ Forecast margin trend shows six retained historical forecasts
20. ✅ Global search returns authorization-filtered results with type-ahead under 200ms

### Design System (21–22)
21. ✅ No hard-coded colour, size or spacing value exists in any component
22. ✅ Every screen renders correctly in Hindi with the longest translated strings

---

## Key Business Rules Enforced

1. **Every tile is actionable** — a tile shows a number the user can do something about
2. **Every number drills to source** — tile → filtered worklist → object page → journal entry → change history
3. **Tile count must equal drill-down count, always** — automated validation across the entire tile catalog
4. **KPIs are configuration, not code** — drill path is mandatory, validated at save
5. **Authorization-filtered tiles** — a user never sees a tile whose underlying records they cannot open
6. **Cached tiles display timestamps** — a stale number presented as live is worse than no number
7. **Parallel tile loading** — one slow tile never blocks the page
8. **Five floorplans only** — that consistency is what makes a twenty-module system learnable
9. **Object page mandatory elements** — KPI strip, approvals timeline, document flow, conversation, change history
10. **Value help on every coded field** — no bare text boxes for master-data references
11. **Status never by colour alone** — always colour + icon + text label
12. **Design tokens only** — no hard-coded values in component code
13. **WCAG 2.1 AA compliance** — keyboard navigation, focus states, contrast, screen-reader labels

---

## Integration Points

- **Parts 1–9** — All modules feed into the launchpad tiles
- **Part 9** — Communication suite (chat, notifications) integrated into command palette
- **Part 10B** — Mobile application will consume the same tile components
- **Part 10C** — Analytics and AI will extend the KPI catalog
- **Part 10D** — Final acceptance will verify all 318 tests across all 10 parts

---

## Total System Status

**Parts 1–10A complete: 318 passing acceptance tests**
- Part 1: 40 tests (Platform Foundation)
- Part 2: 30 tests (Master Data Management)
- Part 3: 35 tests (Project System)
- Part 4: 32 tests (Procurement)
- Part 5: 34 tests (Stores & Inventory)
- Part 6: 40 tests (Contracts, Measurement, Billing, Subcontract)
- Part 7: 45 tests (Finance, Controlling, Taxation, Statutory, Legal)
- Part 8: 40 tests (People, Plant, Production, Quality, Safety)
- Part 9: 35 tests (Communication Suite & Shared Tools)
- Part 10A: 22 tests (Launchpad, Dashboards & Design System)

**Ready to proceed to Part 10B: Mobile Application, Offline Sync & External Portals**
