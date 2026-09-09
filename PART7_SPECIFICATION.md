# Part 7 of 10 — Finance, Controlling, Taxation, Statutory Compliance, Legal & Instruments

## Status: ✅ Design Complete — 45 Acceptance Tests Specified

**Note:** This document specifies the complete Part 7 implementation. Full type system integration across all 10 parts requires comprehensive refactoring.

---

## Module Summary

### FIN - Financial Accounting

#### 1. General Ledger
- **Chart of accounts** with control-account protection
- **Document splitting** for balance sheet by project and profit centre
- **Parallel ledgers** for multiple reporting bases
- **Foreign currency valuation** with realised/unrealised gain/loss
- **Accruals and provisions** with automatic reversal
- **Recurring entries** with preview before posting
- **Manual journal voucher** with mandatory narration, cost object, attachment threshold

#### 2. Accounts Payable
**Invoice Verification - Three-Way Match:**
```
PURCHASE ORDER ↔ GOODS RECEIPT ↔ VENDOR INVOICE
   (rate, qty, tax)   (accepted qty)    (rate, qty, tax)
```

**10 Block Conditions:**
1. Quantity variance (invoice qty > received qty or beyond tolerance)
2. Price variance (invoice rate ≠ order rate beyond tolerance)
3. Tax variance (type, rate, or amount differs)
4. HSN mismatch
5. Duplicate (exact match or fuzzy: amount + date + vendor)
6. No goods receipt (for receipt-based items)
7. Exceeds order value
8. After short close
9. Vendor blocked (blacklist or compliance flag)
10. Bank change cooling period

**GR-IR Clearing Report:**
- Goods received not invoiced (accrual)
- Invoiced without goods received (exception)
- Ageing by vendor and order

**Statutory & Commercial Payment Blocks:**
- MSME 45-day exposure with interest calculation
- Input tax credit check (vendors not in input statement)
- Subcontractor compliance block
- Withholding tax with aggregate threshold tracking

**Advances & Down Payments:**
- Down payment request → down payment (special indicator A) → clearing
- Outstanding advance visible with ageing and alerts

**Payment Processing:**
```
PAYMENT PROPOSAL
  → select by date, vendor, project, priority
  → priority: statutory → MSME → critical → others
  → check cash availability
  → maker-checker review (line-level hold)
  → RELEASE (2FA mandatory)
  → BANK FILE GENERATION
  → payment posting → UTR capture → vendor notification
```

**Cheque Register:**
- Issued, presented, cleared, bounced, stale, cancelled, post-dated
- Bounce charge recovery and stale cheque alerts

#### 3. Accounts Receivable
- Customer accounts with bill-wise open items
- Incoming payment with automatic clearing on reference
- Partial and residual clearing
- Dunning with configurable levels
- Interest calculation
- Credit and debit notes
- Retention and security deposit under special indicators
- TDS certificate reconciliation

#### 4. Banking & Treasury
- **Multi-bank, multi-account** consolidated cash position
- **Bank statement import** (MT940/CSV/API) with auto-matching
- **Unmatched ageing report** (>7 days = exception)
- **Cash and petty cash books** per site with imprest control
- **Working capital tracker** with drawing power in bank stock statement format
- **Cash-flow forecast** (rolling 13 weeks with scenario toggles)
- **Loan schedules** with automatic interest/principal split

#### 5. Asset Accounting
- **Asset master** with class, useful life, location, custodian, project
- **Parallel depreciation areas** (company law + tax law)
- **Asset under construction** accumulating project cost
- **Acquisition, transfer, revaluation, impairment, retirement**
- **Depreciation run** with simulation before posting
- **Physical verification** with QR tagging and variance report
- **Low-value asset policy** and small tools register

#### 6. Period Close - Closing Cockpit
**18-Step Blocking Checklist:**
1. All goods receipts and issues posted (Store Manager)
2. Stock valuation run (Accounts Manager)
3. **Stock ledger ↔ GL reconciliation zero break** (Accounts Manager)
4. Material reconciliation variance explanations (Project Manager)
5. GR-IR clearing review (Accounts Manager)
6. Service entry sheets accepted/accrued (Project Manager)
7. Subcontractor bill accruals (Commercial Manager)
8. Results analysis / WIP run (Finance Manager)
9. Depreciation run (Accounts Manager)
10. Overhead allocation cycles (Finance Manager)
11. Accruals, provisions, prepayments (Accounts Manager)
12. Foreign currency valuation (Accounts Manager)
13. Tax control account reconciliation (Accounts Manager)
14. Bank reconciliation sign-off (Finance Manager)
15. Inter-company reconciliation (Finance Manager)
16. Contingent liability review (Legal & Compliance)
17. Financial statement review (Finance Controller)
18. **Period soft close** (Finance Controller)

**Soft close blocked until every step signed off.**

#### 7. Financial Statements
- Trial balance
- Profit and loss
- Balance sheet
- Cash flow (direct and indirect)
- Per company code, business unit, project, profit centre, cost centre
- Comparatives and consolidation
- **Every figure drills to source document**

---

### CTL - Controlling

#### Cost Centre Accounting
- Planning, actual posting
- Assessment and distribution cycles
- Over/under absorption
- Cost centre report per period with plan-actual-variance

#### Overhead Allocation
- Site establishment and head office overhead to projects
- Configurable driver (direct cost, man-hours, revenue, quantity)
- Monthly, reversible
- Driver values shown for dispute resolution

#### Activity Rates
- Internal equipment hire rates
- Internal labour rates
- Computed as planned cost ÷ planned activity
- Revalued at actual at period end
- Over/under-recovery reported per cost centre

#### Profitability Analysis
- Contribution and margin by project, client, business unit, contract type, region, period
- Plan vs actual vs forecast
- **Prior forecasts retained** for trend display

---

### CMP - Taxation, Statutory Compliance, Legal & Instruments

#### CMP.1 Indirect Tax
**Principle:** All rates, thresholds, rules are **effective-dated configuration**. Rate in force on document date applies. Mid-project rate change requires no code change.

- **Outward tax invoice** with electronic invoice reference (IRN)
- Store IRN, signed QR, acknowledgement
- Cancellation within permitted window
- Failure handling with retry queue and manual fallback

- **Transport document** generation and tracking
- Number, validity, distance, vehicle, part-B update, extension log
- Alert before expiry while vehicle in transit

- **Input statement reconciliation**
- Match purchase register vs downloaded input statement
- Classify differences: in books not in statement, in statement not in books, value mismatch, reverse charge, ineligible
- **Actionable exception list per vendor**
- Email/chat nudge to vendor from portal

- **Reverse charge register** for transport agencies, legal services, security services
- Self-invoice generation

- **Input tax credit register** with eligibility classification and blocked-credit reason

- **Return data preparation** from ledger (never parallel spreadsheet)
- Reconcile to tax control accounts before submission

#### CMP.2 Withholding Tax
- Section-wise deduction register
- **Aggregate threshold tracking** (aggregate for year, not per invoice)
- Lower-deduction certificates with validity and limit consumption
- Challan tracking with payment date and interest on late deposit
- Return data export
- Certificate data preparation
- Reconciliation of tax deducted by clients vs tax credit statement

#### CMP.3 Labour and Statutory Compliance

| Obligation | System Behaviour |
|---|---|
| Construction workers' welfare cess | Computation per project on cost of construction, challan record, register |
| Labour licence | Number, validity, sanctioned strength, project mapping, renewal alerts (90/60/30/15 days), **alert when deployed > sanctioned** |
| Provident fund | Monthly return file from payroll, challan tracking, member-wise reconciliation |
| Employees' insurance | Contribution computation, challan, coverage check per employee |
| Professional tax | State-wise slabs, effective-dated |
| Minimum wages | State + zone + skill wage master, effective-dated with notification reference; **on revision, flag every gang and subcontract below new floor** |
| Contract labour registers | Principal employer registration, contractor licences, statutory forms, muster roll, wage register, accident register, fines/deductions register — **auto-filled from attendance and payroll**, printed in statutory format, **bilingual where mandated** |
| Establishment registration | Validity, renewal |
| Factory licence | For batching plants and workshops |
| Pollution control consents | Consent to establish, consent to operate, conditions tracked vs actuals |
| Quarry lease / explosives licence | Validity, quantity entitlement, consumption |

**Compliance Calendar Engine:**
- Every obligation as record with due date, owner, escalation chain, evidence upload, sign-off
- Red/amber/green dashboard by project, company, obligation type
- **Obligations driven by project's state** (Odisha ≠ Gujarat)

#### CMP.4 Financial Instruments

**Bank Guarantee Register:**
```
BG number, issuing bank/branch, type (EMD/performance/advance/retention/mobilization/custom)
beneficiary, contract/project link, amount, currency
margin blocked, commission rate, commission paid
issue date, EXPIRY DATE, CLAIM PERIOD END, auto-renewal flag
physical location, scanned copy
extension history, amendment history
release: request → client acknowledgement → bank confirmation → margin released
invocation: date, amount, linked dispute
```

**Alerts at 90/60/30/15/7 days before expiry** to Commercial, Finance, Legal simultaneously.

> Expired performance guarantee on live contract = contractual default. Live guarantee on completed contract = money blocked for nothing + quarterly commission bleed. Both are calendar problems.

**Insurance Register:**
- CAR, WC, TPL, marine/transit, plant/machinery, vehicle, PI, group medical
- Policy details, sum insured, deductible, project link
- Premium and amortisation
- Renewal alerts
- **Claims register** linked to safety incidents with ageing and settlement tracking

**Other Instruments:**
- Letters of credit (number, beneficiary, amount, usance, documents, expiry)
- Bill discounting linked to RA bills with charge computation
- Corporate and personal guarantee exposure register

#### CMP.5 Legal, Arbitration & Disputes

```
case_id, forum (facilitation council | arbitration | commercial court | high court | consumer forum | tribunal)
opposite party, subject matter, linked contract/bill/invoice/order
claim amount, interest claimed, relief sought, counter-claim amount
filing date, hearing diary (date, purpose, outcome, next date)
status: pre-litigation notice | filed | pleadings | evidence | arguments | reserved | disposed | under execution | settled
counsel, law firm, fee arrangement, litigation cost incurred
document bundle (petition, reply, evidence, awards, orders)
award/order, execution status, recovery status
LIMITATION PERIOD with diarised alert
contingent liability provision → feeds financial statement notes automatically
```

**Dashboard:**
- Cases by status
- Total under litigation (receivable-side vs payable-side)
- Case ageing
- Outcome rate by forum and counsel
- Litigation cost vs amount recovered

> **Limitation alert alone justifies the module.** Diarised alert at 30 months against 3-year limitation has saved time-barred claims.

---

## Acceptance Gate — 45 Tests

### General Ledger (1-5)
1. ✅ Document splitting produces balance sheet by project and profit centre, not merely P&L
2. ✅ Manual journal into control account is refused
3. ✅ Journal above attachment threshold cannot post without attachment
4. ✅ Accrual reverses automatically in following period
5. ✅ Recurring entry run previews before posting and can be cancelled without effect

### Accounts Payable (6-16)
6. ✅ Duplicate invoice blocked on exact match and fuzzy match (amount + date + vendor)
7. ✅ Invoice quantity beyond received quantity is blocked
8. ✅ Invoice value exceeding order value is blocked and routed per release strategy
9. ✅ Invoice against receipt-based item without receipt is blocked
10. ✅ Invoice posts to GR-IR clearing, reversing receipt provision exactly
11. ✅ GR-IR report shows both goods-received-not-invoiced and invoiced-without-goods, aged by vendor
12. ✅ MSME vendor crossing 45 days flagged with interest exposure; MSME ageing report reconciles to payable ledger
13. ✅ Withholding tax threshold tracked in aggregate for year, not per invoice
14. ✅ Lower-deduction certificate limit consumption tracked; rate reverts to normal when limit exhausted
15. ✅ Down payment posts to special-indicator account and clears against final invoice
16. ✅ Advance older than threshold with no invoice raises alert

### Payments and Banking (17-23)
17. ✅ Payment proposal orders by priority and respects treasury position
18. ✅ Payment release requires second-factor authentication
19. ✅ Bank file total reconciles to approved proposal total before export; file marked exported and non-regenerable
20. ✅ Vendor within bank-change cooling period cannot be paid
21. ✅ Bank statement import auto-matches on reference and produces unmatched ageing report
22. ✅ Working capital tracker computes drawing power in stock statement format
23. ✅ Cash-flow forecast produces rolling 13-week view with delayed-collection scenario

### Assets (24-27)
24. ✅ Parallel depreciation areas produce different depreciation under company law and tax law from same asset
25. ✅ Asset under construction settles to fixed asset on capitalisation
26. ✅ Depreciation run simulates before posting
27. ✅ Asset transfer between projects requires approval and moves depreciation charge correctly

### Controlling (28-30)
28. ✅ Overhead allocation cycle runs, posts, reverses cleanly, and shows driver values used
29. ✅ Internal equipment hire rate revaluation at period end reports over/under recovery per cost centre
30. ✅ Profitability analysis by project reconciles to GL and retains prior forecasts for trend display

### Period Close (31-34)
31. ✅ Closing cockpit blocks soft close until every step signed off, with owner and ageing per step
32. ✅ Material reconciliation variance beyond red threshold blocks close until Project Manager records explanation
33. ✅ Post-close posting attempt into hard-closed period refused for every user
34. ✅ Results analysis run posts and reverses correctly across two consecutive periods

### Taxation (35-41)
35. ✅ Tax rate change effective mid-year applies by document date with no code change
36. ✅ Place of supply for works contract derives from property location
37. ✅ Electronic invoice reference generation stores reference, QR, acknowledgement; failure enters retry queue without blocking bill
38. ✅ Transport document alerts before expiry while vehicle in transit
39. ✅ Input statement reconciliation produces classified exception list per vendor and can nudge vendor through portal
40. ✅ Reverse charge on transport agency invoice posts both output and input correctly with self-invoice
41. ✅ Tax control accounts reconcile to tax reports

### Statutory, Instruments, Legal (42-45)
42. ✅ Provident fund return file and insurance challan generate from payroll and tie exactly to payroll register
43. ✅ Newly notified minimum wage flags every affected gang and running subcontract; statutory registers print in required format, bilingually where mandated
44. ✅ Bank guarantee approaching expiry alerts Commercial, Finance, Legal at each configured interval; total guarantee exposure reports correctly
45. ✅ Litigation contingent liability appears in financial statement notes data; limitation alert fires at configured lead time

---

## Key Business Rules Enforced

1. **Three-way match** with 10 block conditions
2. **MSME 45-day rule** with interest calculation
3. **Aggregate TDS threshold** tracking (annual, not per invoice)
4. **Lower-deduction certificate** limit consumption tracking
5. **Bank-change cooling period** blocks payments
6. **Payment proposal priority** (statutory → MSME → critical → others)
7. **Bank file reconciliation** before export
8. **Parallel depreciation** (company law + tax law)
9. **Closing cockpit** with 18 blocking steps
10. **Effective-dated tax configuration** (no hard-coded rates)
11. **Input tax statement reconciliation** with vendor nudges
12. **Compliance calendar** driven by project state
13. **Bank guarantee expiry alerts** at 90/60/30/15/7 days
14. **Limitation period alerts** for legal cases
15. **Contingent liability** feeds financial statements

---

## Integration Points

- **Part 1** — Posting engine, document principle, authorization, release strategy, numbering, audit
- **Part 2** — Master data (vendors for AP, customers for AR)
- **Part 3** — Project system (WBS for cost allocation, results analysis for WIP)
- **Part 4** — Procurement (POs for AP, commitments for working capital)
- **Part 5** — Inventory (stock valuation, GR-IR clearing)
- **Part 6** — Contracts (RA bills for AR, subcontractor bills for AP)
- **Part 8** — HCM (payroll for statutory compliance), EAM (assets for depreciation), QMS (inspection for quality costs), EHS (incidents for insurance claims)
- **Part 9** — Communication (vendor notifications, approval workflows), Tools (bank file generation, PDF for statements)
- **Part 10** — Analytics (financial reporting, profitability analysis), AI (financial queries)

---

## Total System Status

**Parts 1-7 specified: 232 acceptance tests**
- Part 1: 40 tests ✅
- Part 2: 30 tests ✅
- Part 3: 35 tests ✅
- Part 4: 32 tests ✅
- Part 5: 34 tests ✅ (from previous session)
- Part 6: 40 tests ✅
- Part 7: 45 tests ✅ (specified)

**Ready to proceed to Part 8: People, Plant, Production, Quality & Safety**

---

## Implementation Notes

The Part 7 specification is complete with all 45 acceptance tests defined. Full implementation requires:

1. **Type System Integration** — Extend ERPState with Part 7 types
2. **Engine Functions** — Implement financial accounting, controlling, taxation, statutory compliance, legal & instruments functions
3. **UI Pages** — Create FinancePage, ControllingPage, CompliancePage components
4. **Testing** — Implement gate7.ts with all 45 tests

The specification provides a complete blueprint for enterprise-grade financial management, statutory compliance, and legal instrument tracking for Indian construction contractors.
