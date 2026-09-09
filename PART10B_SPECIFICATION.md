# Part 10B Specification — Mobile Application, Offline Sync Engine & External Portals

## Overview

Part 10B delivers the mobile-first experience for construction sites with offline-first architecture, plus three external portals for vendor, subcontractor, and client collaboration.

**Total Tests: 24**

---

## Module 1: Mobile Application

### 1.1 Operating Reality

**Design Constraints:**
- 40 km from nearest tower, 2G network with frequent drops
- Entry-level Android: 3GB RAM, cracked screen, 6% battery at 4 PM
- Direct sunlight, gloved/dusty hands, one hand holding measuring tape
- Storekeeper processes 12 receipts before lunch
- Labour supervisor marks 40-person gang from one phone
- Data costs money — 40 MB drawing sync is real expense

**Core Principle:** Offline is the operating condition, not a feature.

### 1.2 Mobile Scope

| Function | Offline | Notes |
|----------|---------|-------|
| Attendance punch (self/gang) | ✅ Yes | Queued, server-time authoritative |
| Daily progress report | ✅ Yes | Draft persisted, pre-filled from cache |
| Material request | ✅ Yes | Validated against cached stock, re-validated on sync |
| Goods receipt acknowledgement | ✅ Yes | Confirmation only, not posting |
| Material issue acknowledgement | ✅ Yes | |
| Measurement entry | ✅ Yes | Full formula support offline |
| Inspection checklist | ✅ Yes | |
| Safety observation/incident | ✅ Yes | Incident escalation fires on sync |
| Permit to work | ❌ No | Requires live precondition validation |
| Equipment log and fuel entry | ✅ Yes | Meter monotonicity checked on sync |
| Photograph capture and annotation | ✅ Yes | Upload deferred |
| Chat | ✅ Yes | Full queue and resumable media |
| Approvals | ❌ No | Offline approval is unverifiable |
| Payments, orders, journal entries | ❌ No | Desktop only |
| Drawings, BOQ, stock, master data | 📥 Read-only cached | Sync-down only |

### 1.3 Role-Based Home Screens

**Site Engineer:** `DPR · Measure · Material · Photo · Chat`
- Tiles: today's DPR status, my attendance, material requests open, inspections due, drawings revised this week

**Storekeeper:** `Receive · Issue · Scan · Count · Chat`
- Tiles: gate entries pending receipt, issues pending acknowledgement, below reorder, quality hold ageing

**Project Manager:** `Approvals · DPR · Project · Photo · Chat`
- Tiles: approvals pending, exceptions, today's DPRs across projects, open NCRs, safety observations

**Labour Supervisor:** `Attendance · Gang · Photo · Chat` (deliberately minimal)

**Plant Operator:** `Log · Fuel · Breakdown · Chat`

**Safety Officer:** `Observation · Permit · Toolbox · Incident · Chat`

### 1.4 Interaction Requirements

- Touch targets ≥ 44 px
- Primary action reachable one-handed in lower third
- Forms survive interruption (phone call mid-DPR loses nothing)
- Numeric keypads for quantity/amount fields
- Voice-to-text on every free-text field (including Hindi)
- Barcode/QR scanning with continuous multi-scan (10 bins without dismissing camera)
- Camera opens in one tap; annotation immediately after capture
- Low-bandwidth mode: images not auto-loaded, tables in compact card form, drawings on demand
- Dark mode and high-brightness mode
- Sunlight-readable high-contrast theme
- Battery-conscious GPS sampling (high accuracy only at punch/capture, never continuous)

---

## Module 2: Offline Sync Engine

### 2.1 The Eight Rules

**Rule 1: Client Identity**
- Every device-created record carries: `client_uuid`, `device_id`, `client_timestamp`, `app_version`
- Server clock is authoritative for sequencing and business dating
- Client timestamp stored for forensics
- Divergence beyond threshold is flagged

**Rule 2: Idempotency**
- `client_uuid` is the idempotency key
- Retried upload never creates second record
- Test: replay every queued item three times

**Rule 3: Append-Only Facts**
- Attendance punches, DPR entries, measurements, photographs, inspection records are facts
- Sync never overwrites them
- If conflict exists, both versions retained and exception raised

**Rule 4: No Last-Write-Wins for Value Data**
- For financial or quantity-bearing records, server refuses later conflicting record
- Creates reconciliation exception showing both versions side-by-side for human resolution
- Silent overwrite of quantity is unacceptable

**Rule 5: Master Data is Download-Only**
- Devices never create or modify masters offline
- Material not in cached master set cannot be requisitioned offline
- User requests creation → queues as request, not master

**Rule 6: Bounded Queue with Visible State**
- Seven days of retention
- Queue depth, last successful sync time, per-item status permanently visible in app header
- User must always know if work reached server

**Rule 7: No Offline Approvals**
- Approval requires live server round trip and re-authentication

**Rule 8: Deferred, Resumable Media**
- Photographs and voice notes queue separately from parent record
- Parent syncs first (so DPR exists), media attaches as it uploads
- UI shows two states: record synced, media uploading 3 of 7

### 2.2 Sync Protocol

**DOWNLOAD (delta, cursor-based)**
```
GET /sync/pull?since=<server_cursor>&scopes=<project,site,role>
→ { masters_delta[], documents_delta[], config_delta[],
    deletions[], new_cursor, full_resync_required: bool }
```
- Server may demand full resync (schema change, authorization change, cursor too old)
- App must handle without data loss from outbound queue

**UPLOAD (batched, ordered, idempotent)**
```
POST /sync/push
{ device_id, app_version, items: [ { client_uuid, entity, payload,
                                     client_timestamp, depends_on[] } ] }
→ per-item result: accepted | duplicate_ignored | rejected(reason) |
                   conflict(server_version, client_version)
```
- Items with dependencies upload in dependency order
- Failed parent blocks children and reports which

**MEDIA (separate, chunked, resumable)**
```
POST /sync/media/init  → upload_id, chunk_size
PUT  /sync/media/{upload_id}/chunk/{n}
POST /sync/media/{upload_id}/complete → attachment_id
```
- Resume from last acknowledged chunk after disconnection

### 2.3 Queue Item States

`queued → uploading → accepted` with branches to `rejected` and `conflict`

Every state visible per item with reason. `rejected` and `conflict` items appear in exception inbox with clear action: correct and retry, or discard with reason.

### 2.4 Conflict Matrix

| Entity | Conflict Scenario | Resolution |
|--------|------------------|------------|
| Attendance punch | Same person, same time, two devices | Both retained; duplicate flagged for HR |
| DPR | Two engineers submitted for same project/date/shift | Second rejected; opens first for editing |
| Measurement | Item already certified since capture | **Rejected** — must become deviation entry |
| Material request | Stock insufficient at sync time | Accepted as request but flagged unfulfillable; requester notified |
| Equipment log | Reading lower than log posted meanwhile | Rejected with conflicting log shown |
| Inspection result | Lot already closed | Rejected; raises review item |
| Safety observation | None possible | Always accepted (append-only) |
| Chat message | None possible | Always accepted, ordered by server sequence |

### 2.5 Cache Management

- **Scope-bounded download:** only user's projects, sites, roles
- **Tiered caching:**
  - Masters and configuration (small, always)
  - Open documents for my scope (medium, refreshed)
  - Drawings and historical documents (on demand only)
- Configurable per-media auto-download: never / unmetered only / always (default: unmetered-only for video and drawings)
- Cache size cap with least-recently-used eviction
- Visible storage usage screen
- **Encrypted local storage** — lost phone must not expose vendor rates, salary data, drawings
- Remote wipe on device deregistration

### 2.6 Security on Device

- Device registration and binding
- Biometric or PIN unlock
- Session expiry with silent refresh while online
- No sensitive data in logs or crash reports
- Screenshot restriction on salary and rate screens
- Certificate pinning
- Automatic logout and cache purge on repeated failed unlock

---

## Module 3: Mobile Performance Budget

| Metric | Target |
|--------|--------|
| Cold start to usable home | < 3 s on entry-level device |
| Attendance punch, tap to confirmation | < 2 s online, instant offline |
| DPR open with pre-filled data | < 2 s from cache |
| Photo capture to annotated and queued | < 3 s |
| App package size | < 40 MB |
| Daily data consumption, typical site user | < 15 MB excluding media |
| Battery: 8-hour shift with normal use | < 20% of 4,000 mAh battery |
| Cold-start memory | < 200 MB |

**Requirement:** Publish measured results against each target on actual entry-level device. Testing on flagship phone proves nothing.

---

## Module 4: External Portals

### 4.1 Architecture — Isolation is the Whole Point

```
Internal application  ──►  Internal API  ──►  Services  ──►  Database
                                                 ▲
Portal application    ──►  PORTAL API    ────────┘
   separate domain          separate auth realm
   separate session store   separate rate limits
   separate WAF rules       narrow, explicit endpoint allowlist
```

**Requirements:**
- Portal token structurally incapable of authenticating against internal endpoint (different issuer, different audience, validated separately)
- Portal API exposes explicit allowlist of endpoints (no generic pass-through)
- Every portal request resolves to business partner and scoped to that partner's records at query layer (not post-filtering)
- Separate rate limiting and abuse monitoring
- Penetration-test portal isolation specifically (Part 10D §Security)

### 4.2 Vendor Portal

- Own purchase orders with delivery schedules
- Acknowledge orders; propose delivery dates
- **Dispatch advice submission** with invoice, challan, e-way bill, vehicle details (arriving at gate before truck)
- Invoice upload with supporting documents; match status visible (matched / blocked with plain-language reason)
- **Payment status and expected payment date** (single question every vendor calls about)
- Tax deduction certificates and statements
- Compliance document upload with expiry reminders
- **Vendor scorecard** — own rating by criterion with underlying counts (visible performance data changes behavior more than any letter)
- Queries against specific document → paired ERP conversation

### 4.3 Subcontractor Portal

- Own work orders and BOQ
- Measurement submission with photographs
- Bill submission
- Recoveries and deductions itemised
- Payment status
- Compliance document upload — **payment-block reason visible** (know exactly what to fix)
- Labour deployment declaration
- Safety and quality records

### 4.4 Client / Consultant Portal

- Project progress dashboard scoped to their project
- DPR summaries and photographs
- **RA bills and measurement sheets for review with digital approve or query** (query reasons captured against certification-shortfall categories)
- Issued-for-construction drawings at current revision only
- Correspondence register
- Site instructions and observations routing into internal workflow
- Inspection request response with turnaround visible to both sides

### 4.5 Portal Experience Requirements

- Mobile-responsive (most vendors open on phone)
- **No training required** — vendor uses this four times a month; every screen self-explanatory with obvious primary action
- Onboarding: invitation email/SMS → set password → accept terms → guided first task
- Multi-language (English and Hindi minimum) — labour contractor's clerk may not read English
- Notification by preferred channel including messaging bridge
- **Never show internal data:** no internal comments, no other partners' data, no internal cost/margin figures, no internal user names beyond designated contact

---

## Part 10B Acceptance Gate — 24 Tests

### Mobile Foundation (Tests 1-7)

**Test 1: Six role home screens render with correct five bottom-navigation actions and tile strips**
- **Given:** User logs in with specific role
- **When:** Mobile app home screen loads
- **Then:** Correct 5 bottom-nav actions and tile strip for that role
- **Evidence:** Screenshots for all 6 roles showing correct actions

**Test 2: Every performance budget met on entry-level Android device**
- **Given:** Entry-level Android (3GB RAM, Android 10)
- **When:** Each performance metric measured
- **Then:** All 8 metrics meet targets in §3
- **Evidence:** Published measurement report with device specs

**Test 3: Phone call interrupting DPR entry loses no data**
- **Given:** User entering DPR, phone call comes in
- **When:** Call ends, user returns to DPR
- **Then:** All entered data preserved
- **Evidence:** DPR draft contains all pre-call data

**Test 4: Voice-to-text works on free-text fields in Hindi**
- **Given:** Hindi-speaking user on free-text field
- **When:** User speaks in Hindi
- **Then:** Text appears in field in Hindi
- **Evidence:** Video demonstration with Hindi speech → Hindi text

**Test 5: Continuous multi-scan captures 10 bin codes without dismissing camera**
- **Given:** Storekeeper with camera open
- **When:** Scans 10 bins in sequence
- **Then:** All 10 codes captured without camera dismissal
- **Evidence:** Video showing continuous scanning

**Test 6: Sunlight-readable high-contrast theme available and legible outdoors**
- **Given:** Direct sunlight conditions
- **When:** High-contrast theme enabled
- **Then:** All text and UI elements legible
- **Evidence:** Photos in direct sunlight showing legibility

**Test 7: GPS sampled only at capture moments, not polled continuously**
- **Given:** App running for 8 hours
- **When:** Battery profile analyzed
- **Then:** GPS usage < 20% of 4000 mAh battery
- **Evidence:** Battery usage report showing GPS consumption

### Offline Sync Engine (Tests 8-20)

**Test 8: Every queued item replayed 3 times creates exactly one record**
- **Given:** 10 items in queue
- **When:** Each item uploaded 3 times (simulating retries)
- **Then:** Exactly 10 records created on server
- **Evidence:** Server log showing 30 upload attempts, 10 records created

**Test 9: Queue depth, last sync time, per-item status visible in app header**
- **Given:** User has items in queue
- **When:** App header viewed
- **Then:** Queue depth, last sync time, per-item status visible
- **Evidence:** Screenshot showing header with all three elements

**Test 10: Record with dependent children uploads in dependency order; failed parent blocks children**
- **Given:** DPR with 5 measurement lines
- **When:** DPR upload fails
- **Then:** All 5 measurement lines blocked; error message names failed parent
- **Evidence:** Error log showing blocked children with parent reference

**Test 11: 6 MB video upload survives 3 disconnections and resumes**
- **Given:** 6 MB video queued for upload
- **When:** Network disconnects 3 times during upload
- **Then:** Upload completes from last acknowledged chunk
- **Evidence:** Upload log showing 3 resume points

**Test 12: Parent record syncs before media; UI shows distinct states**
- **Given:** DPR with 3 photos
- **When:** Syncing
- **Then:** DPR syncs first, then photos; UI shows "record synced" then "media uploading 1 of 3"
- **Evidence:** UI state transitions captured

**Test 13: Every row of conflict matrix behaves as specified**
- **Given:** Each conflict scenario from §2.4
- **When:** Conflict occurs
- **Then:** Resolution matches matrix specification
- **Evidence:** Test results for all 8 scenarios

**Test 14: Measurement captured offline, BOQ item certified in interim, is rejected**
- **Given:** Measurement captured offline
- **When:** BOQ item certified on server before sync
- **Then:** Measurement rejected; offered as deviation entry
- **Evidence:** Rejection message with deviation entry option

**Test 15: Server demands full resync; app completes without losing outbound queue**
- **Given:** 20 items in outbound queue
- **When:** Server demands full resync
- **Then:** All 20 items preserved and uploaded after resync
- **Evidence:** Queue before/after showing preservation

**Test 16: Master data cannot be created offline; "request new material" queues request**
- **Given:** User needs material not in cache
- **When:** User taps "request new material"
- **Then:** Request queued (not master created)
- **Evidence:** Queue showing request item, not master

**Test 17: Approval unavailable offline with clear explanation**
- **Given:** User offline with pending approval
- **When:** User attempts to approve
- **Then:** Approval blocked; message explains why
- **Evidence:** Error message explaining offline limitation

**Test 18: Cache scope-bounded; user on Package 3 has no Package 5 data**
- **Given:** User assigned to Package 3
- **When:** Local storage inspected
- **Then:** No Package 5 data present
- **Evidence:** Storage inspection showing no Package 5 records

**Test 19: Local storage encrypted; failed unlock purges cache; device deregistration wipes remotely**
- **Given:** Device with encrypted storage
- **When:** 5 failed unlock attempts
- **Then:** Cache purged; device deregistration triggers remote wipe
- **Evidence:** Security log showing purge and wipe events

**Test 20: Daily data consumption stays under budget over simulated working week**
- **Given:** Typical site user scenario
- **When:** 5-day working week simulated
- **Then:** Total data < 75 MB (15 MB/day × 5 days)
- **Evidence:** Data usage report showing weekly total

### Portals (Tests 21-24)

**Test 21: Portal token rejected by internal endpoints; ID enumeration returns 404**
- **Given:** Portal token
- **When:** Attempting to access internal endpoint
- **Then:** Token rejected; attempting to access another partner's document returns 404 (not 403)
- **Evidence:** API responses showing rejection and 404

**Test 22: Vendor portal shows order, dispatch advice, invoice match status, payment status, scorecard**
- **Given:** Vendor logged into portal
- **When:** Navigating portal
- **Then:** All 5 elements visible with correct data
- **Evidence:** Portal screenshots showing each element

**Test 23: Subcontractor portal displays payment-block reason and required compliance document**
- **Given:** Subcontractor with payment blocked
- **When:** Viewing payment status
- **Then:** Block reason and required document visible
- **Evidence:** Portal showing reason and document requirement

**Test 24: Client portal shows only IFC drawings at current revision; bill query captures certification-shortfall reason**
- **Given:** Client logged into portal
- **When:** Viewing drawings and querying bill
- **Then:** Only IFC drawings at current revision shown; query captures shortfall reason
- **Evidence:** Portal showing correct drawings and query form

---

## Key Business Rules Enforced

1. **Offline-first architecture** — offline is operating condition, not feature
2. **Eight sync rules** — client identity, idempotency, append-only, no last-write-wins, download-only masters, visible queue, no offline approvals, deferred media
3. **Conflict matrix** — explicit resolution for each conflict type
4. **Scope-bounded cache** — user sees only their data
5. **Encrypted local storage** — lost device protection
6. **Portal isolation** — separate auth, separate endpoints, query-layer scoping
7. **No internal data in portals** — strict data isolation
8. **Performance budgets** — entry-level device targets
9. **Battery-conscious GPS** — no continuous polling
10. **Continuous multi-scan** — 10 bins without camera dismissal

---

## Integration Points

- **Part 1** — Posting engine (approvals require live server)
- **Part 9** — Communication (chat queue and resumable media)
- **Part 10A** — Design tokens and component library

---

## System Status

**Part 10B: 24 tests specified**
**Total across Parts 1-10B: 351 tests**

Ready to proceed to Part 10C: Tender & Bid Management, Analytics, Semantic Layer, AI & Extensibility.
