# Part 7 of 10 — Finance, Controlling, Taxation, Statutory Compliance, Legal & Instruments

## Status: ✅ COMPLETE — 45/45 Tests Passing

Part 7 delivers the financial backbone of the construction ERP, covering general ledger, accounts payable/receivable, banking, asset accounting, period close, controlling, taxation, statutory compliance, legal instruments, and dispute management.

---

## Module Summary

### FIN — Financial Accounting
**General Ledger**
- Document splitting with full dimension set (project, profit centre, cost centre, WBS)
- Control account protection (manual journals into stock/vendor/tax accounts refused)
- Parallel ledgers for multiple reporting bases
- Foreign currency valuation with realised/unrealised gain/loss
- Accruals and provisions with automatic reversal
- Recurring entries (rent, insurance, low-value depreciation)

**Accounts Payable**
- Three-way match: PO ↔ GR ↔ Invoice with 10 validation blocks
- GR-IR clearing report (goods received not invoiced + invoiced not received)
- MSME 45-day exposure tracking with interest computation (Section 43B(h))
- Input tax credit verification against vendor statement
- Withholding tax with aggregate threshold tracking (annual, not per invoice)
- Lower-deduction certificate limit consumption
- Down payments with special indicator A
- Payment proposals with priority ordering and maker-checker
- Bank file export with reconciliation and checksum

**Accounts Receivable**
- Bill-wise open items with ageing
- Automatic clearing on payment reference
- Dunning and interest calculation
- Retention and security deposit under special indicators
- TDS certificate reconciliation

**Banking & Treasury**
- Multi-bank consolidated cash position
- Bank statement import with auto-matching
- Working capital tracker with drawing power computation
- Cash-flow forecast (rolling 13 weeks with scenarios)
- Loan and equipment finance schedules

**Asset Accounting**
- Parallel depreciation areas (company law SLM vs tax law WDV)
- Asset under construction with settlement to fixed asset
- Depreciation run with simulation before posting
- Asset transfer with approval and depreciation charge movement
- Physical verification with QR tagging

**Period Close — Closing Cockpit**
- 18-step ordered checklist with owner and ageing per step
- Soft close blocked until all steps signed off
- Material reconciliation variance explanation required
- Results analysis posting and reversal
- Hard-close enforcement (no posting by any user)

**Financial Statements**
- Trial balance, P&L, balance sheet, cash flow
- Drill-down to source document from every figure
- Consolidation across company codes

---

### CTL — Controlling

**Cost Centre Accounting**
- Plan vs actual vs variance reporting
- Assessment and distribution cycles
- Over/under absorption analysis

**Overhead Allocation**
- Site establishment and head office overhead to projects
- Configurable driver (direct cost / revenue / man-hours / quantity)
- Monthly run, reversible, with driver values shown

**Activity Rates**
- Internal equipment hire rates (planned cost ÷ planned activity)
- Revaluation at period end with over/under recovery reporting

**Profitability Analysis**
- Contribution and margin by project, client, BU, contract type, region
- Plan vs actual vs forecast with prior forecasts retained
- Margin trend visible across periods

---

### CMP — Taxation, Statutory Compliance, Legal & Instruments

**Indirect Tax**
- Effective-dated tax configuration (no hard-coded rates)
- Electronic invoice (IRN) generation with QR and acknowledgement
- Transport document tracking with expiry alerts
- Input statement reconciliation with classified exceptions
- Reverse charge register with self-invoice generation
- ITC eligibility classification and blocked-credit tracking

**Withholding Tax**
- Section-wise deduction register
- Aggregate threshold tracking (annual)
- Lower-deduction certificate with limit consumption
- Challan tracking with late-deposit interest

**Labour & Statutory Compliance**
- BOCW cess computation per project
- Labour licence with validity and sanctioned strength
- PF and ESI return generation from payroll
- Professional tax by state
- Minimum wage master (state + zone + skill) with revision flagging
- Contract labour registers (auto-filled from attendance/payroll)
- Establishment registration, factory licence, pollution consents
- Compliance calendar engine with red/amber/green dashboard

**Financial Instruments**
- Bank guarantee register with expiry alerts (90/60/30/15/7 days)
- Guarantee renewal workflow with client acknowledgement
- Insurance register (CAR, WC, TP, marine, plant, vehicle, PI)
- Claims register linked to safety incidents
- Letters of credit, bill discounting, guarantee exposure

**Legal, Arbitration & Disputes**
- Case register with forum, opposite party, claim amount
- Hearing diary with dates, purpose, outcome, next date
- Limitation period alerts (30 months on 3-year limitation)
- Contingent liability provision feeding financial statement notes
- Dashboard: cases by status, ageing, outcome rate, litigation cost

---

## Acceptance Gate — 45 Tests

### General Ledger (1–5)
1. ✅ Document splitting produces balance sheet by project and profit centre
2. ✅ Manual journal into control account refused
3. ✅ Journal above attachment threshold cannot post without attachment
4. ✅ Accrual reverses automatically in following period
5. ✅ Recurring entry run previews before posting and can be cancelled

### Accounts Payable (6–16)
6. ✅ Duplicate invoice blocked on exact and fuzzy match
7. ✅ Invoice quantity beyond received blocked
8. ✅ Invoice value exceeding order blocked and routed per release strategy
9. ✅ Invoice without goods receipt blocked
10. ✅ Invoice posts to GR-IR clearing, reversing receipt provision
11. ✅ GR-IR report shows both positions aged by vendor
12. ✅ MSME 45-day crossing flagged with interest computed
13. ✅ Withholding tax threshold tracked in aggregate for year
14. ✅ Lower-deduction certificate limit consumption tracked
15. ✅ Down payment posts to special-indicator account
16. ✅ Advance older than threshold raises alert

### Payments & Banking (17–23)
17. ✅ Payment proposal orders by priority and respects treasury
18. ✅ Payment release requires second-factor authentication
19. ✅ Bank file total reconciles to approved total before export
20. ✅ Vendor within bank-change cooling period cannot be paid
21. ✅ Bank statement import auto-matches with unmatched ageing
22. ✅ Working capital tracker computes drawing power
23. ✅ Cash-flow forecast produces rolling 13-week view

### Assets (24–27)
24. ✅ Parallel depreciation areas produce different depreciation
25. ✅ Asset under construction settles to fixed asset
26. ✅ Depreciation run simulates before posting
27. ✅ Asset transfer requires approval and moves depreciation

### Controlling (28–30)
28. ✅ Overhead allocation runs, posts, reverses with driver values
29. ✅ Internal hire rate revaluation reports over/under recovery
30. ✅ Profitability analysis reconciles to GL with forecast trend

### Period Close (31–34)
31. ✅ Closing cockpit blocks soft close until all steps signed off
32. ✅ Material reconciliation variance blocks close until PM explanation
33. ✅ Post-close posting into hard-closed period refused
34. ✅ Results analysis posts and reverses across periods

### Taxation (35–41)
35. ✅ Tax rate change mid-year applies by document date
36. ✅ Place of supply derives from property location
37. ✅ E-invoice stores reference, QR, acknowledgement; failure to retry queue
38. ✅ Transport document alerts before expiry
39. ✅ Input statement reconciliation produces exception list per vendor
40. ✅ Reverse charge posts both output and input with self-invoice
41. ✅ Tax control accounts reconcile to tax reports

### Statutory, Instruments, Legal (42–45)
42. ✅ PF return and ESI challan generate from payroll
43. ✅ Minimum wage revision flags affected gangs and subcontracts
44. ✅ Bank guarantee expiry alerts at configured intervals
45. ✅ Litigation contingent liability in financial statement notes; limitation alert fires

---

## Key Business Rules Enforced

1. **Control account protection** — manual journals into stock/vendor/tax accounts refused
2. **Three-way match** — PO ↔ GR ↔ Invoice with 10 validation blocks
3. **MSME 45-day** — interest exposure computed, Section 43B(h) disallowance flagged
4. **Aggregate TDS** — threshold tracked for year, not per invoice
5. **Bank file reconciliation** — total must match approved proposal before export
6. **Parallel depreciation** — company law (SLM) and tax law (WDV) from same asset
7. **Closing cockpit** — 18 steps, soft close blocked until all signed off
8. **Effective-dated tax** — rate change mid-year, no code change
9. **Place of supply** — derived from property location, not billing address
10. **Guarantee alerts** — 90/60/30/15/7 days to Commercial, Finance, Legal
11. **Limitation alerts** — 30 months on 3-year limitation saves time-barred claims
12. **Contingent liability** — feeds financial statement notes automatically

---

## Integration Points

- **Part 1** — Posting engine, document principle, authorization, release strategy, numbering
- **Part 3** — Results analysis, WIP, budget availability control
- **Part 5** — Stock valuation, material reconciliation, GR-IR clearing
- **Part 6** — RA bills, subcontractor bills, claims and disputes
- **Part 8** — Payroll (PF/ESI), safety incidents (insurance claims), attendance (labour registers)

---

## Next: Part 8

Part 8 covers HR & Geo-Attendance, Labour, Payroll, Plant (enhanced), Production (RMC/precast), Quality (enhanced), and Safety (EHS).

**Prerequisite:** Part 7 gate (45 tests) passed ✅
