# CONSTRUCTION ERP — PART 9 SPECIFICATION
## Communication Suite, Notification Engine & Shared Tool Library

**Status: ✅ All 35 acceptance tests defined**

---

## PART A — COMMUNICATION & COLLABORATION SUITE (COM)

### A.1 Conversation Model

**Conversation Types (9 types):**
1. DIRECT - One-to-one messaging
2. GROUP - Ad-hoc group with invited members
3. PROJECT - Auto-created per project, membership derived from team
4. WORKFRONT - Auto-created per WBS package or work front
5. SITE - Auto-created per operating site
6. DOCUMENT - Auto-created and bound to business document
7. ROLE_BROADCAST - One-to-many announcement channel
8. EXTERNAL - Includes vendor/subcontractor/client participants
9. SUPPORT - Helpdesk thread with IT/ERP support

**Auto-Created Conversations:**
- Purchase requisition → Requester, approvers, buyer
- Purchase order → Buyer, vendor (external), store, approvers
- Goods receipt exception → Storekeeper, buyer, PM
- Material request → Requester, storekeeper, project engineer
- Measurement/RA bill → QS, PM, commercial, client
- Non-conformance → Raiser, assignee, QA manager, subcontractor
- Safety incident → Safety officer, PM, management
- Hindrance/RFI/site instruction → Site engineer, PM, commercial, consultant
- Maintenance order → Operator, plant manager, workshop
- Legal case → Legal, Commercial, management (restricted)
- Grievance/whistleblower → Committee only (admin excluded)

**Membership Resolution:**
- PROJECT thread → Everyone with row-level access + explicit externals
- WORKFRONT thread → WBS-scoped team members
- DOCUMENT thread → Initiator + approvers + assignees + posters + explicit
- Automatic updates on role/project changes
- Removed users lose forward access but history remains intact

### A.2 Message Model

**Content Types (13 types):**
1. TEXT - Rich text (bold/italic/lists/links)
2. VOICE_NOTE - Press-hold record with auto-transcription (Hindi/English)
3. IMAGE - With annotation, GPS, timestamp overlay
4. VIDEO - Compressed with thumbnail and duration
5. DOCUMENT - PDF/Office/CAD preview
6. LOCATION - Static pin or live location
7. CONTACT - Internal user or business partner card
8. OBJECT_CARD - Live ERP record card
9. TASK - Assignable task with due date
10. APPROVAL_REQUEST - Actionable approval card
11. FORM - Checklist or micro-form
12. POLL - Scheduling and simple decisions
13. SYSTEM - Status changes posted by ERP

**Interaction Features:**
- Reply-with-quote
- Threaded replies
- @mentions (user, role, group)
- Emoji reactions
- Starred messages per user
- Pinned messages (max 5, moderator required)
- Forward with attribution
- Message search within/across conversations
- Media/document/link gallery
- Unread markers and jump-to-first-unread
- Draft persistence

**Edit and Delete Governance:**
- Edit permitted within 15-minute window with edit history
- Delete for me (local hide)
- Delete for everyone (tombstone, original retained in audit)
- Legal hold disables deletion entirely
- Retention classes: operational (2 years), project (contract + DLP + 3 years), legal (permanent)

### A.3 Realtime Architecture

**WebSocket + REST Hybrid:**
- Primary: WebSocket with heartbeat, backoff reconnect, resume-from-cursor
- Fallback: REST for history and upload
- Gateway: Auth on connect, rate limit, presence registration
- Message service: Append, persist, fan-out, enqueue notifications/indexing/transcription
- Presence service: Online/away/offline, typing indicators (ephemeral, Redis)

**Ordering and Delivery:**
- Server-assigned monotonic sequence_number per conversation
- Client orders by sequence, never timestamp
- client_message_id as idempotency key
- At-least-once delivery with client-side deduplication
- Delivery states: sent → delivered → read (batched to avoid receipt storm)

**Offline Behaviour:**
- Outbound queue with visible state: queued/sending/sent/delivered/read/failed
- Queue survives app restart with exponential backoff
- Inbound sync on reconnect by cursor (paginated, newest-first)
- Resumable attachment upload (chunked, separate from message)
- Configurable auto-download policy (never/Wi-Fi only/always)

**Encryption Position:**
- TLS + encryption at rest mandatory
- No end-to-end encryption (allows search, DLP, legal export, audit)
- Restricted conversations use separate encryption key with narrower access

### A.4 ERP Binding

**Message → ERP Object:**
- Photo of defect → Non-conformance (two-way link)
- Voice note about shortage → Material request (transcript pre-fills)
- Any message → Task (assignee, due date, tracked)
- Photo of delivery → Gate entry draft (vehicle OCR)
- Message about delay → Hindrance register (deadline computed)
- Client message → Site instruction (evidence attached)
- Photo of progress → DPR photo (attaches to today's DPR)
- Message about invoice → Vendor query (routed to portal)

**ERP Object → Conversation:**
- Every object page has Conversation tab
- Status changes post system messages
- Examples: "Order released", "GR posted", "RA certified", "Cube failed"

**Approval from Chat:**
- APPROVAL_REQUEST card with summary, budget, history
- Re-authentication required (biometric/PIN)
- Posts through normal release strategy with full audit
- Excluded: payments, high-value orders, contract amendments, guarantees

**Assistant in Chat:**
- Conversational query interface respecting authorization
- Examples: "stock of OPC 53", "who approved PO-142", "pending approvals"
- Retrieves and summarizes, never computes financial figures
- Every answer cites records

**Slash Commands:**
- /mr - Material request
- /dpr - Today's daily report
- /attendance - Punch
- /photo - Tagged site photo
- /task - Assign task
- /status <doc> - Document status
- /stock <material> - Stock query
- /approve <doc> - Approve document

### A.5 External Participants

**Portal-Based Externals:**
- Vendors, subcontractors, clients, consultants via portal
- Strictly scoped: only conversations they're party to
- No internal-only threads or side-comments
- Internal side-channel for team discussion before responding
- UI distinction: different background, banner, confirmation

**WhatsApp Business API Bridge:**
- Outbound: template messages (dispatch, payment, delivery, wage, safety)
- Inbound: replies and media land in ERP conversation
- Session-window rules respected
- Template approval tracked
- Every bridged message stored in ERP (ERP is record of truth)

### A.6 Governance, Safety & Compliance

**Controls:**
- Authorization: COM_CONV object (read/post/manage/export)
- Data-loss prevention: Detect salary/rates/margin/PII in external conversations
- Watermarking: Documents in external conversations watermarked
- Forwarding control: Restricted classes cannot forward outside conversation
- Legal hold: Deletion/edit disabled, retention extended
- Export: Paginated, indexed, timestamped PDF with media and hash
- Retention: Per conversation type, automated purge with report
- Moderation: Admins remove messages with reason, abuse escalates to HR
- Restricted conversations: Grievance/whistleblower visible only to committee
- Personal data: Labour phone/ID masked without authorization

### A.7 Notification Engine

**Single Dispatcher Service:**
- notify(event_key, recipients_resolver, payload, priority, channels_policy)
- Channels: in_app, push, email, sms, whatsapp, chat_message

**Routing Priority:**
1. Event criticality (fatality overrides preferences)
2. User preference per event category and channel
3. Organizational default per role

**Anti-Fatigue Design:**
- Digest mode: immediate/hourly/daily/weekly
- Aggregation: "7 approvals pending" not 7 messages
- Deduplication: Same event not notified twice across channels
- Quiet hours with critical-severity override
- Snooze per notification and category
- Effectiveness telemetry: sent/opened/acted-upon rates

**Event Catalog:**
- Approvals: pending, approved, rejected, escalated
- Budget: threshold crossed
- Inventory: low stock, reorder
- Quality: hold ageing, NCR raised/overdue
- Safety: incident by severity, permit expiring
- Attendance: exception, missing DPR
- Finance: payment due, MSME ageing, invoice mismatch
- Billing: certified, short-certified
- Compliance: retention release, guarantee/insurance/licence expiry
- Contract: notice deadline, limitation period, hearing date
- Equipment: document expiry, maintenance due, fuel exception
- Documents: revision issued, superseded in use
- Tender: deadline
- Communication: mention in conversation
- Tasks: assigned, overdue

### A.8 Task, Calendar & Comment Tools

**Task Manager:**
- Created standalone, from message, or from record
- Assignee, due date, priority, checklist, attachments, linked object, recurrence
- Surfaced on launchpad and in chat
- Overdue escalation to assigner

**Unified Calendar:**
- Approval SLAs, compliance due dates, guarantee/insurance expiries
- Hearing dates, milestones, maintenance due, meetings, leave
- Filterable by source, export to standard formats

**Threaded Comments:**
- Distinct from chat (permanent annotation on record)
- Used for review notes and audit observations
- Both searchable and audited

---

## PART B — SHARED TOOL LIBRARY (20 TOOLS)

### TOOL 1 — PDF GENERATION & TEMPLATE ENGINE

**Interface:** `render(template_key, data, options) → PDF stream + metadata`

**Requirements:**
- Template designer with branding (letterhead, logo, footer, watermark, signatures)
- Multi-language and bilingual output (Devanagari rendering)
- Table layouts with repeating headers, column spanning, row grouping, subtotals
- Page numbering "page n of m", document number in footer, generated-on stamp, QR code
- Digital signature support (certificate-based)
- Deterministic output (same input → byte-identical PDF)
- Asynchronous generation for large documents

**Test Cases:**
- 40-page bill abstract with repeating headers
- Bilingual wage register
- Devanagari rendering
- Same input twice producing identical hash
- 500-row report generating asynchronously

---

### TOOL 2 — EXCEL / CSV IMPORT & EXPORT ENGINE

**Import Pipeline (7 stages):**
1. Template download (validation, dropdowns, instructions, schema version)
2. File upload (size/type validation, virus scan)
3. Column mapping (auto-suggested, user-adjustable, reusable profile)
4. Validation preview (type, mandatory, master lookup, rules, duplicates, tree preview)
5. Error rows (downloadable with error text)
6. Corrected re-upload (merges with validated set)
7. Confirmation (summary, commit in single transaction, reversal handle)

**Requirements:**
- Streaming read for 50,000+ rows (no memory overload)
- Handle merged cells, repeated headers, blank rows, text amounts
- Reversible import with batch ID
- Import history (who, when, what, file retained)
- Export respects active filter and column configuration

**Test Cases:**
- 50,000-row material import within memory limits
- Messy BOQ Excel with merged cells and repeated headers
- Reversal of committed import
- Saved mapping profile reused on second file

---

### TOOL 3 — BARCODE / QR GENERATION & SCANNING

**Requirements:**
- QR (preferred) and Code-128
- Encodes signed deep link with object type and ID
- Error-correction level for dusty site environment
- Batch label printing
- Camera scanning with continuous multi-scan mode
- Offline resolution against cached master set

**Test Cases:**
- Printed and creased label scanning successfully
- Scan resolving to correct object
- Offline scan queuing and resolving on reconnect

---

### TOOL 4 — OCR & DOCUMENT DATA EXTRACTION

**Interface:** `extract(image_or_pdf, document_type_hint) → {fields, confidence, raw_text, bounding_boxes}`

**Requirements:**
- Pre-fill only, never auto-post
- Every field presented for confirmation with confidence score
- Low-confidence fields highlighted
- Vehicle number plate extraction
- Invoice field extraction (vendor, GSTIN, invoice number, date, amounts, tax, HSN)
- Handle poor-light site documents (deskew, denoise, contrast)
- Learn per-vendor layouts over time

**Test Cases:**
- Crumpled challan at dusk producing usable extraction
- Low-confidence field flagged rather than silently accepted
- Never posting without confirmation

---

### TOOL 5 — FORMULA & RATE ANALYSIS ENGINE

**Requirements:**
- Safe expression evaluator (no eval, no arbitrary code)
- Whitelisted grammar: variables, arithmetic, comparison, conditionals, fixed functions
- Decimal arithmetic throughout (never floating point)
- Nested sub-analysis with circular reference detection
- Formula versioning with effective dates and locked snapshots
- Explain mode: step-by-step evaluation trace

**Test Cases:**
- Three-level nested analysis
- Circular reference reported with chain
- Injection attempt rejected
- Explain trace matching hand calculation

---

### TOOL 6 — UOM CONVERSION ENGINE

Per Part 2 §6: Dimension-checked, material-specific factors, master-data-driven, round-trip tested.

---

### TOOL 7 — GPS & GEOFENCING ENGINE

**Interface:** `checkContainment(point, accuracy, geofence_set) → {inside, geofence_id, distance_from_boundary, confidence}`

**Requirements:**
- PostGIS geometry with spatial indexing
- Circle and polygon support
- Accuracy-aware decision (indeterminate vs outside)
- Mock-location detection
- Location history with configurable sampling
- Battery-conscious sampling on mobile

**Test Cases:**
- Point inside, outside, exactly on boundary
- Low-accuracy point near boundary returning indeterminate
- 10,000 containment checks within latency budget

---

### TOOL 8 — PHOTO & VIDEO PIPELINE

**Requirements:**
- Capture with mandatory metadata (GPS, timestamp, device, user, project, object)
- Annotation layer (arrow, circle, rectangle, freehand, text, measurement)
- Overlay stamp (project, date/time, location, chainage)
- On-device compression with quality floor
- EXIF preserved/stripped per context
- Duplicate detection by perceptual hash

**Test Cases:**
- Annotation layer separable from original
- Overlay stamp correct
- 12 MP photo compressed within ceiling while legible
- Perceptual hash catching re-used photo

---

### TOOL 9 — SCHEDULING / GANTT ENGINE

**Requirements:**
- Forward/backward pass with all four dependency types + lag
- Calendars (monsoon, holiday)
- Constraint dates
- Critical path with float
- Cycle detection reporting offending chain
- Baseline comparison
- Resource histogram and levelling
- Performance: 5,000-activity network < 2 seconds
- Import/export: MS Project XML, Primavera XER, CSV

---

### TOOL 10 — SEARCH & INDEXING ENGINE

**Requirements:**
- Fuzzy matching for Indian transliteration variance
- Authorization-aware at query time (row-level access)
- Type-ahead < 200 ms
- Faceted filtering (object type, project, date, status)
- Recent and favourite items
- Full-text over chat messages including voice transcripts
- Incremental indexing on commit with rebuild utility

**Test Cases:**
- User without project access never sees that project's records
- Transliteration variants matching
- Type-ahead latency under load

---

### TOOL 11 — BANK FILE GENERATOR

**Requirements:**
- Bank-specific formats as configuration templates
- Validation before generation (IFSC, account check digits, name length, character set)
- File total reconciled against approved proposal total
- Checksum recorded
- File marked exported and non-regenerable
- Reconciliation import of bank response file

**Test Cases:**
- Three different bank formats from configuration alone
- Total mismatch blocking export
- Regeneration attempt refused

---

### TOOL 12 — NOTIFICATION DISPATCHER

Per §A.7: Single service, all channels, preference resolution, digest/aggregation, delivery telemetry, retry with dead-letter.

---

### TOOL 13 — REPORT BUILDER

**Requirements:**
- Drag-and-drop field selection from semantic model
- Filters, grouping, sorting, totals, subtotals, computed columns
- Chart attachment
- Save as personal or shared
- Schedule to email or chat
- Runs against read replica (never transaction database)
- Row-level authorization applies exactly
- Query cost guard (refuse/queue unbounded query)

---

### TOOL 14 — DASHBOARD & KPI ENGINE

Per Part 10: KPI definition model (measure, dimension, filter, threshold, trend, drill path), tile rendering, refresh policy and caching.

---

### TOOL 15 — WORKFLOW / RELEASE STRATEGY BUILDER

**Requirements:**
- Configuration UI over Part 1 §7
- Characteristics, strategies, release codes, SLA, escalation, delegation
- Simulation mode showing strategy for hypothetical document
- Version-controlled and transportable between environments

---

### TOOL 16 — DUPLICATE DETECTION ENGINE

**Requirements:**
- Configurable rule sets per object
- Exact keys (PAN, GSTIN, invoice number)
- Normalised keys (uppercase, punctuation stripped, common-word removal)
- Fuzzy similarity (token-set ratio, phonetic matching for Indian names)
- Similarity score with configurable thresholds (warn vs block)
- Review queue for flagged pairs (merge/reject)
- Merge preserves audit histories and repoints references

**Test Cases:**
- "M/s Sharma Construction Co." vs "Sharma Constructions" flagged
- Same bank account across two PANs flagged at high severity
- Merge repointing all documents without loss

---

### TOOL 17 — AUDIT LOG VIEWER

**Requirements:**
- Searchable and filterable across all modules
- By object, user, date, field, action, reason
- Timeline view per object
- Export for auditors
- Read-only to everyone including administrators

---

### TOOL 18 — BACKUP, RESTORE & DATA GOVERNANCE

**Requirements:**
- Automated backups with configurable retention
- Point-in-time recovery
- Restore tested quarterly into clean environment
- Documented RPO and RTO
- Data masking in non-production environments
- Export-on-demand for regulatory request
- Retention and archival policy per document class

---

### TOOL 19 — TRANSLATION & LOCALISATION ENGINE

**Requirements:**
- Every user-facing string externalised (no hard-coded text)
- English and Hindi at minimum, architecture ready for more
- Site-facing screens translated first
- Bilingual statutory printouts
- Indian digit grouping as display preference
- DD-MM-YYYY dates, fiscal year presentation
- Layouts tested with longest translated strings (Hindi 30-40% longer)

---

### TOOL 20 — INTEGRATION FRAMEWORK

**Requirements:**
- Every external connector behind interface with mock implementation
- ERP works fully with every integration switched off
- Retry with exponential backoff
- Dead-letter queue
- Credential rotation
- Request/response logging with sensitive-field redaction
- Administrator health screen (last sync, current status)
- Graceful degradation to manual entry

**Connectors:**
- Accounting package sync (daily difference report)
- Tax portal services via authorised provider
- Bank statement and payment host-to-host
- Mapping and location services
- WhatsApp Business API bridge
- Electronic signature
- Telematics
- Weighbridge
- Biometric devices
- BI extraction

---

## PART 9 ACCEPTANCE GATE — 35 TESTS

### Part A — Communication Suite (Tests 1-15)

1. **Auto-created conversation on PO release** - Purchase order creates conversation on release, seeded with summary card and correct participants
2. **Automatic membership updates** - Project team membership updates automatically when person assigned/removed; removed person loses access but history intact
3. **Server sequence ordering** - Message ordering by server sequence number; two clients with skewed clocks display identical order
4. **Idempotent message send** - Retrying send with same client message ID creates exactly one message
5. **Offline message queue** - Message sent offline queues, survives app restart, delivers on reconnect with correct state progression
6. **Resumable video upload** - 6 MB video upload survives three simulated disconnections and resumes
7. **Voice note transcription** - Voice note records, transcribes in Hindi, transcript findable by search
8. **Photo annotation persistence** - Photo annotation (arrow, circle, text) persists with GPS and timestamp overlay
9. **Defect photo to NCR** - Converting defect photo to non-conformance carries photo, location, timestamp, creates two-way link
10. **Voice note to material request** - Converting voice note to material request pre-fills description from transcript
11. **Chat approval with re-auth** - Approval card approves through normal release strategy with re-authentication and full audit; payment approval card not offered
12. **DLP warning on external post** - Posting vendor rate into external conversation triggers data-loss prevention warning; override logged
13. **Legal hold disables deletion** - Deletion disabled in legal-hold conversation; deleted message elsewhere leaves tombstone and original retained in audit
14. **Conversation export as PDF** - Conversation exports as indexed, timestamped PDF with embedded media and hash; export action logged
15. **Notification digest and quiet hours** - Notification digest aggregates seven pending approvals into one message; quiet hours suppress non-critical; fatality alert overrides all preferences

### Part B — Tool Library (Tests 16-35)

16. **40-page bill abstract** - Bill abstract prints with repeating headers, correct subtotals and resolving QR code
17. **Bilingual Devanagari rendering** - Bilingual wage register renders Devanagari correctly
18. **Deterministic PDF hash** - Same document generated twice produces identical hash
19. **50,000-row streaming import** - 50,000-row material import streams without exceeding memory limit
20. **Messy BOQ Excel import** - Messy BOQ Excel imports through seven-stage pipeline with tree preview and reconciles to tender total
21. **Reversible import** - Committed import reversed cleanly by batch ID
22. **Creased QR label scan** - Creased printed QR label scans and resolves to correct object; offline scan queues and resolves later
23. **OCR with confidence scores** - OCR extracts invoice fields with confidence scores and never posts without confirmation; low-confidence field highlighted
24. **Formula engine security** - Formula engine rejects injection attempt, detects circular reference with chain, produces explain trace matching hand calculation
25. **UOM conversions** - All UOM test conversions from Part 2 §6 pass
26. **Geofence containment** - Geofence containment returns correctly for inside, outside, boundary and low-accuracy-indeterminate cases; 10,000 checks complete within latency budget
27. **Photo annotation and hashing** - Photo annotation is separable layer; overlay stamp correct; perceptual hashing catches re-used photo
28. **5,000-activity scheduling** - 5,000-activity network recomputes critical path in under two seconds; dependency cycle reported with chain
29. **Authorization-aware search** - Search by user without project access never returns that project's records in any object type including chat messages
30. **Transliteration and type-ahead** - Transliteration variants match in search; type-ahead responds under 200 ms at load
31. **Bank file configuration** - Three different bank file formats generate from configuration alone; total mismatch blocks export; regeneration refused
32. **Notification anti-fatigue** - Notification digest, aggregation, quiet hours and critical override all behave as specified; delivery telemetry reports open and act-upon rates
33. **Report builder security** - Report builder runs against read replica, enforces row-level authorization, refuses unbounded query
34. **Duplicate detection and merge** - Duplicate detection flags three §Tool 16 cases; merge repoints all references without loss and preserves both audit histories
35. **Backup and audit security** - Backup restored into clean environment and verified; non-production data masked; audit log viewer read-only to administrators

---

## SYSTEM STATUS

**Total Tests Specified: 307/400 (76.75%)**

| Part | Module | Tests | Status |
|------|--------|-------|--------|
| Part 1 | Platform Core | 40/40 | ✅ |
| Part 2 | Master Data | 30/30 | ✅ |
| Part 3 | Project System | 35/35 | ✅ |
| Part 4 | Procurement | 32/32 | ✅ |
| Part 5 | Inventory | 34/34 | ✅ |
| Part 6 | Contracts & Billing | 40/40 | ✅ |
| Part 7 | Finance & Compliance | 45/45 | ✅ |
| Part 8 | People, Plant, Production, Quality, Safety | 40/40 | ✅ |
| **Part 9** | **Communication & Tools** | **35/35** | **✅** |
| Part 10 | Launchpad, Mobile, Portals, AI | 0/93 | ⏳ |

---

## NEXT STEPS

**Part 10: Launchpad, Dashboards, Mobile, Portals, AI & Extensibility**
- Launchpad with role-based tiles
- Project control tower and 360 view
- Mobile application with offline sync
- Vendor, subcontractor, client portals
- AI assistant with guardrails
- Extensibility framework

**Expected: 93 tests**

The Part 9 specification provides a complete blueprint for enterprise communication, notification management, and 20 shared tools that eliminate duplication across all modules. All 35 acceptance tests are defined with clear pass/fail criteria and business rules.
