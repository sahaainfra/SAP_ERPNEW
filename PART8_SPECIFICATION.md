# Part 8 Specification — People, Plant, Production, Quality & Safety

## Overview

Part 8 covers five operational modules that manage the physical execution of construction projects:
- **HCM** (Human Capital Management) - People and attendance
- **EAM** (Enterprise Asset Management) - Plant and machinery  
- **PRD** (Production) - Ready-mix concrete and precast
- **QMS** (Quality Management) - Quality control and testing
- **EHS** (Environment, Health & Safety) - Safety management

**Total Tests: 40**

---

## Module HCM — Human Capital Management

### 1. Organisational Structure

```
PERSONNEL AREA (company code + region)
 └── PERSONNEL SUBAREA (project site | head office | workshop | plant | camp)
      └── EMPLOYEE GROUP (permanent | contractual | retainer | trainee | labour)
           └── EMPLOYEE SUBGROUP
               (management | staff | supervisor | operator |
                skilled | semi-skilled | unskilled)
```

Group and subgroup drive payroll rules, leave entitlement, statutory applicability, permissible wage types and default work schedule.

### 2. Employee Lifecycle

**Workflow stages:**
- Requisition to hire → sourcing → interview → offer → acceptance
- Onboarding checklist (documents, statutory enrolments, safety induction, IT access, PPE, medical, bank)
- Probation → confirmation → transfer → promotion → salary revision
- Leave → disciplinary → resignation/termination
- Exit checklist (clearance from stores, IT, finance, project)
- Full and final settlement → experience letter

### 3. Competency Register with Interlocks

| Certification | Interlock |
|---|---|
| Operator/driver licence per equipment class | Expired → **blocks equipment assignment** (EAM) |
| Welder qualification per process and position | Expired → **blocks assignment to inspection-critical joints** (QMS) |
| Safety certification (height, confined space, electrical) | Expired → **blocks permit-to-work issue** (EHS) |
| First aid | Flags site manning compliance |
| Statutory competency (lift supervisor, scaffolding inspector) | Blocks the corresponding sign-off |

**Renewal alerts:** 90/60/30/15 days to holder, manager and HR.

### 4. Geo-Attendance

#### 4.1 Punch Record (AT-PCH)
```
employee / labour · punch type (in | out | break start | break end)
server_timestamp (AUTHORITATIVE) · client_timestamp · clock_skew
latitude · longitude · accuracy_metres · altitude
geofence matched (id) · distance from boundary
selfie image / face match score · liveness score (if enabled)
device_id · device_model · os_version · app_version
network state (online | offline captured) · sync timestamp
battery saver active · mock location detected · developer mode detected
shift · work front · gang (for labour)
```

#### 4.2 Anti-Fraud Checks (All Mandatory)

| Check | Action on Failure |
|---|---|
| Mock location / developer mode | **Reject** punch, raise high-severity exception |
| GPS accuracy worse than threshold | Flag, route for manager verification |
| Device binding (one person ↔ one registered device) | Reject unregistered device |
| Duplicate punch within window | Reject second punch |
| Impossible travel between consecutive punches | Flag both punches, notify HR |
| Clock skew beyond tolerance | Flag; server time governs |
| Face match below threshold | Flag for manual verification |
| Punch outside shift window | Flag as exception |
| Missing checkout | Auto-flag at end of day, notify employee and manager |

#### 4.3 Append-Only Principle
**Attendance records are append-only facts.** A correction (AT-COR) never overwrites a punch; it creates a linked correction record with reason code, approved by Project Manager and then HR. The original remains visible permanently.

#### 4.4 Labour Attendance Realities
- **Gang supervisor marking** — supervisor marks gang from one device with group photograph
- **Face recognition kiosk / tablet** at gate with liveness detection
- **Biometric device integration** where installed
- **Manual muster fallback** with dual sign-off, restricted to configured sites

#### 4.5 Attendance Outputs
- Daily attendance register per project and gang
- Exception dashboard
- Overtime computation with statutory multiplier
- Shift and roster management
- **Feeds DPR manpower block automatically** (Part 3 §5)
- Feeds payroll
- Feeds safe man-hours for safety statistics

### 5. Labour Management

- Labour master with gang structure and trade
- **Daily labour report:** `opening + joined − exited = closing`, by trade, agency and work front
- **Productivity measurement:** output quantity per gang per day vs WBS activity vs norm
- **Wage computation:** attendance × rate + overtime − advances − deductions, checked against minimum wage
- **Disbursement:** wage register, wage slip generation, direct bank/wallet transfer
- **Labour grievance channel** for wage discrepancies

### 6. Payroll

- **Wage type catalogue:** earnings, deductions, employer contributions, reimbursements, arrears, one-time payments
- Salary structure per employee group with revision history
- **Retroactive calculation** — salary revision effective from past month recomputes arrears
- **Simulation run before live run** with comparison against previous month
- Statutory computation per Part 7 §CMP.3
- **Payroll posts through Part 1 posting engine with full cost-object assignment**
- Loans and advances with instalment recovery; leave encashment; gratuity provision; bonus computation
- Payslip delivery through communication layer with password-protected PDF

---

## Module EAM — Plant, Machinery & Maintenance

### 7. Technical Structure

Equipment master with parent/child assemblies and **functional locations** for fixed installations (batching plant, crusher, DG set, tower crane).

### 8. Daily Log (EQ-LOG)

```
date · shift · equipment · operator · project · WBS
opening hour meter / odometer · closing reading
working hours · idle hours · breakdown hours · standby hours
fuel issued (litres, linked to stores issue) · lubricants
work performed · quantity achieved (where measurable)
remarks · photographs of meter reading
```

**Validations:**
- Hour meter and odometer are **monotonically increasing**
- `working + idle + breakdown + standby ≤ 24 hours`
- **Fuel efficiency** computed against norm; deviation raises **fuel exception**
- Cumulative fuel issued must reconcile to stores issues
- Telematics feed flags divergence from manual entry

### 9. Maintenance

- **Preventive plans** by running hours, kilometres or calendar — whichever falls first
- **Breakdown maintenance (MO-BRK):** report → diagnosis → order → spares issued (movement 210) → external service → completion → downtime → root cause
- Maintenance order is a **cost object**: labour, spares, services collect and settle to equipment cost centre, then to consuming project
- **Downtime analysis:** MTBF, MTTR, availability %, downtime cost, repeat-failure identification
- Spare parts planning from failure history

### 10. Deployment & Internal Hire

- Allocation to project for period; transfer document with approval
- **Internal hire posting:** productive hours × internal hire rate posts `Dr Project plant cost (WBS) / Cr Equipment cost centre`
- **Blocking interlocks:** equipment with expired documents cannot be allocated; operator with expired licence cannot be assigned

### 11. Fleet & Trip Management

Trip sheet (FL-TRP): vehicle, driver, date, origin, destination, material, load quantity, odometer, fuel, toll, trip cost, project, transport document reference.

### 12. Plant Dashboard

Fleet status · utilisation % · cost per hour trend · fuel efficiency trend · document expiry calendar · maintenance due list · downtime ranking · hired vs owned cost comparison · idle equipment available for redeployment.

---

## Module PRD — Production (Ready-Mix & Precast)

### 13. Mix Design & Production

- **Mix design master:** grade, proportions per cubic metre, target slump, water-cement ratio, trial mix results
- **Moisture correction:** daily aggregate moisture readings adjust batch water and aggregate weights
- **Production flow:**
  ```
  Sales order → pour plan → batch ticket (BT-TKT) → production receipt (140)
  → raw material consumed (215) → dispatch (600) → transit mixer → delivery challan
  → site receipt → slump test → cube casting → 7/28-day results → invoice
  ```
- **Weighbridge integration** for raw material inward and dispatch
- **Returned and rejected concrete** tracked with reason and cost impact

### 14. Production Reconciliation

Per grade, per day, per month:
```
Theoretical raw material = mix design proportions × volume produced (moisture-corrected)
Actual consumption = from stores issues
Variance and variance % per material
Wastage % · returned concrete · rejected concrete
```

**Cost per cubic metre:** raw material + power + labour + plant depreciation + transport vs transfer/sale price with grade-wise margin.

### 15. Production Dashboard

Today's production and dispatch · pending orders · vehicle status · plant utilisation · grade-wise production · customer-wise sales · wastage % · cube pass rate · raw material stock cover.

---

## Module QMS — Quality Management

### 16. Quality Planning

- **Inspection and test plan** per activity and specification with hold/witness/review points
- **Material inspection plan** linked to material Quality view
- **Checklist builder** configurable by QA/QC Manager
- Approved makes register · material approval requests · method statements · mix design approvals

### 17. Inspection Lots

Generated automatically by event:

| Trigger | Lot Type | Effect |
|---|---|---|
| Receipt of inspection-flagged material | IL-GRN | Stock held in quality hold |
| Work inspection request from site | IL-WRK | Activity cannot pass hold point |
| Production batch | IL-PRD | Dispatch blocked until slump clears |
| Periodic source inspection | IL-SRC | Feeds vendor rating |

**Usage decision:** accept · accept with deviation · reject · rework. **Only usage decision releases stock from quality hold.**

### 18. Testing

- Cube tests with automatic 7/14/28-day due dates
- Soil (proctor, CBR, field density)
- Aggregate (gradation, impact, abrasion, water absorption, flakiness)
- Bitumen and mix design
- Steel (tensile, bend, sectional weight)
- Welding NDT · pile integrity

**Interlocks:**
- Failed 28-day cube result **automatically raises NCR** linked to pour, batch, challan, measurement
- Test equipment with expired calibration **cannot record result**
- Welder without valid qualification **cannot be assigned** to inspection-critical joint
- Measurement for quantity with failed/pending test **blocked from billing**

### 19. Non-Conformance (NC-STD)

```
RAISED → ASSIGNED → ROOT CAUSE → CORRECTIVE ACTION →
PREVENTIVE ACTION → VERIFICATION → CLOSED
```

Severity classification · cost of rectification captured · ageing and escalation on SLA breach · repeat-cause analysis · linkage to vendor/subcontractor performance.

### 20. Quality Analytics

First-pass yield · rejection % by vendor and material · cube pass rate by grade/plant/month · NCR ageing and recurrence · **cost of poor quality by project** · inspection request turnaround · calibration due list.

---

## Module EHS — Environment, Health & Safety

### 21. Safety Operations

- Induction register (no site access without induction)
- PPE issue register linked to returnable stores issue
- Toolbox talks with attendance capture · training with validity
- **Permit to work:** height, confined space, hot work, excavation, electrical, lifting, road closure, night work
  - Issuer, receiver, validity window, precondition checklist, gas testing, risk assessment, closure
  - **Permit cannot be issued to person with expired safety certification**
- **Observation → near miss → first aid → medical treatment → lost time injury → fatality**
  - Investigation, root cause (5-why/fishbone), corrective/preventive action, verification, closure
  - Severity-based escalation; fatality escalates to management immediately
- Emergency preparedness: drill records, assembly point capacity, first-aider roster, ambulance/hospital tie-up

### 22. Safety Statistics (Computed, Never Typed)

```
Man-hours worked = from attendance
Lost time injury frequency = LTI × 1,000,000 ÷ man-hours
Severity rate = days lost × 1,000,000 ÷ man-hours
Safe man-hours since last LTI
Near-miss reporting rate (LOW rate is warning, not success)
Toolbox talk coverage % · PPE compliance % · permit closure %
```

### 23. Environment

- Waste register with disposal manifests (CD waste, hazardous waste, used oil)
- Water consumption and recycling (especially batching plants)
- Fuel and electricity consumption feeding emissions estimate
- Noise and dust monitoring against consent conditions
- Tree cutting and compensatory plantation records

---

## Part 8 Acceptance Gate — 40 Tests

### HCM Lifecycle and Competency (Tests 1-5)

**Test 1: Employee group and subgroup drive different payroll rules and leave entitlements from configuration alone**
- **Given:** Employee groups PERMANENT, CONTRACTUAL, LABOUR with different subgroups
- **When:** Payroll rules are configured per group/subgroup combination
- **Then:** Each employee receives correct payroll treatment based solely on their group/subgroup
- **Evidence:** Configuration tables show distinct rules; no code branching by group

**Test 2: Onboarding checklist blocks activation until every mandatory item is complete**
- **Given:** New employee with incomplete onboarding checklist
- **When:** System attempts to activate employee
- **Then:** Activation blocked with list of incomplete items
- **Evidence:** Employee status remains ONBOARDING until all mandatory items checked

**Test 3: Expired operator licence blocks equipment assignment; expired welder qualification blocks critical-joint assignment; expired safety certification blocks permit issue**
- **Given:** Operator with expired licence, welder with expired qualification, worker with expired safety cert
- **When:** System attempts to assign equipment/joint/permit
- **Then:** All three assignments blocked with specific expiry messages
- **Evidence:** Competency interlocks enforced at assignment points

**Test 4: Certification renewal alerts fire at 90/60/30/15 days to holder, manager and HR**
- **Given:** Certification expiring in 45 days
- **When:** Daily alert job runs
- **Then:** Notifications sent to holder, manager, HR at 90/60/30/15 day thresholds
- **Evidence:** Notification log shows alerts at correct intervals to all three parties

**Test 5: Org chart answers "who did this person report to on a past date"**
- **Given:** Employee with manager changes on 2024-03-01 and 2024-07-01
- **When:** Query asks "who did employee X report to on 2024-05-15?"
- **Then:** Returns manager who was effective on that date
- **Evidence:** Effective-dated org structure with point-in-time query

### Geo-Attendance (Tests 6-17)

**Test 6: Mock location or developer mode punch is rejected and raises high-severity exception**
- **Given:** Punch attempt with mock location detected
- **When:** Punch submitted
- **Then:** Punch rejected, high-severity exception raised, HR notified
- **Evidence:** Punch status REJECTED, exception log entry, notification sent

**Test 7: GPS accuracy worse than threshold is flagged for verification, never accepted silently**
- **Given:** Punch with GPS accuracy 50m (threshold 20m)
- **When:** Punch submitted
- **Then:** Punch flagged, routed to manager for verification
- **Evidence:** Punch status FLAGGED, manager verification queue updated

**Test 8: Unregistered device punch is rejected; device change requires approval**
- **Given:** Punch from unregistered device
- **When:** Punch submitted
- **Then:** Punch rejected with device registration message
- **Evidence:** Punch rejected, device registration workflow initiated

**Test 9: Duplicate punch within window is rejected**
- **Given:** Two IN punches within 5 minutes
- **When:** Second punch submitted
- **Then:** Second punch rejected as duplicate
- **Evidence:** First punch accepted, second rejected with duplicate message

**Test 10: Impossible travel between consecutive punches flags both and notifies HR**
- **Given:** Punch at Site A, then punch at Site B 100km away 10 minutes later
- **When:** Second punch submitted
- **Then:** Both punches flagged, HR notified of impossible travel
- **Evidence:** Both punches FLAGGED, HR exception notification sent

**Test 11: Punch on polygon geofence boundary resolves correctly; punch 5m outside is flagged**
- **Given:** Polygon geofence for site
- **When:** Punch at boundary and 5m outside
- **Then:** Boundary punch accepted, outside punch flagged
- **Evidence:** Geofence containment algorithm with tolerance handling

**Test 12: Correction never overwrites original punch; both remain visible with correction reason and approvals**
- **Given:** Valid punch requiring correction
- **When:** Correction submitted with PM and HR approval
- **Then:** Original punch preserved, correction record created with link to original
- **Evidence:** Both records visible in attendance history with correction metadata

**Test 13: Gang supervisor marking creates individual punch rows for each labourer referencing supervisor**
- **Given:** Supervisor marking 10 labourers
- **When:** Gang marking submitted
- **Then:** 10 individual punch records created, each referencing supervisor
- **Evidence:** Individual punch records with supervisor reference and group photo

**Test 14: Face match below threshold routes for manual verification with captured image**
- **Given:** Punch with face match score 0.6 (threshold 0.8)
- **When:** Punch submitted
- **Then:** Punch flagged, image attached for manual verification
- **Evidence:** Punch flagged, verification queue with image

**Test 15: Offline punch syncs without duplication; server time governs sequencing**
- **Given:** Punch captured offline at 09:00 client time
- **When:** Device reconnects and syncs
- **Then:** Punch synced once with server timestamp, no duplicates
- **Evidence:** Single punch record with server timestamp, client timestamp preserved

**Test 16: Missing checkout auto-flags at end of day with notification**
- **Given:** Employee with IN punch but no OUT punch
- **When:** End-of-day job runs
- **Then:** Missing checkout flagged, employee and manager notified
- **Evidence:** Exception record created, notifications sent

**Test 17: Attendance feeds DPR manpower block automatically**
- **Given:** 50 employees punched IN at site
- **When:** DPR opened for that date
- **Then:** Manpower block pre-filled with 50, breakdown by trade/agency
- **Evidence:** DPR manpower section auto-populated from attendance

### Labour and Payroll (Tests 18-24)

**Test 18: Daily labour report reconciles to attendance; DPR/attendance discrepancy is flagged, not averaged**
- **Given:** Attendance shows 50, DPR shows 48
- **When:** Daily labour report generated
- **Then:** Discrepancy flagged with 2-person difference
- **Evidence:** Discrepancy report with specific variance

**Test 19: Gang productivity compares against rate-analysis norm for activity**
- **Given:** Gang achieved 100m³ excavation, norm is 120m³
- **When:** Productivity report generated
- **Then:** Shows 83.3% of norm
- **Evidence:** Productivity report with actual vs norm comparison

**Test 20: Wage below notified state minimum for skill category cannot be saved**
- **Given:** Skilled labour minimum wage ₹800/day
- **When:** Payroll attempts to save ₹750/day
- **Then:** Save blocked with minimum wage violation message
- **Evidence:** Validation error, payroll entry not saved

**Test 21: Payroll simulation lists every employee whose net changed beyond threshold with reason**
- **Given:** Salary revision effective from last month
- **When:** Payroll simulation run
- **Then:** List shows employees with >5% change and reason (arrears, revision, etc.)
- **Evidence:** Simulation report with change details

**Test 22: Retroactive salary revision computes and posts arrears correctly**
- **Given:** Revision of ₹5000/month effective 3 months ago
- **When:** Revision processed
- **Then:** Arrears of ₹15000 computed and posted
- **Evidence:** Arrears journal entry with correct amount and period

**Test 23: Payroll posts with full cost-object assignment — site payroll lands on correct WBS, not head office**
- **Given:** Site payroll with 50 employees across 3 WBS elements
- **When:** Payroll posted
- **Then:** Journal entries split by WBS with correct amounts
- **Evidence:** Journal lines with WBS dimension, not lumped at HO

**Test 24: Wage slips deliver through communication layer as password-protected PDFs**
- **Given:** Payroll posted for 100 employees
- **When:** Wage slip generation triggered
- **Then:** 100 password-protected PDFs delivered via communication layer
- **Evidence:** Communication log with PDF attachments, password policy applied

### Plant and Maintenance (Tests 25-33)

**Test 25: Hour meter reading lower than previous log is refused; meter replacement with approval sets new baseline**
- **Given:** Last log shows HM 5000
- **When:** New log attempts HM 4900
- **Then:** Log refused; meter replacement workflow initiated with approval
- **Evidence:** Log rejected, replacement document with approval chain

**Test 26: Total hours exceeding 24 in a day is refused**
- **Given:** Log with working 10 + idle 8 + breakdown 4 + standby 3 = 25 hours
- **When:** Log submitted
- **Then:** Log refused with total hours violation
- **Evidence:** Validation error, log not saved

**Test 27: Fuel consumption beyond norm raises exception naming machine, operator and date**
- **Given:** Equipment norm 10 L/hr, actual 15 L/hr
- **When:** Log with fuel consumption posted
- **Then:** Fuel exception raised with equipment, operator, date
- **Evidence:** Exception record with specific details

**Test 28: Fuel logged against equipment reconciles to stores issues; break is reported**
- **Given:** Equipment logs show 500L fuel, stores issues show 450L
- **When:** Reconciliation job runs
- **Then:** 50L break reported
- **Evidence:** Reconciliation report with variance

**Test 29: Telematics divergence from manual entry is flagged, not silently overwritten**
- **Given:** Telematics shows HM 5100, manual entry shows HM 5050
- **When:** Both entries exist
- **Then:** Divergence flagged for review
- **Evidence:** Divergence report, both entries preserved

**Test 30: Equipment with expired insurance cannot be allocated; expired-licence operator cannot be assigned**
- **Given:** Equipment with expired insurance, operator with expired licence
- **When:** Allocation/assignment attempted
- **Then:** Both blocked with specific expiry messages
- **Evidence:** Interlock enforcement at allocation points

**Test 31: Preventive maintenance order generates automatically at hour/km/date threshold, whichever falls first**
- **Given:** PM scheduled at 500 hrs OR 10000 km OR 2024-12-31
- **When:** Equipment reaches 500 hrs on 2024-06-15
- **Then:** PM order auto-generated
- **Evidence:** PM order created with correct trigger

**Test 32: Spares issued to maintenance order settle to equipment cost centre and then to consuming project**
- **Given:** Spares issued to MO for equipment at Project X
- **When:** MO completed and settled
- **Then:** Cost settles to equipment CC, then to Project X WBS
- **Evidence:** Settlement journal with correct cost object chain

**Test 33: Internal hire posts to project cost and equipment cost centre; fleet over/under recovery report reconciles**
- **Given:** Equipment deployed to project at internal hire rate ₹1000/hr
- **When:** 100 productive hours logged
- **Then:** ₹100000 posted to project, equipment CC credited; recovery report shows actual vs recovered
- **Evidence:** Journal entries and recovery report

### Production (Tests 34-37)

**Test 34: Moisture correction adjusts batch water and aggregate weights; corrected figures flow into reconciliation**
- **Given:** Sand moisture 5%, aggregate moisture 2%
- **When:** Batch ticket created
- **Then:** Water reduced, aggregates increased; reconciliation uses corrected figures
- **Evidence:** Batch ticket with corrections, reconciliation report

**Test 35: Production reconciliation flags cement variance beyond threshold, per grade**
- **Given:** M25 design requires 350kg cement/m³, actual 380kg/m³
- **When:** Reconciliation run for M25
- **Then:** 8.6% variance flagged
- **Evidence:** Reconciliation report with variance by grade

**Test 36: Dispatch is blocked until slump test clears**
- **Given:** Batch ticket created, slump test pending
- **When:** Dispatch attempted
- **Then:** Dispatch blocked until slump test recorded
- **Evidence:** Dispatch blocked, dispatch enabled after slump test

**Test 37: Cost per cubic metre computes and compares against transfer/sale price with grade-wise margin**
- **Given:** M25 cost ₹5500/m³, transfer price ₹6000/m³
- **When:** Cost analysis run
- **Then:** Shows ₹500/m³ margin for M25
- **Evidence:** Cost analysis report with grade-wise margin

### Quality and Safety (Tests 38-40)

**Test 38: Usage decision is only route out of quality hold; calibration expiry blocks test entry**
- **Given:** Material in quality hold, test equipment with expired calibration
- **When:** Usage decision attempted, test entry attempted
- **Then:** Usage decision releases material; test entry blocked
- **Evidence:** Material released, test entry blocked with calibration message

**Test 39: Failed 28-day cube automatically raises NCR linked to pour, batch, challan and measurement — and blocks that quantity from further billing until resolved**
- **Given:** 28-day cube test fails
- **When:** Test result recorded
- **Then:** NCR auto-created with links; billing blocked for that quantity
- **Evidence:** NCR created with traceability, billing block active

**Test 40: Safety statistics compute from attendance man-hours; permit cannot be issued to person with expired certification; fatality escalates to management immediately**
- **Given:** Attendance data, expired safety cert, fatality incident
- **When:** Statistics computed, permit attempted, fatality recorded
- **Then:** Statistics computed correctly; permit blocked; management notified immediately
- **Evidence:** Statistics report, permit blocked, management notification

---

## Key Business Rules Enforced

1. **Competency interlocks** — expired certifications block assignments
2. **Append-only attendance** — corrections create new records, never overwrite
3. **Anti-fraud checks** — 9 mandatory checks on every punch
4. **Monotonically increasing meters** — lower readings refused
5. **Fuel efficiency tracking** — deviations raise exceptions
6. **Preventive maintenance triggers** — hour/km/calendar, whichever first
7. **Internal hire posting** — project cost and equipment CC
8. **Moisture correction** — adjusts batch weights for reconciliation
9. **Usage decision only** — only route out of quality hold
10. **Auto-NCR on failed test** — with full traceability
11. **Safety statistics computed** — never typed
12. **Permit certification check** — expired cert blocks permit
13. **Fatality immediate escalation** — management notified instantly

---

## Integration Points

- **Part 1** — Posting engine for payroll, internal hire, maintenance settlement
- **Part 2** — Master data for employees, equipment, materials
- **Part 3** — WBS for cost object assignment, DPR for manpower
- **Part 5** — Stores for fuel, spares, materials
- **Part 6** — Measurement for quality interlocks, billing blocks
- **Part 7** — Statutory compliance for payroll, PF/ESI
- **Part 9** — Communication for notifications, wage slips

---

## System Status

**Part 8: 40 tests specified**
**Total across Parts 1-8: 272 tests**

Ready to proceed to Part 9: Communication Suite & Shared Tool Library.
