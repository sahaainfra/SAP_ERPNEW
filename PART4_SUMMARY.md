# Part 4 of 10 — Procurement: Sourcing, Requisition, RFQ, Orders, Vendor Performance

## Status: ✅ COMPLETE — 32/32 Tests Passing

Part 4 implements the complete procurement lifecycle from sourcing master data through vendor evaluation, with strict framework compliance ensuring all pricing, posting, approval, and numbering logic delegates to Part 1 services.

---

## Module Summary

### 1. Sourcing Master Data

**Purchasing Info Record**
- Vendor-material relationship backbone for pricing access sequence
- Fields: vendor, material, purchasing org, site, last price, effective price, planned/actual delivery days, min order qty, tolerances, GR-based IV flag
- Price history: date, order ref, qty, rate, landed rate (auto-maintained from transactions)
- Quality history: receipts, rejections, rejection % (auto-maintained from inspection lots)

**Source List**
- Permitted vendors per material per site with validity dates
- Fixed-source flag and block flag
- Source-controlled material groups require override with mandatory reason for off-list vendors
- Override reason appears on release note to every approver

**Quota Arrangement**
- Split allocation across vendors (e.g., cement 60/40)
- Allocated and consumed quantity tracked
- Over-allocation refused with current split displayed
- Enforcement, not aspiration

**Outline Agreements**
- **Rate contracts**: agreed rates with value/quantity cap, releases consume cap, refused beyond cap
- **Scheduling agreements**: fixed schedule lines with delivery dates for bulk materials, delivery call-off function

### 2. Requirement Determination

**Four Sources Feed Requisition Pipeline:**

1. **Manual site requisition** — everyday route
2. **Reorder-point planning** — when unrestricted stock + open orders − reservations < reorder level, generate planned requisition
3. **Project-driven material requirement (BOQ explosion)**:
   ```
   planned qty of work × material coefficient × (1 + wastage %)
   − stock at site − reserved − in transit − open order qty
   = NET REQUIREMENT by required-by date
   ```
4. **Consolidation run** — merge requisitions across projects/sites, preserve each line's account assignment

### 3. Purchase Requisition

**Document Structure:**
- Header: type (PR-STD | PR-EMG | PR-SVC | PR-CAP), site, project, requester, purpose, required-by date, justification
- Item: material/service, qty, UOM, delivery date, account assignment (WBS/cost code), valuation price

**Mandatory Pre-Submission Checks:**
1. **Availability display**: unrestricted stock, sibling-site stock, quality-hold, reserved, open order, in-transit, with-subcontractor
2. **Budget availability control**: pass/warn/notify/block per tolerance profile, remaining budget shown
3. **Duplicate check**: open requisitions for same material, project, required-by window
4. **Specification completeness**: refused for specification-controlled material groups
5. **Emergency requisitions (PR-EMG)**: shortened release strategy, mandatory justification, management notification, monthly emergency-purchase report

**Requisition Tracking:**
- Live downstream status: awaiting release → released → RFQ issued → quotations received → order placed → partially delivered → delivered → short-closed
- Ageing at each stage reported
- Procurement cycle-time analysis built from tracking

### 4. RFQ, Quotation & Comparative Statement

**RFQ (RQ-STD):**
- Issued to selected vendors from source list
- Sealed-until-deadline option: quotations encrypted, opened by two authorised users jointly, logged
- Scope, specification, qty, delivery location/schedule, terms, validity, submission deadline

**Quotation Entry:**
- Full condition detail through pricing procedure (not single lump rate)
- Capture: basic rate, discount, freight, loading/unloading, packing, insurance, royalty, taxes, payment terms, delivery period, validity, deviations

**Comparative Statement — Compare on Effective Cost:**
```
                                   Vendor A     Vendor B     Vendor C
Basic value                        1,000,000    1,020,000      985,000
− Discount                            20,000       15,000            0
= Net value                          980,000    1,005,000      985,000
+ Freight                             35,000            0       42,000
+ Lead & lift                          8,000        8,000       12,000
+ Loading / unloading                  5,000        5,000        5,000
+ Royalty (if borne by us)                 0            0       18,000
= LANDED VALUE                     1,028,000    1,018,000    1,062,000
+ Tax                                185,040      183,240      191,160
= INVOICE VALUE                    1,213,040    1,201,240    1,253,160
− Creditable tax                     185,040      183,240            0   ← composition vendor
= EFFECTIVE COST TO PROJECT        1,028,000    1,018,000    1,253,160
± Payment term adjustment              −6,850       +3,400       −8,900
= COMPARABLE COST            L2  1,021,150   L1  1,021,640  L3  1,244,260
```

**Additional Vendor Data Displayed:**
- Delivery lead time
- On-time delivery % from history
- Rejection % from history
- MSME status
- GST filing status
- Open blacklist flags
- Outstanding quality issues

**Key Rule:** Ranking on quoted rate alone is the most common and expensive procurement error. System's default sort is comparable cost. Composition-scheme vendor (ITC not creditable) ranks worse than equal-priced registered vendor.

**Non-Lowest Award:**
- Mandatory justification carried into order release note
- Shown to every approver
- Reported monthly with value differential

**Negotiation:**
- Rounds recorded: date, participants, revised offers per condition, minutes
- Full history retained
- Final rate traceable to recorded negotiation
- Savings vs first quotation computed and reported

### 5. Purchase Order

**Document Structure:**
- Header: type, vendor, purchasing org/group, company code, site, currency, payment terms, incoterms, pricing procedure, delivery address, retention/security terms, LD clause
- Item: item category, material/service, specification, qty, UOM, delivery schedule lines, conditions, tax code, ITC eligibility, account assignment, WBS, cost code, inspection requirement, batch requirement, approved makes

**Rules:**
- Tax type derived (never selected) from place of supply
- **Release creates commitment** — statistical posting consuming budget availability immediately
- **Amendments versioned (PO-AMD)**: old→new per field, re-enter release strategy, preserve original as issued
- Vendor change = major amendment → highest approval level
- **Short closure**: releases residual commitment with reason code
- **Service orders (PO-SVC)**: service entry sheet required, work recorded and accepted before invoicing
- Order PDF: company branding, full terms, QR code linking to order for vendor verification
- Order confirmation: acknowledged qty and date recorded, variance from ordered dates flagged

**Delivery Follow-Up:**
- Open order report by required-by date
- Overdue deliveries with ageing
- Automatic reminder generation at configurable intervals
- Delivery performance feeds vendor evaluation
- Expediting notes recorded in order conversation thread

### 6. Minor Minerals, Royalty & Transit Permits

**Fields Built Into Order, Gate Entry, Goods Receipt:**
- Source quarry/lease holder, lease number, lease validity, lease capacity
- Royalty borne by (contractor/vendor), royalty rate per unit
- District mineral fund and other statutory cess
- Transit permit/e-transit pass number, permit validity, permitted quantity, vehicle number, issuing authority

**Alerts and Blocks:**
- Received quantity exceeding permit quantity → exception, receipt blocked pending approval
- Expired permit at receipt → blocked
- Reused permit number → high-severity exception to Legal and Procurement
- Expired quarry lease on source → order blocked

**Business Impact:**
- Unroyaltied material on site = live penalty exposure
- On government projects = contractual default
- Vendor's bill = only place to catch before payment

### 7. Vendor Evaluation

**Scores Computed from Transactions (Never Typed):**

| Criterion | Computation | Default Weight |
|---|---|---|
| Price | Variance of awarded rate vs lowest comparable and vs last purchase | 30% |
| Delivery | On-time-in-full % from receipt dates vs order dates | 25% |
| Quality | 100 − rejection % from inspection lots | 25% |
| Compliance | GST filing status, document validity, statutory currency | 10% |
| Service | RFQ response rate, query turnaround, short-supply incidents, expediting effort | 10% |

**Weights Configurable Per Material Group:**
- Quality weighs more for structural steel than stationery
- Delivery weighs more for time-critical materials

**Score Bands Drive Status:**
- PREFERRED · APPROVED · CONDITIONAL · WATCHLIST · BLACKLISTED

**Blacklisting:**
- Approved document with reason
- Hard block on new orders
- Reactivation requires higher approval level

**Vendor Scorecard:**
- Shared with vendor through portal
- Visible performance data changes vendor behaviour more than any letter

### 8. Procurement Intelligence

**Spend Analysis:**
- By material group, project, vendor, period, buyer

**Vendor Concentration:**
- Single-source dependency risk by spend and criticality
- Alert where one vendor exceeds configured share of critical material

**Price Variance:**
- Awarded rate vs last purchase, vs budget rate, vs market index
- Rate rising faster than index = question worth asking

**Price Trend and Buying-Timing Advisory:**
- Historical purchase-rate series per material with seasonality
- Bulk buying can be timed
- Advisory only, always with underlying data

**Cycle Time Analysis:**
- By stage: requisition raised → released → RFQ → quotations → comparative → order released → delivered
- Bottleneck identification by stage and by person

**Savings Analysis:**
- First quote vs final negotiated
- Awarded vs budget rate

**Budget vs Commitment:**
- By project and cost code

**Emergency Purchase Trend:**
- Value and count by project and requester

**Order Ageing and Short-Closure Analysis:**
- Orders raised and never delivered = cash and budget locked for nothing

---

## Acceptance Gate — 32 Tests

### Framework Compliance (1–3)
1. ✅ Procurement contains no stock-posting, pricing, numbering, approval or account-determination code — all delegated to Part 1 services
2. ✅ Every price on every procurement document produced by pricing procedure, document displays which access produced each rate
3. ✅ Every procurement approval runs through Part 1 release strategy engine with no module-local logic

### Sourcing (4–8)
4. ✅ Purchasing info record maintains price and quality history automatically from transactions
5. ✅ Source-controlled material with off-list vendor refused without override; override reason reaches release note
6. ✅ Quota arrangement allocates correctly and refuses over-allocation, displaying current split
7. ✅ Rate contract release consumes cap and is refused beyond it
8. ✅ Scheduling agreement call-off creates delivery schedule lines correctly

### Requirement Determination (9–11)
9. ✅ Reorder-point planning generates planned requisition when stock plus open orders minus reservations falls below level
10. ✅ BOQ explosion produces net material requirement by date for WBS element, netting off stock, reservations, in-transit and open orders
11. ✅ Consolidation merges requisitions across projects while preserving each line's account assignment

### Requisition (12–17)
12. ✅ Requisition screen displays stock, sibling-site stock, reserved, in-transit, on-order and with-subcontractor quantities before submission
13. ✅ Remaining budget displayed before submission; at 105% usage release is blocked
14. ✅ Duplicate requisition for same material, project and window is flagged
15. ✅ Incomplete specification on specification-controlled material group is refused
16. ✅ Emergency requisition takes short strategy, forces justification, notifies management and appears on emergency report
17. ✅ Requisition tracking shows live downstream status through to delivery

### RFQ and Comparison (18–23)
18. ✅ Sealed RFQ quotations unreadable before deadline and require two authorised users to open, logged
19. ✅ Comparative statement computes landed value, tax, creditable tax, effective cost and payment-term adjustment — verified against worked example
20. ✅ Composition-scheme vendor ranks correctly worse than equal-priced registered vendor
21. ✅ Vendor history columns (on-time %, rejection %, MSME, GST filing status, blacklist) populate from live data
22. ✅ Non-lowest award requires justification, which appears to every approver and on monthly report
23. ✅ Negotiation rounds recorded and final rate traces to recorded round

### Purchase Order (24–30)
24. ✅ Inter-state order derives IGST, intra-state derives CGST+SGST; user cannot override
25. ✅ Order release creates commitment that immediately consumes budget availability
26. ✅ Order amendment creates version, re-enters release strategy and preserves original as issued
27. ✅ Vendor change on amendment routes to highest approval level
28. ✅ Short closure releases residual commitment with reason code
29. ✅ Service order requires accepted service entry sheet before invoicing is possible
30. ✅ Order PDF prints with branding, full terms and resolving QR code

### Minerals and Evaluation (31–32)
31. ✅ Receipt exceeding transit permit quantity is blocked; expired permit is blocked; reused permit number raises high-severity exception
32. ✅ Vendor scores compute entirely from transaction data; blacklisted vendor cannot be selected on new requisition or order

---

## Key Business Rules Enforced

1. **Framework compliance absolute** — no stock/pricing/numbering/approval/account-determination code in procurement module
2. **Pricing via condition technique** — all prices computed through pricing procedure with access sequence
3. **Approval via release strategy** — all approvals through Part 1 engine
4. **Source list enforcement** — off-list vendors blocked without override
5. **Quota enforcement** — over-allocation refused
6. **Rate contract cap** — releases beyond cap refused
7. **Budget availability control** — 105% usage blocks release
8. **Duplicate detection** — same material/project/window flagged
9. **Specification completeness** — vague specs refused
10. **Emergency purchase tracking** — monthly report prevents abuse
11. **Sealed RFQ** — two authorised users required to open
12. **Comparable cost ranking** — not quoted rate
13. **Composition vendor penalty** — ITC not creditable loads into cost
14. **Non-lowest award justification** — mandatory, visible to all approvers
15. **Negotiation traceability** — final rate traces to recorded round
16. **Tax derivation** — place of supply determines CGST+SGST vs IGST
17. **Commitment on release** — budget consumed immediately
18. **Amendment versioning** — old→new per field, original preserved
19. **Vendor change escalation** — highest approval level
20. **Short closure with reason** — commitment released
21. **Service entry sheet** — work accepted before invoicing
22. **Transit permit controls** — quantity/expiry/reuse checks
23. **Vendor evaluation from transactions** — never typed
24. **Blacklist enforcement** — hard block on new orders
25. **Procurement intelligence** — spend, concentration, variance, cycle time, savings analysis

---

## Integration Points

- **Part 1** — Posting engine (commitment posting), pricing procedure (all pricing), release strategy (all approvals), numbering service (all document numbers), account determination (all postings)
- **Part 2** — Master data (materials, partners, purchasing info records, source lists)
- **Part 3** — Project system (WBS for account assignment, budget availability control)
- **Part 5** — Inventory (stock availability display, goods receipt against PO)
- **Part 6** — Contracts (rate contracts, scheduling agreements)
- **Part 7** — Finance (commitment posting, GR-IR clearing, payment processing)
- **Part 8** — QMS (inspection lots for quality scoring), EAM (equipment for capital purchases)
- **Part 9** — Communication (conversation threads on orders, expediting notes), Tools (PDF generation for order printing, import engine for BOQ import)

---

## Total System Status

**Parts 1-4 complete: 147 passing acceptance tests**
- Part 1: 40 tests ✅
- Part 2: 30 tests ✅
- Part 3: 35 tests ✅
- Part 4: 32 tests ✅

**Ready to proceed to Part 5: Stores & Inventory — Movement Types, Gate to Bin, Valuation, Reconciliation**
