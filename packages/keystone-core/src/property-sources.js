// Column vocabularies shared by the Keystone agents, so a rent roll, a tenant ledger
// or a work-order export reads the same way in every agent, plus the named export
// layouts of common property management systems.
//
// Each field lists the English header names it is also called, and (through
// `translate`) a concept whose German, French, Spanish, Portuguese, Italian, Japanese,
// Chinese and Korean names are in i18n/columns.js. Names were written from knowledge of
// the exports; none was checked against a live account. A buyer can always name
// columns by hand in keystone-sources.json, and `inspect` shows what was matched.
import { exportProfile } from './exports.js';

/**
 * Row hook for reports that print each property as a heading row (AppFolio style):
 * a row whose `detail` field is blank but whose `from` field has text names the
 * property for the rows under it; "Total" rows are dropped.
 */
export function groupHeadings(target, from, detail) {
  return (rows) => {
    const out = []; let group = '';
    for (const r of rows) {
      const head = String(r[from] ?? '').trim(); const det = detail.some((d) => String(r[d] ?? '').trim() !== '');
      if (/^(grand\s+)?total\b/i.test(head) || /^total\b/i.test(String(r[target] ?? '').trim())) continue;
      if (head && !det) { group = head.replace(/^->\s*/, ''); continue; }
      if (!det) continue;
      out.push({ ...r, [target]: String(r[target] ?? '').trim() || group });
    }
    return out;
  };
}
const grouped = (detail, from = 'unit') => ({ rows: groupHeadings('property', from, detail), provides: ['property'] });

const f = (aliases, extra = {}) => ({ aliases, ...extra });
const money = (aliases, translate = false, extra = {}) => f(aliases, { type: 'money', translate, ...extra });
const date = (aliases, translate = false, extra = {}) => f(aliases, { type: 'date', translate, ...extra });
const num = (aliases, translate = false, extra = {}) => f(aliases, { type: 'number', translate, ...extra });
const text = (aliases, translate = false, extra = {}) => f(aliases, { translate, ...extra });

const PROPERTY = text(['Property', 'Property Name', 'Property Code', 'Prop', 'Prop Code', 'Building', 'Site', 'Community', 'Asset', 'Entity'], 'property');
const UNIT = text(['Unit', 'Unit Number', 'Unit #', 'Unit No', 'Unit(s)', 'Suite', 'Space', 'Apt', 'Apartment', 'Door', 'Lot'], 'unit');
const TENANT = text(['Tenant', 'Tenant Name', 'Tenants', 'Resident', 'Resident Name', 'Name', 'Occupant', 'Lessee', 'Customer'], 'tenant');
const LEASE = text(['Lease', 'Lease ID', 'Lease Code', 'Lease Number', 'Lease #', 'Tenant Code', 'Resident ID', 'Account', 'Tenant ID'], 'lease_id');

export const RENT_ROLL_FIELDS = Object.freeze({
  property: PROPERTY,
  unit: { ...UNIT, required: true },
  tenant: TENANT,
  lease_id: LEASE,
  status: text(['Status', 'Unit Status', 'Tenant Status', 'Occupancy Status', 'Lease Status'], 'status'),
  sqft: num(['Sqft', 'Sq Ft', 'SqFt', 'Square Feet', 'Unit Sq Ft', 'Area', 'RSF', 'Rentable SF', 'Size', 'SF'], 'sqft'),
  bedrooms: text(['BD/BA', 'Beds', 'Bedrooms', 'Bed', 'Unit Type', 'Floorplan', 'Floor Plan'], 'bedrooms'),
  market_rent: money(['Market Rent', 'Market', 'Asking Rent', 'Scheduled Rent'], 'market_rent'),
  rent: money(['Rent', 'Monthly Rent', 'Current Rent', 'Actual Rent', 'Lease Rent', 'Base Rent', 'Monthly Base Rent', 'Rent Amount', 'Charges'], 'rent'),
  annual_rent: money(['Annual Rent', 'Annual Base Rent', 'Annual Rent Amount']),
  deposit: money(['Deposit', 'Deposits', 'Deposits Held', 'Security Deposit', 'Resident Deposit', 'Deposit Held', 'Sec Dep'], 'deposit'),
  lease_start: date(['Lease From', 'Lease Start', 'Lease Start Date', 'Lease Begin', 'Start Date', 'Commencement', 'Lease Commencement', 'From'], 'lease_start'),
  lease_end: date(['Lease To', 'Lease End', 'Lease End Date', 'Lease Expiration', 'Lease Exp', 'Expiration', 'Expiration Date', 'End Date', 'To'], 'lease_end'),
  move_in: date(['Move-in', 'Move In', 'Move-In Date', 'Move In Date'], 'move_in'),
  move_out: date(['Move-out', 'Move Out', 'Move-Out Date', 'Move Out Date', 'Notice Date'], 'move_out'),
  balance: money(['Past Due', 'Balance', 'Balance Due', 'Current Balance', 'Amount Receivable', 'Total Unpaid'], 'balance'),
  charge_code: text(['Charge Code', 'Charge Type', 'Charge', 'Code'], 'charge_code'),
  charge_amount: money(['Charge Amount', 'Amount', 'Lease Charges', 'Charge Amt']),
});

export const LEDGER_FIELDS = Object.freeze({
  property: PROPERTY, unit: UNIT, tenant: TENANT, lease_id: LEASE,
  date: date(['Date', 'Transaction Date', 'Trans Date', 'Post Date', 'Posted', 'Posting Date', 'Charge Date'], 'date', { required: true }),
  due_date: date(['Due Date', 'Due'], 'due_date'),
  charge_code: text(['Charge Code', 'Charge Type', 'Code', 'Type', 'GL Account', 'Account'], 'charge_code'),
  description: text(['Description', 'Memo', 'Notes', 'Detail', 'Details'], 'description'),
  charge: money(['Charges', 'Charge', 'Charge Amount', 'Increase', 'Debit', 'Billed'], false),
  payment: money(['Payments', 'Payment', 'Payment Amount', 'Decrease', 'Credit', 'Received', 'Receipt'], 'payment'),
  amount: money(['Amount', 'Net Amount', 'Transaction Amount'], 'amount'),
  balance: money(['Balance', 'Running Balance', 'Bal'], 'balance'),
  reference: text(['Reference', 'Ref', 'Check Number', 'Check #', 'Receipt #', 'Document', 'Ref #'], 'reference'),
});

export const AGING_FIELDS = Object.freeze({
  property: PROPERTY, unit: UNIT, tenant: { ...TENANT, required: true }, lease_id: LEASE,
  status: text(['Tenant Status', 'Resident Status', 'Status', 'Lease Status'], 'status'),
  balance: money(['Amount Receivable', 'Total Unpaid', 'Balance', 'Total Balance', 'Total Due', 'Total'], 'balance'),
  current: money(['Current', '0-30', '00 - 30', '0 - 30', '0-30 Days', '1-30']),
  d30: money(['30-60', '30 - 60', '31-60', '31-60 Days']),
  d60: money(['60-90', '60 - 90', '61-90', '61-90 Days']),
  d90: money(['90+', 'Over 90', '90+ Days', '> 90', 'Over 90 Days', '91+']),
  prepaid: money(['Prepays', 'Prepaid', 'Prepayments', 'Credits']),
  deposit: money(['Deposit', 'Deposits Held', 'Security Deposit'], 'deposit'),
  last_payment: date(['Last Payment', 'Last Payment Date', 'Last Receipt']),
  in_collections: text(['In Collections', 'Collections', 'Collection Status']),
  email: text(['Email', 'Email Address', 'Tenant Email'], 'email'),
  phone: text(['Phone', 'Phone Number', 'Mobile', 'Cell'], 'phone'),
});

export const GL_FIELDS = Object.freeze({
  property: PROPERTY,
  account: text(['GL Account', 'Account', 'Account Number', 'Account Code', 'Acct', 'GL Code', 'GL Account Number'], 'account', { required: true }),
  account_name: text(['Account Name', 'Account Description', 'GL Account Name', 'Description of Account', 'Acct Name'], 'account_name'),
  date: date(['Date', 'Post Date', 'Posting Date', 'Transaction Date', 'Trans Date'], 'date'),
  period: text(['Period', 'Post Month', 'Month', 'Fiscal Period', 'Accounting Period'], 'period'),
  description: text(['Description', 'Memo', 'Remarks', 'Notes', 'Line Description'], 'description'),
  vendor: text(['Vendor', 'Payee', 'Payee Name', 'Vendor Name', 'Person/Company', 'Name'], 'vendor'),
  debit: money(['Debit', 'Debits', 'Dr'], 'ledger_debit'),
  credit: money(['Credit', 'Credits', 'Cr'], 'ledger_credit'),
  amount: money(['Amount', 'Net', 'Net Amount', 'Total'], 'amount'),
  reference: text(['Reference', 'Ref', 'Control', 'Document', 'Check #', 'Invoice', 'Invoice Number'], 'reference'),
});

export const BUDGET_FIELDS = Object.freeze({
  property: PROPERTY,
  account: text(['GL Account', 'Account', 'Account Number', 'Account Code', 'Acct'], 'account', { required: true }),
  account_name: text(['Account Name', 'Account Description', 'Description'], 'account_name'),
  period: text(['Period', 'Month', 'Post Month'], 'period'),
  budget: money(['Budget', 'Budgeted', 'Budget Amount', 'Plan', 'PTD Budget', 'YTD Budget'], 'budget'),
  actual: money(['Actual', 'Actuals', 'Actual Amount', 'PTD Actual', 'YTD Actual'], 'actual'),
});

export const WORK_ORDER_FIELDS = Object.freeze({
  work_order: text(['Work Order', 'Work Order Number', 'Work Order #', 'WO', 'WO #', 'WO Number', 'Ticket', 'Request ID', 'Service Request'], 'work_order', { required: true }),
  property: PROPERTY, unit: UNIT,
  category: text(['Category', 'Issue', 'Type', 'Work Order Type', 'Problem', 'Trade'], 'category'),
  description: text(['Description', 'Job Description', 'Issue Description', 'Details', 'Problem Description', 'Summary'], 'description'),
  priority: text(['Priority', 'Urgency'], 'priority'),
  status: text(['Status', 'Work Order Status'], 'status'),
  vendor: text(['Vendor', 'Assigned Vendor', 'Assigned To', 'Technician', 'Contractor'], 'vendor'),
  created: date(['Created At', 'Created', 'Created Date', 'Date Created', 'Opened', 'Reported', 'Call Date', 'Requested On'], 'date'),
  assigned: date(['Assigned At', 'Assigned On', 'Dispatched', 'Scheduled', 'Scheduled Date']),
  completed: date(['Completed On', 'Completed', 'Completed Date', 'Date Completed', 'Closed', 'Closed On', 'Work Completed'], 'completed_date'),
  cost: money(['Cost', 'Amount', 'Invoice Amount', 'Total', 'Vendor Bill Amount', 'Labor + Materials'], 'amount'),
});

export const VENDOR_FIELDS = Object.freeze({
  vendor: text(['Vendor', 'Company Name', 'Vendor Name', 'Name', 'Payee', 'Company'], 'vendor', { required: true }),
  vendor_id: text(['Vendor ID', 'Vendor Code', 'Code', 'Vendor #'], 'vendor_id'),
  trade: text(['Trade', 'Vendor Type', 'Category', 'Service', 'Services'], 'category'),
  tax_id: text(['Tax ID', 'TIN', 'EIN', 'SSN/EIN', 'Federal ID', 'Tax Payer ID'], 'tax_id'),
  w9_on_file: text(['W-9 On File', 'W9 On File', 'W-9', 'W9', 'W-9 Received']),
  type_1099: text(['1099 Type', '1099', 'Send 1099', '1099 Eligible', '1099 Box']),
  gl_expires: date(['Liability Ins. Expires', 'Liability Insurance Expires', 'GL Expiration', 'General Liability Expires', 'Insurance Expiration', 'COI Expires', 'Liability Expiration']),
  wc_expires: date(['Workers Comp Expires', 'Workers Comp Expiration', "Workers' Comp Expires", 'WC Expiration', 'WC Expires']),
  auto_expires: date(['Auto Insurance Expires', 'Auto Ins Expires', 'Auto Expiration']),
  license_expires: date(['License Expires', 'License Expiration', 'State License Expires', 'Licence Expires'], 'expires'),
  license_number: text(['License Number', 'License #', 'State License', 'Licence Number']),
  email: text(['Email', 'Email Address', 'Primary Email'], 'email'),
  phone: text(['Phone', 'Phone Number', 'Primary Phone'], 'phone'),
});

export const PAYMENT_FIELDS = Object.freeze({
  payee: text(['Payee', 'Vendor', 'Paid To', 'Name', 'Owner', 'Payee Name', 'Vendor Name'], 'vendor', { required: true }),
  date: date(['Date', 'Payment Date', 'Check Date', 'Paid Date', 'Post Date'], 'date'),
  amount: money(['Amount', 'Payment Amount', 'Paid', 'Check Amount', 'Total'], 'amount', { required: true }),
  method: text(['Method', 'Payment Method', 'Payment Type', 'Type'], 'method'),
  account: text(['GL Account', 'Account', 'Expense Account'], 'account'),
  reference: text(['Reference', 'Check Number', 'Check #', 'Ref'], 'reference'),
  property: PROPERTY,
});

export const TENANT_INSURANCE_FIELDS = Object.freeze({
  property: PROPERTY, unit: { ...UNIT, required: true }, tenant: TENANT, lease_id: LEASE,
  insurer: text(['Insurer', 'Insurance Company', 'Carrier', 'Insurance Carrier', 'Provider']),
  policy: text(['Policy', 'Policy Number', 'Policy #']),
  liability: money(['Liability', 'Liability Limit', 'Liability Coverage', 'Personal Liability', 'GL Per Occurrence', 'Each Occurrence']),
  aggregate: money(['Aggregate', 'General Aggregate', 'GL Aggregate']),
  expires: date(['Expires', 'Expiration', 'Expiration Date', 'Policy End', 'Policy Expiration', 'End Date'], 'expires'),
  additional_insured: text(['Additional Insured', 'Additional Interest', 'Landlord Named', 'Interested Party']),
});

export const INSPECTION_FIELDS = Object.freeze({
  property: PROPERTY, unit: { ...UNIT, required: true },
  inspected_at: date(['Inspection Date', 'Date', 'Inspected', 'Inspected On'], 'date'),
  inspection_type: text(['Inspection Type', 'Type', 'Kind']),
  area: text(['Area', 'Room', 'Location', 'Section'], 'location'),
  item: text(['Item', 'Component', 'Feature', 'Element', 'Question'], 'item'),
  condition: text(['Condition', 'Rating', 'Result', 'Status', 'Score'], 'status'),
  notes: text(['Notes', 'Comment', 'Comments', 'Description', 'Remarks'], 'description'),
  photo: text(['Photo', 'Photos', 'Image', 'Photo URL', 'Attachment']),
  inspector: text(['Inspector', 'Inspected By', 'Completed By']),
});

export const CAPEX_FIELDS = Object.freeze({
  project: text(['Project', 'Project Name', 'Job', 'Job Name', 'Capital Project'], false, { required: true }),
  project_id: text(['Project ID', 'Project Code', 'Job Code', 'Job #'], 'id'),
  property: PROPERTY,
  category: text(['Category', 'Type', 'Component'], 'category'),
  budget: money(['Budget', 'Approved Budget', 'Budget Amount', 'Revised Budget'], 'budget'),
  committed: money(['Committed', 'Commitments', 'Contracted', 'PO Amount', 'Open Commitments']),
  spent: money(['Spent', 'Actual', 'Actual to Date', 'Paid to Date', 'Invoiced', 'Cost to Date'], 'actual'),
  status: text(['Status', 'Project Status', 'Phase'], 'status'),
  start: date(['Start', 'Start Date', 'Planned Start'], 'start_date'),
  finish: date(['Finish', 'End', 'End Date', 'Completion', 'Planned Finish', 'Target Completion'], 'end_date'),
  funding: text(['Funding', 'Funding Source', 'Reserve', 'Paid From']),
});

export const TAX_FIELDS = Object.freeze({
  property: { ...PROPERTY, required: true },
  parcel: text(['Parcel', 'Parcel ID', 'Parcel Number', 'APN', 'PIN', 'Folio', 'Tax ID', 'Account Number']),
  tax_year: num(['Tax Year', 'Year', 'Assessment Year']),
  assessed_value: money(['Assessed Value', 'Assessment', 'Total Assessed', 'Market Value', 'Appraised Value', 'Taxable Value'], 'assessed_value'),
  prior_assessed_value: money(['Prior Assessed Value', 'Prior Year Value', 'Previous Assessment', 'Prior Value']),
  tax_amount: money(['Tax', 'Tax Amount', 'Total Tax', 'Annual Tax', 'Tax Due'], 'amount'),
  notice_date: date(['Notice Date', 'Notice Mailed', 'Mailing Date', 'Notice of Value Date']),
  appeal_deadline: date(['Appeal Deadline', 'Protest Deadline', 'Appeal By', 'Filing Deadline']),
  due_date: date(['Due Date', 'Installment Due', 'Payment Due'], 'due_date'),
  paid: money(['Paid', 'Amount Paid', 'Paid Amount'], 'payment'),
});

export const SALES_FIELDS = Object.freeze({
  tenant: TENANT, unit: UNIT, lease_id: LEASE,
  period: text(['Period', 'Month', 'Sales Month', 'Reporting Period', 'Sales Period'], 'period', { required: true }),
  gross_sales: money(['Gross Sales', 'Sales', 'Total Sales', 'Reported Sales', 'Net Sales'], 'sales'),
  exclusions: money(['Exclusions', 'Deductions', 'Allowable Deductions', 'Excluded Sales', 'Returns', 'Abzüge', 'Déductions', 'Deducciones', 'Deduções', 'Detrazioni', '控除額', '扣除额', '공제액']),
  reported_on: date(['Reported On', 'Received', 'Date Received', 'Report Date', 'Submitted'], 'date'),
});

export const UTILITY_BILL_FIELDS = Object.freeze({
  property: PROPERTY,
  utility: text(['Utility', 'Service', 'Utility Type', 'Type', 'Commodity'], 'type', { required: true }),
  period_start: date(['Service From', 'Period Start', 'From', 'Start Date', 'Service Start', 'Bill Start'], 'start_date'),
  period_end: date(['Service To', 'Period End', 'To', 'End Date', 'Service End', 'Bill End'], 'end_date'),
  amount: money(['Amount', 'Bill Amount', 'Total', 'Total Due', 'Charges', 'Current Charges'], 'amount', { required: true }),
  account: text(['Account', 'Account Number', 'Utility Account', 'Meter'], 'account'),
  common_area: money(['Common Area', 'Common Area Amount', 'House Meter', 'Vacant/Common Deduction']),
});

export const UNIT_FIELDS = Object.freeze({
  property: PROPERTY, unit: { ...UNIT, required: true }, tenant: TENANT,
  sqft: num(['Sqft', 'Sq Ft', 'Square Feet', 'Area', 'Unit Sq Ft', 'SF'], 'sqft'),
  occupants: num(['Occupants', 'Occupant Count', 'Residents', 'Persons', 'Household Size', 'Number of Occupants'], 'occupants'),
  bedrooms: num(['Bedrooms', 'Beds', 'BR', 'Bed'], 'bedrooms'),
  move_in: date(['Move-in', 'Move In', 'Move-In Date', 'Occupied From'], 'move_in'),
  move_out: date(['Move-out', 'Move Out', 'Move-Out Date', 'Occupied To'], 'move_out'),
  billed: money(['Billed', 'Utility Billed', 'Billback', 'RUBS Charge', 'Charged'], 'amount'),
});

export const OWNER_LEDGER_FIELDS = Object.freeze({
  owner: text(['Owner', 'Owner Name', 'Owners', 'Payee', 'Investor'], 'owner', { required: true }),
  property: PROPERTY,
  date: date(['Date', 'Post Date', 'Transaction Date'], 'date'),
  type: text(['Type', 'Transaction Type', 'Category', 'Account Type'], 'type'),
  account: text(['GL Account', 'Account', 'Account Name'], 'account'),
  description: text(['Description', 'Memo', 'Notes'], 'description'),
  amount: money(['Amount', 'Net Amount', 'Total'], 'amount'),
  income: money(['Income', 'Cash In', 'Receipts', 'Deposits']),
  expense: money(['Expense', 'Expenses', 'Cash Out', 'Disbursements', 'Bills Paid']),
  reference: text(['Reference', 'Ref', 'Check #', 'Check Number'], 'reference'),
});

export const OWNER_STATEMENT_FIELDS = Object.freeze({
  owner: text(['Owner', 'Owner Name', 'Owners', 'Investor'], 'owner', { required: true }),
  property: PROPERTY,
  period: text(['Period', 'Statement Period', 'Month', 'Statement Month'], 'period'),
  beginning_balance: money(['Beginning Balance', 'Beginning Cash', 'Opening Balance', 'Starting Balance']),
  income: money(['Income', 'Total Income', 'Cash In', 'Receipts', 'Rent Collected']),
  expenses: money(['Expenses', 'Total Expenses', 'Cash Out', 'Disbursements']),
  management_fee: money(['Management Fee', 'Management Fees', 'Mgmt Fee', 'Property Management Fee']),
  owner_draw: money(['Owner Draw', 'Owner Distribution', 'Distribution', 'Owner Disbursement', 'Contributions/Distributions', 'Owner Payment']),
  reserve: money(['Reserve', 'Property Reserve', 'Operating Reserve', 'Held Reserve']),
  ending_balance: money(['Ending Balance', 'Ending Cash', 'Closing Balance', 'Ending Cash Balance']),
});

export const BANK_FIELDS = Object.freeze({
  date: date(['Date', 'Posting Date', 'Post Date', 'Transaction Date', 'Value Date'], 'date', { required: true }),
  description: text(['Description', 'Details', 'Memo', 'Payee', 'Transaction Description'], 'description'),
  amount: money(['Amount', 'Transaction Amount', 'Net Amount'], 'amount'),
  debit: money(['Debit', 'Withdrawal', 'Withdrawals', 'Money Out', 'Payments'], 'debit'),
  credit: money(['Credit', 'Deposit', 'Deposits', 'Money In', 'Receipts'], 'credit'),
  reference: text(['Reference', 'Check Number', 'Check #', 'Ref', 'Bank Reference'], 'reference'),
  balance: money(['Balance', 'Running Balance', 'Running Bal.'], 'balance'),
});

export const LEAD_FIELDS = Object.freeze({
  lead_id: text(['Lead ID', 'Guest Card ID', 'Prospect ID', 'ID', 'Inquiry ID'], 'id', { required: true }),
  property: PROPERTY,
  name: text(['Name', 'Prospect', 'Prospect Name', 'Guest Card Name', 'Lead Name'], 'name'),
  source: text(['Source', 'Lead Source', 'Marketing Source', 'Channel', 'Referral Source'], 'lead_source'),
  unit_type: text(['Unit Type', 'Floorplan', 'Desired Bedrooms', 'Bedrooms', 'Beds'], 'bedrooms'),
  created: date(['Created', 'Created At', 'Inquiry Date', 'Lead Date', 'First Contact', 'Received'], 'date'),
  first_response: date(['First Response', 'First Response At', 'Responded', 'Response Date', 'First Contacted']),
  toured: date(['Tour Date', 'Toured', 'Showing Date', 'Showing', 'Tour']),
  applied: date(['Application Date', 'Applied', 'Application Submitted']),
  approved: date(['Approved', 'Approval Date', 'Application Approved']),
  leased: date(['Lease Signed', 'Leased', 'Lease Date', 'Move-in', 'Converted']),
  status: text(['Status', 'Lead Status', 'Stage'], 'status'),
  lost_reason: text(['Lost Reason', 'Reason Lost', 'Cancel Reason', 'Denied Reason'], 'reason'),
});

export const BOOKING_FIELDS = Object.freeze({
  booking_id: text(['Confirmation Code', 'Reservation ID', 'Booking ID', 'Reservation', 'Reservation Number', 'Confirmation', 'Booking Reference'], 'reference', { required: true }),
  type: text(['Type', 'Transaction Type', 'Line Type'], 'type'),
  listing: text(['Listing', 'Property', 'Listing Name', 'Rental', 'Unit', 'Property Name'], 'property'),
  guest: text(['Guest', 'Guest Name', 'Traveler', 'Traveller'], 'guest'),
  check_in: date(['Start date', 'Check-in', 'Check In', 'Arrival', 'Arrival Date', 'Start Date'], 'check_in'),
  check_out: date(['End date', 'Check-out', 'Check Out', 'Departure', 'Departure Date', 'End Date'], 'check_out'),
  nights: num(['Nights', 'Night', 'Length of Stay', 'LOS'], 'nights'),
  currency: text(['Currency', 'Currency Code'], 'currency'),
  gross: money(['Gross earnings', 'Gross Earnings', 'Gross', 'Booking Amount', 'Rental Amount', 'Total Booking', 'Accommodation', 'Gross Booking Value']),
  cleaning_fee: money(['Cleaning fee', 'Cleaning Fee', 'Cleaning']),
  service_fee: money(['Service fee', 'Service Fee', 'Host Fee', 'Commission', 'Channel Fee', 'Host service fee']),
  taxes: money(['Occupancy taxes', 'Occupancy Taxes', 'Taxes', 'Lodging Tax', 'Tax']),
  amount: money(['Amount', 'Net', 'Net Amount', 'Expected Payout', 'Payout Amount'], 'payout'),
  paid_out: money(['Paid out', 'Paid Out', 'Payout', 'Payout Sent', 'Actual Payout']),
  payout_date: date(['Date', 'Payout Date', 'Paid Date', 'Transfer Date']),
});

export const LISTING_FIELDS = Object.freeze({
  listing_id: text(['Listing ID', 'Listing', 'ID', 'MLS #', 'Ad ID', 'Posting ID'], 'id'),
  channel: text(['Channel', 'Source', 'Site', 'Portal', 'Syndication'], 'lead_source'),
  property: PROPERTY, unit: { ...UNIT, required: true },
  bedrooms: num(['Bedrooms', 'Beds', 'BR', 'Bed'], 'bedrooms'),
  bathrooms: num(['Bathrooms', 'Baths', 'BA', 'Bath']),
  sqft: num(['Sqft', 'Sq Ft', 'Square Feet', 'Size', 'Area'], 'sqft'),
  rent: money(['Rent', 'Price', 'Asking Rent', 'Monthly Rent', 'List Price', 'Market Rent'], 'rent'),
  deposit: money(['Deposit', 'Security Deposit'], 'deposit'),
  available: date(['Available', 'Available Date', 'Date Available', 'Available On', 'Move-in Date'], 'date'),
  pets: text(['Pets', 'Pet Policy', 'Pets Allowed', 'Cats', 'Dogs']),
  status: text(['Status', 'Listing Status', 'Posted'], 'status'),
  title: text(['Title', 'Headline', 'Listing Title', 'Marketing Title'], 'name'),
});

export const ASSOCIATION_FIELDS = Object.freeze({
  account: text(['Account', 'Owner Account', 'Account #', 'Homeowner ID', 'Owner ID'], 'id'),
  owner: text(['Owner', 'Homeowner', 'Owner Name', 'Member', 'Name'], 'owner', { required: true }),
  unit: UNIT,
  date: date(['Date', 'Charge Date', 'Post Date', 'Due Date'], 'date'),
  type: text(['Type', 'Charge Type', 'Assessment Type', 'Description', 'Code'], 'charge_code'),
  charge: money(['Charge', 'Charges', 'Assessment', 'Amount Due', 'Billed']),
  payment: money(['Payment', 'Payments', 'Paid', 'Received'], 'payment'),
  balance: money(['Balance', 'Balance Due', 'Account Balance'], 'balance'),
});

export const VIOLATION_FIELDS = Object.freeze({
  violation_id: text(['Violation ID', 'Violation #', 'Case', 'Case Number', 'ID'], 'id', { required: true }),
  unit: UNIT, owner: text(['Owner', 'Homeowner', 'Owner Name', 'Name'], 'owner'),
  type: text(['Type', 'Violation Type', 'Category', 'Rule', 'Issue'], 'category'),
  opened: date(['Opened', 'Date Opened', 'Observed', 'Violation Date', 'Created'], 'date'),
  notice_1: date(['First Notice', 'Notice 1', 'Courtesy Notice', '1st Notice']),
  notice_2: date(['Second Notice', 'Notice 2', '2nd Notice']),
  hearing: date(['Hearing', 'Hearing Date', 'Board Hearing']),
  closed: date(['Closed', 'Date Closed', 'Cured', 'Resolved'], 'completed_date'),
  status: text(['Status', 'Violation Status'], 'status'),
  fine: money(['Fine', 'Fine Amount', 'Fines'], 'amount'),
});

export const RECERT_FIELDS = Object.freeze({
  household: text(['Household', 'Household ID', 'Resident ID', 'Tenant Code', 'Head of Household', 'Resident'], 'tenant', { required: true }),
  property: PROPERTY, unit: UNIT,
  program: text(['Program', 'Program Type', 'Subsidy', 'Funding', 'Set-Aside']),
  move_in: date(['Move-in', 'Move In', 'Move-In Date', 'Initial Certification'], 'move_in'),
  last_cert: date(['Last Certification', 'Last Cert', 'Effective Date', 'Last Recert', 'Last AR', 'Certification Date']),
  next_due: date(['Next Certification', 'Next Recert', 'Recert Due', 'Next AR Due', 'Anniversary', 'Next Due'], 'due_date'),
  status: text(['Status', 'Certification Status', 'Cert Status'], 'status'),
  notice_sent: date(['Notice Sent', 'First Notice', '120-Day Notice', 'Reminder Sent']),
});

export const TURN_FIELDS = Object.freeze({
  property: PROPERTY, unit: { ...UNIT, required: true },
  move_out: date(['Move-out', 'Move Out', 'Vacated', 'Move-Out Date', 'Vacate Date'], 'move_out'),
  ready: date(['Ready', 'Make Ready', 'Ready Date', 'Made Ready', 'Rent Ready', 'Completed'], 'completed_date'),
  move_in: date(['Move-in', 'Move In', 'Next Move-In', 'New Move-In', 'Move-In Date'], 'move_in'),
  category: text(['Category', 'Item', 'Trade', 'Type', 'Scope'], 'category'),
  vendor: text(['Vendor', 'Contractor', 'Assigned To'], 'vendor'),
  cost: money(['Cost', 'Amount', 'Total', 'Invoice Amount', 'Turn Cost'], 'amount'),
  chargeable: text(['Chargeable', 'Tenant Chargeable', 'Bill to Tenant', 'Damage']),
  rent: money(['Rent', 'Market Rent', 'Monthly Rent'], 'rent'),
});

export const MOVE_OUT_FIELDS = Object.freeze({
  unit: { ...UNIT, required: true }, tenant: TENANT, lease_id: LEASE,
  item: text(['Item', 'Charge', 'Description', 'Damage', 'Deduction'], 'item', { required: true }),
  category: text(['Category', 'Type', 'Charge Type', 'Reason'], 'category'),
  amount: money(['Amount', 'Cost', 'Charge Amount', 'Deduction Amount'], 'amount'),
  age_years: num(['Age', 'Age (years)', 'Item Age', 'Years in Service', 'Installed Years']),
  useful_life_years: num(['Useful Life', 'Useful Life (years)', 'Life', 'Expected Life']),
  evidence: text(['Photo', 'Photos', 'Evidence', 'Invoice', 'Receipt', 'Attachment']),
});

// --------------------------------------------------- named export layouts ----

/**
 * Profiles for the field sets above, per system. Signatures and column names were
 * written from knowledge of the exports (basis: recalled) and were not checked
 * against vendor documentation or a live account.
 */
export const RENT_ROLL_PROFILES = Object.freeze([
  exportProfile('appfolio_rent_roll', { unit: 'Unit', tenant: 'Tenant', status: 'Status', sqft: 'Sqft', bedrooms: 'BD/BA', market_rent: 'Market Rent', rent: 'Rent', deposit: 'Deposit', lease_start: 'Lease From', lease_end: 'Lease To', move_in: 'Move-in', move_out: 'Move-out', balance: 'Past Due' }, grouped(['tenant', 'status', 'rent', 'market_rent'])),
  exportProfile('yardi_rent_roll_charges', { unit: 'Unit', bedrooms: 'Unit Type', sqft: 'Unit Sq Ft', lease_id: 'Resident', tenant: 'Name', market_rent: 'Market Rent', charge_code: 'Charge Code', charge_amount: 'Amount', deposit: 'Resident Deposit', move_in: 'Move In', lease_end: 'Lease Expiration', move_out: 'Move Out', balance: 'Balance' }),
  exportProfile('yardi_commercial_rent_roll', { property: 'Property', unit: 'Unit(s)', lease_id: 'Lease', tenant: 'Tenant', sqft: 'Area', lease_start: 'Lease From', lease_end: 'Lease To', rent: 'Monthly Rent', annual_rent: 'Annual Rent', deposit: 'Security Deposit Received' }),
  exportProfile('buildium_rent_roll', { property: 'Property', unit: 'Unit', tenant: 'Tenants', status: 'Lease Status', lease_start: 'Lease start date', lease_end: 'Lease end date', rent: 'Rent', deposit: 'Deposits held' }),
  exportProfile('rentmanager_rent_roll', { property: 'Property', unit: 'Unit', tenant: 'Tenant Name', bedrooms: 'Unit Type', sqft: 'Sq Ft', market_rent: 'Market Rent', rent: 'Rent', deposit: 'Security Deposit', lease_start: 'Lease Start', lease_end: 'Lease End', move_in: 'Move In', balance: 'Balance' }),
  exportProfile('entrata_rent_roll', { property: 'Property', unit: 'Unit', tenant: 'Resident', status: 'Lease Status', sqft: 'SQFT', bedrooms: 'Floor Plan', market_rent: 'Market Rent', rent: 'Scheduled Rent', deposit: 'Deposit Held', lease_start: 'Lease Start', lease_end: 'Lease End', move_in: 'Move-In', balance: 'Balance' }),
  exportProfile('onesite_rent_roll', { unit: 'Unit', bedrooms: 'Floorplan', sqft: 'SQFT', tenant: 'Name', status: 'Unit/Lease Status', market_rent: 'Market Rent', rent: 'Lease Rent', deposit: 'Deposit On Hand', move_in: 'Move-In', lease_end: 'Lease End', balance: 'Balance' }),
  exportProfile('mri_rent_roll', { property: 'Building', unit: 'Suite', lease_id: 'Lease ID', tenant: 'Occupant Name', sqft: 'Suite Sq Ft', lease_start: 'Lease Begin', lease_end: 'Lease Expiration', rent: 'Monthly Base Rent', annual_rent: 'Annual Rent', deposit: 'Security Deposit' }),
]);

export const AGING_PROFILES = Object.freeze([
  exportProfile('appfolio_delinquency', { unit: 'Unit', tenant: 'Name', status: 'Tenant Status', balance: 'Amount Receivable', current: '00 - 30', d30: '30 - 60', d60: '60 - 90', d90: '90+', last_payment: 'Last Payment', in_collections: 'In Collections' }, grouped(['tenant', 'balance'])),
  exportProfile('yardi_aged_receivables', { property: 'Property', unit: 'Unit', lease_id: 'Resident', tenant: 'Name', balance: 'Total Unpaid', current: '0-30', d30: '31-60', d60: '61-90', d90: 'Over 90', prepaid: 'Prepays' }),
  exportProfile('buildium_outstanding_balances', { property: 'Property', unit: 'Unit', tenant: 'Tenant', balance: 'Total balance', current: '0-30 days', d30: '31-60 days', d60: '61-90 days', d90: '91+ days' }),
]);

export const LEDGER_PROFILES = Object.freeze([
  exportProfile('appfolio_tenant_ledger', { date: 'Date', description: 'Description', charge: 'Increase', payment: 'Decrease', balance: 'Balance', reference: 'Reference' }),
  exportProfile('yardi_resident_ledger', { date: 'Date', description: 'Description', charge_code: 'Charge Code', charge: 'Charges', payment: 'Payments', balance: 'Balance', reference: 'Control' }),
  exportProfile('buildium_tenant_ledger', { date: 'Date', description: 'Memo', charge_code: 'Account', charge: 'Charges', payment: 'Payments', balance: 'Balance' }),
]);

export const GL_PROFILES = Object.freeze([
  exportProfile('appfolio_general_ledger', { account: 'GL Account', date: 'Date', vendor: 'Payee / Payer', description: 'Description', debit: 'Debit', credit: 'Credit', reference: 'Reference' }, { rows: groupHeadings('account', 'account', ['date']), provides: [] }),
  exportProfile('yardi_gl_detail', { property: 'Property', account: 'Account', account_name: 'Account Description', date: 'Date', period: 'Period', description: 'Description', vendor: 'Person/Description', debit: 'Debit', credit: 'Credit', reference: 'Control' }),
  exportProfile('buildium_general_ledger', { property: 'Property', account: 'Account', date: 'Date', vendor: 'Payee', description: 'Memo', debit: 'Debit', credit: 'Credit', reference: 'Reference' }),
]);

export const WORK_ORDER_PROFILES = Object.freeze([
  exportProfile('appfolio_work_orders', { work_order: 'Work Order Number', property: 'Property', unit: 'Unit', priority: 'Priority', status: 'Status', vendor: 'Vendor', description: 'Job Description', category: 'Work Order Issue', created: 'Created At', completed: 'Completed On', cost: 'Amount' }),
  exportProfile('buildium_work_orders', { work_order: 'Task #', property: 'Property', unit: 'Unit', priority: 'Priority', status: 'Status', vendor: 'Assigned to', description: 'Subject', category: 'Category', created: 'Created', completed: 'Closed date' }),
  exportProfile('yardi_service_requests', { work_order: 'Service Request', property: 'Property', unit: 'Unit', priority: 'Priority', status: 'Status', vendor: 'Vendor', description: 'Brief Desc', category: 'Category', created: 'Call Date', completed: 'Complete Date' }),
]);

export const VENDOR_PROFILES = Object.freeze([
  exportProfile('appfolio_vendor_directory', { vendor: 'Company Name', trade: 'Vendor Trades', tax_id: 'Tax ID', type_1099: 'Send 1099?', gl_expires: 'Liability Ins. Expires', wc_expires: 'Workers Comp Expires', auto_expires: 'Auto Insurance Expires', license_expires: 'State Lic. Expires', email: 'Email', phone: 'Phone Numbers' }),
  exportProfile('buildium_vendors', { vendor: 'Company name', trade: 'Category', tax_id: 'Taxpayer ID', type_1099: '1099 reporting', gl_expires: 'Insurance expiration', email: 'Email', phone: 'Phone' }),
]);

export const BOOKING_PROFILES = Object.freeze([
  exportProfile('airbnb_transaction_history', { payout_date: 'Date', type: 'Type', booking_id: 'Confirmation Code', check_in: 'Start date', nights: 'Nights', guest: 'Guest', listing: 'Listing', currency: 'Currency', amount: 'Amount', paid_out: 'Paid out', service_fee: 'Service fee', cleaning_fee: 'Cleaning fee', gross: 'Gross earnings', taxes: 'Occupancy taxes' }),
  exportProfile('vrbo_payouts', { booking_id: 'Reservation ID', listing: 'Property', guest: 'Traveler', check_in: 'Check-in', check_out: 'Check-out', gross: 'Booking Amount', service_fee: 'Commission', amount: 'Payout Amount', payout_date: 'Payout Date', currency: 'Currency' }),
]);

export const LEAD_PROFILES = Object.freeze([
  exportProfile('appfolio_guest_cards', { lead_id: 'Guest Card ID', property: 'Property', name: 'Name', source: 'Source', unit_type: 'Bed / Bath Preference', created: 'Received', toured: 'Showing', status: 'Status', lost_reason: 'Inactive Reason' }),
]);
