# PART 10D — ROLES, APPROVAL MATRIX, SECURITY, MIGRATION, CUTOVER & FINAL ACCEPTANCE

**Status: ✅ Complete specification**

---

## SECTION A — ROLE CATALOG

### A.1 Complete Role Definitions (34 roles)

#### Management & Administration (Roles 1-2)

**Role 1: System Administrator**
- **Core responsibility:** Enterprise structure, roles, authorizations, numbering, document types, workflows, geofences, tax and compliance configuration
- **Principal authorization objects:**
  - `PLT_CONFIG` — Platform configuration
  - `ORG_STRUCT` — Organizational structure
  - `PLT_AUTH` — Authorization configuration
  - `HCM_GEOFENCE` — Geofence management
- **Critical rule:** Acts through the same audit trail as everyone — no special privileges

**Role 2: Management / Director**
- **Core responsibility:** Executive launchpad, control tower, company-wide financials, final release above thresholds, budget and bid approval
- **Principal authorization objects:**
  - All display objects (`*_DISPLAY`)
  - `*_RELEASE` at top band (highest approval thresholds)
- **Key capabilities:**
  - View all dashboards and control towers
  - Final approval for high-value transactions
  - Budget approval
  - Bid go/no-go decisions

#### Finance (Roles 3-6)

**Role 3: Finance Controller**
- **Core responsibility:** Chart of accounts, financial policy, period close, statement sign-off, high-value journal release, tax oversight
- **Principal authorization objects:**
  - `FIN_DOC` (all activities) — Financial documents
  - `FIN_PERIOD` — Period management
  - `FIN_COA` — Chart of accounts
  - `CTL_*` — All controlling objects
- **Key capabilities:**
  - Period close and reopen
  - Financial statement sign-off
  - High-value journal approval
  - Tax compliance oversight

**Role 4: Finance Manager**
- **Core responsibility:** Cash flow, banking, guarantee margins, loan schedules, payment proposal review, ageing
- **Principal authorization objects:**
  - `FIN_BANK` — Bank management
  - `FIN_PAY` (release ≤ threshold F) — Payment release
  - `CMP_INSTRUMENT` — Financial instruments
- **Key capabilities:**
  - Payment proposal approval
  - Bank reconciliation
  - Guarantee and instrument management
  - Cash flow management

**Role 5: Accounts Manager**
- **Core responsibility:** Bookkeeping supervision, match exceptions, tax return data, asset register, bank reconciliation
- **Principal authorization objects:**
  - `FIN_DOC` (activities 02, 43) — Document change and release
  - `FIN_ASSET` — Asset management
  - `FIN_RECON` — Reconciliation
- **Key capabilities:**
  - Invoice match exception handling
  - Asset register maintenance
  - Bank reconciliation execution
  - Tax return preparation

**Role 6: Accounts Executive**
- **Core responsibility:** Voucher entry, routine invoice verification, cash and petty cash
- **Principal authorization objects:**
  - `FIN_DOC` (activities 01, 02) — Document create and change
  - **No release authority**
- **Key capabilities:**
  - Journal voucher creation
  - Invoice verification
  - Cash and petty cash management

#### Procurement (Roles 7-8)

**Role 7: Procurement Manager**
- **Core responsibility:** Sourcing policy, vendor empanelment, order release within limit, vendor evaluation, rate contracts
- **Principal authorization objects:**
  - `PRC_PO` (activities 43, limit) — PO release with value limit
  - `PRC_VENDOR` — Vendor management
  - `PRC_CONTRACT` — Contract management
- **Key capabilities:**
  - Purchase order approval (within limit)
  - Vendor evaluation and empanelment
  - Rate contract management
  - Sourcing policy

**Role 8: Purchase Officer**
- **Core responsibility:** RFQ, quotation comparison, order creation within limit, delivery follow-up
- **Principal authorization objects:**
  - `PRC_PR` — Purchase requisition
  - `PRC_RFQ` — RFQ management
  - `PRC_PO` (activities 01, 02, limit) — PO create, change with limit
- **Key capabilities:**
  - RFQ creation and management
  - Quotation comparison
  - Purchase order creation (within limit)
  - Delivery follow-up

#### Inventory (Roles 9-10)

**Role 9: Store Manager**
- **Core responsibility:** Stock accuracy, adjustment approval within limit, physical inventory sign-off, reorder discipline
- **Principal authorization objects:**
  - `INV_MOVE` (activity 43) — Movement release
  - `INV_COUNT` — Physical inventory
- **Key capabilities:**
  - Stock adjustment approval (within limit)
  - Physical inventory sign-off
  - Reorder level management
  - Stock accuracy oversight

**Role 10: Store Keeper**
- **Core responsibility:** Gate entry, goods receipt, issue, returns, bin management, counting
- **Principal authorization objects:**
  - `INV_MOVE` (activities 01, 02) — Movement create and change
  - Scoped to site
- **Key capabilities:**
  - Gate entry management
  - Goods receipt execution
  - Material issue execution
  - Bin management
  - Physical counting

#### Project Management (Roles 11-16)

**Role 11: Project Manager**
- **Core responsibility:** Project delivery — schedule, cost, quality, safety, client interface. Approves DPR, measurement, bill submission, site requisitions, attendance corrections. **Owns project P&L**
- **Principal authorization objects:**
  - `PRJ_WBS` (all activities) — WBS management, scoped
  - `BIL_MB` (activity 43) — Measurement release
  - `HCM_ATT` (activity 43) — Attendance correction release
- **Key capabilities:**
  - Project P&L ownership
  - DPR approval
  - Measurement certification
  - Bill submission approval
  - Site requisition approval
  - Attendance correction approval

**Role 12: Project Engineer**
- **Core responsibility:** Work package execution, subcontractor and gang coordination, material requests, measurement verification
- **Principal authorization objects:**
  - `PRJ_WBS` (activities 01, 02, 03) — WBS create, change, display, scoped
- **Key capabilities:**
  - Work package execution
  - Subcontractor coordination
  - Material request creation
  - Measurement verification

**Role 13: Site Engineer**
- **Core responsibility:** DPR, field measurement, material requests, hindrance recording, quality and safety field reporting
- **Principal authorization objects:**
  - `PRJ_DPR` — DPR management
  - `BIL_MB` (activity 01) — Measurement creation
  - `INV_REQ` (activity 01) — Material request creation
- **Key capabilities:**
  - DPR creation
  - Field measurement entry
  - Material request creation
  - Hindrance recording
  - Quality and safety reporting

**Role 14: Quantity Surveyor**
- **Core responsibility:** Measurement certification, client and subcontractor bills, variation and extra-item tracking, quantity reconciliation
- **Principal authorization objects:**
  - `BIL_MB` (activity 43) — Measurement release
  - `BIL_RA` (activities 01, 02) — RA bill create and change
  - `CTR_VO` — Variation order
- **Key capabilities:**
  - Measurement certification
  - Client bill preparation
  - Subcontractor bill preparation
  - Variation tracking
  - Quantity reconciliation

**Role 15: Planning Engineer**
- **Core responsibility:** Schedule, baseline, progress, look-ahead, delay analysis, resource simulation
- **Principal authorization objects:**
  - `PRJ_SCHED` — Schedule management
  - `PRJ_BASELINE` (activity 43) — Baseline release
- **Key capabilities:**
  - Schedule creation and maintenance
  - Baseline management
  - Progress tracking
  - Delay analysis
  - Resource simulation

**Role 16: Commercial Manager**
- **Core responsibility:** Contract administration, variations, EOT, claims, notices, LD exposure, instrument status
- **Principal authorization objects:**
  - `CTR_*` — All contract objects
  - `BIL_RA` (activity 43) — RA bill release
  - `CMP_INSTRUMENT` — Financial instruments
- **Key capabilities:**
  - Contract administration
  - Variation management
  - EOT claim management
  - Claims management
  - LD exposure tracking

#### Contracts & Subcontracts (Role 17)

**Role 17: Contracts Manager**
- **Core responsibility:** Work orders and subcontract agreements, claims register, final settlements
- **Principal authorization objects:**
  - `SUB_SO` — Subcontract order
  - `CTR_CLAIM` — Claims management
- **Key capabilities:**
  - Subcontract order management
  - Claims register maintenance
  - Final settlement

#### Tender & Estimation (Roles 18-19)

**Role 18: Tender Manager**
- **Core responsibility:** Pipeline, eligibility, bid decision, submission package, consortium coordination, win-loss analytics
- **Principal authorization objects:**
  - `BID_*` — All bid objects
- **Key capabilities:**
  - Tender pipeline management
  - Eligibility screening
  - Bid decision
  - Submission package preparation
  - Consortium coordination
  - Win-loss analytics

**Role 19: Estimation Engineer**
- **Core responsibility:** Rate analysis, cost estimates, rate library, bid costing
- **Principal authorization objects:**
  - `CTR_RATE` — Rate analysis
  - `BID_EST` — Bid estimation
- **Key capabilities:**
  - Rate analysis
  - Cost estimation
  - Rate library management
  - Bid costing

#### HR & Payroll (Roles 20-21)

**Role 20: HR Manager**
- **Core responsibility:** Employee lifecycle, leave and payroll approval, statutory registers with Legal, attendance exception review
- **Principal authorization objects:**
  - `HCM_EMP` (all groups) — Employee management
  - `HCM_ATT` (activity 43) — Attendance correction release
  - `HCM_PAY` (activity 43) — Payroll release
- **Key capabilities:**
  - Employee lifecycle management
  - Leave approval
  - Payroll approval
  - Statutory register management
  - Attendance exception review

**Role 21: Payroll Officer**
- **Core responsibility:** Payroll processing, salary structures, statutory deductions and returns, employee records
- **Principal authorization objects:**
  - `HCM_PAY` (activities 01, 02) — Payroll create and change
  - `HCM_EMP` (compensation group) — Employee compensation
- **Key capabilities:**
  - Payroll processing
  - Salary structure management
  - Statutory deduction calculation
  - Statutory return preparation

#### Safety & Quality (Roles 22-23)

**Role 22: Safety Manager**
- **Core responsibility:** Inductions, toolbox talks, permits, inspections, incident investigation, statistics
- **Principal authorization objects:**
  - `EHS_*` (all activities) — All EHS objects
- **Key capabilities:**
  - Induction management
  - Toolbox talk management
  - Permit management
  - Inspection management
  - Incident investigation
  - Safety statistics

**Role 23: QA/QC Manager**
- **Core responsibility:** Inspection plans, checklist library, usage decisions, test results, material approvals, NCR closure, calibration
- **Principal authorization objects:**
  - `QMS_*` (activity 43) — QMS release activities
- **Key capabilities:**
  - Inspection plan management
  - Checklist library management
  - Usage decision approval
  - Test result management
  - Material approval
  - NCR closure
  - Calibration management

#### Plant & Production (Roles 24-25)

**Role 24: Plant Manager**
- **Core responsibility:** Equipment allocation, transfers, maintenance plans, fuel efficiency, document validity, cost per hour
- **Principal authorization objects:**
  - `EAM_*` (activity 43) — EAM release activities
- **Key capabilities:**
  - Equipment allocation
  - Equipment transfer
  - Maintenance plan management
  - Fuel efficiency tracking
  - Document validity management
  - Cost per hour analysis

**Role 25: Production Manager**
- **Core responsibility:** Mix design, production planning, batching, dispatch, quality clearance, production reconciliation
- **Principal authorization objects:**
  - `PRD_*` (all activities) — All production objects
- **Key capabilities:**
  - Mix design management
  - Production planning
  - Batching management
  - Dispatch management
  - Quality clearance
  - Production reconciliation

#### Document Control (Role 26)

**Role 26: Document Controller**
- **Core responsibility:** Drawing register, revisions, transmittals, issued-for-construction currency, retention
- **Principal authorization objects:**
  - `DMS_*` (activity 43) — DMS release activities
- **Key capabilities:**
  - Drawing register management
  - Revision management
  - Transmittal management
  - IFC currency management
  - Retention management

#### Legal & Compliance (Role 27)

**Role 27: Legal & Compliance Officer**
- **Core responsibility:** Disputes and arbitration, compliance calendar with HR, guarantee and insurance registers, contract risk
- **Principal authorization objects:**
  - `CMP_LEGAL` — Legal management
  - `CMP_STATUTORY` — Statutory compliance
  - `CMP_INSTRUMENT` — Financial instruments
- **Key capabilities:**
  - Dispute management
  - Arbitration management
  - Compliance calendar management
  - Guarantee register management
  - Insurance register management
  - Contract risk assessment

#### IT & Audit (Roles 28-29)

**Role 28: IT Administrator**
- **Core responsibility:** Infrastructure, backups, integrations, technical support, provisioning with the System Administrator, security monitoring
- **Principal authorization objects:**
  - `PLT_INFRA` — Infrastructure
  - `PLT_INTEGRATION` — Integration
  - **No business data access**
- **Critical rule:** Infrastructure work requiring temporary data access is granted as time-boxed elevated session, logged and notified to Internal Auditor
- **Key capabilities:**
  - Infrastructure management
  - Backup management
  - Integration management
  - Technical support
  - Security monitoring

**Role 29: Internal Auditor**
- **Core responsibility:** **Read-only across all modules** with full change-document visibility; reviews approval adherence and duty-segregation exceptions
- **Principal authorization objects:**
  - `*` (activity 03 only) — Display only across all objects
  - `PLT_AUDIT` (activity 03) — Audit log display
  - **No create, change or release anywhere**
- **Critical rule:** Any capability beyond read destroys independence
- **Key capabilities:**
  - Read-only access to all modules
  - Full change-document visibility
  - Approval adherence review
  - Segregation-of-duties exception review

#### Self-Service & Portal (Roles 30-34)

**Role 30: Employee**
- **Core responsibility:** Own attendance, leave, payslips, documents; raises requests routed to the reporting manager
- **Scope:** Self-service only
- **Key capabilities:**
  - View own attendance
  - Apply for leave
  - View payslips
  - View own documents
  - Raise requests

**Role 31: Labour**
- **Core responsibility:** Geofenced or supervisor-marked attendance; own wage and attendance record; wage queries
- **Scope:** Self-service only
- **Key capabilities:**
  - Geofenced attendance
  - Supervisor-marked attendance
  - View own wage record
  - View own attendance record
  - Wage queries

**Role 32: Vendor (portal)**
- **Core responsibility:** Own orders, invoices, payment status, compliance uploads, queries
- **Scope:** Portal realm, partner-scoped
- **Key capabilities:**
  - View own orders
  - Submit invoices
  - View payment status
  - Upload compliance documents
  - Raise queries

**Role 33: Subcontractor (portal)**
- **Core responsibility:** Own order and BOQ, measurements, bills, recoveries, compliance uploads
- **Scope:** Portal realm, partner-scoped
- **Key capabilities:**
  - View own orders
  - View BOQ
  - Submit measurements
  - Submit bills
  - View recoveries
  - Upload compliance documents

**Role 34: Client / Consultant (portal)**
- **Core responsibility:** Own project progress, reports, photographs, bill and measurement approval, issued drawings, site instructions
- **Scope:** Portal realm, project-scoped
- **Key capabilities:**
  - View project progress
  - View reports
  - View photographs
  - Approve bills
  - Approve measurements
  - View issued drawings
  - Issue site instructions

### A.2 Critical Role Design Notes

**IT Administrator — No Business Data Access**
- Infrastructure, integrations and backups only
- No access to vendor rates, salaries, contracts
- Temporary data access requires:
  - Time-boxed elevated session
  - Logged activity
  - Notification to Internal Auditor
- **Risk:** Administrative convenience is the most common route to uncontrolled data breach

**Internal Auditor — Read-Only Everywhere**
- Read-only access across all modules including audit logs
- No ability to create, change or release anything
- **Purpose:** Independence is the point of the role
- **Risk:** Any capability beyond read destroys independence

---

## SECTION B — APPROVAL MATRIX / DELEGATION OF AUTHORITY

### B.1 Universal Engine Rules

**These rules are enforced by the engine, not by policy:**

1. **Maker ≠ checker ≠ approver, absolutely**
   - The initiator cannot appear as an approver at any step regardless of permissions held

2. **Every step logs:**
   - User
   - Role
   - Timestamp
   - Action
   - Comment
   - Device
   - **Document version approved**

3. **Rejection requires a comment**
   - An unchanged resubmission is refused

4. **Every step has an SLA**
   - Breach auto-escalates
   - Surfaces in approval inbox ageing buckets

5. **Delegation is date-bounded**
   - Logged
   - Displays both names on the approval

6. **Value-relevant field change mid-release**
   - Resets strategy to step 1
   - Logs the reset

7. **Every release action posts to document's conversation thread**
   - Per Part 9

8. **Bulk approval restrictions:**
   - Permitted only for document types explicitly configured as bulk-approvable
   - **Never for:**
     - Payments
     - Orders above threshold
     - Contract amendments
     - Guarantee issuance
     - Period reopen

### B.2 Complete Approval Matrix

#### Procurement Documents

| Document | Initiator | Level 1 | Level 2 | Level 3 | Final |
|---|---|---|---|---|---|
| **Purchase requisition** | Site Engineer / Store Manager | Project Engineer | Project Manager (> A) | Procurement Manager (> B) | Management |
| **Purchase order** | Purchase Officer | Procurement Manager | Finance Manager co-sign (> C) | Management (> D) | Management |
| **Order amendment** | Purchase Officer | Procurement Manager | Finance Manager (if value rises) | Management (vendor change / major) | Management |
| **Goods receipt exception** | Store Keeper | Store Manager | Project Manager (critical material) | — | Procurement Manager |
| **Material issue** | Site Engineer (request) | Store Keeper (execute) | Store Manager (high value) | — | Project Manager |
| **Stock adjustment / write-off** | Store Keeper | Store Manager | Finance Manager (> E) | Management (major) | Management |
| **Invoice match exception** | Accounts Executive | Accounts Manager | Procurement Manager (qty/rate) | Finance Controller (major) | Finance Controller |

#### Finance Documents

| Document | Initiator | Level 1 | Level 2 | Level 3 | Final |
|---|---|---|---|---|---|
| **Payment release** | Accounts Executive | Accounts Manager | Finance Manager | Management (> F) | Management |
| **Journal voucher** | Accounts Executive | Accounts Manager | Finance Controller (> J) | — | Finance Controller |
| **Credit / debit note** | Accounts Manager | Finance Manager | Management (> K) | — | Management |
| **Period close / reopen** | Accounts Manager | Finance Controller | Management (reopen only) | — | Management |

#### Subcontract & Contract Documents

| Document | Initiator | Level 1 | Level 2 | Level 3 | Final |
|---|---|---|---|---|---|
| **Subcontract order** | Commercial Manager | Project Manager | Management (> G) | — | Management |
| **Subcontractor bill** | Quantity Surveyor | Project Manager | Commercial Manager | Finance Manager (release) | Management |
| **Client RA bill** | Quantity Surveyor | Project Manager | Commercial Manager | — | Management (disputed) |
| **Measurement entry** | Site Engineer | Quantity Surveyor | Project Engineer (verification) | — | Project Manager |
| **Variation / extra item** | Project Engineer | Project Manager | Commercial Manager | Management (> H) | Management |
| **Contract amendment** | Commercial Manager | Contracts Manager | Legal & Compliance (risk) | Management (signing) | Management |

#### Bid & Estimation Documents

| Document | Initiator | Level 1 | Level 2 | Level 3 | Final |
|---|---|---|---|---|---|
| **Bid go / no-go** | Tender Manager | Estimation Engineer | Commercial Manager | Management (> I / strategic) | Management |
| **Bid submission** | Tender Manager | Estimation Engineer | Commercial Manager | Management (authorisation) | Management |
| **Rate analysis** | Estimation Engineer | Commercial Manager | Finance Manager (validation) | — | Management |
| **Project budget / supplement** | Project Manager | Commercial Manager | Finance Controller | Management | Management |

#### HR Documents

| Document | Initiator | Level 1 | Level 2 | Level 3 | Final |
|---|---|---|---|---|---|
| **Employee onboarding** | Payroll Officer | HR Manager | Department Head | Management (senior) | Management |
| **Payroll run** | Payroll Officer | HR Manager | Finance Manager (funding) | — | Finance Controller |
| **Leave** | Employee | Reporting Manager | HR Manager (exceptional) | — | HR Manager |
| **Attendance correction** | Site Engineer / Employee | Project Manager | HR Manager | — | HR Manager |
| **Advance** | Requester | Reporting Manager | Finance Manager | Management (> L) | Management |
| **Asset purchase / disposal** | Department Head | Finance Manager | Management | — | Management |

#### Legal & Compliance Documents

| Document | Initiator | Level 1 | Level 2 | Level 3 | Final |
|---|---|---|---|---|---|
| **Guarantee issue / release** | Commercial Manager | Legal & Compliance | Finance Controller | Management (signing) | Management |
| **Insurance renewal / claim** | Legal & Compliance | Finance Manager | Management (major) | — | Management |
| **Legal filing / settlement** | Legal & Compliance | Commercial Manager | Management | — | Management |

#### Quality & Safety Documents

| Document | Initiator | Level 1 | Level 2 | Level 3 | Final |
|---|---|---|---|---|---|
| **Non-conformance closure** | QC Engineer | QA/QC Manager | Project Manager (major) | — | Project Manager |
| **Safety incident closure** | Safety Officer | Safety Manager | Project Manager | Management (major) | Management |

#### Document Control

| Document | Initiator | Level 1 | Level 2 | Level 3 | Final |
|---|---|---|---|---|---|
| **Drawing issued-for-construction** | Document Controller | Design / Planning Engineer | Project Manager | Client (where required) | Project Manager |

#### Plant & Equipment

| Document | Initiator | Level 1 | Level 2 | Level 3 | Final |
|---|---|---|---|---|---|
| **Equipment transfer** | Site Engineer | Plant Manager | Project Manager (cross-project) | — | Plant Manager |

#### Vendor Management

| Document | Initiator | Level 1 | Level 2 | Level 3 | Final |
|---|---|---|---|---|---|
| **Vendor blacklist / reactivation** | Procurement Manager | Legal & Compliance | Management | — | Management |
| **Vendor bank change** | Accounts Executive | Accounts Manager | Finance Manager | — | Finance Controller |

#### Configuration

| Document | Initiator | Level 1 | Level 2 | Level 3 | Final |
|---|---|---|---|---|---|
| **Geofence create / change** | System Administrator | — | — | — | Logged, notified to Management |
| **Configuration transport to production** | System Administrator | IT Administrator | Finance Controller (if financial config) | — | Management |

### B.3 Segregation of Duties Conflict Matrix

**Configurable, enforced at role assignment, reported to Internal Auditor for existing violations with mitigation-note workflow.**

| Conflict | Risk |
|---|---|
| Vendor master maintenance **+** payment release | Payment to a fictitious or altered vendor |
| Vendor bank change **+** payment release | **The primary fraud vector in the industry** |
| Goods receipt **+** invoice posting | Payment for goods never received |
| Purchase order creation **+** order release | Uncontrolled commitment |
| Measurement entry **+** measurement certification | Overstated execution |
| Measurement certification **+** bill approval | Overstated billing |
| Budget owner **+** budget supplement approval | Uncontrolled budget growth |
| Stock adjustment entry **+** adjustment approval | Concealment of shortage |
| Payroll processing **+** payroll release | Ghost employees |
| Employee master maintenance **+** payroll processing | Ghost employees |
| Journal entry **+** period close | Concealment of an unposted adjustment |
| Any configuration change **+** transport to production | Unreviewed control change |

**Implementation:**
- Enforced at role assignment
- Existing violations reported to Internal Auditor
- Mitigation-note workflow for exceptions

---

## SECTION C — PERFORMANCE, SECURITY & RESILIENCE

### C.1 Performance Requirements

| Requirement | Specification |
|---|---|
| **Server-side paging** | Everywhere — no client-side paging of full datasets |
| **Lazy loading** | Load data on demand, not upfront |
| **Index usage verification** | Query plans verified on top 20 queries by volume |
| **Configuration and master data caching** | Cached with activation-based invalidation |
| **Image compression** | Automatic compression before storage |
| **CDN for static assets** | Static assets served from CDN |
| **Asynchronous generation** | Anything over 5 seconds — job status and download link |
| **Connection pooling** | Sized to concurrency target |
| **Load test** | To Part 1 §1.3 targets including 500 concurrent chat connections — publish measured results |

### C.2 Security Requirements

| Control | Requirement |
|---|---|
| **Transport** | TLS 1.3, HSTS, certificate pinning on mobile |
| **At rest** | Database and object storage encrypted; separate key for restricted conversations |
| **Secrets** | Vault-managed, rotated, never in source or environment files committed |
| **Dependencies** | Scanned in pipeline; build fails on high-severity known vulnerability |
| **Application** | OWASP Top 10 review with documented findings and fixes |
| **Rate limiting** | Per endpoint, per user, per IP; separate limits for portal realm |
| **Uploads** | Type, size and content validated; malware scanned; served from separate origin |
| **Documents** | Signed, time-limited URLs; never a guessable path |
| **Portal isolation** | Separate auth realm, separate token audience, explicit endpoint allowlist |
| **Authentication** | Short-lived access + refresh tokens, device-bound on mobile, revocation list |
| **Second factor** | **Mandatory for:** payment release, vendor bank change, period reopen, configuration transport |
| **Logging** | Full server-side with correlation IDs and sensitive-field redaction |
| **Penetration test** | **Before go-live, with findings closed and retested** — including portal isolation and ID enumeration |

### C.3 Error Handling

**Principles:**
- **Never expose a stack trace**
- Every user-facing message states:
  - **What happened**
  - **Why it happened**
  - **What to do about it**
  - **Correlation ID for support**
- Full rollback on any failure
- Validation errors at field level
- Grouped in message area with links

### C.4 Backup and Disaster Recovery

| Requirement | Specification |
|---|---|
| **Automated backups** | Configurable retention (daily full, hourly incremental) |
| **Point-in-time recovery** | Supported |
| **RPO and RTO** | Documented |
| **Restore testing** | **Quarterly into clean environment — result documented** |
| **Data masking** | In every non-production environment (never train or test on live salary and bank data) |
| **Export-on-demand** | For regulatory request |
| **Retention and archival** | Policy per document class with statutory minimums observed |

---

## SECTION D — DATA MIGRATION

### D.1 Migration Scope (Load Order)

**Dependencies dictate sequence. Load in this order, reconciling at each checkpoint.**

| # | Object | Source | Reconciliation checkpoint |
|---|---|---|---|
| 1 | Company codes, tax units, sites, storage locations | Manual setup | Structure review sign-off |
| 2 | Chart of accounts, account determination, tax codes | Legacy books | Account count and hierarchy match |
| 3 | Cost centres, profit centres | Legacy | Count match |
| 4 | Business partners (vendors, subcontractors, clients) | Legacy + KYC files | Count match; PAN/GSTIN validity ≥ 95% |
| 5 | Material master with coefficients | Legacy + BOQ analysis | Count match; **no duplicates** |
| 6 | Employees and labour | HR records | Headcount match to payroll |
| 7 | Equipment and fixed assets | Asset register | Count and gross block match |
| 8 | Projects, WBS, cost codes | Project files | WBS structure review per project |
| 9 | Contracts and BOQ with executed quantities to date | Contract files + last RA bill | **BOQ value ties to contract value; executed quantity ties to last certified bill** |
| 10 | Project budgets | Budget files | Budget total per project matches approval |
| 11 | Rate library | Estimation files | Spot check 20 items |
| 12 | **Opening stock with valuation** | Physical count at cutover | **Stock value ties to legacy stock account to the rupee** |
| 13 | **Opening trial balance** | Legacy books | **Ties to legacy trial balance to the rupee** |
| 14 | Vendor open items, bill-wise | Legacy ageing | **Sums to the payable control account** |
| 15 | Customer open items, bill-wise | Legacy ageing | **Sums to the receivable control account** |
| 16 | Retention, security deposits, advances | Legacy | Sums to their control accounts |
| 17 | WIP / unbilled revenue | Project cost sheets | **Ties to the WIP account and to project cost to date** |
| 18 | Open purchase orders and commitments | Legacy | Value review; commitment reflected in budget availability |
| 19 | Open subcontract orders | Legacy | Value review |
| 20 | Guarantees and insurance policies | Register + bank confirmations | **Count and value confirmed by the bank** |
| 21 | Legal cases and claims | Legal files | Count review |
| 22 | Compliance registrations and licences | Compliance files | Validity dates verified |
| 23 | Drawings at current revision | DMS or file server | Current-revision count per project |

### D.2 Migration Method — Three Passes

```
PASS 1  Trial load into sandbox
          → reconciliation report per object
          → error log with row-level detail

PASS 2  Corrected load into sandbox
          → reconciliation report must be materially clean
          → business owner review and sign-off per object

PASS 3  Final load into production during cutover window
          → reconciliation report → Finance Controller sign-off
```

**Templates:** Via Part 9 §Tool 2 import engine, with validation preview, error rows and reversible import batches.

### D.3 The Reconciliation Rule

**Do not go live on an unreconciled migration.**

**Before go-live, specifically:**
- Migrated trial balance **equals** legacy trial balance to the rupee
- Migrated stock value **equals** legacy stock account balance to the rupee
- Bill-wise open items **sum exactly** to the receivable and payable control accounts
- Project cost to date **ties** to legacy project cost sheets, per project
- Guarantee register **matches** bank confirmations

**Warning:** An unreconciled migration never gets fixed afterwards. It becomes a permanent unexplained difference that every subsequent audit questions and nobody can resolve, because the legacy system has by then been decommissioned.

### D.4 History Policy

**Decide explicitly, and record the decision:**

| Category | Action |
|---|---|
| **Migrate** | Open items, live contracts with executed quantities, current budgets, current-revision drawings, active masters |
| **Archive read-only** | Closed projects, historical transactions, superseded drawings — accessible through read-only archive, not loaded into live system |
| **Do not migrate** | Ten years of transactions out of sentiment — slows system, complicates reconciliation, nobody queries it |

---

## SECTION E — CUTOVER RUNBOOK

### E.1 Timeline

| When | Activity | Owner |
|---|---|---|
| **T−60 days** | Pass 1 trial load; reconciliation reports issued | Implementation |
| **T−45** | Business owner sign-off per migration object | Object owners |
| **T−40** | User acceptance testing begins on loaded sandbox | Key users |
| **T−30** | Pass 2 corrected load; UAT defects triaged | Implementation |
| **T−21** | Penetration test complete, findings closed and retested | IT + vendor |
| **T−21** | Load test executed, results published | IT |
| **T−14** | Training complete; competency check per role | HR + Implementation |
| **T−14** | Production environment ready; backup and restore tested | IT |
| **T−7** | Configuration transport to production, verified by dry run | Sys Admin |
| **T−7** | **Legacy data entry freeze announced** | Management |
| **T−3** | Physical stock count at all sites | Store Managers |
| **T−1** | Legacy system read-only; final balances extracted | Finance |
| **T−1 evening** | Pass 3 final load begins | Implementation |
| **T−0 morning** | **Reconciliation review; Finance Controller sign-off; GO / NO-GO** | Finance Controller + Management |
| **T+0** | Production live; hypercare desk staffed on site | All |
| **T+1 to T+14** | Daily reconciliation of stock ledger vs GL; daily issue triage | Finance + IT |
| **T+30** | Parallel run for finance complete; legacy reconciled and closed | Finance Controller |
| **T+45** | Post-implementation review; benefits baseline recorded | Management |

### E.2 Go/No-Go Criteria

**All must be met:**

1. Migration reconciliation clean per §D.3, signed by Finance Controller
2. All Part 1–10C acceptance gates passed
3. Penetration test findings closed and retested
4. Load test targets met
5. Backup restored into clean environment and verified
6. Training complete with competency check per role
7. Hypercare staffing confirmed, including on-site presence at pilot project
8. **Rollback procedure documented and rehearsed**, with named decision-maker and stated decision deadline

### E.3 Rollback Trigger

**Define before go-live, not during a crisis:**
- What condition triggers return to legacy
- Who decides
- By when
- How already-entered production data is preserved for later reload

### E.4 Rollout Sequence

**One pilot project first**, stabilise for a full month including a month-end close, then extend in waves.

**Never a single-step cutover across a full portfolio.**

**Pilot selection:**
- Live, medium-complexity project
- Cooperative team
- **Not the smallest** (proves nothing)
- **Not the largest** (risks everything)

---

## SECTION F — DEMO DATA, TRAINING & SUPPORT

### F.1 Demo Data Requirements

**Data that does not tie out teaches users that the system does not tie out.**

**Provide:**
- 3 company codes (one multi-state)
- 5 projects (highway with chainage WBS, building, bridge, railway, RMC plant)
- 20 vendors across registration types including MSME, composition scheme and transport agency
- 50 materials with consumption coefficients
- 50 employees
- 100 labour records
- 10 equipment items
- 2 subcontractors
- Tenders won and lost with competitor rates
- Orders, gate entries, weighbridge tickets, receipts, movements, issues
- Invoices, payments, bank statements
- Measurements and bills at every lifecycle stage
- One month of attendance including exceptions
- DPRs, hindrances, RFIs
- Quality and safety records
- Populated conversations with voice notes and photographs

**Producing:**
- A balanced trial balance
- A stock ledger reconciling to the general ledger
- A project profit and loss that ties

### F.2 Training Requirements

| Requirement | Specification |
|---|---|
| **Role-based manuals** | In **English and Hindi** with screenshots |
| **Task videos** | Short videos for site users (attendance, DPR, measurement, material request, chat) |
| **Administrator guide** | Configuration guide |
| **Masked sandbox** | Refreshed on demand |
| **Competency check** | Per role before go-live |
| **Champion user** | Identified per site |

### F.3 Support Model

| Component | Specification |
|---|---|
| **Hypercare desk** | During cutover with on-site presence at pilot |
| **In-app support** | Conversation (Part 9 conversation type `SUPPORT`) with correlation ID attached automatically |
| **Issue triage** | By severity with SLA |
| **Known-issues page** | Visible in-app |
| **Release notes** | Monthly |

---

## SECTION G — FINAL QUALITY GATE (WHOLE SYSTEM)

### G.1 Visual and Functional Sweep

**Remove:**
- Placeholder text
- Dummy buttons
- Broken links
- Fake charts
- Empty menus
- Unused components
- "Coming soon" panels

**Every visible action works, or is disabled with a tooltip explaining why.**

**Check on every screen:**
- Alignment
- Spacing
- Type hierarchy
- Consistent buttons and status colours
- Responsiveness
- Empty states
- Loading states
- Error states
- Table usability
- Form usability
- Navigation consistency
- Print output

### G.2 Integrated End-to-End Tests

**Run each on the live system with evidence.**

1. **Tender → award → contract → project → WBS → BOQ → budget baseline**
   - Tender estimate live as plan version V0

2. **Requisition → RFQ → comparative → order → gate entry → weighbridge → receipt → inspection → usage decision → put-away → invoice → three-way match → payment → bank file → bank reconciliation**
   - Correct postings at every step
   - GR-IR clearing netting to zero

3. **Material request → reservation → issue → acknowledgement → WBS consumption → project cost**
   - Stock ledger reconciling to general ledger to the paisa

4. **Measurement → certification → RA bill (escalation, secured advance, all recoveries, tax) → submission → certification → invoice → receivable → collection**
   - Submitted, certified and paid tracked separately
   - Certification shortfall categorised

5. **Subcontract order → free-issue and recoverable material → measurement → bill with recoveries → compliance check → payment**
   - Compliance block demonstrated
   - Overridden only by Legal with reason

6. **Employee → geo-attendance including an offline punch, a mock-location rejection, a geofence exception and a correction → approval → payroll → statutory posting → return file**

7. **Equipment allocation → daily log → fuel → maintenance order → settlement → project cost**
   - Fuel exception raised
   - Expired-insurance allocation blocked

8. **Production order → mix design → moisture correction → batching → dispatch → site receipt → cube test → invoice → consumption reconciliation**
   - Cement variance flagged

9. **Hindrance → notice deadline alert → EOT claim → variation → contract amendment → revised value → LD recomputation**
   - Claim evidence bundle auto-assembled

10. **Dispute → case register → contingent provision → financial statement notes**
    - Limitation alert firing

11. **Period close:**
    - All 18 cockpit steps
    - Soft close
    - Reports
    - Hard close
    - Post-close posting attempt correctly refused
    - Material reconciliation variance blocking close until explained

12. **Communication:**
    - Defect photo in site conversation
    - Converted to non-conformance
    - Linked to measurement
    - That quantity blocked from billing
    - Resolved
    - Thread exported as indexed, hashed PDF

### G.3 Cross-Cutting Verification

13. **Every launchpad tile's count exactly equals its drill-down list count**
    - Automated across entire tile catalog

14. **Every dashboard figure drills through to source documents and journal entries**

15. **Every report reconciles to underlying transactions**
    - Supply the reconciliations

16. **Authorization enforced at API layer**
    - Verified by direct API testing rather than UI inspection
    - Across every module including chat, search and reports

17. **Segregation-of-duties conflict matrix blocks every combination in §B.3**
    - Existing violations report to Internal Auditor

18. **Full offline cycle on real entry-level device:**
    - Capture offline
    - Sync
    - No duplicates
    - Every conflict-matrix row behaving as specified

19. **Load test at target volumes with latency targets met**
    - Including 500 concurrent chat connections

20. **Penetration test complete**
    - Portal isolation verified by ID enumeration attempts
    - Findings closed and retested

21. **Backup restored into clean environment and data verified**

22. **Migration reconciliation ties exactly to legacy:**
    - Trial balance
    - Stock value
    - Bill-wise open items
    - Project cost to date
    - Guarantee register

23. **Every module has tests**
    - Coverage report supplied
    - CI pipeline green

24. **Complete end-to-end suite passes with AI layer disabled**

### G.4 Deliverables

**Source code**

**Database migrations**

**Complete seed configuration:**
- Document types
- Item categories
- Movement types
- Condition types
- Pricing procedures
- Account determination
- Release strategies
- Tolerance profiles
- Authorization objects
- Roles
- SoD matrix
- KPI definitions
- Tile catalog
- Print templates
- Reason code catalogues

**Demo data**

**Test suite and coverage report**

**OpenAPI specification**

**Entity-relationship diagram**

**Architecture document**

**Configuration guide**

**Deployment runbook**

**Environment variable reference**

**Backup and restore runbook**

**User manuals in English and Hindi**

**Administrator guide**

**Migration templates and reconciliation reports**

**Cutover runbook**

**Penetration test report**

**Load test report**

---

## CLOSING INSTRUCTION TO THE BUILDER

**Build the mechanisms properly and the modules become configuration.**

**Build the modules first and you will have forty silos that never reconcile.**

**If capacity runs short, deliver:**
- Parts 1, 2, 4, 5
- Communication layer of Part 9

**Complete and tested, then stop.**

**A working procure-to-consume system with:**
- Correct ledger
- Real document flow
- Enforced authorization
- Chat layer people actually use

**Is genuinely valuable from the first week.**

**A forty-module shell whose stock ledger does not tie to the general ledger is worse than the spreadsheets it replaced — because people will trust it.**

---

## SYSTEM STATUS

**Total Tests Specified: 400/400 (100%)**

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
| Part 9 | Communication & Tools | 35/35 | ✅ |
| Part 10A | Launchpad, Dashboards & Design System | 22/22 | ✅ |
| Part 10B | Mobile, Offline Sync, Portals | 25/25 | ✅ |
| Part 10C | Tender, Analytics, AI, Extensibility | 26/26 | ✅ |
| **Part 10D** | **Roles, Security, Migration, Go-Live** | **24/24** | **✅** |

**Total: 400 tests across 10 parts — COMPLETE**

---

## NEXT STEPS

The complete specification is now ready for implementation. The system covers:

1. **Platform Foundation** — Document principle, posting engine, authorization, audit
2. **Master Data** — Materials, partners, employees with full lifecycle
3. **Project System** — WBS, BOQ, planning, budget, cost control
4. **Procurement** — Sourcing, requisition, RFQ, orders, vendor evaluation
5. **Inventory** — Movement types, gate to bin, valuation, reconciliation
6. **Contracts & Billing** — RA bills, escalation, recoveries, tax
7. **Finance & Compliance** — GL, AP/AR, tax, statutory, legal
8. **People & Operations** — HR, plant, production, quality, safety
9. **Communication** — Chat, notifications, shared tools
10. **User Experience** — Launchpad, mobile, portals, AI, extensibility
11. **Operations** — Roles, security, migration, cutover, final acceptance

**Ready for implementation.**
