// Catalogue of export files from real systems that the agents recognise.
//
// Each entry says how to recognise the file (column names that must be there).
// An agent turns an entry into a profile by adding its own column map:
//
//   exportProfile('slack_members', { user: 'fullname', email: 'email' })
//
// basis:
//   'documented'  the column names were checked against the vendor's own
//                 documentation (source and date given);
//   'recalled'    the layout was written from knowledge of the export and was
//                 not checked against documentation or a live account.
// Neither kind was tested against a live account. When a header differs, the
// file still maps by each column's "also called" list, `inspect` shows what was
// matched, and keystone-sources.json names the columns by hand.

const e = (id, system, label, signature, extra = {}) => Object.freeze({ id, system, label, signature, basis: 'recalled', ...extra });

export const EXPORTS = Object.freeze(Object.fromEntries([
  // Property management systems (Keystone). Layouts recalled, not checked.
  e('appfolio_rent_roll', 'AppFolio', 'Reports > Rent Roll (CSV or Excel)', ['Unit', 'Tenant', 'Lease From', 'Lease To', ['Market Rent', 'BD/BA']]),
  e('yardi_rent_roll_charges', 'Yardi Voyager', 'Rent Roll with Lease Charges (Excel)', ['Unit', 'Resident', 'Charge Code', ['Lease Expiration', 'Resident Deposit']]),
  e('yardi_commercial_rent_roll', 'Yardi Voyager (Commercial)', 'Commercial Rent Roll (Excel)', ['Unit(s)', 'Lease', 'Area', 'Lease From', 'Lease To']),
  e('buildium_rent_roll', 'Buildium', 'Reports > Rent roll (CSV or Excel)', ['Tenants', 'Lease start date', 'Lease end date', 'Rent']),
  e('rentmanager_rent_roll', 'Rent Manager', 'Rent Roll report (Excel export)', ['Tenant Name', 'Unit Type', 'Lease Start', 'Lease End', 'Sq Ft']),
  e('entrata_rent_roll', 'Entrata', 'Rent Roll report (Excel export)', ['Resident', 'Floor Plan', 'Scheduled Rent', 'Lease Start']),
  e('onesite_rent_roll', 'RealPage OneSite', 'Rent Roll Detail (Excel export)', ['Floorplan', 'Unit/Lease Status', 'Lease Rent']),
  e('mri_rent_roll', 'MRI Commercial Management', 'Rent Roll (Excel export)', ['Suite', 'Occupant Name', 'Lease Begin', 'Lease Expiration']),
  e('appfolio_delinquency', 'AppFolio', 'Reports > Delinquency (CSV or Excel)', ['Unit', 'Name', 'Amount Receivable', ['00 - 30', '90+']]),
  e('yardi_aged_receivables', 'Yardi Voyager', 'Aged Receivables (Excel)', ['Resident', 'Total Unpaid', 'Over 90']),
  e('buildium_outstanding_balances', 'Buildium', 'Reports > Outstanding balances (CSV)', ['Tenant', 'Total balance', ['0-30 days', '91+ days']]),
  e('appfolio_tenant_ledger', 'AppFolio', 'Tenant Ledger (CSV or Excel)', ['Date', 'Description', 'Increase', 'Decrease', 'Balance']),
  e('yardi_resident_ledger', 'Yardi Voyager', 'Resident Ledger (Excel)', ['Date', 'Charge Code', 'Charges', 'Payments', 'Balance']),
  e('buildium_tenant_ledger', 'Buildium', 'Tenant ledger (CSV)', ['Date', 'Memo', 'Charges', 'Payments', 'Balance']),
  e('appfolio_general_ledger', 'AppFolio', 'Reports > General Ledger (CSV or Excel)', ['GL Account', 'Payee / Payer', 'Debit', 'Credit']),
  e('yardi_gl_detail', 'Yardi Voyager', 'General Ledger detail (Excel)', ['Account', 'Account Description', 'Person/Description', 'Control']),
  e('buildium_general_ledger', 'Buildium', 'Reports > General ledger (CSV)', ['Account', 'Payee', 'Memo', 'Debit', 'Credit']),
  e('appfolio_work_orders', 'AppFolio', 'Reports > Work Order (CSV or Excel)', ['Work Order Number', 'Priority', ['Job Description', 'Work Order Issue']]),
  e('buildium_work_orders', 'Buildium', 'Tasks > Work orders export (CSV)', ['Task #', 'Subject', 'Assigned to']),
  e('yardi_service_requests', 'Yardi Voyager', 'Service Request register (Excel)', ['Service Request', 'Brief Desc', 'Call Date']),
  e('appfolio_vendor_directory', 'AppFolio', 'Reports > Vendor Directory (CSV or Excel)', ['Company Name', ['Liability Ins. Expires', 'Workers Comp Expires', 'Send 1099?']]),
  e('buildium_vendors', 'Buildium', 'Vendors > Export (CSV)', ['Company name', ['Taxpayer ID', '1099 reporting', 'Insurance expiration']]),
  e('airbnb_transaction_history', 'Airbnb', 'Earnings > Transaction history > Export CSV', ['Confirmation Code', 'Nights', 'Paid out', ['Gross earnings', 'Service fee']]),
  e('vrbo_payouts', 'Vrbo', 'Payouts / financial reporting export (CSV)', ['Reservation ID', 'Traveler', 'Payout Amount']),
  e('appfolio_guest_cards', 'AppFolio', 'Reports > Guest Card Inquiries (CSV or Excel)', ['Guest Card ID', 'Source', 'Received']),
  // Identity and SaaS admin consoles
  e('okta_users_api', 'Okta', 'Users API JSON (GET /api/v1/users)', ['profile.login', 'status']),
  e('entra_users', 'Microsoft Entra ID', 'Users > Download users (CSV)', ['userPrincipalName', 'accountEnabled']),
  e('m365_active_users', 'Microsoft 365 admin center', 'Active users > Export users (CSV)', ['User principal name', 'Block credential']),
  e('m365_active_user_detail', 'Microsoft 365 usage reports', 'Active users report detail (CSV)', ['User Principal Name', 'Assigned Products', 'Report Refresh Date']),
  e('google_workspace_users', 'Google Workspace Admin', 'Users > Download users (CSV)', ['Email Address [Required]', 'Last Sign In [READ ONLY]']),
  e('slack_members', 'Slack', 'Manage members > Export member list (CSV)', ['username', 'email', 'billing-active']),
  e('github_org_members', 'GitHub', 'Organization People > Export (CSV or JSON)', ['login', 'tfa_enabled']),
  e('github_copilot_seats', 'GitHub Copilot', 'Seat assignments API JSON (GET /orgs/{org}/copilot/billing/seats)', ['assignee.login', 'last_activity_at']),
  e('aws_iam_credential_report', 'AWS IAM', 'Credential report (CSV)', ['user', 'arn', 'password_last_used', 'mfa_active']),
  e('atlassian_users', 'Atlassian Administration', 'Directory > Users > Export users (CSV)', ['User id', 'User status', 'Added to org']),
  // HR
  e('bamboohr_employees', 'BambooHR', 'Employee report (CSV or Excel)', ['Employee #', ['Hire Date', 'Work Email', 'Employment Status']]),
  // Accounting
  e('netsuite_vendors', 'NetSuite', 'Vendor saved search (default column labels)', ['Internal ID', ['Tax ID', 'Tax Number', '1099 Eligible', 'Legal Name']]),
  e('netsuite_transactions', 'NetSuite', 'Transaction saved search (default column labels)', ['Document Number', 'Date']),
  e('netsuite_inventory', 'NetSuite', 'Item saved search with location quantities', [['Location On Hand', 'On Hand'], ['Location', 'Inventory Location']]),
  e('qbo_vendor_contact_list', 'QuickBooks Online', 'Vendor Contact List report (CSV or Excel)', ['Vendor', ['Phone Numbers', 'Billing Address', 'Full Name']]),
  e('qbo_transaction_list_by_vendor', 'QuickBooks Online', 'Transaction List by Vendor report (CSV or Excel)', ['Transaction Type', 'Num', 'Posting', 'Amount']),
  e('qbo_transaction_detail', 'QuickBooks Online', 'Transaction Detail by Account / General Ledger report', ['Transaction Type', 'Num', 'Split', 'Amount']),
  e('xero_contacts', 'Xero', 'Contacts > Export (CSV)', ['ContactName', 'EmailAddress', 'TaxNumber']),
  e('xero_bills', 'Xero', 'Bills > Export (CSV)', ['ContactName', 'InvoiceNumber', 'UnitAmount', 'Quantity']),
  e('xero_account_transactions', 'Xero', 'Account Transactions report (Excel or CSV)', ['Date', 'Source', 'Debit', 'Credit']),
  e('xero_statement_csv', 'Xero', 'Bank statement CSV (Xero import layout)', ['Date', 'Amount', 'Payee', 'Reference']),
  // Payments and commerce
  e('stripe_payments', 'Stripe', 'Payments > Export (CSV)', ['id', 'Amount Refunded', ['Created date (UTC)', 'Created (UTC)']]),
  e('shopify_orders', 'Shopify', 'Orders > Export (CSV)', ['Name', 'Financial Status', 'Lineitem name']),
  e('shopify_inventory', 'Shopify', 'Products > Inventory > Export (CSV)', ['Handle', 'SKU', 'Location', ['On hand', 'On hand (current)', 'Available']]),
  // CRM and email
  e('hubspot_contacts', 'HubSpot', 'Contacts > Export (CSV or Excel)', ['Record ID', 'Email', ['Lifecycle Stage', 'Last Activity Date', 'Marketing contact status', 'Create Date']]),
  e('salesforce_contacts_report', 'Salesforce', 'Contacts or Leads report export', ['Email', ['Email Opt Out', 'Email Bounced Reason'], ['Account Name', 'Company / Account', 'Contact ID', 'Lead ID']]),
  e('salesforce_data_loader', 'Salesforce', 'Data Loader / Data Export of Contact (API field names)', ['Id', 'Email', 'HasOptedOutOfEmail']),
  e('mailchimp_audience', 'Mailchimp', 'Audience > Export audience (CSV)', ['Email Address', 'MEMBER_RATING', 'LEID']),
  // Construction
  e('procore_rfis', 'Procore', 'RFIs > Export > CSV', ['#', 'Initiated At', 'Ball In Court'], { basis: 'documented', source: 'support.procore.com "Export RFIs to CSV or PDF"', checked: '2026-11-15' }),
  // Expenses
  e('ramp_transactions', 'Ramp', 'Transactions > Export (CSV)', ['Merchant Name', 'Ramp Category', 'Transaction Date'], { basis: 'documented', source: 'support.ramp.com "Exporting your data to CSV"', checked: '2026-11-15' }),
  e('expensify_default_csv', 'Expensify', 'Default CSV export of expenses', ['Timestamp', 'Merchant', 'Amount', 'Reimbursable']),
  // Banks
  e('chase_checking', 'Chase', 'Checking or savings account activity (CSV)', ['Details', 'Posting Date', 'Description', 'Amount', 'Balance']),
  e('chase_card', 'Chase', 'Credit card activity (CSV)', ['Transaction Date', 'Post Date', 'Description', 'Category', 'Amount']),
  e('bofa_checking', 'Bank of America', 'Checking account activity (CSV, with its summary block)', ['Date', 'Description', 'Amount', 'Running Bal.']),
  e('wells_fargo_csv', 'Wells Fargo', 'Account activity download (CSV with no header row)', [], {
    headerless: ['Date', 'Amount', 'Flag', 'Check Number', 'Description'],
    detect: (first) => first.length === 5 && /^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(String(first[0]).trim()) && /^-?[\d,]*\.?\d+$/.test(String(first[1]).trim()) && String(first[2]).trim() === '*',
  }),
  e('capital_one_360', 'Capital One', '360 account transactions (CSV)', ['Transaction Description', 'Transaction Date', 'Transaction Type', 'Transaction Amount']),
  e('mercury', 'Mercury', 'Transactions export (CSV)', ['Date (UTC)', 'Description', 'Amount', 'Bank Description']),
  // Certificates
  e('aws_acm', 'AWS Certificate Manager', 'aws acm list-certificates JSON', ['CertificateArn', 'DomainName', 'NotAfter']),
  e('crtsh', 'crt.sh', 'Certificate search JSON (output=json)', ['issuer_name', 'common_name', 'not_after']),
].map((x) => [x.id, x])));

/** A profile for an agent: a catalogue entry plus the agent's column map. */
export function exportProfile(key, map, extra = {}) {
  const base = EXPORTS[key];
  if (!base) throw new Error(`unknown export "${key}"`);
  return { ...base, map, ...extra };
}

export const EXPORTS_BASIS_NOTE = 'Where a layout says "checked", its column names were compared with the vendor\'s documentation on that date. The other layouts were written from knowledge of the export and were not checked. None was tested against a live account.';

/**
 * Row hook for grouped reports (QuickBooks style): a row with only its first
 * cell filled names the group for the rows under it; "Total for ..." rows end it.
 * The group name is written to `field` on each detail row.
 */
export function carryGroup(field, { groupColumn = '', isDetail } = {}) {
  return (rows) => {
    const out = []; let group = '';
    for (const r of rows) {
      const label = String(r[groupColumn] ?? '').trim();
      const detail = isDetail ? isDetail(r) : Object.entries(r).some(([k, v]) => k !== groupColumn && k !== field && String(v ?? '').trim() !== '');
      if (label && /^(grand\s+)?total\b/i.test(label)) continue;
      if (label && !detail) { group = label; continue; }
      if (!detail) continue;
      const { [groupColumn]: _drop, ...rest } = r;
      out.push({ ...rest, [field]: String(r[field] ?? '').trim() || label || group });
    }
    return out;
  };
}

/** Row hook: keep the first row for each value of `field` (Shopify repeats an order once per line item). */
export function firstRowPer(field) {
  return (rows) => { const seen = new Set(); return rows.filter((r) => { const k = String(r[field] ?? ''); if (!k || seen.has(k)) return false; seen.add(k); return true; }); };
}

/** "First Last" from two columns, for exports that split the name. */
export const fullName = (first, last) => ({ from: [first, last], compute: (_r, get) => [get(first), get(last)].map((v) => String(v ?? '').trim()).filter(Boolean).join(' ') });
