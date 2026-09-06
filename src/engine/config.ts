import type {
  Company, TaxRegistrationUnit, OperatingSite, ProjectDef, CostCentre, GLAccount,
  Material, Partner, InfoRecord, ConditionRecord, TaxCode, DocumentType, MovementType,
  RoleDef, UserDef, ClosingStep, ModuleCode, ItemCategory,
  WbsNode, ContractMaster, BoqItem, RateAnalysis, BankGuarantee, InsurancePolicy,
  Dispute, ComplianceTask, MinWage, AssetMaster,
  UomDef, UomFactor, Geofence, ProjectTemplate,
} from './types';

/* ---------------- Enterprise structure ---------------- */

export const CONTROLLING_AREA = { code: 'CA-VUL', name: 'Vulcan Group Controlling Area', currency: 'INR', coa: 'COA-V1' };

export const COMPANIES: Company[] = [
  { code: 'VUL', name: 'Vulcan Constructions Ltd', cin: 'U45200MH1987PLC043210', pan: 'AAACV4412F', controllingArea: 'CA-VUL', coa: 'COA-V1', currency: 'INR', fyVariant: 'APR-MAR-12+4', hqState: 'MH' },
  { code: 'VUR', name: 'Vulcan RMC & Materials Pvt Ltd', cin: 'U26942MH2009PTC194558', pan: 'AAJCV8834K', controllingArea: 'CA-VUL', coa: 'COA-V1', currency: 'INR', fyVariant: 'APR-MAR-12+4', hqState: 'MH' },
];

export const TRUS: TaxRegistrationUnit[] = [
  { code: 'TRU-MH', companyId: 'VUL', gstin: '27AAACV4412F1Z5', state: 'MH', stateName: 'Maharashtra' },
  { code: 'TRU-GJ', companyId: 'VUL', gstin: '24AAACV4412F1Z2', state: 'GJ', stateName: 'Gujarat' },
  { code: 'TRU-RMC', companyId: 'VUR', gstin: '27AAJCV8834K1Z8', state: 'MH', stateName: 'Maharashtra' },
];

export const BUSINESS_UNITS = [
  { code: 'BU-ROAD', name: 'Roads & Highways' },
  { code: 'BU-BLD', name: 'Buildings' },
  { code: 'BU-RMC', name: 'RMC & Materials' },
];

export const SITES: OperatingSite[] = [
  {
    code: 'ST-NH47', name: 'NH-47 Package-3 Site', type: 'PROJECT_SITE', companyId: 'VUL', truId: 'TRU-MH',
    state: 'MH', city: 'Pune', distanceKm: 12,
    storageLocs: [
      { code: 'UNR', name: 'Unrestricted Store', stockTypes: ['UNR'] },
      { code: 'QH', name: 'Quality Hold Yard', stockTypes: ['QH'] },
      { code: 'BLK', name: 'Blocked / Reject', stockTypes: ['BLK'] },
      { code: 'SUB', name: 'Subcontractor Stock', stockTypes: ['SUB'] },
      { code: 'RET', name: 'Returnable Pool', stockTypes: ['RET'] },
    ],
  },
  {
    code: 'ST-GDN', name: 'Pune Central Godown', type: 'CENTRAL_STORE', companyId: 'VUL', truId: 'TRU-MH',
    state: 'MH', city: 'Pune', distanceKm: 0,
    storageLocs: [
      { code: 'UNR', name: 'Unrestricted Store', stockTypes: ['UNR'] },
      { code: 'TRN', name: 'Goods in Transit', stockTypes: ['TRN'] },
      { code: 'BLK', name: 'Blocked / Reject', stockTypes: ['BLK'] },
    ],
  },
  {
    code: 'ST-WSH', name: 'Pune Equipment Workshop', type: 'WORKSHOP', companyId: 'VUL', truId: 'TRU-MH',
    state: 'MH', city: 'Pune', distanceKm: 8,
    storageLocs: [{ code: 'UNR', name: 'Spare Parts Store', stockTypes: ['UNR'] }],
  },
  {
    code: 'ST-AHD', name: 'Ahmedabad Elevated Corridor', type: 'PROJECT_SITE', companyId: 'VUL', truId: 'TRU-GJ',
    state: 'GJ', city: 'Ahmedabad', distanceKm: 660,
    storageLocs: [
      { code: 'UNR', name: 'Unrestricted Store', stockTypes: ['UNR'] },
      { code: 'QH', name: 'Quality Hold Yard', stockTypes: ['QH'] },
    ],
  },
  {
    code: 'ST-RMC', name: 'Talegaon Batching Plant', type: 'PRODUCTION_PLANT', companyId: 'VUR', truId: 'TRU-RMC',
    state: 'MH', city: 'Talegaon', distanceKm: 40,
    storageLocs: [
      { code: 'UNR', name: 'RM & FG Store', stockTypes: ['UNR'] },
      { code: 'QH', name: 'Lab Hold', stockTypes: ['QH'] },
    ],
  },
];

export const PURCH_ORGS = [
  { code: 'PUR-C', name: 'Central Procurement', companyCodes: ['VUL', 'VUR'] },
  { code: 'PUR-S', name: 'Site Procurement — West', companyCodes: ['VUL'] },
];
export const PURCH_GROUPS = [
  { code: 'PG-CIV', name: 'Civil Materials Desk' },
  { code: 'PG-MEC', name: 'Mech / Equipment Desk' },
  { code: 'PG-GEN', name: 'General & Consumables' },
];
export const BILLING_ORG = { code: 'BIL-1', name: 'Vulcan Billing Organisation' };
export const BILLING_CHANNELS = [
  { code: 'BC-GOV', name: 'Government' },
  { code: 'BC-PSU', name: 'PSU' },
  { code: 'BC-PVT', name: 'Private' },
  { code: 'BC-CAP', name: 'Captive Transfer' },
];

export const PROJECTS: ProjectDef[] = [
  {
    code: 'PRJ-NH47', name: 'NH-47 Package-3 — 4-Laning', companyId: 'VUL', siteCode: 'ST-NH47', budget: 8_40_00_000,
    wbs: [
      { code: 'PRJ-NH47-E', name: 'Earthworks' },
      { code: 'PRJ-NH47-S', name: 'Structures' },
      { code: 'PRJ-NH47-P', name: 'Pavement' },
    ],
  },
  {
    code: 'PRJ-AHD', name: 'Ahmedabad Elevated Corridor', companyId: 'VUL', siteCode: 'ST-AHD', budget: 12_60_00_000,
    wbs: [
      { code: 'PRJ-AHD-F', name: 'Foundations & Piles' },
      { code: 'PRJ-AHD-D', name: 'Deck & Girders' },
    ],
  },
];

export const COST_CENTRES: CostCentre[] = [
  { code: 'CC-ADM', name: 'Corporate Administration', companyId: 'VUL', group: 'ADMIN' },
  { code: 'CC-4700', name: 'NH-47 Site Overheads', companyId: 'VUL', group: 'SITE' },
  { code: 'CC-WSH', name: 'Workshop Operations', companyId: 'VUL', group: 'WORKSHOP' },
  { code: 'CC-RMC1', name: 'Batching Plant Operations', companyId: 'VUR', group: 'PLANT' },
];

/* ---------------- Chart of accounts ---------------- */

export const GL_ACCOUNTS: GLAccount[] = [
  { code: '110100', name: 'Stock — Materials', group: 'ASSET', control: 'STOCK' },
  { code: '110150', name: 'Stock — RMC Semi-Finished', group: 'ASSET', control: 'STOCK' },
  { code: '110160', name: 'Stock — Client-Issued Material (split valuation)', group: 'ASSET', control: 'STOCK' },
  { code: '110200', name: 'Stock in Transit', group: 'ASSET', control: 'STOCK' },
  { code: '110300', name: 'GR/IR Clearing', group: 'LIABILITY', control: 'GRIR' },
  { code: '110400', name: 'Stock with Subcontractor', group: 'ASSET', control: 'STOCK' },
  { code: '120100', name: 'Sundry Creditors', group: 'LIABILITY', control: 'VENDOR' },
  { code: '120200', name: 'Advances to Suppliers', group: 'LIABILITY', special: 'A' },
  { code: '120300', name: 'Retention Payable', group: 'LIABILITY', special: 'R' },
  { code: '120400', name: 'Client Material Control', group: 'LIABILITY' },
  { code: '120500', name: 'Deposits & Security', group: 'LIABILITY', special: 'S' },
  { code: '120600', name: 'Recovery Receivable', group: 'ASSET' },
  { code: '121000', name: 'TDS Payable', group: 'LIABILITY', control: 'TAX' },
  { code: '121100', name: 'GST Payable — Output', group: 'LIABILITY', control: 'TAX' },
  { code: '130100', name: 'Input Credit — CGST', group: 'ASSET' },
  { code: '130200', name: 'Input Credit — SGST', group: 'ASSET' },
  { code: '130300', name: 'Input Credit — IGST', group: 'ASSET' },
  { code: '140100', name: 'Bank — Corporate Account', group: 'ASSET' },
  { code: '140200', name: 'Site Imprest Cash', group: 'ASSET' },
  { code: '210100', name: 'Sundry Debtors', group: 'ASSET', control: 'CUSTOMER' },
  { code: '210200', name: 'Mobilisation Advance from Client', group: 'LIABILITY', special: 'M' },
  { code: '210300', name: 'Retention Receivable', group: 'ASSET', special: 'R' },
  { code: '310100', name: 'Revenue — Construction', group: 'REVENUE' },
  { code: '310200', name: 'Revenue — RMC Sales', group: 'REVENUE' },
  { code: '410100', name: 'Project Consumption — Material', group: 'EXPENSE' },
  { code: '410200', name: 'Cost Centre Consumption', group: 'EXPENSE' },
  { code: '420100', name: 'Maintenance Order Cost', group: 'EXPENSE' },
  { code: '420200', name: 'Production Order Cost', group: 'EXPENSE' },
  { code: '430100', name: 'Inventory Difference', group: 'EXPENSE' },
  { code: '430200', name: 'Stock Write-Off', group: 'EXPENSE' },
  { code: '440100', name: 'Price Difference', group: 'EXPENSE' },
  { code: '510100', name: 'Cost of Goods Sold — RMC', group: 'EXPENSE' },
  { code: '910100', name: 'Rounding Off', group: 'EXPENSE' },
  /* ---- Part 3 commercial / financial accounts ---- */
  { code: '150100', name: 'Unbilled Revenue (Contract Asset)', group: 'ASSET' },
  { code: '220100', name: 'Billing in Advance (Contract Liability)', group: 'LIABILITY' },
  { code: '220200', name: 'Provision — Onerous Contracts', group: 'LIABILITY' },
  { code: '220300', name: 'Retention from Client', group: 'LIABILITY' },
  { code: '220400', name: 'Mobilisation Advance Recoverable', group: 'LIABILITY' },
  { code: '220500', name: 'Secured Advance — Materials at Site', group: 'LIABILITY' },
  { code: '150200', name: 'Retention Receivable from Client', group: 'ASSET' },
  { code: '310300', name: 'Revenue — Recognised (PoC)', group: 'REVENUE' },
  { code: '440200', name: 'Cost of Construction (PoC)', group: 'EXPENSE' },
  { code: '440300', name: 'Expected Loss — Onerous Contract', group: 'EXPENSE' },
  { code: '420300', name: 'Depreciation Expense', group: 'EXPENSE' },
  { code: '160100', name: 'Fixed Assets — Plant & Equipment', group: 'ASSET' },
  { code: '160200', name: 'Accumulated Depreciation', group: 'ASSET' },
  { code: '150300', name: 'GST Input Credit Receivable', group: 'ASSET' },
];

/* ---------------- Master data ---------------- */

export const MATERIAL_GROUPS = [
  { code: 'MG-CEM', name: 'Cement & Binders' },
  { code: 'MG-STL', name: 'Steel & Rebar' },
  { code: 'MG-AGG', name: 'Aggregates & Sand' },
  { code: 'MG-FUL', name: 'Fuels & Lubricants' },
  { code: 'MG-CON', name: 'Consumables' },
  { code: 'MG-SPR', name: 'Spares' },
  { code: 'MG-RMC', name: 'RMC Output' },
  { code: 'MG-GEO', name: 'Geosynthetics' },
];

export const MATERIALS: Material[] = [
  { code: 'MAT-C53', desc: 'Cement OPC 53 Grade', spec: 'IS 12269 · 50 kg bag', group: 'MG-CEM', accountGroup: 'RAWM', baseUom: 'BAG', altUom: 'MT', conv: 20, hsn: '2523', valuationClass: 'VC-RAW', priceControl: 'MAP', price: 412, views: ['Basic', 'Purchasing', 'Inventory', 'Valuation', 'Quality', 'Planning', 'Costing', 'Site'], status: 'ACTIVE', itc: 'ELIGIBLE', createdBy: 'USR-MDM' },
  { code: 'MAT-STL16', desc: 'TMT Rebar Fe500D 16 mm', spec: 'IS 1786 · length 12 m', group: 'MG-STL', accountGroup: 'RAWM', baseUom: 'MT', altUom: 'KG', conv: 1000, hsn: '7214', valuationClass: 'VC-RAW', priceControl: 'MAP', price: 58400, views: ['Basic', 'Purchasing', 'Inventory', 'Valuation', 'Quality', 'Costing', 'Site'], status: 'ACTIVE', itc: 'ELIGIBLE', createdBy: 'USR-MDM' },
  { code: 'MAT-AGG20', desc: 'Crushed Aggregate 20 mm', spec: 'IS 383 Zone — II', group: 'MG-AGG', accountGroup: 'RAWM', baseUom: 'M3', hsn: '2517', valuationClass: 'VC-RAW', priceControl: 'MAP', price: 1360, views: ['Basic', 'Purchasing', 'Inventory', 'Valuation', 'Quality', 'Site'], status: 'ACTIVE', itc: 'ELIGIBLE', royalty: true, createdBy: 'USR-MDM' },
  { code: 'MAT-SND', desc: 'Manufactured Sand', spec: 'IS 383 Zone II', group: 'MG-AGG', accountGroup: 'RAWM', baseUom: 'M3', hsn: '2505', valuationClass: 'VC-RAW', priceControl: 'MAP', price: 1120, views: ['Basic', 'Purchasing', 'Inventory', 'Valuation', 'Site'], status: 'ACTIVE', itc: 'ELIGIBLE', royalty: true, createdBy: 'USR-MDM' },
  { code: 'MAT-HSD', desc: 'HSD (Diesel)', spec: 'BS-VI · bulk bowser', group: 'MG-FUL', accountGroup: 'FUEL', baseUom: 'LTR', hsn: '2710', valuationClass: 'VC-FUEL', priceControl: 'MAP', price: 92.4, views: ['Basic', 'Purchasing', 'Inventory', 'Valuation', 'Planning', 'Site'], status: 'ACTIVE', itc: 'ELIGIBLE', createdBy: 'USR-MDM' },
  { code: 'MAT-WBR', desc: 'Welding Electrode E7018', spec: 'AWS A5.1 · 3.15 mm', group: 'MG-CON', accountGroup: 'CONS', baseUom: 'KG', hsn: '8311', valuationClass: 'VC-CONS', priceControl: 'MAP', price: 148, views: ['Basic', 'Purchasing', 'Inventory', 'Valuation', 'Site'], status: 'ACTIVE', itc: 'ELIGIBLE', createdBy: 'USR-MDM' },
  { code: 'MAT-PPE', desc: 'Safety Helmet ISI', spec: 'IS 2925', group: 'MG-CON', accountGroup: 'CONS', baseUom: 'NOS', hsn: '6506', valuationClass: 'VC-CONS', priceControl: 'MAP', price: 185, views: ['Basic', 'Purchasing', 'Inventory', 'Valuation', 'Site'], status: 'ACTIVE', itc: 'ELIGIBLE', createdBy: 'USR-MDM' },
  { code: 'MAT-EXHR', desc: 'Excavator 20T — Hire', spec: 'Wet hire · with operator', group: 'MG-SPR', accountGroup: 'SERV', baseUom: 'HR', hsn: '9973', valuationClass: 'VC-SERV', priceControl: 'MAP', price: 2450, views: ['Basic', 'Purchasing', 'Valuation', 'Site'], status: 'ACTIVE', itc: 'ELIGIBLE', createdBy: 'USR-MDM' },
  { code: 'MAT-RMC25', desc: 'RMC M25 (Pumped)', spec: 'IS 4926 · 20mm agg', group: 'MG-RMC', accountGroup: 'SEMI', baseUom: 'M3', hsn: '2523', valuationClass: 'VC-SEMI', priceControl: 'STD', price: 4950, views: ['Basic', 'Purchasing', 'Inventory', 'Valuation', 'Quality', 'Site'], status: 'ACTIVE', itc: 'ELIGIBLE', createdBy: 'USR-MDM' },
  { code: 'MAT-GEO', desc: 'Geotextile NT-1200', spec: 'Non-woven 1200 gsm', group: 'MG-GEO', accountGroup: 'RAWM', baseUom: 'SQM', hsn: '5603', valuationClass: 'VC-RAW', priceControl: 'MAP', price: 96, views: ['Basic'], status: 'ACTIVE', itc: 'ELIGIBLE', createdBy: 'USR-MDM' },
];

export const PARTNERS: Partner[] = [
  { id: 'BP-SHREE', name: 'Shree Cement Distributors', legalName: 'Shree Cement Distributors LLP', roles: ['VENDOR'], accountGroup: 'VEND', pan: 'AABFS9921L', gstin: [{ state: 'MH', no: '27AABFS9921L1ZC' }], regType: 'REGULAR', state: 'MH', stateName: 'Maharashtra', tdsSection: '194Q', tdsPct: 0.1, reconAccount: '120100', bank: { bankName: 'HDFC Bank, Pune', acct: '50200041129334', ifsc: 'HDFC0001207' }, msme: true, rating: 88, status: 'ACTIVE', createdBy: 'USR-MDM' },
  { id: 'BP-TATA', name: 'Tata Steel Retail', legalName: 'Tata Steel Ltd — Retail Division', roles: ['VENDOR'], accountGroup: 'VEND', pan: 'AAACT2727Q', gstin: [{ state: 'MH', no: '27AAACT2727Q1ZM' }, { state: 'GJ', no: '24AAACT2727Q1ZP' }], regType: 'REGULAR', state: 'MH', stateName: 'Maharashtra', tdsSection: '194Q', tdsPct: 0.1, reconAccount: '120100', bank: { bankName: 'ICICI Bank, Mumbai', acct: '000405001234', ifsc: 'ICIC0000004' }, msme: false, rating: 94, status: 'ACTIVE', createdBy: 'USR-MDM' },
  { id: 'BP-KRISH', name: 'Krishna Aggregates', legalName: 'Krishna Mines & Aggregates', roles: ['VENDOR'], accountGroup: 'VEND', pan: 'AAJPK3345R', gstin: [{ state: 'MH', no: '27AAJPK3345R1ZA' }], regType: 'REGULAR', state: 'MH', stateName: 'Maharashtra', tdsSection: '194C', tdsPct: 2, reconAccount: '120100', bank: { bankName: 'Bank of Maharashtra', acct: '60212445678', ifsc: 'MAHB0001122' }, msme: true, rating: 76, status: 'ACTIVE', createdBy: 'USR-MDM' },
  { id: 'BP-IOCL', name: 'IndOil Fleet Supplies', legalName: 'IndOil Marketing Co Ltd', roles: ['VENDOR'], accountGroup: 'VEND', pan: 'AAACI5567M', gstin: [{ state: 'MH', no: '27AAACI5567M1ZF' }], regType: 'REGULAR', state: 'MH', stateName: 'Maharashtra', tdsSection: '194B', tdsPct: 0, reconAccount: '120100', bank: { bankName: 'SBI, New Delhi', acct: '30012345678', ifsc: 'SBIN0000691' }, msme: false, rating: 91, status: 'ACTIVE', createdBy: 'USR-MDM' },
  { id: 'BP-SAI', name: 'Sai Earthmovers', legalName: 'Sai Earthmovers Pvt Ltd', roles: ['VENDOR', 'SUBCON'], accountGroup: 'VEND', pan: 'AAGCS8812P', gstin: [{ state: 'GJ', no: '24AAGCS8812P1ZK' }], regType: 'REGULAR', state: 'GJ', stateName: 'Gujarat', tdsSection: '194I', tdsPct: 2, reconAccount: '120100', bank: { bankName: 'Axis Bank, Surat', acct: '913010012345678', ifsc: 'UTIB0000321' }, msme: true, rating: 71, status: 'ACTIVE', createdBy: 'USR-MDM' },
  { id: 'BP-PRAK', name: 'Prakash Civil Contractors', legalName: 'Prakash Civil Contractors', roles: ['SUBCON'], accountGroup: 'SUBC', pan: 'AAHFP7743N', gstin: [{ state: 'MH', no: '27AAHFP7743N1ZQ' }], regType: 'REGULAR', state: 'MH', stateName: 'Maharashtra', tdsSection: '194C', tdsPct: 2, reconAccount: '120100', bank: { bankName: 'Punjab National Bank', acct: '04561230000987', ifsc: 'PUNB0045600' }, msme: true, rating: 82, status: 'ACTIVE', createdBy: 'USR-MDM' },
  { id: 'BP-NHAI', name: 'NHAI — PIU Pune', legalName: 'National Highways Authority of India', roles: ['CLIENT'], accountGroup: 'CLNT', pan: 'AAACN9910H', gstin: [{ state: 'MH', no: '27AAACN9910H1ZS' }], regType: 'REGULAR', state: 'MH', stateName: 'Maharashtra', tdsSection: '—', tdsPct: 0, reconAccount: '210100', bank: { bankName: 'RBI, New Delhi', acct: 'GOV-ACCT-8890', ifsc: '—' }, msme: false, rating: 99, status: 'ACTIVE', createdBy: 'USR-MDM' },
  { id: 'BP-SUNR', name: 'Sunrise Chemicals', legalName: 'Sunrise Specialty Chemicals LLP', roles: ['VENDOR'], accountGroup: 'VEND', pan: 'AAHFS2210C', gstin: [{ state: 'MH', no: '27AAHFS2210C1ZW' }], regType: 'COMPOSITION', state: 'MH', stateName: 'Maharashtra', tdsSection: '194Q', tdsPct: 0.1, reconAccount: '120100', bank: { bankName: 'Kotak Bank', acct: '778812340000', ifsc: 'KKBK0000211' }, msme: true, rating: 64, status: 'ACTIVE', createdBy: 'USR-MDM' },
];

export const INFO_RECORDS: InfoRecord[] = [
  { vendorId: 'BP-SHREE', materialCode: 'MAT-C53', rate: 405, validFrom: '2025-04-01' },
  { vendorId: 'BP-TATA', materialCode: 'MAT-STL16', rate: 57800, validFrom: '2025-04-01' },
  { vendorId: 'BP-KRISH', materialCode: 'MAT-AGG20', rate: 1285, validFrom: '2025-04-01' },
  { vendorId: 'BP-KRISH', materialCode: 'MAT-SND', rate: 1040, validFrom: '2025-04-01' },
  { vendorId: 'BP-IOCL', materialCode: 'MAT-HSD', rate: 91.85, validFrom: '2025-10-01' },
  { vendorId: 'BP-SAI', materialCode: 'MAT-EXHR', rate: 2350, validFrom: '2025-04-01' },
];

export const CONDITION_RECORDS: ConditionRecord[] = [
  { condType: 'DISC', key: 'BP-SHREE|MG-CEM', rate: 2.0, per: 'PCT', validFrom: '2025-04-01' },
  { condType: 'DISC', key: 'BP-TATA|MG-STL', rate: 1.0, per: 'PCT', validFrom: '2025-04-01' },
  { condType: 'FRGT', key: 'BP-SHREE|MAT-C53', rate: 6.0, per: 'UNIT', validFrom: '2025-04-01' },
  { condType: 'FRGT', key: 'BP-KRISH|MAT-AGG20', rate: 180, per: 'UNIT', validFrom: '2025-04-01' },
  { condType: 'FRGT', key: 'BP-TATA|MAT-STL16', rate: 420, per: 'UNIT', validFrom: '2025-04-01' },
  { condType: 'LDLF', key: 'SLAB|MH', rate: 1.6, per: 'UNIT', validFrom: '2025-04-01' },
  { condType: 'LDLF', key: 'SLAB|GJ', rate: 4.2, per: 'UNIT', validFrom: '2025-04-01' },
  { condType: 'ROYL', key: 'ROYL|MG-AGG', rate: 48, per: 'UNIT', validFrom: '2025-04-01' },
  { condType: 'LOAD', key: 'BP-KRISH', rate: 35, per: 'UNIT', validFrom: '2025-04-01' },
  { condType: 'WSTG', key: 'MG-CEM', rate: 2.0, per: 'PCT', validFrom: '2025-04-01' },
  { condType: 'WSTG', key: 'MG-STL', rate: 3.0, per: 'PCT', validFrom: '2025-04-01' },
];

/* Effective-dated tax codes — the rate in force on the document date applies */
export const TAX_CODES: TaxCode[] = [
  { code: 'T18', hsnPrefix: '2523', desc: 'Cement / concrete — standard', ratePct: 28, validFrom: '2025-04-01', validTo: '2025-12-31' },
  { code: 'T18', hsnPrefix: '2523', desc: 'Cement / concrete — rate revision', ratePct: 26, validFrom: '2026-01-01' },
  { code: 'T18', hsnPrefix: '72', desc: 'Steel & articles of iron/steel', ratePct: 18, validFrom: '2025-04-01' },
  { code: 'T12', hsnPrefix: '2517', desc: 'Aggregates / mineral materials', ratePct: 5, validFrom: '2025-04-01' },
  { code: 'T12', hsnPrefix: '2505', desc: 'Natural / manufactured sand', ratePct: 5, validFrom: '2025-04-01' },
  { code: 'T18', hsnPrefix: '2710', desc: 'Petroleum fuels', ratePct: 18, validFrom: '2025-04-01' },
  { code: 'T18', hsnPrefix: '83', desc: 'Welding consumables', ratePct: 18, validFrom: '2025-04-01' },
  { code: 'T18', hsnPrefix: '65', desc: 'Headgear / PPE', ratePct: 18, validFrom: '2025-04-01' },
  { code: 'T18', hsnPrefix: '9973', desc: 'Machinery hire services', ratePct: 18, validFrom: '2025-04-01' },
  { code: 'T18', hsnPrefix: '5603', desc: 'Geotextiles / nonwovens', ratePct: 12, validFrom: '2025-04-01' },
];

/* ---------------- Item categories ---------------- */

export const ITEM_CATEGORIES: Record<ItemCategory, { desc: string; gr: string; valuated: string; consumesTo: string }> = {
  STD: { desc: 'Standard material', gr: 'Goods receipt', valuated: 'Yes', consumesTo: 'Stock → issue' },
  CNS: { desc: 'Direct consumption', gr: 'Goods receipt', valuated: 'Direct cost', consumesTo: 'WBS / cost centre' },
  SVC: { desc: 'Service', gr: 'Service entry sheet', valuated: 'No', consumesTo: 'WBS / cost centre' },
  SUB: { desc: 'Subcontracting', gr: 'Output receipt', valuated: 'Yes', consumesTo: 'Issued components' },
  CNG: { desc: 'Consignment', gr: 'Goods receipt', valuated: 'On withdrawal', consumesTo: 'WBS' },
  LIM: { desc: 'Limit / blanket', gr: 'No', valuated: 'Up to limit', consumesTo: 'Cost centre' },
  TXT: { desc: 'Text line', gr: 'No', valuated: 'No', consumesTo: '—' },
  FOC: { desc: 'Free of charge (client-issued)', gr: 'Goods receipt', valuated: 'At issue rate', consumesTo: 'Stock' },
};

/* ---------------- Document types ---------------- */

export const DOC_TYPES: DocumentType[] = [
  { code: 'PR-STD', module: 'PRC', desc: 'Purchase requisition — standard', numberRange: 'NR-PR', itemCategories: ['STD', 'CNS', 'SVC', 'SUB'], pricingProcedure: 'PRC-STD', releaseGroup: 'REL-PR', postingBehaviour: 'STATISTICAL', followOn: ['RQ-STD', 'PO-STD'] },
  { code: 'PR-EMG', module: 'PRC', desc: 'Purchase requisition — emergency', numberRange: 'NR-PR', itemCategories: ['STD', 'CNS'], pricingProcedure: 'PRC-STD', releaseGroup: 'REL-PR', postingBehaviour: 'STATISTICAL', followOn: ['PO-STD'] },
  { code: 'PR-SVC', module: 'PRC', desc: 'Purchase requisition — service', numberRange: 'NR-PR', itemCategories: ['SVC', 'LIM'], pricingProcedure: 'PRC-STD', releaseGroup: 'REL-PR', postingBehaviour: 'STATISTICAL', followOn: ['PO-SVC'] },
  { code: 'RQ-STD', module: 'PRC', desc: 'Request for quotation', numberRange: 'NR-RQ', itemCategories: ['STD', 'SVC'], pricingProcedure: 'PRC-STD', postingBehaviour: 'STATISTICAL', followOn: ['PO-STD'] },
  { code: 'PO-STD', module: 'PRC', desc: 'Purchase order — standard', numberRange: 'NR-PO', itemCategories: ['STD', 'CNS', 'FOC'], pricingProcedure: 'PRC-STD', releaseGroup: 'REL-PO', postingBehaviour: 'VALUE', reversalType: 'PO-STD', followOn: ['GR-PO', 'IV-VEN'] },
  { code: 'PO-SVC', module: 'PRC', desc: 'Purchase order — service', numberRange: 'NR-PO', itemCategories: ['SVC', 'LIM'], pricingProcedure: 'PRC-STD', releaseGroup: 'REL-PO', postingBehaviour: 'VALUE', followOn: ['IV-VEN'] },
  { code: 'PO-SUB', module: 'PRC', desc: 'Subcontract purchase order', numberRange: 'NR-PO', itemCategories: ['SUB'], pricingProcedure: 'PRC-STD', releaseGroup: 'REL-PO', postingBehaviour: 'VALUE', followOn: ['GR-PO', 'IV-VEN'] },
  { code: 'PO-RC', module: 'PRC', desc: 'Rate-contract release order', numberRange: 'NR-PO', itemCategories: ['STD'], pricingProcedure: 'PRC-STD', releaseGroup: 'REL-PO', postingBehaviour: 'VALUE', followOn: ['GR-PO'] },
  { code: 'PO-IMP', module: 'PRC', desc: 'Import purchase order', numberRange: 'NR-PO', itemCategories: ['STD'], pricingProcedure: 'PRC-STD', releaseGroup: 'REL-PO', postingBehaviour: 'VALUE', followOn: ['GR-PO'] },
  { code: 'IV-VEN', module: 'FIN', desc: 'Vendor invoice receipt', numberRange: 'NR-IV', itemCategories: ['STD', 'CNS', 'SVC'], pricingProcedure: 'PRC-STD', postingBehaviour: 'VALUE', reversalType: 'IV-VEN' },
  { code: 'GR-PO', module: 'INV', desc: 'Goods receipt vs purchase order', numberRange: 'NR-MD', itemCategories: ['STD', 'SUB', 'FOC'], pricingProcedure: '—', postingBehaviour: 'STOCK', reversalType: 'GR-PO' },
  { code: 'GR-RTN', module: 'INV', desc: 'Goods receipt — return from site', numberRange: 'NR-MD', itemCategories: ['STD'], pricingProcedure: '—', postingBehaviour: 'STOCK' },
  { code: 'GI-PRJ', module: 'INV', desc: 'Goods issue to project', numberRange: 'NR-MD', itemCategories: ['STD'], pricingProcedure: '—', postingBehaviour: 'STOCK', reversalType: 'GI-PRJ' },
  { code: 'GI-CC', module: 'INV', desc: 'Goods issue to cost centre', numberRange: 'NR-MD', itemCategories: ['STD', 'CNS'], pricingProcedure: '—', postingBehaviour: 'STOCK' },
  { code: 'GI-EAM', module: 'INV', desc: 'Goods issue to maintenance order', numberRange: 'NR-MD', itemCategories: ['STD'], pricingProcedure: '—', postingBehaviour: 'STOCK' },
  { code: 'ST-PLT', module: 'INV', desc: 'Site-to-site transfer', numberRange: 'NR-MD', itemCategories: ['STD'], pricingProcedure: '—', postingBehaviour: 'STOCK' },
  { code: 'ST-LOC', module: 'INV', desc: 'Storage location transfer', numberRange: 'NR-MD', itemCategories: ['STD'], pricingProcedure: '—', postingBehaviour: 'STOCK' },
  { code: 'PI-ADJ', module: 'INV', desc: 'Physical inventory adjustment', numberRange: 'NR-MD', itemCategories: ['STD'], pricingProcedure: '—', postingBehaviour: 'STOCK' },
  { code: 'SC-WOF', module: 'INV', desc: 'Scrap / write-off', numberRange: 'NR-MD', itemCategories: ['STD'], pricingProcedure: '—', postingBehaviour: 'STOCK' },
  { code: 'PD-STD', module: 'PRJ', desc: 'Project definition', numberRange: 'NR-PD', itemCategories: ['TXT'], pricingProcedure: '—', postingBehaviour: 'STATISTICAL' },
  { code: 'WBS-STD', module: 'PRJ', desc: 'WBS element', numberRange: 'NR-PD', itemCategories: ['TXT'], pricingProcedure: '—', postingBehaviour: 'STATISTICAL' },
  { code: 'BUD-ORG', module: 'PRJ', desc: 'Original budget document', numberRange: 'NR-BD', itemCategories: ['TXT'], pricingProcedure: '—', postingBehaviour: 'VALUE' },
  { code: 'BUD-SUP', module: 'PRJ', desc: 'Budget supplement', numberRange: 'NR-BD', itemCategories: ['TXT'], pricingProcedure: '—', postingBehaviour: 'VALUE' },
  { code: 'BUD-RET', module: 'PRJ', desc: 'Budget return', numberRange: 'NR-BD', itemCategories: ['TXT'], pricingProcedure: '—', postingBehaviour: 'VALUE' },
  { code: 'CN-CLI', module: 'CTR', desc: 'Client contract', numberRange: 'NR-CT', itemCategories: ['STD', 'TXT'], pricingProcedure: 'BIL-STD', postingBehaviour: 'VALUE' },
  { code: 'VO-STD', module: 'CTR', desc: 'Variation order', numberRange: 'NR-CT', itemCategories: ['STD'], pricingProcedure: 'BIL-STD', postingBehaviour: 'VALUE' },
  { code: 'EI-STD', module: 'CTR', desc: 'Extra item', numberRange: 'NR-CT', itemCategories: ['STD'], pricingProcedure: 'BIL-STD', postingBehaviour: 'VALUE' },
  { code: 'EOT-STD', module: 'CTR', desc: 'Extension of time', numberRange: 'NR-CT', itemCategories: ['TXT'], pricingProcedure: '—', postingBehaviour: 'STATISTICAL' },
  { code: 'CLM-STD', module: 'CTR', desc: 'Claim', numberRange: 'NR-CT', itemCategories: ['STD', 'TXT'], pricingProcedure: 'BIL-STD', postingBehaviour: 'VALUE' },
  { code: 'MB-STD', module: 'BIL', desc: 'Measurement book entry', numberRange: 'NR-BL', itemCategories: ['STD'], pricingProcedure: 'BIL-STD', postingBehaviour: 'STATISTICAL' },
  { code: 'RA-INT', module: 'BIL', desc: 'Interim RA bill', numberRange: 'NR-BL', itemCategories: ['STD'], pricingProcedure: 'BIL-STD', postingBehaviour: 'VALUE' },
  { code: 'RA-FIN', module: 'BIL', desc: 'Final RA bill', numberRange: 'NR-BL', itemCategories: ['STD'], pricingProcedure: 'BIL-STD', postingBehaviour: 'VALUE' },
  { code: 'IV-TAX', module: 'BIL', desc: 'Tax invoice (gapless)', numberRange: 'NR-TINV', itemCategories: ['STD'], pricingProcedure: 'BIL-STD', postingBehaviour: 'VALUE', reversalType: 'CN-CRD' },
  { code: 'CN-CRD', module: 'BIL', desc: 'Credit note (gapless)', numberRange: 'NR-TINV', itemCategories: ['STD'], pricingProcedure: 'BIL-STD', postingBehaviour: 'VALUE' },
  { code: 'DN-DEB', module: 'BIL', desc: 'Debit note (gapless)', numberRange: 'NR-TINV', itemCategories: ['STD'], pricingProcedure: 'BIL-STD', postingBehaviour: 'VALUE' },
  { code: 'SO-STD', module: 'SUB', desc: 'Subcontract order', numberRange: 'NR-SO', itemCategories: ['SUB'], pricingProcedure: 'PRC-STD', postingBehaviour: 'VALUE' },
  { code: 'SM-STD', module: 'SUB', desc: 'Subcontract measurement', numberRange: 'NR-SO', itemCategories: ['STD'], pricingProcedure: 'PRC-STD', postingBehaviour: 'STATISTICAL' },
  { code: 'SB-INT', module: 'SUB', desc: 'Subcontract interim bill', numberRange: 'NR-SO', itemCategories: ['STD'], pricingProcedure: 'PRC-STD', postingBehaviour: 'VALUE' },
  { code: 'SB-FIN', module: 'SUB', desc: 'Subcontract final bill', numberRange: 'NR-SO', itemCategories: ['STD'], pricingProcedure: 'PRC-STD', postingBehaviour: 'VALUE' },
  { code: 'JV-GEN', module: 'FIN', desc: 'General journal voucher', numberRange: 'NR-JV', itemCategories: ['TXT'], pricingProcedure: '—', postingBehaviour: 'VALUE', reversalType: 'JV-REV' },
  { code: 'JV-PRV', module: 'FIN', desc: 'Provision journal', numberRange: 'NR-JV', itemCategories: ['TXT'], pricingProcedure: '—', postingBehaviour: 'VALUE' },
  { code: 'JV-REV', module: 'FIN', desc: 'Reversal journal', numberRange: 'NR-JV', itemCategories: ['TXT'], pricingProcedure: '—', postingBehaviour: 'VALUE' },
  { code: 'PV-VEN', module: 'FIN', desc: 'Outgoing payment — vendor', numberRange: 'NR-JV', itemCategories: ['TXT'], pricingProcedure: '—', postingBehaviour: 'VALUE' },
  { code: 'RV-CUS', module: 'FIN', desc: 'Incoming payment — customer', numberRange: 'NR-JV', itemCategories: ['TXT'], pricingProcedure: '—', postingBehaviour: 'VALUE' },
  { code: 'CO-BNK', module: 'FIN', desc: 'Bank contra / transfer', numberRange: 'NR-JV', itemCategories: ['TXT'], pricingProcedure: '—', postingBehaviour: 'VALUE' },
  { code: 'DP-REQ', module: 'FIN', desc: 'Down-payment request', numberRange: 'NR-JV', itemCategories: ['TXT'], pricingProcedure: '—', postingBehaviour: 'VALUE' },
  { code: 'EQ-LOG', module: 'EAM', desc: 'Equipment usage log', numberRange: 'NR-EQ', itemCategories: ['TXT'], pricingProcedure: '—', postingBehaviour: 'STATISTICAL' },
  { code: 'MO-PRV', module: 'EAM', desc: 'Preventive maintenance order', numberRange: 'NR-EQ', itemCategories: ['STD'], pricingProcedure: '—', postingBehaviour: 'VALUE' },
  { code: 'MO-BRK', module: 'EAM', desc: 'Breakdown maintenance order', numberRange: 'NR-EQ', itemCategories: ['STD'], pricingProcedure: '—', postingBehaviour: 'VALUE' },
  { code: 'EQ-TRF', module: 'EAM', desc: 'Equipment transfer', numberRange: 'NR-EQ', itemCategories: ['TXT'], pricingProcedure: '—', postingBehaviour: 'STATISTICAL' },
  { code: 'AT-PCH', module: 'HCM', desc: 'Attendance punch', numberRange: 'NR-HR', itemCategories: ['TXT'], pricingProcedure: '—', postingBehaviour: 'STATISTICAL' },
  { code: 'AT-COR', module: 'HCM', desc: 'Attendance correction', numberRange: 'NR-HR', itemCategories: ['TXT'], pricingProcedure: '—', postingBehaviour: 'STATISTICAL' },
  { code: 'PY-RUN', module: 'HCM', desc: 'Payroll run', numberRange: 'NR-HR', itemCategories: ['TXT'], pricingProcedure: '—', postingBehaviour: 'VALUE' },
  { code: 'IL-GRN', module: 'QMS', desc: 'Inspection lot — goods receipt', numberRange: 'NR-QM', itemCategories: ['STD'], pricingProcedure: '—', postingBehaviour: 'STATISTICAL' },
  { code: 'IL-WRK', module: 'QMS', desc: 'Inspection lot — works', numberRange: 'NR-QM', itemCategories: ['STD'], pricingProcedure: '—', postingBehaviour: 'STATISTICAL' },
  { code: 'NC-STD', module: 'QMS', desc: 'Non-conformance', numberRange: 'NR-QM', itemCategories: ['TXT'], pricingProcedure: '—', postingBehaviour: 'STATISTICAL' },
];

/* ---------------- Movement types ---------------- */

export const MOVEMENT_TYPES: MovementType[] = [
  { code: '100', desc: 'Goods receipt vs PO → unrestricted', sign: 1, from: null, to: 'UNR', valRel: true, modifier: 'GR', required: ['PO', 'RATE'], drEvent: 'BSX', crEvent: 'WRX', reversal: '105', authObject: 'INV_MVT' },
  { code: '101', desc: 'Goods receipt vs PO → quality hold', sign: 1, from: null, to: 'QH', valRel: true, modifier: 'GR', required: ['PO', 'RATE'], drEvent: 'BSX', crEvent: 'WRX', reversal: '105', authObject: 'INV_MVT' },
  { code: '102', desc: 'Release quality hold → unrestricted', sign: 1, from: 'QH', to: 'UNR', valRel: false, modifier: 'TR', required: [], drEvent: null, crEvent: null, reversal: '103', authObject: 'INV_MVT' },
  { code: '103', desc: 'Quality rejection → blocked', sign: 1, from: 'QH', to: 'BLK', valRel: false, modifier: 'TR', required: ['REASON'], drEvent: null, crEvent: null, reversal: '102', authObject: 'INV_MVT' },
  { code: '105', desc: 'Reversal of goods receipt', sign: -1, from: 'UNR', to: null, valRel: true, modifier: 'GR', required: ['PO', 'REASON'], drEvent: 'WRX', crEvent: 'BSX', reversal: '100', authObject: 'INV_MVT' },
  { code: '110', desc: 'Return to vendor', sign: -1, from: 'UNR', to: null, valRel: true, modifier: 'GR', required: ['PO', 'REASON'], drEvent: 'WRX', crEvent: 'BSX', reversal: '100', authObject: 'INV_MVT' },
  { code: '120', desc: 'Goods receipt without PO', sign: 1, from: null, to: 'UNR', valRel: true, modifier: 'GR', required: ['RATE', 'REASON'], drEvent: 'BSX', crEvent: 'WRX', reversal: '105', authObject: 'INV_MVT' },
  { code: '130', desc: 'Client-issued material receipt', sign: 1, from: null, to: 'UNR', valRel: true, modifier: 'CLM', required: ['RATE', 'PARTNER'], drEvent: 'BSX', crEvent: 'KDM', reversal: '135', authObject: 'INV_MVT' },
  { code: '200', desc: 'Issue to WBS element', sign: -1, from: 'UNR', to: null, valRel: true, modifier: 'PRJ', required: ['WBS'], drEvent: 'CON', crEvent: 'BSX', reversal: '220', authObject: 'INV_MVT' },
  { code: '205', desc: 'Issue to cost centre', sign: -1, from: 'UNR', to: null, valRel: true, modifier: 'CC', required: ['CC'], drEvent: 'CON', crEvent: 'BSX', reversal: '225', authObject: 'INV_MVT' },
  { code: '210', desc: 'Issue to maintenance order', sign: -1, from: 'UNR', to: null, valRel: true, modifier: 'EAM', required: ['CC', 'REASON'], drEvent: 'CON', crEvent: 'BSX', reversal: '220', authObject: 'INV_MVT' },
  { code: '215', desc: 'Issue to production order (RMC)', sign: -1, from: 'UNR', to: null, valRel: true, modifier: 'PRD', required: ['CC'], drEvent: 'CON', crEvent: 'BSX', reversal: '220', authObject: 'INV_MVT' },
  { code: '220', desc: 'Return from WBS to store', sign: 1, from: null, to: 'UNR', valRel: true, modifier: 'PRJ', required: ['WBS'], drEvent: 'BSX', crEvent: 'CON', reversal: '200', authObject: 'INV_MVT' },
  { code: '225', desc: 'Return from cost centre', sign: 1, from: null, to: 'UNR', valRel: true, modifier: 'CC', required: ['CC'], drEvent: 'BSX', crEvent: 'CON', reversal: '205', authObject: 'INV_MVT' },
  { code: '230', desc: 'Returnable issue out (shuttering / tools)', sign: 1, from: 'UNR', to: 'RET', valRel: false, modifier: 'MEM', required: ['WBS'], drEvent: null, crEvent: null, reversal: '235', authObject: 'INV_MVT' },
  { code: '235', desc: 'Returnable return in', sign: 1, from: 'RET', to: 'UNR', valRel: false, modifier: 'MEM', required: [], drEvent: null, crEvent: null, reversal: '230', authObject: 'INV_MVT' },
  { code: '240', desc: 'Returnable loss / damage recovery', sign: -1, from: 'RET', to: null, valRel: true, modifier: 'REC', required: ['REASON'], drEvent: 'REC', crEvent: 'BSX', reversal: '230', authObject: 'INV_MVT' },
  { code: '300', desc: 'Site-to-site transfer — issue leg → transit', sign: -1, from: 'UNR', to: 'TRN', valRel: true, modifier: 'TRN', required: ['SITE_TO'], drEvent: 'TRS', crEvent: 'BSX', reversal: '301', authObject: 'INV_MVT' },
  { code: '301', desc: 'Site-to-site transfer — receipt leg', sign: 1, from: 'TRN', to: 'UNR', valRel: true, modifier: 'TRN', required: ['SITE_TO'], drEvent: 'BSX', crEvent: 'TRS', reversal: '300', authObject: 'INV_MVT' },
  { code: '310', desc: 'Storage location transfer', sign: 1, from: 'UNR', to: 'UNR', valRel: false, modifier: 'TR', required: [], drEvent: null, crEvent: null, reversal: '310', authObject: 'INV_MVT' },
  { code: '320', desc: 'Bin transfer', sign: 1, from: 'UNR', to: 'UNR', valRel: false, modifier: 'TR', required: [], drEvent: null, crEvent: null, reversal: '320', authObject: 'INV_MVT' },
  { code: '400', desc: 'Components issued to subcontractor', sign: 1, from: 'UNR', to: 'SUB', valRel: false, modifier: 'SUB', required: ['PARTNER'], drEvent: null, crEvent: null, reversal: '420', authObject: 'INV_MVT' },
  { code: '410', desc: 'Component consumption on subcontract receipt', sign: -1, from: 'SUB', to: null, valRel: true, modifier: 'PRJ', required: ['WBS'], drEvent: 'CON', crEvent: 'SUB', reversal: '400', authObject: 'INV_MVT' },
  { code: '420', desc: 'Return from subcontractor', sign: 1, from: 'SUB', to: 'UNR', valRel: false, modifier: 'SUB', required: [], drEvent: null, crEvent: null, reversal: '400', authObject: 'INV_MVT' },
  { code: '500', desc: 'Physical inventory gain', sign: 1, from: null, to: 'UNR', valRel: true, modifier: 'DIF', required: ['REASON'], drEvent: 'BSX', crEvent: 'DIF', reversal: '510', authObject: 'INV_MVT' },
  { code: '510', desc: 'Physical inventory loss', sign: -1, from: 'UNR', to: null, valRel: true, modifier: 'DIF', required: ['REASON'], drEvent: 'DIF', crEvent: 'BSX', reversal: '500', authObject: 'INV_MVT' },
  { code: '520', desc: 'Scrapping / write-off', sign: -1, from: 'BLK', to: null, valRel: true, modifier: 'WOF', required: ['REASON'], drEvent: 'WOF', crEvent: 'BSX', reversal: '500', authObject: 'INV_MVT' },
  { code: '530', desc: 'Stock revaluation (value only)', sign: 1, from: 'UNR', to: 'UNR', valRel: true, modifier: 'PRV', required: ['RATE', 'REASON'], drEvent: 'BSX', crEvent: 'PRD', reversal: '530', authObject: 'INV_MVT' },
  { code: '600', desc: 'Goods issue for sale (RMC dispatch)', sign: -1, from: 'UNR', to: null, valRel: true, modifier: 'CGS', required: ['PARTNER'], drEvent: 'CGS', crEvent: 'BSX', reversal: '610', authObject: 'INV_MVT' },
  { code: '610', desc: 'Sales return', sign: 1, from: null, to: 'UNR', valRel: true, modifier: 'CGS', required: ['PARTNER', 'REASON'], drEvent: 'BSX', crEvent: 'CGS', reversal: '600', authObject: 'INV_MVT' },
];

/* ---------------- Account determination ---------------- */
/* Key = event key × valuation class (or modifier) → GL account. '*' = default. */

export const ACCOUNT_DETERMINATION: Record<string, Record<string, string>> = {
  BSX: { 'VC-RAW': '110100', 'VC-FUEL': '110100', 'VC-CONS': '110100', 'VC-SEMI': '110150', 'VC-SERV': '110100', '*': '110100' },
  WRX: { '*': '110300' },
  KDM: { '*': '120400' },
  CON: { PRJ: '410100', CC: '410200', EAM: '420100', PRD: '420200' },
  TRS: { '*': '110200' },
  SUB: { '*': '110400' },
  DIF: { '*': '430100' },
  WOF: { '*': '430200' },
  PRD: { '*': '440100' },
  REC: { '*': '120600' },
  CGS: { '*': '510100' },
  RND: { '*': '910100' },
  VBR: { '*': '120100' },
  ITC: { CGST: '130100', SGST: '130200', IGST: '130300' },
  TDS: { '*': '121000' },
};

export const EVENT_KEY_DESC: Record<string, string> = {
  BSX: 'Stock inventory account',
  WRX: 'GR/IR clearing',
  KDM: 'Client material control',
  CON: 'Consumption (by modifier)',
  TRS: 'Stock in transit',
  SUB: 'Stock with subcontractor',
  DIF: 'Inventory difference',
  WOF: 'Write-off',
  PRD: 'Price difference',
  REC: 'Recovery receivable',
  CGS: 'Cost of goods sold',
  RND: 'Rounding off',
  VBR: 'Vendor reconciliation',
  ITC: 'Input tax credit',
  TDS: 'Tax withholding',
};

/* ---------------- Pricing ---------------- */

export const PRICE_PROCEDURE = {
  code: 'PRC-STD',
  desc: 'Procurement — landed cost (works contract)',
  steps: [
    { step: 10, code: 'BASE', desc: 'Basic value' },
    { step: 20, code: 'DISC', desc: 'Discount' },
    { step: 30, code: 'NET0', desc: 'Net value' },
    { step: 40, code: 'FRGT', desc: 'Freight', loads: true },
    { step: 50, code: 'LDLF', desc: 'Lead & lift', loads: true },
    { step: 60, code: 'ROYL', desc: 'Royalty / mineral cess', loads: true },
    { step: 70, code: 'LOAD', desc: 'Loading / unloading', loads: true },
    { step: 80, code: 'LND0', desc: 'Landed value before tax' },
    { step: 90, code: 'CGST', desc: 'Central GST' },
    { step: 100, code: 'SGST', desc: 'State GST' },
    { step: 110, code: 'IGST', desc: 'Integrated GST' },
    { step: 120, code: 'GRS0', desc: 'Gross invoice value' },
    { step: 130, code: 'TDSI', desc: 'Income tax withholding' },
    { step: 140, code: 'ROND', desc: 'Rounding' },
    { step: 150, code: 'PAY0', desc: 'Net payable to vendor' },
  ],
};

export const CONDITION_TYPES = [
  { code: 'BASE', desc: 'Basic rate', calc: 'Quantity × rate', acct: 'Stock / expense' },
  { code: 'DISC', desc: 'Discount', calc: '% or absolute, negative', acct: 'Reduces stock value' },
  { code: 'FRGT', desc: 'Freight', calc: 'Per unit / trip / %', acct: 'Loads into stock' },
  { code: 'LDLF', desc: 'Lead & lift', calc: 'Distance slab × factor', acct: 'Loads into stock' },
  { code: 'PKFW', desc: 'Packing & forwarding', calc: '%', acct: 'Loads into stock' },
  { code: 'INSR', desc: 'Insurance', calc: '%', acct: 'Loads into stock' },
  { code: 'ROYL', desc: 'Royalty / mineral cess', calc: 'Per unit by mineral', acct: 'Loads into stock' },
  { code: 'LOAD', desc: 'Loading / unloading', calc: 'Per unit', acct: 'Loads into stock' },
  { code: 'WSTG', desc: 'Wastage allowance', calc: '% (estimation only)', acct: 'Statistical' },
  { code: 'CGST', desc: 'Central GST', calc: '% on landed', acct: 'Input credit or cost' },
  { code: 'SGST', desc: 'State GST', calc: '% on landed', acct: 'Input credit or cost' },
  { code: 'IGST', desc: 'Integrated GST', calc: '% on landed', acct: 'Input credit or cost' },
  { code: 'TDSI', desc: 'Income tax withholding', calc: '% on base', acct: 'Payable' },
  { code: 'CESS', desc: 'Labour cess (BOCW)', calc: '% on construction cost', acct: 'Payable' },
  { code: 'RTNM', desc: 'Retention', calc: '% capped at ceiling', acct: 'Retention control' },
  { code: 'ESCL', desc: 'Price escalation', calc: 'Index formula', acct: 'Revenue / cost' },
  { code: 'ROND', desc: 'Rounding', calc: 'To nearest rupee', acct: 'Rounding account' },
];

/* ---------------- Release strategies ---------------- */

export const RELEASE_GROUPS = [
  {
    id: 'REL-PR', desc: 'Purchase requisitions', characteristic: 'Document value (INR)',
    strategies: [
      { id: 'PR-S1', name: 'PR up to ₹2 L', max: 2_00_000, steps: [{ code: 'L1', title: 'Procurement Head', role: 'ROLE-HOD', valueLimit: 10_00_000 }] },
      { id: 'PR-S2', name: 'PR up to ₹10 L', max: 10_00_000, steps: [{ code: 'L1', title: 'Procurement Head', role: 'ROLE-HOD', valueLimit: 10_00_000 }, { code: 'L2', title: 'Director — Projects', role: 'ROLE-DIR', valueLimit: 99_99_99_999 }] },
      { id: 'PR-S3', name: 'PR above ₹10 L', max: 99_99_99_999, steps: [{ code: 'L1', title: 'Procurement Head', role: 'ROLE-HOD', valueLimit: 99_99_99_999 }, { code: 'L2', title: 'Director — Projects', role: 'ROLE-DIR', valueLimit: 99_99_99_999 }] },
    ],
  },
  {
    id: 'REL-PO', desc: 'Purchase orders', characteristic: 'Document value · purchasing group · vendor risk',
    strategies: [
      { id: 'PO-S1', name: 'PO up to ₹5 L', max: 5_00_000, steps: [{ code: 'L1', title: 'Procurement Head', role: 'ROLE-HOD', valueLimit: 5_00_000 }] },
      { id: 'PO-S2', name: 'PO ₹5–25 L', max: 25_00_000, steps: [{ code: 'L1', title: 'Procurement Head', role: 'ROLE-HOD', valueLimit: 25_00_000 }, { code: 'L2', title: 'Director — Projects', role: 'ROLE-DIR', valueLimit: 99_99_99_999 }] },
      { id: 'PO-S3', name: 'PO above ₹25 L', max: 99_99_99_999, steps: [{ code: 'L1', title: 'Procurement Head', role: 'ROLE-HOD', valueLimit: 50_00_000 }, { code: 'L2', title: 'Director — Projects', role: 'ROLE-DIR', valueLimit: 100_00_000 }, { code: 'L3', title: 'Chief Financial Officer', role: 'ROLE-CFO', valueLimit: 99_99_99_999 }] },
    ],
  },
  {
    id: 'REL-MDM', desc: 'Master data — dual-control fields', characteristic: 'Field group (valuation · bank · tax)',
    strategies: [
      { id: 'MD-S1', name: 'Dual control', max: 99_99_99_999, steps: [{ code: 'D1', title: 'Finance Manager', role: 'ROLE-FIN', valueLimit: 99_99_99_999 }, { code: 'D2', title: 'Internal Auditor', role: 'ROLE-IA', valueLimit: 99_99_99_999 }] },
    ],
  },
];

/* ---------------- Authorization ---------------- */

export const AUTH_OBJECTS = [
  { obj: 'PRC_PR', fields: ['COMPANY_CODE', 'PURCHASING_GROUP', 'ACTIVITY', 'VALUE_LIMIT'], acts: ['01 create', '02 change', '03 display', '06 delete', '43 release'] },
  { obj: 'PRC_PO', fields: ['COMPANY_CODE', 'PURCHASING_ORG', 'PURCHASING_GROUP', 'ACTIVITY', 'VALUE_LIMIT'], acts: ['01 create', '02 change', '03 display', '06 delete', '43 release', '85 reverse'] },
  { obj: 'INV_MVT', fields: ['COMPANY_CODE', 'SITE', 'MOVEMENT_GROUP', 'ACTIVITY'], acts: ['01 post', '03 display', '85 reverse'] },
  { obj: 'FIN_DOC', fields: ['COMPANY_CODE', 'DOCUMENT_TYPE', 'ACTIVITY', 'POSTING_PERIOD'], acts: ['01 post', '03 display', '43 release', '85 reverse'] },
  { obj: 'ORG_MDM', fields: ['COMPANY_CODE', 'INFO_GROUP', 'ACTIVITY'], acts: ['01 create', '02 change', '03 display'] },
  { obj: 'BP_BANK', fields: ['INFO_GROUP', 'ACTIVITY'], acts: ['02 change', '03 display'] },
  { obj: 'PRJ_WBS', fields: ['COMPANY_CODE', 'PROJECT', 'WBS_NODE', 'ACTIVITY'], acts: ['01 create', '02 change', '03 display'] },
  { obj: 'FIN_PERIOD', fields: ['COMPANY_CODE', 'ACTIVITY'], acts: ['11 close / reopen'] },
];

export const ROLES: RoleDef[] = [
  { id: 'ROLE-ADM', name: 'System Administrator', objects: [{ obj: '*', activities: ['*'] }] },
  { id: 'ROLE-REQ', name: 'Requisitioner', objects: [{ obj: 'PRC_PR', activities: ['01', '03', '06'] }, { obj: 'PRC_PO', activities: ['03'] }] },
  { id: 'ROLE-BUY', name: 'Buyer', objects: [{ obj: 'PRC_PR', activities: ['03'] }, { obj: 'PRC_PO', activities: ['01', '02', '03', '06'], fields: { PURCHASING_GROUP: ['PG-CIV', 'PG-MEC', 'PG-GEN'] }, valueLimit: 10_00_000 }] },
  { id: 'ROLE-HOD', name: 'Procurement Head', objects: [{ obj: 'PRC_PO', activities: ['01', '02', '03', '43'], valueLimit: 25_00_000 }, { obj: 'PRC_PR', activities: ['03', '43'], valueLimit: 10_00_000 }] },
  { id: 'ROLE-DIR', name: 'Director — Projects', objects: [{ obj: 'PRC_PO', activities: ['03', '43'], valueLimit: 50_00_000 }, { obj: 'PRC_PR', activities: ['03', '43'], valueLimit: 99_99_99_999 }, { obj: 'PRJ_WBS', activities: ['03', '43'] }] },
  { id: 'ROLE-CFO', name: 'Chief Financial Officer', objects: [{ obj: 'PRC_PO', activities: ['03', '43'], valueLimit: 99_99_99_999 }, { obj: 'FIN_DOC', activities: ['01', '03', '43'] }] },
  { id: 'ROLE-STR', name: 'Store Keeper', objects: [{ obj: 'INV_MVT', activities: ['01', '03', '85'] }] },
  { id: 'ROLE-FIN', name: 'Finance Manager', objects: [{ obj: 'FIN_DOC', activities: ['01', '03', '43', '85'] }, { obj: 'FIN_PERIOD', activities: ['11'] }, { obj: 'BP_BANK', activities: ['02', '03'] }, { obj: 'ORG_MDM', activities: ['03'] }] },
  { id: 'ROLE-IA', name: 'Internal Auditor', objects: [{ obj: '*', activities: ['03'] }, { obj: 'BP_BANK', activities: ['03'] }] },
  { id: 'ROLE-MDM', name: 'Master Data Steward', objects: [{ obj: 'ORG_MDM', activities: ['01', '02', '03'] }] },
];

export const USERS: UserDef[] = [
  { id: 'USR-ADM', name: 'A. Mehra', title: 'System Administrator', roles: ['ROLE-ADM'], color: '#135f7c' },
  { id: 'USR-REQ', name: 'R. Iyer', title: 'Site Requisitioner', roles: ['ROLE-REQ'], color: '#1e7a46' },
  { id: 'USR-BUY', name: 'S. Kulkarni', title: 'Buyer — Civil Desk', roles: ['ROLE-BUY'], color: '#9a6206' },
  { id: 'USR-HOD', name: 'V. Nair', title: 'Procurement Head', roles: ['ROLE-HOD'], color: '#b3261e' },
  { id: 'USR-DIR', name: 'D. Rao', title: 'Director — Projects', roles: ['ROLE-DIR'], color: '#135f7c' },
  { id: 'USR-CFO', name: 'N. Bhatt', title: 'Chief Financial Officer', roles: ['ROLE-CFO'], color: '#b3261e' },
  { id: 'USR-STR', name: 'M. Shaikh', title: 'Store Keeper — NH-47', roles: ['ROLE-STR'], color: '#1e7a46' },
  { id: 'USR-FIN', name: 'P. Joshi', title: 'Finance Manager', roles: ['ROLE-FIN'], color: '#9a6206' },
  { id: 'USR-IA', name: 'K. Bose', title: 'Internal Auditor', roles: ['ROLE-IA'], color: '#26384b' },
  { id: 'USR-MDM', name: 'T. Fernandes', title: 'Master Data Steward', roles: ['ROLE-MDM'], color: '#135f7c' },
];

/* Segregation-of-duty conflict matrix (object + activity level) */
export const SOD_RULES: { a: string; b: string; desc: string }[] = [
  { a: 'ORG_MDM', b: 'FIN_DOC', desc: 'Vendor master maintenance + payment posting' },
  { a: 'INV_MVT', b: 'FIN_DOC', desc: 'Goods receipt + invoice posting' },
  { a: 'ORG_MDM:02', b: 'PRC_PO:43', desc: 'Bank-detail change + PO release' },
];

export const CLOSING_STEPS_SEED: ClosingStep[] = [
  { id: 'CL-1', title: 'Stock valuation run', module: 'INV', ownerRole: 'ROLE-STR', done: false },
  { id: 'CL-2', title: 'GR/IR clearing review', module: 'FIN', ownerRole: 'ROLE-FIN', done: false },
  { id: 'CL-3', title: 'WIP & results analysis', module: 'CTL', ownerRole: 'ROLE-FIN', done: false },
  { id: 'CL-4', title: 'Depreciation run', module: 'FIN', ownerRole: 'ROLE-FIN', done: false },
  { id: 'CL-5', title: 'Accruals & provisions', module: 'FIN', ownerRole: 'ROLE-FIN', done: false },
  { id: 'CL-6', title: 'Tax control reconciliation', module: 'FIN', ownerRole: 'ROLE-FIN', done: false },
  { id: 'CL-7', title: 'Bank reconciliation', module: 'FIN', ownerRole: 'ROLE-FIN', done: false },
  { id: 'CL-8', title: 'Inter-company reconciliation', module: 'FIN', ownerRole: 'ROLE-FIN', done: false },
];

/* PR → PO copy rules: which fields copy, re-derive or re-enter */
export const COPY_RULES_PR_PO = [
  { field: 'Company code', rule: 'Copy' },
  { field: 'Operating site', rule: 'Copy' },
  { field: 'Items · material · qty · UOM', rule: 'Copy' },
  { field: 'Account assignment (WBS / CC)', rule: 'Copy' },
  { field: 'Required date → delivery date', rule: 'Copy' },
  { field: 'Vendor', rule: 'Re-enter (sourced)' },
  { field: 'Rate & conditions', rule: 'Re-derive (access sequence)' },
  { field: 'Tax code & GST split', rule: 'Re-derive (place of supply)' },
  { field: 'Release strategy', rule: 'Re-derive (value)' },
  { field: 'Document number', rule: 'Re-enter (new range)' },
];

export const MODULES: { code: ModuleCode; name: string }[] = [
  { code: 'PLT', name: 'Platform & Technical Services' }, { code: 'ORG', name: 'Enterprise Structure & MDG' },
  { code: 'FIN', name: 'Financial Accounting' }, { code: 'CTL', name: 'Controlling & Cost Mgmt' },
  { code: 'PRC', name: 'Procurement' }, { code: 'INV', name: 'Inventory & Warehouse' },
  { code: 'PRJ', name: 'Project System' }, { code: 'CTR', name: 'Contracts & Claims' },
  { code: 'BIL', name: 'Billing & Revenue' }, { code: 'SUB', name: 'Subcontract Management' },
  { code: 'EAM', name: 'Plant & Machinery' }, { code: 'PRD', name: 'Production / RMC' },
  { code: 'QMS', name: 'Quality Management' }, { code: 'HCM', name: 'Human Capital' },
  { code: 'EHS', name: 'Environment, Health & Safety' }, { code: 'DMS', name: 'Documents & Drawings' },
  { code: 'BID', name: 'Tender & Bid Management' }, { code: 'CMP', name: 'Compliance & Instruments' },
  { code: 'ANA', name: 'Analytics & Reporting' }, { code: 'EXT', name: 'Extensibility & Integration' },
];

export const STOCK_TYPE_NAMES: Record<string, string> = {
  UNR: 'Unrestricted', QH: 'Quality Hold', BLK: 'Blocked', TRN: 'Transit', SUB: 'At Subcontractor', RET: 'Returnable',
};

export const STATE_NAMES: Record<string, string> = { MH: 'Maharashtra', GJ: 'Gujarat', DL: 'Delhi', KA: 'Karnataka' };

/* ==================================================================== */
/*  PART 2 — LOGISTICS CONFIGURATION (PRC · INV · EAM · QMS)             */
/* ==================================================================== */

import type {
  SourceListItem, QuotaArrangement, RateContract, Equipment,
} from './types';

/* ---- PRC.1 Sourcing master data ---- */

/* Materials whose group is source-controlled need a source-list vendor */
export const SOURCE_CONTROLLED_GROUPS = ['MG-AGG', 'MG-STL'];

export const SOURCE_LIST_SEED: SourceListItem[] = [
  { materialCode: 'MAT-C53', siteId: 'ST-NH47', vendorId: 'BP-SHREE', validFrom: '2025-04-01', validTo: '2026-03-31', fixed: true },
  { materialCode: 'MAT-STL16', siteId: 'ST-NH47', vendorId: 'BP-TATA', validFrom: '2025-04-01', validTo: '2026-03-31' },
  { materialCode: 'MAT-AGG20', siteId: 'ST-NH47', vendorId: 'BP-KRISH', validFrom: '2025-04-01', validTo: '2026-03-31' },
  { materialCode: 'MAT-SND', siteId: 'ST-NH47', vendorId: 'BP-KRISH', validFrom: '2025-04-01', validTo: '2026-03-31' },
  { materialCode: 'MAT-AGG20', siteId: 'ST-AHD', vendorId: 'BP-SAI', validFrom: '2025-04-01', validTo: '2026-03-31' },
  { materialCode: 'MAT-HSD', siteId: 'ST-NH47', vendorId: 'BP-IOCL', validFrom: '2025-04-01', validTo: '2026-03-31', fixed: true },
  { materialCode: 'MAT-EXHR', siteId: 'ST-NH47', vendorId: 'BP-SAI', validFrom: '2025-04-01', validTo: '2026-03-31' },
];

export const QUOTA_SEED: QuotaArrangement[] = [
  {
    materialCode: 'MAT-C53', siteId: 'ST-NH47',
    allocations: [
      { vendorId: 'BP-SHREE', pct: 55 },
      { vendorId: 'BP-TATA', pct: 30 },
      { vendorId: 'BP-SUNR', pct: 15 },
    ],
    allocated: { 'BP-SHREE': 9500, 'BP-TATA': 4100, 'BP-SUNR': 900 },
  },
];

export const RATE_CONTRACT_SEED: RateContract[] = [
  { id: 'RC-1001', number: 'VUL-RC/25-26/00001', vendorId: 'BP-SHREE', materialCode: 'MAT-C53', siteId: 'ST-NH47', rate: 405, capQty: 20000, releasedQty: 9500, validFrom: '2025-04-01', validTo: '2026-03-31', status: 'ACTIVE' },
  { id: 'RC-1002', number: 'VUL-RC/25-26/00002', vendorId: 'BP-KRISH', materialCode: 'MAT-AGG20', siteId: 'ST-NH47', rate: 1285, capQty: 8000, releasedQty: 7920, validFrom: '2025-04-01', validTo: '2026-03-31', status: 'ACTIVE' },
];

/* ---- PRC.2 Requirement planning (reorder points) ---- */
export const REORDER_POINTS: Record<string, { siteId: string; reorder: number; max: number }> = {
  'MAT-C53|ST-NH47': { siteId: 'ST-NH47', reorder: 1200, max: 6000 },
  'MAT-STL16|ST-NH47': { siteId: 'ST-NH47', reorder: 40, max: 220 },
  'MAT-HSD|ST-NH47': { siteId: 'ST-NH47', reorder: 2500, max: 12000 },
  'MAT-WBR|ST-WSH': { siteId: 'ST-WSH', reorder: 120, max: 600 },
};

/* Material coefficients from the Costing view (per unit of BOQ work) */
export const BOQ_COEFFICIENTS: Record<string, { mat: string; coeff: number; uom: string }> = {
  'PRJ-NH47-S|CONC': { mat: 'MAT-C53', coeff: 7.6, uom: 'BAG' },   /* cement bags / m³ concrete */
  'PRJ-NH47-S|CONC_STL': { mat: 'MAT-STL16', coeff: 0.085, uom: 'MT' }, /* t steel / m³ */
  'PRJ-NH47-P|AGG': { mat: 'MAT-AGG20', coeff: 0.9, uom: 'M3' },
};

/* ---- PRC.6 Minor minerals / royalty ---- */
export const MINERAL_GROUP = 'MG-AGG';
export const ROYALTY_BORNE = ['CONTRACTOR', 'VENDOR'];

/* ---- EAM fleet ---- */

export const OPERATORS = [
  { id: 'OP-1', name: 'G. Pawar', licenceValidTo: '2026-08-15' },
  { id: 'OP-2', name: 'S. Yadav', licenceValidTo: '2026-02-20' },
  { id: 'OP-3', name: 'A. Khan', licenceValidTo: '2025-11-30' }, /* expired licence */
];

export const EQUIPMENT_SEED: Equipment[] = [
  {
    code: 'EQ-EX201', desc: 'Excavator 20T — PC200', category: 'Earthmoving', make: 'Komatsu', model: 'PC200-8M2',
    serial: 'KMT-88231', regNo: 'MH-12-EX-4471', ownership: 'OWNED', acqValue: 78_00_000, siteId: 'ST-NH47',
    wbs: 'PRJ-NH47-E', operatorId: 'OP-1', operatorLicValidTo: '2026-08-15', status: 'RUNNING', hourMeter: 6420,
    fuelType: 'HSD', fuelNormLph: 18, internalRate: 2450,
    docs: [
      { kind: 'Insurance', no: 'INS-4471-25', validTo: '2026-06-30' },
      { kind: 'Fitness', no: 'FIT-4471', validTo: '2026-04-10' },
      { kind: 'Pollution Cert', no: 'PUC-4471', validTo: '2026-03-05' },
    ],
    pmEveryHrs: 250, lastPmHm: 6250,
  },
  {
    code: 'EQ-WA301', desc: 'Wheel Loader — WA320', category: 'Earthmoving', make: 'Komatsu', model: 'WA320-5',
    serial: 'KMT-71102', regNo: 'MH-12-WL-2208', ownership: 'OWNED', acqValue: 64_00_000, siteId: 'ST-NH47',
    wbs: 'PRJ-NH47-E', operatorId: 'OP-2', operatorLicValidTo: '2026-02-20', status: 'AVAILABLE', hourMeter: 3980,
    fuelType: 'HSD', fuelNormLph: 14, internalRate: 1900,
    docs: [
      { kind: 'Insurance', no: 'INS-2208-25', validTo: '2026-09-15' },
      { kind: 'Fitness', no: 'FIT-2208', validTo: '2026-05-22' },
    ],
    pmEveryHrs: 250, lastPmHm: 3800,
  },
  {
    code: 'EQ-CR401', desc: 'Transit Mixer 6 m³ (hired)', category: 'Concreting', make: 'Schwing', model: 'STM-6',
    serial: 'SW-55120', regNo: 'GJ-05-TM-8834', ownership: 'HIRED', acqValue: 0, siteId: 'ST-NH47',
    wbs: 'PRJ-NH47-S', operatorId: 'OP-1', operatorLicValidTo: '2026-08-15', status: 'RUNNING', hourMeter: 1240,
    fuelType: 'HSD', fuelNormLph: 9, internalRate: 1150,
    docs: [
      { kind: 'Insurance', no: 'INS-8834-25', validTo: '2026-07-01' },
      { kind: 'Permit', no: 'PRM-8834', validTo: '2026-03-31' },
    ],
    pmEveryHrs: 200, lastPmHm: 1100,
  },
  {
    code: 'EQ-DG500', desc: 'DG Set 500 kVA (functional location)', category: 'Power', make: 'Cummins', model: 'C500D5',
    serial: 'CMN-30987', regNo: '—', ownership: 'OWNED', acqValue: 42_00_000, siteId: 'ST-NH47',
    operatorId: 'OP-2', operatorLicValidTo: '2026-02-20', status: 'IDLE', hourMeter: 8810,
    fuelType: 'HSD', fuelNormLph: 62, internalRate: 820,
    docs: [{ kind: 'Insurance', no: 'INS-DG500', validTo: '2026-10-01' }],
    pmEveryHrs: 300, lastPmHm: 8700,
  },
  {
    code: 'EQ-EX209', desc: 'Excavator 20T — backup (insurance lapsed)', category: 'Earthmoving', make: 'Hitachi', model: 'ZX200',
    serial: 'HTC-11930', regNo: 'MH-12-EX-9917', ownership: 'OWNED', acqValue: 71_00_000, siteId: 'ST-NH47',
    operatorId: 'OP-3', operatorLicValidTo: '2025-11-30', status: 'AVAILABLE', hourMeter: 5110,
    fuelType: 'HSD', fuelNormLph: 18, internalRate: 2350,
    docs: [
      { kind: 'Insurance', no: 'INS-9917-24', validTo: '2025-10-31' }, /* EXPIRED */
      { kind: 'Fitness', no: 'FIT-9917', validTo: '2026-01-15' },
    ],
    pmEveryHrs: 250, lastPmHm: 5000,
  },
];

export const FUEL_TOLERANCE_FACTOR = 1.15; /* consumption above norm × factor → exception */

/* ---- QMS quality planning ---- */

export const QUALITY_CONFIG: Record<string, { insp: boolean; type: string; test: 'CUBE' | 'SOIL' | 'AGG' | 'BITUMEN' | 'STEEL' | null }> = {
  'MAT-C53': { insp: true, type: 'IL-GRN', test: null },
  'MAT-STL16': { insp: true, type: 'IL-GRN', test: 'STEEL' },
  'MAT-AGG20': { insp: true, type: 'IL-GRN', test: 'AGG' },
  'MAT-SND': { insp: true, type: 'IL-GRN', test: 'AGG' },
  'MAT-RMC25': { insp: true, type: 'IL-PRD', test: 'CUBE' },
  'MAT-HSD': { insp: false, type: '—', test: null },
  'MAT-WBR': { insp: false, type: '—', test: null },
  'MAT-PPE': { insp: false, type: '—', test: null },
};

export const ITP_SEED = [
  { activity: 'PCC / RCC Concreting', spec: 'IS 456 · M25', characteristics: ['Slump 75–100 mm', 'Cube 28-day ≥ 25 MPa', 'Compaction factor ≥ 0.95'], frequency: 'Per pour / per 50 m³', points: 'Hold: before pour · Witness: cube casting' },
  { activity: 'Rebar fixing', spec: 'IS 1786 · Fe500D', characteristics: ['Cover 25–50 mm', 'Lap length per design', 'Bend radius OK'], frequency: 'Per member', points: 'Review: BBS · Witness: pre-pour inspection' },
  { activity: 'Bituminous layer', spec: 'MoRTH 5th Rev · BC', characteristics: ['Thickness ±6 mm', 'Compaction ≥ 98%', 'Bitumen content 4–4.6%'], frequency: 'Per 500 m', points: 'Hold: before overlay' },
];

export const TEST_EQUIPMENT = [
  { id: 'TE-CTM', name: 'Compression Testing Machine', validTo: '2026-05-20' },
  { id: 'TE-SLUMP', name: 'Slump Cone Set', validTo: '2026-09-01' },
  { id: 'TE-UT', name: 'Ultrasonic NDT Probe', validTo: '2025-12-15' }, /* expired calibration */
];

export const WELDERS = [
  { id: 'WD-1', name: 'R. More', qualValidTo: '2026-07-10' },
  { id: 'WD-2', name: 'B. Singh', qualValidTo: '2025-09-30' }, /* lapsed qualification */
];

export const NCR_SLA_DAYS: Record<string, number> = { MINOR: 14, MAJOR: 7, CRITICAL: 3 };

/* ==================================================================== */
/*  PART 3 — COMMERCIAL & FINANCIAL CONFIG (PRJ·CTR·BIL·SUB·FIN·CTL·CMP) */
/* ==================================================================== */

/* ---- PRJ: WBS tree (node types, status, billing/cost flags) ---- */
export const WBS_TREE: WbsNode[] = [
  /* NH-47 Package-3 */
  { code: 'PRJ-NH47', name: 'NH-47 Package-3 — 4-Laning', projectCode: 'PRJ-NH47', nodeType: 'SUMMARY', planning: true, budgetElement: true, costObject: false, billingElement: false, profitCentre: 'PC-ROAD', status: 'RELEASED' },
  { code: 'PRJ-NH47-E', name: 'Earthworks', projectCode: 'PRJ-NH47', parent: 'PRJ-NH47', nodeType: 'BOTH', planning: true, budgetElement: true, costObject: true, billingElement: true, costCentre: 'CC-4700', profitCentre: 'PC-ROAD', uom: 'M3', responsible: 'USR-DIR', status: 'RELEASED' },
  { code: 'PRJ-NH47-S', name: 'Structures', projectCode: 'PRJ-NH47', parent: 'PRJ-NH47', nodeType: 'BOTH', planning: true, budgetElement: true, costObject: true, billingElement: true, costCentre: 'CC-4700', profitCentre: 'PC-ROAD', uom: 'M3', responsible: 'USR-DIR', status: 'RELEASED' },
  { code: 'PRJ-NH47-P', name: 'Pavement', projectCode: 'PRJ-NH47', parent: 'PRJ-NH47', nodeType: 'BOTH', planning: true, budgetElement: true, costObject: true, billingElement: true, costCentre: 'CC-4700', profitCentre: 'PC-ROAD', uom: 'M2', responsible: 'USR-DIR', status: 'RELEASED' },
  /* Ahmedabad Elevated Corridor */
  { code: 'PRJ-AHD', name: 'Ahmedabad Elevated Corridor', projectCode: 'PRJ-AHD', nodeType: 'SUMMARY', planning: true, budgetElement: true, costObject: false, billingElement: false, profitCentre: 'PC-BLD', status: 'RELEASED' },
  { code: 'PRJ-AHD-F', name: 'Foundations & Piles', projectCode: 'PRJ-AHD', parent: 'PRJ-AHD', nodeType: 'BOTH', planning: true, budgetElement: true, costObject: true, billingElement: true, costCentre: 'CC-4700', profitCentre: 'PC-BLD', uom: 'M3', status: 'RELEASED' },
  { code: 'PRJ-AHD-D', name: 'Deck & Girders', projectCode: 'PRJ-AHD', parent: 'PRJ-AHD', nodeType: 'BOTH', planning: true, budgetElement: true, costObject: true, billingElement: true, costCentre: 'CC-4700', profitCentre: 'PC-BLD', uom: 'M3', status: 'TECH_COMPLETE' },
];

/* Budget tolerance profile (usage % -> action) */
export const BUDGET_TOLERANCE = [
  { pct: 90, action: 'WARN' as const, note: 'Warning to initiator' },
  { pct: 100, action: 'WARN_NOTIFY' as const, note: 'Warning + notify PM & Commercial' },
  { pct: 105, action: 'BLOCK' as const, note: 'Block — needs budget supplement' },
];

export const COST_CODES = [
  { code: 'CC-MAT', name: 'Material' }, { code: 'CC-LAB', name: 'Labour' },
  { code: 'CC-PLT', name: 'Plant' }, { code: 'CC-SUB', name: 'Subcontract' },
  { code: 'CC-SOH', name: 'Site Overhead' }, { code: 'CC-HOH', name: 'Head-office Overhead' },
  { code: 'CC-FIN', name: 'Finance' }, { code: 'CC-STA', name: 'Statutory' },
];

/* Settlement rules (from cost object -> to) */
export const SETTLEMENT_RULES = [
  { from: 'Maintenance order', to: 'Equipment cost centre', then: 'Consuming WBS', driver: 'Actual hours' },
  { from: 'Production order (RMC)', to: 'Cost of production', then: 'Consuming WBS / sales', driver: 'Output qty' },
  { from: 'WBS element', to: 'Profitability segment', then: '—', driver: 'Direct' },
  { from: 'Site overhead WBS', to: 'Work WBS', then: '—', driver: 'Direct cost %' },
];

/* ---- CTR: contracts & BOQ ---- */
export const CONTRACTS_SEED: ContractMaster[] = [
  {
    id: 'CN-001', number: 'VUL/CN/25-26/001', clientId: 'BP-NHAI', projectCode: 'PRJ-NH47', type: 'ITEM_RATE',
    loaRef: 'NHAI/PIU-P/LOA/2025/114', agreementDate: '2025-04-15',
    originalValue: 8_40_00_000, revisedValue: 8_65_00_000,
    completionDate: '2027-04-14', revisedCompletion: '2027-07-13', eotGrantedDays: 90,
    retentionPct: 5, retentionCeilingPct: 5, securityDepositPct: 2.5,
    mobilisationAdvancePct: 10, advanceInterestPct: 12, recoveryStartPct: 30, recoveryRatePct: 8,
    priceAdjustment: true, ldRatePctPerWeek: 0.5, ldCeilingPct: 10, defectLiabilityMonths: 12,
    claimNoticeDays: 28, eotNoticeDays: 28, disputeNoticeDays: 28, status: 'ACTIVE',
  },
  {
    id: 'CN-002', number: 'VUL/CN/25-26/002', clientId: 'BP-NHAI', projectCode: 'PRJ-AHD', type: 'EPC',
    loaRef: 'NHAI/AHD/LOA/2025/041', agreementDate: '2025-06-01',
    originalValue: 12_60_00_000, revisedValue: 12_60_00_000,
    completionDate: '2027-11-30', eotGrantedDays: 0,
    retentionPct: 5, retentionCeilingPct: 5, securityDepositPct: 3,
    mobilisationAdvancePct: 10, advanceInterestPct: 12, recoveryStartPct: 25, recoveryRatePct: 10,
    priceAdjustment: false, ldRatePctPerWeek: 0.5, ldCeilingPct: 10, defectLiabilityMonths: 24,
    claimNoticeDays: 14, eotNoticeDays: 14, disputeNoticeDays: 14, status: 'ACTIVE',
  },
];

export const BOQ_SEED: BoqItem[] = [
  { id: 'BQ-01', contractId: 'CN-001', itemCode: '2.1', desc: 'Embankment construction (incl. compaction)', spec: 'MoRTH 5th Rev · Cl 300', unit: 'M3', tenderQty: 120000, tenderRate: 185, revisedQty: 120000, executedCum: 52000, previouslyBilled: 48000, deviationLimitPct: 15, wbs: 'PRJ-NH47-E', costCode: 'CC-MAT', rateVersion: 1, rateEffective: '2025-04-15', approved: true },
  { id: 'BQ-02', contractId: 'CN-001', itemCode: '4.3', desc: 'RCC M25 in structures', spec: 'IS 456 · MoRTH Cl 1700', unit: 'M3', tenderQty: 9500, tenderRate: 7850, revisedQty: 9500, executedCum: 4100, previouslyBilled: 3900, deviationLimitPct: 10, wbs: 'PRJ-NH47-S', costCode: 'CC-MAT', rateVersion: 1, rateEffective: '2025-04-15', approved: true },
  { id: 'BQ-03', contractId: 'CN-001', itemCode: '4.4', desc: 'Reinforcement steel Fe500D', spec: 'IS 1786', unit: 'MT', tenderQty: 780, tenderRate: 74500, revisedQty: 780, executedCum: 320, previouslyBilled: 300, deviationLimitPct: 10, wbs: 'PRJ-NH47-S', costCode: 'CC-MAT', rateVersion: 1, rateEffective: '2025-04-15', approved: true },
  { id: 'BQ-04', contractId: 'CN-001', itemCode: '6.1', desc: 'Dense bituminous concrete', spec: 'MoRTH Cl 500', unit: 'MT', tenderQty: 28000, tenderRate: 4650, revisedQty: 28000, executedCum: 0, previouslyBilled: 0, deviationLimitPct: 15, wbs: 'PRJ-NH47-P', costCode: 'CC-MAT', rateVersion: 1, rateEffective: '2025-04-15', approved: true },
  { id: 'BQ-05', contractId: 'CN-001', itemCode: 'E-01', desc: 'Extra: under-drain (approved)', spec: 'Drawing IFD-201', unit: 'RM', tenderQty: 0, tenderRate: 940, revisedQty: 1200, executedCum: 350, previouslyBilled: 300, deviationLimitPct: 100, wbs: 'PRJ-NH47-E', costCode: 'CC-MAT', rateVersion: 1, rateEffective: '2025-09-01', approved: true },
  { id: 'BQ-06', contractId: 'CN-001', itemCode: 'E-02', desc: 'Extra: additional traffic signage (unapproved)', spec: 'Drawing IFD-214', unit: 'NOS', tenderQty: 0, tenderRate: 3200, revisedQty: 40, executedCum: 12, previouslyBilled: 0, deviationLimitPct: 100, wbs: 'PRJ-NH47-E', costCode: 'CC-MAT', rateVersion: 1, rateEffective: '2025-11-01', approved: false, provisional: true },
  { id: 'BQ-07', contractId: 'CN-002', itemCode: '3.1', desc: 'Bored cast-in-situ piles 1200 dia', spec: 'IS 2911', unit: 'RM', tenderQty: 14500, tenderRate: 18500, revisedQty: 14500, executedCum: 6200, previouslyBilled: 6000, deviationLimitPct: 10, wbs: 'PRJ-AHD-F', costCode: 'CC-MAT', rateVersion: 1, rateEffective: '2025-06-01', approved: true },
  { id: 'BQ-08', contractId: 'CN-002', itemCode: '5.2', desc: 'PSC box girder (cast & launch)', spec: 'IRC 112', unit: 'M3', tenderQty: 6800, tenderRate: 15200, revisedQty: 6800, executedCum: 2800, previouslyBilled: 2800, deviationLimitPct: 10, wbs: 'PRJ-AHD-D', costCode: 'CC-MAT', rateVersion: 1, rateEffective: '2025-06-01', approved: true },
];

/* ---- CTR: rate analysis library (nested) ---- */
export const RATE_LIBRARY_SEED: RateAnalysis[] = [
  {
    id: 'RA-M25', code: 'RA-M25', desc: 'RCC M25 (excl. reinforcement) — sub-analysis', unit: 'M3',
    components: [
      { kind: 'MATERIAL', desc: 'Cement OPC 53', qty: 7.6, rate: 412, unit: 'BAG', wastagePct: 2 },
      { kind: 'MATERIAL', desc: 'Aggregate 20mm', qty: 0.85, rate: 1360, unit: 'M3', wastagePct: 2 },
      { kind: 'MATERIAL', desc: 'Sand', qty: 0.45, rate: 1120, unit: 'M3', wastagePct: 2 },
      { kind: 'LABOUR', desc: 'Mason + helpers (output 1.25 cum/gang-day)', qty: 0.8, rate: 1450, unit: 'DAY' },
      { kind: 'PLANT', desc: 'Mixer + vibrator', qty: 0.35, rate: 900, unit: 'HR' },
    ],
    siteOverheadPct: 6, hoOverheadPct: 3, profitPct: 8, version: 2, effective: '2025-04-15', preparer: 'USR-BUY', approver: 'USR-HOD',
  },
  {
    id: 'RA-RCC', code: 'RA-RCC-4.3', desc: 'Item 4.3 — RCC M25 in structures (uses M25 sub-analysis)', unit: 'M3',
    components: [
      { kind: 'SUB_ANALYSIS', desc: 'RCC M25 base (nested)', qty: 1, rate: 0, unit: 'M3', subAnalysisId: 'RA-M25' },
      { kind: 'LABOUR', desc: 'Formwork + finishing', qty: 1, rate: 1150, unit: 'M3' },
      { kind: 'TRANSPORT', desc: 'Lead (12 km slab) + lift', qty: 1, rate: 240, unit: 'M3' },
    ],
    siteOverheadPct: 6, hoOverheadPct: 3, profitPct: 8, version: 1, effective: '2025-04-15', preparer: 'USR-BUY', approver: 'USR-HOD',
  },
];

/* ---- BIL: escalation index master ---- */
export const ESCALATION_COMPONENTS = [
  { code: 'LAB', name: 'Labour', weight: 0.30, base: 100, current: 108.5 },
  { code: 'CEM', name: 'Cement', weight: 0.15, base: 100, current: 106.2 },
  { code: 'STL', name: 'Steel', weight: 0.20, base: 100, current: 112.4 },
  { code: 'BIT', name: 'Bitumen', weight: 0.10, base: 100, current: 104.0 },
  { code: 'POL', name: 'POL (fuel)', weight: 0.05, base: 100, current: 109.8 },
  { code: 'PM', name: 'Plant & machinery', weight: 0.05, base: 100, current: 103.6 },
  { code: 'OM', name: 'Other materials', weight: 0.15, base: 100, current: 105.1 },
];
export const ESCALATION_NON_ADJUSTABLE = 0.0; /* sum of weights + this = 1.0 */

/* ---- FIN: depreciation areas (company law vs tax) ---- */
export const DEPR_AREAS = [
  { code: 'AREA-CO', name: 'Company Law', method: 'SLM' },
  { code: 'AREA-TAX', name: 'Income Tax', method: 'WDV' },
];

export const ASSET_SEED: AssetMaster[] = [
  { id: 'AS-01', code: 'FA-1001', desc: 'Batching Plant 60 m³/hr', cls: 'Plant & Machinery', acqDate: '2024-04-10', acqValue: 48_00_000, usefulLifeYears: 10, location: 'ST-RMC', projectCode: 'PRJ-NH47', depCoLaw: 9_60_000, depTax: 12_60_000, coLawRatePct: 10, taxRatePct: 15 },
  { id: 'AS-02', code: 'FA-1002', desc: 'Tower Crane 8T', cls: 'Plant & Machinery', acqDate: '2025-01-20', acqValue: 62_00_000, usefulLifeYears: 12, location: 'ST-AHD', projectCode: 'PRJ-AHD', depCoLaw: 5_16_667, depTax: 7_75_000, coLawRatePct: 8.33, taxRatePct: 12.5 },
];

/* ---- CMP: compliance registers ---- */
export const GUARANTEE_SEED: BankGuarantee[] = [
  { id: 'BG-01', number: 'HDFC/BG/2025/8841', bank: 'HDFC Bank', type: 'PERFORMANCE', beneficiary: 'NHAI — PIU Pune', contractId: 'CN-001', amount: 42_00_000, marginBlocked: 4_20_000, issueDate: '2025-04-20', expiryDate: '2026-01-25', claimPeriodEnd: '2026-04-20', autoRenew: true, status: 'LIVE' },
  { id: 'BG-02', number: 'SBI/BG/2025/1204', bank: 'SBI', type: 'MOBILISATION', beneficiary: 'NHAI — PIU Pune', contractId: 'CN-001', amount: 84_00_000, marginBlocked: 8_40_000, issueDate: '2025-05-05', expiryDate: '2026-05-04', claimPeriodEnd: '2026-08-04', autoRenew: false, status: 'LIVE' },
  { id: 'BG-03', number: 'ICICI/BG/2025/0771', bank: 'ICICI Bank', type: 'EARNEST_MONEY', beneficiary: 'NHAI — PIU Ahmedabad', contractId: 'CN-002', amount: 12_60_000, marginBlocked: 1_26_000, issueDate: '2025-03-10', expiryDate: '2025-12-31', claimPeriodEnd: '2026-03-10', autoRenew: false, status: 'LIVE' },
];

export const INSURANCE_SEED: InsurancePolicy[] = [
  { id: 'INS-01', kind: 'Contractors All Risk', policyNo: 'CAR/2025/4410', insurer: 'New India Assurance', sumInsured: 84_00_00_000, projectCode: 'PRJ-NH47', validTo: '2027-04-14', status: 'LIVE' },
  { id: 'INS-02', kind: 'Workmen Compensation', policyNo: 'WC/2025/1182', insurer: 'Oriental Insurance', sumInsured: 2_00_00_000, projectCode: 'PRJ-NH47', validTo: '2026-01-15', status: 'LIVE' },
  { id: 'INS-03', kind: 'Plant & Machinery', policyNo: 'PM/2025/0039', insurer: 'ICICI Lombard', sumInsured: 11_00_00_000, projectCode: 'PRJ-AHD', validTo: '2025-12-20', status: 'LIVE' },
];

export const DISPUTE_SEED: Dispute[] = [
  { id: 'DSP-01', ref: 'ARB/NH47/2025/04', forum: 'Arbitration (3-member tribunal)', oppositeParty: 'NHAI', subject: 'Non-payment of RA-07 certified dues + interest', contractId: 'CN-001', amountClaimed: 3_85_00_000, filingDate: '2025-08-12', limitationEnd: '2028-08-11', status: 'HEARING', contingentProvision: 0 },
  { id: 'DSP-02', ref: 'FC/AHD/2025/02', forum: 'Dispute Facilitation Council', oppositeParty: 'NHAI', subject: 'Rejection of extra item E-02 rate', contractId: 'CN-002', amountClaimed: 64_00_000, filingDate: '2025-11-02', limitationEnd: '2028-11-01', status: 'FILED', contingentProvision: 12_00_000 },
];

export const COMPLIANCE_SEED: ComplianceTask[] = [
  { id: 'CMP-01', obligation: 'GST Return GSTR-3B (Dec)', dueDate: '2026-01-20', owner: 'ROLE-FIN', state: 'MH', status: 'GREEN', evidence: false },
  { id: 'CMP-02', obligation: 'PF monthly return (Dec)', dueDate: '2026-01-15', owner: 'ROLE-FIN', state: 'MH', projectCode: 'PRJ-NH47', status: 'AMBER', evidence: false },
  { id: 'CMP-03', obligation: 'Labour licence renewal', dueDate: '2026-01-05', owner: 'ROLE-ADM', state: 'GJ', projectCode: 'PRJ-AHD', status: 'RED', evidence: false },
  { id: 'CMP-04', obligation: 'BOCW cess — Q3 challan', dueDate: '2026-01-31', owner: 'ROLE-FIN', state: 'MH', projectCode: 'PRJ-NH47', status: 'GREEN', evidence: false },
  { id: 'CMP-05', obligation: 'Factory licence (batching plant)', dueDate: '2026-06-30', owner: 'ROLE-ADM', state: 'MH', projectCode: 'PRJ-NH47', status: 'GREEN', evidence: true },
];

export const MINWAGE_SEED: MinWage[] = [
  { id: 'MW-01', state: 'MH', zone: 'Zone I', skill: 'Unskilled', dailyRate: 620, effective: '2026-01-01', notificationRef: 'MH/LAB/2025/NOTIF-118' },
  { id: 'MW-02', state: 'MH', zone: 'Zone I', skill: 'Skilled', dailyRate: 745, effective: '2026-01-01', notificationRef: 'MH/LAB/2025/NOTIF-118' },
  { id: 'MW-03', state: 'GJ', zone: 'Zone A', skill: 'Unskilled', dailyRate: 560, effective: '2025-10-01', notificationRef: 'GJ/LAB/2025/NOTIF-072' },
];

/* Statutory deduction rates for billing (effective-dated) */
export const STATUTORY_RATES = {
  labourCessPct: 1,        /* BOCW */
  tdsPct194C: 2,           /* income tax withholding */
  gstTdsPct: 2,            /* GST u/s 51 (notified deductor) */
  securedAdvanceRatePct: 75,
};

/* ==================================================================== */
/*  PART 1/10 — PLATFORM FOUNDATION CONFIG                              */
/* ==================================================================== */

/* Field status groups: mandatory / optional / hidden per document type — configuration, not code */
export const FIELD_STATUS_GROUPS: Record<string, Record<string, 'REQ' | 'OPT' | 'HID'>> = {
  'PR-STD': { JUSTIFICATION: 'HID', NEEDED_BY: 'REQ', COST_OBJECT: 'REQ' },
  'PR-EMG': { JUSTIFICATION: 'REQ', NEEDED_BY: 'REQ', COST_OBJECT: 'REQ' },
  'PR-SVC': { JUSTIFICATION: 'OPT', NEEDED_BY: 'REQ', COST_OBJECT: 'REQ' },
  'PR-CAP': { JUSTIFICATION: 'REQ', NEEDED_BY: 'OPT', COST_OBJECT: 'REQ' },
  'PO-STD': { DELIVERY_DATE: 'REQ', INCOTERMS: 'OPT' },
  'PO-IMP': { DELIVERY_DATE: 'REQ', INCOTERMS: 'REQ', LC_REFERENCE: 'REQ' },
};

/* The ten-part build programme */
export const ROADMAP: { part: number; title: string; status: 'LIVE' | 'NEXT' | 'PLANNED' }[] = [
  { part: 1, title: 'Platform Foundation', status: 'LIVE' },
  { part: 2, title: 'Master Data Management', status: 'NEXT' },
  { part: 3, title: 'Project System & Budget Control', status: 'PLANNED' },
  { part: 4, title: 'Procurement — Source to Order', status: 'PLANNED' },
  { part: 5, title: 'Stores & Inventory — Gate to Bin', status: 'PLANNED' },
  { part: 6, title: 'Contracts · Measurement · Billing', status: 'PLANNED' },
  { part: 7, title: 'Finance · Controlling · Compliance', status: 'PLANNED' },
  { part: 8, title: 'HR · Plant · Production · QMS · EHS', status: 'PLANNED' },
  { part: 9, title: 'Communication Suite & Tools', status: 'PLANNED' },
  { part: 10, title: 'Launchpad · Analytics · AI', status: 'PLANNED' },
];

/* ==================================================================== */
/*  PART 2/10 — MASTER DATA MANAGEMENT CONFIG                          */
/* ==================================================================== */

/* ---- UOM conversion engine (§6): every factor is master data ---- */
export const UOM_DEFS: UomDef[] = [
  { code: 'KG', name: 'Kilogram', dim: 'MASS' },
  { code: 'MT', name: 'Metric tonne', dim: 'MASS' },
  { code: 'BAG', name: 'Bag (50 kg)', dim: 'MASS' },
  { code: 'M3', name: 'Cubic metre', dim: 'VOLUME' },
  { code: 'L', name: 'Litre', dim: 'VOLUME' },
  { code: 'M', name: 'Running metre', dim: 'LENGTH' },
  { code: 'RM', name: 'Running metre', dim: 'LENGTH' },
  { code: 'NOS', name: 'Number', dim: 'COUNT' },
  { code: 'SET', name: 'Set', dim: 'COUNT' },
  { code: 'M2', name: 'Square metre', dim: 'AREA' },
  { code: 'HR', name: 'Hour', dim: 'TIME' },
];

export const UOM_FACTORS_SEED: UomFactor[] = [
  /* generic mass */
  { from: 'MT', to: 'KG', factor: 1000, rounding: 'NONE' },
  { from: 'BAG', to: 'KG', factor: 50, materialCode: 'MAT-C53', rounding: 'UP' },  /* cement 1 bag = 50 kg */
  { from: 'BAG', to: 'MT', factor: 0.05, materialCode: 'MAT-C53', rounding: 'NONE' },
  /* steel: sectional weight per diameter, stored not computed */
  { from: 'M', to: 'KG', factor: 1.579, materialCode: 'MAT-STL16', rounding: 'NONE' },  /* 16mm TMT */
  /* aggregate / concrete: bulk density per material */
  { from: 'M3', to: 'MT', factor: 1.52, materialCode: 'MAT-AGG20', rounding: 'NONE' },
  { from: 'M3', to: 'MT', factor: 2.4, materialCode: 'MAT-RMC25', rounding: 'NONE' },
];

/* ---- Geofence master (§8) ---- */
export const GEOFENCE_SEED: Geofence[] = [
  {
    id: 'GF-01', code: 'GF-NH47-ATT', siteId: 'ST-NH47', projectCode: 'PRJ-NH47', name: 'NH-47 Attendance Fence',
    type: 'ATTENDANCE', shape: { kind: 'CIRCLE', lat: 18.5204, lng: 73.8567, radiusM: 450 },
    minAccuracyM: 50, validFrom: '2025-04-01', validTo: '2027-03-31', priority: 1,
  },
  {
    id: 'GF-02', code: 'GF-NH47-YARD', siteId: 'ST-NH47', projectCode: 'PRJ-NH47', name: 'Material Yard — Polygon',
    type: 'MATERIAL_YARD', shape: { kind: 'POLYGON', pts: [[18.5200, 73.8560], [18.5200, 73.8575], [18.5212, 73.8575], [18.5212, 73.8560]] },
    minAccuracyM: 30, validFrom: '2025-04-01', validTo: '2027-03-31', priority: 2,
  },
];

/* ---- Project templates (§4 / test 26) ---- */
export const PROJECT_TEMPLATES: ProjectTemplate[] = [
  {
    code: 'TPL-HWY', name: 'Highway Package',
    wbs: [
      { code: '-E', name: 'Earthworks', nodeType: 'BOTH' },
      { code: '-S', name: 'Structures', nodeType: 'BOTH' },
      { code: '-P', name: 'Pavement', nodeType: 'BOTH' },
      { code: '-SOH', name: 'Site Overhead', nodeType: 'ACCOUNT_ASSIGNMENT' },
    ],
  },
  {
    code: 'TPL-BLD', name: 'Building / Elevated',
    wbs: [
      { code: '-F', name: 'Foundations & Piles', nodeType: 'BOTH' },
      { code: '-D', name: 'Deck & Girders', nodeType: 'BOTH' },
      { code: '-FIN', name: 'Finishes', nodeType: 'BOTH' },
    ],
  },
];

/* Dual-control field list (Part 1 §9 + Part 2 §1.1) */
export const DUAL_CONTROL_FIELDS = [
  'valuation_class', 'price_control', 'reconciliation_account', 'bank_details',
  'tax_registration', 'tds_section', 'min_wage_rate', 'geofence_geometry',
];

/* ---- Part 2 import sample (test 30): 500 rows, ~7% invalid ---- */
export const IMPORT_SAMPLE = { fileName: 'materials_master_upload.xlsx', totalRows: 500 };

/* Closeout pre-closure checklist template */
export const CLOSEOUT_TEMPLATE: { task: string; mandatory: boolean }[] = [
  { task: 'All variations approved', mandatory: true },
  { task: 'All extra items rated', mandatory: true },
  { task: 'All recoveries settled', mandatory: true },
  { task: 'Material at site reconciled', mandatory: true },
  { task: 'Client-issued material reconciled', mandatory: true },
  { task: 'All notices issued', mandatory: true },
  { task: 'As-built drawings handed over', mandatory: false },
  { task: 'Lessons-learned fed to rate library', mandatory: false },
];
