import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import "./App.css";

export default function App() {
  return (
    <div className="page">
      {/* your existing UI here */}
    </div>
  );
}

// Company Types Configuration
const COMPANY_TYPES = {
  SDN_BHD: { 
    name: 'Sdn Bhd (Private Limited)', 
    standard: 'MPERS', 
    fullStandard: 'Malaysian Private Entities Reporting Standard',
    taxInfo: '17% (≤RM500k) / 24% (>RM500k)',
    calcTax: (profit) => {
      if (profit <= 0) return 0;
      if (profit <= 500000) return Math.round(profit * 0.17);
      return Math.round(500000 * 0.17 + (profit - 500000) * 0.24);
    }
  },
  ENTERPRISE: { 
    name: 'Enterprise (Sole Prop/Partnership)', 
    standard: 'MPERS-Micro', 
    fullStandard: 'MPERS for Micro Entities',
    taxInfo: 'Personal Tax Rates (0-28%)',
    calcTax: (profit) => {
      if (profit <= 0) return 0;
      let tax = 0, remaining = profit;
      const brackets = [[5000, 0], [15000, 0.01], [15000, 0.03], [15000, 0.06], [20000, 0.11], [30000, 0.19], [150000, 0.25], [150000, 0.26], [Infinity, 0.28]];
      for (const [limit, rate] of brackets) {
        if (remaining <= 0) break;
        const taxable = Math.min(remaining, limit);
        tax += taxable * rate;
        remaining -= limit;
      }
      return Math.round(tax);
    }
  },
  BERHAD: { 
    name: 'Berhad (Public Listed)', 
    standard: 'MFRS', 
    fullStandard: 'Malaysian Financial Reporting Standards (IFRS)',
    taxInfo: '24% Flat Rate',
    calcTax: (profit) => profit <= 0 ? 0 : Math.round(profit * 0.24)
  }
};

// Financial Statements Engine
// ============================================
// CHART OF ACCOUNTS (COA) WITH GL CODES
// Standard Malaysian SME Chart of Accounts
// ============================================
const CHART_OF_ACCOUNTS = {
  // NON-CURRENT ASSETS (1000-1499)
  '1000': { name: 'Property, Plant & Equipment', type: 'nca', fsId: 'PPE' },
  '1010': { name: 'Land & Buildings', type: 'nca', fsId: 'PPE', subAccount: true },
  '1020': { name: 'Plant & Machinery', type: 'nca', fsId: 'PPE', subAccount: true },
  '1030': { name: 'Motor Vehicles', type: 'nca', fsId: 'PPE', subAccount: true },
  '1040': { name: 'Office Equipment', type: 'nca', fsId: 'PPE', subAccount: true },
  '1050': { name: 'Computer Equipment', type: 'nca', fsId: 'PPE', subAccount: true },
  '1060': { name: 'Furniture & Fittings', type: 'nca', fsId: 'PPE', subAccount: true },
  '1070': { name: 'Renovation', type: 'nca', fsId: 'PPE', subAccount: true },
  '1100': { name: 'Accumulated Depreciation', type: 'nca_contra', fsId: 'ACC_DEP' },
  '1110': { name: 'Acc Dep - Land & Buildings', type: 'nca_contra', fsId: 'ACC_DEP', subAccount: true },
  '1120': { name: 'Acc Dep - Plant & Machinery', type: 'nca_contra', fsId: 'ACC_DEP', subAccount: true },
  '1130': { name: 'Acc Dep - Motor Vehicles', type: 'nca_contra', fsId: 'ACC_DEP', subAccount: true },
  '1140': { name: 'Acc Dep - Office Equipment', type: 'nca_contra', fsId: 'ACC_DEP', subAccount: true },
  '1150': { name: 'Acc Dep - Computer Equipment', type: 'nca_contra', fsId: 'ACC_DEP', subAccount: true },
  '1160': { name: 'Acc Dep - Furniture & Fittings', type: 'nca_contra', fsId: 'ACC_DEP', subAccount: true },
  '1170': { name: 'Acc Dep - Renovation', type: 'nca_contra', fsId: 'ACC_DEP', subAccount: true },
  '1200': { name: 'Intangible Assets', type: 'nca', fsId: 'INTANGIBLES' },
  '1300': { name: 'Investments', type: 'nca', fsId: 'INVESTMENTS' },
  
  // CURRENT ASSETS (1500-1999)
  '1500': { name: 'Inventory', type: 'ca', fsId: 'INVENTORY' },
  '1510': { name: 'Raw Materials', type: 'ca', fsId: 'INVENTORY', subAccount: true },
  '1520': { name: 'Work in Progress', type: 'ca', fsId: 'INVENTORY', subAccount: true },
  '1530': { name: 'Finished Goods', type: 'ca', fsId: 'INVENTORY', subAccount: true },
  '1600': { name: 'Trade Receivables', type: 'ca', fsId: 'TRADE_RECEIVABLES' },
  '1610': { name: 'Trade Debtors Control', type: 'ca', fsId: 'TRADE_RECEIVABLES', subAccount: true },
  '1620': { name: 'Allowance for Doubtful Debts', type: 'ca_contra', fsId: 'TRADE_RECEIVABLES', subAccount: true },
  '1700': { name: 'Other Receivables', type: 'ca', fsId: 'OTHER_RECEIVABLES' },
  '1710': { name: 'Deposits', type: 'ca', fsId: 'OTHER_RECEIVABLES', subAccount: true },
  '1720': { name: 'Prepayments', type: 'ca', fsId: 'OTHER_RECEIVABLES', subAccount: true },
  '1730': { name: 'GST Input Tax', type: 'ca', fsId: 'OTHER_RECEIVABLES', subAccount: true },
  '1740': { name: 'Staff Advances', type: 'ca', fsId: 'OTHER_RECEIVABLES', subAccount: true },
  '1800': { name: 'Tax Prepaid', type: 'ca', fsId: 'TAX_PREPAID' },
  '1900': { name: 'Cash & Bank', type: 'ca', fsId: 'CASH_BANK' },
  '1910': { name: 'Cash in Hand', type: 'ca', fsId: 'CASH_BANK', subAccount: true },
  '1920': { name: 'Bank - Current Account', type: 'ca', fsId: 'CASH_BANK', subAccount: true },
  '1930': { name: 'Bank - Savings Account', type: 'ca', fsId: 'CASH_BANK', subAccount: true },
  '1940': { name: 'Fixed Deposits', type: 'ca', fsId: 'CASH_BANK', subAccount: true },
  
  // NON-CURRENT LIABILITIES (2000-2499)
  '2000': { name: 'Long Term Borrowings', type: 'ncl', fsId: 'LONG_TERM_LOAN' },
  '2010': { name: 'Term Loan', type: 'ncl', fsId: 'LONG_TERM_LOAN', subAccount: true },
  '2020': { name: 'Hire Purchase', type: 'ncl', fsId: 'LONG_TERM_LOAN', subAccount: true },
  '2100': { name: 'Deferred Tax Liability', type: 'ncl', fsId: 'DEFERRED_TAX' },
  
  // CURRENT LIABILITIES (2500-2999)
  '2500': { name: 'Short Term Borrowings', type: 'cl', fsId: 'SHORT_TERM_LOAN' },
  '2510': { name: 'Bank Overdraft', type: 'cl', fsId: 'SHORT_TERM_LOAN', subAccount: true },
  '2520': { name: 'Short Term Loan', type: 'cl', fsId: 'SHORT_TERM_LOAN', subAccount: true },
  '2600': { name: 'Trade Payables', type: 'cl', fsId: 'TRADE_PAYABLES' },
  '2610': { name: 'Trade Creditors Control', type: 'cl', fsId: 'TRADE_PAYABLES', subAccount: true },
  '2700': { name: 'Other Payables', type: 'cl', fsId: 'OTHER_PAYABLES' },
  '2710': { name: 'Accrued Expenses', type: 'cl', fsId: 'OTHER_PAYABLES', subAccount: true },
  '2720': { name: 'GST Output Tax', type: 'cl', fsId: 'OTHER_PAYABLES', subAccount: true },
  '2730': { name: 'Deposits Received', type: 'cl', fsId: 'OTHER_PAYABLES', subAccount: true },
  '2800': { name: 'Tax Payable', type: 'cl', fsId: 'TAX_PAYABLE' },
  '2810': { name: 'Income Tax Payable', type: 'cl', fsId: 'TAX_PAYABLE', subAccount: true },
  '2820': { name: 'GST/SST Payable', type: 'cl', fsId: 'GST_SST_PAYABLE', subAccount: true },
  '2900': { name: 'Directors Account', type: 'cl', fsId: 'OTHER_PAYABLES' },
  
  // EQUITY (3000-3999)
  '3000': { name: 'Share Capital', type: 'equity', fsId: 'SHARE_CAPITAL' },
  '3010': { name: 'Ordinary Shares', type: 'equity', fsId: 'SHARE_CAPITAL', subAccount: true },
  '3020': { name: 'Preference Shares', type: 'equity', fsId: 'SHARE_CAPITAL', subAccount: true },
  '3100': { name: 'Retained Profits', type: 'equity', fsId: 'RETAINED_PROFITS' },
  '3200': { name: 'Reserves', type: 'equity', fsId: 'RESERVES' },
  '3900': { name: 'Drawings', type: 'equity_contra', fsId: 'DRAWINGS' },
  
  // REVENUE (4000-4999)
  '4000': { name: 'Sales Revenue', type: 'revenue', fsId: 'SALES' },
  '4010': { name: 'Sales - Products', type: 'revenue', fsId: 'SALES', subAccount: true },
  '4020': { name: 'Sales - Services', type: 'revenue', fsId: 'SERVICE_REVENUE', subAccount: true },
  '4100': { name: 'Other Income', type: 'other_income', fsId: 'OTHER_INCOME' },
  '4110': { name: 'Interest Income', type: 'other_income', fsId: 'INTEREST_INC', subAccount: true },
  '4120': { name: 'Dividend Income', type: 'other_income', fsId: 'DIVIDEND_INC', subAccount: true },
  '4130': { name: 'Rental Income', type: 'other_income', fsId: 'RENTAL_INC', subAccount: true },
  '4140': { name: 'Gain on Disposal', type: 'other_income', fsId: 'OTHER_INCOME', subAccount: true },
  '4150': { name: 'Forex Gain', type: 'other_income', fsId: 'OTHER_INCOME', subAccount: true },
  
  // COST OF SALES (5000-5999)
  '5000': { name: 'Cost of Sales', type: 'cogs', fsId: 'PURCHASE' },
  '5010': { name: 'Purchases', type: 'cogs', fsId: 'PURCHASE', subAccount: true },
  '5020': { name: 'Direct Labour', type: 'cogs', fsId: 'DIRECT_COSTS', subAccount: true },
  '5030': { name: 'Freight In', type: 'cogs', fsId: 'FREIGHT_IN', subAccount: true },
  '5040': { name: 'Import Duties', type: 'cogs', fsId: 'DIRECT_COSTS', subAccount: true },
  '5050': { name: 'Subcontractor Costs', type: 'cogs', fsId: 'DIRECT_COSTS', subAccount: true },
  
  // OPERATING EXPENSES (6000-6999)
  '6000': { name: 'Staff Costs', type: 'expense', fsId: 'SALARY', group: 'Staff' },
  '6010': { name: 'Salaries & Wages', type: 'expense', fsId: 'SALARY', subAccount: true, group: 'Staff' },
  '6020': { name: 'EPF - Employer', type: 'expense', fsId: 'EPF', subAccount: true, group: 'Staff' },
  '6030': { name: 'SOCSO - Employer', type: 'expense', fsId: 'SOCSO', subAccount: true, group: 'Staff' },
  '6040': { name: 'EIS - Employer', type: 'expense', fsId: 'SOCSO', subAccount: true, group: 'Staff' },
  '6050': { name: 'HRDF Levy', type: 'expense', fsId: 'HRDF', subAccount: true, group: 'Staff' },
  '6060': { name: 'Staff Benefits', type: 'expense', fsId: 'SALARY', subAccount: true, group: 'Staff' },
  '6100': { name: 'Rental Expenses', type: 'expense', fsId: 'RENT', group: 'Premises' },
  '6110': { name: 'Office Rental', type: 'expense', fsId: 'RENT', subAccount: true, group: 'Premises' },
  '6120': { name: 'Warehouse Rental', type: 'expense', fsId: 'RENT', subAccount: true, group: 'Premises' },
  '6200': { name: 'Utilities', type: 'expense', fsId: 'UTILITIES', group: 'Premises' },
  '6210': { name: 'Electricity', type: 'expense', fsId: 'UTILITIES', subAccount: true, group: 'Premises' },
  '6220': { name: 'Water', type: 'expense', fsId: 'UTILITIES', subAccount: true, group: 'Premises' },
  '6230': { name: 'Gas', type: 'expense', fsId: 'UTILITIES', subAccount: true, group: 'Premises' },
  '6300': { name: 'Telephone & Internet', type: 'expense', fsId: 'TELEPHONE', group: 'Premises' },
  '6400': { name: 'Marketing & Advertising', type: 'expense', fsId: 'ADVERTISING', group: 'Marketing' },
  '6410': { name: 'Advertising', type: 'expense', fsId: 'ADVERTISING', subAccount: true, group: 'Marketing' },
  '6420': { name: 'Digital Marketing', type: 'expense', fsId: 'ADVERTISING', subAccount: true, group: 'Marketing' },
  '6500': { name: 'Entertainment', type: 'expense', fsId: 'ENTERTAINMENT', group: 'Marketing' },
  '6600': { name: 'Travelling', type: 'expense', fsId: 'TRAVEL', group: 'Marketing' },
  '6610': { name: 'Local Travel', type: 'expense', fsId: 'TRAVEL', subAccount: true, group: 'Marketing' },
  '6620': { name: 'Overseas Travel', type: 'expense', fsId: 'TRAVEL', subAccount: true, group: 'Marketing' },
  '6700': { name: 'Professional Fees', type: 'expense', fsId: 'PROFESSIONAL_FEE', group: 'Professional' },
  '6710': { name: 'Audit Fee', type: 'expense', fsId: 'PROFESSIONAL_FEE', subAccount: true, group: 'Professional' },
  '6720': { name: 'Accounting Fee', type: 'expense', fsId: 'PROFESSIONAL_FEE', subAccount: true, group: 'Professional' },
  '6730': { name: 'Legal Fee', type: 'expense', fsId: 'PROFESSIONAL_FEE', subAccount: true, group: 'Professional' },
  '6740': { name: 'Secretarial Fee', type: 'expense', fsId: 'PROFESSIONAL_FEE', subAccount: true, group: 'Professional' },
  '6750': { name: 'Tax Agent Fee', type: 'expense', fsId: 'PROFESSIONAL_FEE', subAccount: true, group: 'Professional' },
  '6800': { name: 'License & Subscriptions', type: 'expense', fsId: 'LICENSE_FEE', group: 'Professional' },
  '6900': { name: 'Insurance', type: 'expense', fsId: 'INSURANCE', group: 'Professional' },
  '7000': { name: 'Office Supplies', type: 'expense', fsId: 'OFFICE_SUPPLIES', group: 'Office' },
  '7100': { name: 'Repairs & Maintenance', type: 'expense', fsId: 'REPAIR_MAINTENANCE', group: 'Office' },
  '7200': { name: 'Cleaning & Upkeep', type: 'expense', fsId: 'CLEANING', group: 'Office' },
  '7300': { name: 'Depreciation', type: 'expense', fsId: 'DEPRECIATION', group: 'Other' },
  '7310': { name: 'Depreciation - Buildings', type: 'expense', fsId: 'DEPRECIATION', subAccount: true, group: 'Other' },
  '7320': { name: 'Depreciation - Plant & Machinery', type: 'expense', fsId: 'DEPRECIATION', subAccount: true, group: 'Other' },
  '7330': { name: 'Depreciation - Motor Vehicles', type: 'expense', fsId: 'DEPRECIATION', subAccount: true, group: 'Other' },
  '7340': { name: 'Depreciation - Office Equipment', type: 'expense', fsId: 'DEPRECIATION', subAccount: true, group: 'Other' },
  '7350': { name: 'Depreciation - Computer Equipment', type: 'expense', fsId: 'DEPRECIATION', subAccount: true, group: 'Other' },
  '7400': { name: 'Bad Debts', type: 'expense', fsId: 'BAD_DEBT', group: 'Other' },
  '7500': { name: 'Other Expenses', type: 'other_expense', fsId: 'OTHER_EXPENSE' },
  '7510': { name: 'Forex Loss', type: 'other_expense', fsId: 'FOREX_LOSS', subAccount: true },
  '7520': { name: 'Loss on Disposal', type: 'other_expense', fsId: 'OTHER_EXPENSE', subAccount: true },
  
  // FINANCE COSTS (8000-8999)
  '8000': { name: 'Bank Charges', type: 'finance', fsId: 'BANK_CHARGES' },
  '8100': { name: 'Interest Expense', type: 'finance', fsId: 'INTEREST_EXP' },
  '8110': { name: 'Interest on Term Loan', type: 'finance', fsId: 'INTEREST_EXP', subAccount: true },
  '8120': { name: 'Interest on Hire Purchase', type: 'finance', fsId: 'INTEREST_EXP', subAccount: true },
  '8130': { name: 'Interest on Overdraft', type: 'finance', fsId: 'INTEREST_EXP', subAccount: true },
  
  // TAX (9000-9999)
  '9000': { name: 'Income Tax Expense', type: 'tax', fsId: 'TAX_EXPENSE' },
  '9100': { name: 'Deferred Tax Expense', type: 'tax', fsId: 'TAX_EXPENSE', subAccount: true },
};

// Helper function to get GL code from FS ID
const getGLCode = (fsId) => {
  for (const [code, account] of Object.entries(CHART_OF_ACCOUNTS)) {
    if (account.fsId === fsId && !account.subAccount) return code;
  }
  return null;
};

// Helper function to get account name from GL code
const getAccountName = (glCode) => {
  return CHART_OF_ACCOUNTS[glCode]?.name || 'Unknown Account';
};

// Helper function to get all sub-accounts for a parent GL code
const getSubAccounts = (parentGLCode) => {
  const parentFsId = CHART_OF_ACCOUNTS[parentGLCode]?.fsId;
  if (!parentFsId) return [];
  return Object.entries(CHART_OF_ACCOUNTS)
    .filter(([code, acc]) => acc.fsId === parentFsId && acc.subAccount && code.startsWith(parentGLCode.substring(0, 2)))
    .map(([code, acc]) => ({ code, ...acc }));
};

// ============================================
// UNIFIED FS STRUCTURE & CLASSIFICATIONS
// This defines both the classification codes AND the FS line items
// ============================================
const FS_STRUCTURE = {
  // INCOME STATEMENT
  income: {
    revenue: [
      { id: 'SALES', label: 'Sales Revenue', glCode: '4000', kw: ['sales', 'revenue', 'service fee', 'collection', 'payment received', 'customer payment', 'inward', 'receipt', 'proceed'] },
    ],
    cost_of_sales: [
      { id: 'PURCHASE', label: 'Purchases', glCode: '5010', kw: ['purchase', 'inventory', 'stock', 'goods', 'supplier', 'vendor', 'buy', 'cost of sales', 'raw material'] },
      { id: 'FREIGHT_IN', label: 'Freight & Delivery', glCode: '5030', kw: ['freight in', 'shipping cost', 'delivery charge', 'import', 'carriage inward'] },
    ],
    other_income: [
      { id: 'INTEREST_INC', label: 'Interest Income', glCode: '4110', kw: ['interest income', 'interest received', 'interest credit', 'interest earn', 'hibah'] },
      { id: 'DIVIDEND_INC', label: 'Dividend Income', glCode: '4120', kw: ['dividend', 'dividend income', 'dividend received'] },
      { id: 'RENTAL_INC', label: 'Rental Income', glCode: '4130', kw: ['rental income', 'rent received', 'tenant', 'sewa diterima'] },
      { id: 'OTHER_INCOME', label: 'Other Income', glCode: '4100', kw: ['other income', 'miscellaneous income', 'gain on disposal', 'forex gain', 'commission income', 'rebate', 'refund received'] },
    ],
    operating_expenses: [
      { id: 'SALARY', label: 'Staff Costs', glCode: '6000', kw: ['salary', 'wages', 'payroll', 'bonus', 'staff', 'employee', 'gaji', 'allowance', 'commission paid'], group: 'Staff' },
      { id: 'EPF', label: 'EPF Contribution', glCode: '6020', kw: ['epf', 'kwsp', 'employees provident'], group: 'Staff' },
      { id: 'SOCSO', label: 'SOCSO/EIS', glCode: '6030', kw: ['socso', 'perkeso', 'eis', 'employment insurance'], group: 'Staff' },
      { id: 'HRDF', label: 'HRDF Levy', glCode: '6050', kw: ['hrdf', 'training levy'], group: 'Staff' },
      { id: 'RENT', label: 'Rental', glCode: '6100', kw: ['rent', 'lease', 'tenancy', 'rental', 'premises', 'sewa', 'office space'], group: 'Premises' },
      { id: 'UTILITIES', label: 'Utilities', glCode: '6200', kw: ['electric', 'water', 'gas', 'utility', 'utilities', 'tnb', 'syabas', 'indah water', 'tenaga', 'sewerage'], group: 'Premises' },
      { id: 'TELEPHONE', label: 'Telephone & Internet', glCode: '6300', kw: ['telephone', 'phone', 'mobile', 'internet', 'telco', 'unifi', 'maxis', 'celcom', 'digi', 'time', 'broadband', 'wifi'], group: 'Premises' },
      { id: 'ADVERTISING', label: 'Advertising & Marketing', glCode: '6400', kw: ['advertising', 'advertisement', 'ads', 'marketing', 'promotion', 'branding', 'social media', 'google ads', 'facebook', 'instagram', 'digital marketing'], group: 'Marketing' },
      { id: 'ENTERTAINMENT', label: 'Entertainment', glCode: '6500', kw: ['entertainment', 'client meal', 'business meal', 'corporate gift', 'hamper', 'gift', 'makan', 'lunch meeting', 'dinner'], group: 'Marketing' },
      { id: 'TRAVEL', label: 'Travelling', glCode: '6600', kw: ['travel', 'travelling', 'accommodation', 'hotel', 'flight', 'airfare', 'petrol', 'toll', 'parking', 'grab', 'uber', 'transport', 'mileage'], group: 'Marketing' },
      { id: 'PROFESSIONAL_FEE', label: 'Professional Fees', glCode: '6700', kw: ['professional fee', 'audit fee', 'accounting fee', 'legal fee', 'consultation', 'consultant', 'secretary fee', 'tax agent', 'company secretary'], group: 'Professional' },
      { id: 'LICENSE_FEE', label: 'License & Subscriptions', glCode: '6800', kw: ['license', 'licence', 'permit', 'renewal', 'ssm', 'registration', 'subscription', 'software license'], group: 'Professional' },
      { id: 'INSURANCE', label: 'Insurance', glCode: '6900', kw: ['insurance', 'takaful', 'premium', 'coverage', 'policy'], group: 'Professional' },
      { id: 'OFFICE_SUPPLIES', label: 'Office Supplies', glCode: '7000', kw: ['office supplies', 'stationery', 'printing', 'toner', 'cartridge', 'paper', 'pen', 'pantry'], group: 'Office' },
      { id: 'REPAIR_MAINTENANCE', label: 'Repairs & Maintenance', glCode: '7100', kw: ['repair', 'maintenance', 'service', 'fix', 'servicing', 'upkeep', 'baiki'], group: 'Office' },
      { id: 'CLEANING', label: 'Cleaning', glCode: '7200', kw: ['cleaning', 'cleaner', 'housekeeping', 'pest control', 'waste disposal'], group: 'Office' },
      { id: 'DEPRECIATION', label: 'Depreciation', glCode: '7300', kw: ['depreciation', 'amortisation', 'amortization'], group: 'Other' },
      { id: 'BAD_DEBT', label: 'Bad Debts', glCode: '7400', kw: ['bad debt', 'doubtful debt', 'write off', 'impairment', 'provision'], group: 'Other' },
    ],
    other_expenses: [
      { id: 'FOREX_LOSS', label: 'Forex Loss', glCode: '7510', kw: ['forex loss', 'exchange loss', 'currency loss'] },
      { id: 'OTHER_EXPENSE', label: 'Other Expenses', glCode: '7500', kw: ['other expense', 'miscellaneous expense', 'sundry expense', 'general expense'] },
    ],
    finance_costs: [
      { id: 'BANK_CHARGES', label: 'Bank Charges', glCode: '8000', kw: ['bank charge', 'bank fee', 'service charge', 'annual fee', 'monthly fee', 'atm fee', 'card fee', 'transaction fee'] },
      { id: 'INTEREST_EXP', label: 'Interest Expense', glCode: '8100', kw: ['interest expense', 'interest paid', 'loan interest', 'finance charge', 'overdraft interest'] },
    ],
    tax: [
      { id: 'TAX_EXPENSE', label: 'Tax Expense', glCode: '9000', kw: [] }, // Computed, not classified
    ],
  },
  // BALANCE SHEET
  balance: {
    non_current_assets: [
      { id: 'PPE', label: 'Property, Plant & Equipment', glCode: '1000', kw: ['equipment', 'machinery', 'vehicle', 'furniture', 'computer', 'laptop', 'printer', 'asset purchase', 'renovation', 'air cond', 'aircon'], classCode: 'FIXED_ASSET' },
      { id: 'INTANGIBLES', label: 'Intangible Assets', glCode: '1200', kw: ['intangible', 'software', 'trademark', 'patent'] },
      { id: 'INVESTMENTS', label: 'Investments', glCode: '1300', kw: ['investment', 'shares', 'unit trust'] },
    ],
    current_assets: [
      { id: 'INVENTORY', label: 'Inventory', glCode: '1500', kw: [] }, // Subledger managed
      { id: 'TRADE_RECEIVABLES', label: 'Trade Receivables', glCode: '1600', kw: [] }, // Subledger managed
      { id: 'OTHER_RECEIVABLES', label: 'Other Receivables', glCode: '1700', kw: ['deposit', 'prepaid', 'prepayment', 'advance'] },
      { id: 'TAX_PREPAID', label: 'Tax Prepaid', glCode: '1800', kw: [] }, // Computed from tax payments exceeding liability
      { id: 'CASH_BANK', label: 'Cash & Bank', glCode: '1900', kw: [] }, // From bank transactions
    ],
    non_current_liabilities: [
      { id: 'LONG_TERM_LOAN', label: 'Long Term Borrowings', glCode: '2000', kw: ['term loan', 'long term loan', 'hp', 'hire purchase'] },
      { id: 'DEFERRED_TAX', label: 'Deferred Tax', glCode: '2100', kw: [] },
    ],
    current_liabilities: [
      { id: 'SHORT_TERM_LOAN', label: 'Short Term Borrowings', glCode: '2500', kw: ['loan disbursement', 'loan drawdown', 'borrowing', 'financing', 'instalment', 'installment', 'loan repayment'], classCode: 'LOAN' },
      { id: 'TRADE_PAYABLES', label: 'Trade Payables', glCode: '2600', kw: [] }, // Subledger managed
      { id: 'OTHER_PAYABLES', label: 'Other Payables', glCode: '2700', kw: ['accrual', 'accrued'] },
      { id: 'TAX_PAYABLE', label: 'Tax Payable', glCode: '2800', kw: [], classCode: 'TAX_PAYMENT' }, // Display only, no auto-classify
      { id: 'GST_SST_PAYABLE', label: 'GST/SST Payable', glCode: '2820', kw: ['gst payment', 'sst payment', 'gst', 'sst', 'service tax', 'sales tax'], classCode: 'GST_SST' },
    ],
    equity: [
      { id: 'SHARE_CAPITAL', label: 'Share Capital', glCode: '3000', kw: ['capital injection', 'share capital', 'director loan', 'shareholder fund', 'capital contribution'], classCode: 'CAPITAL' },
      { id: 'RETAINED_PROFITS', label: 'Retained Profits', glCode: '3100', kw: [] },
      { id: 'CURRENT_YEAR_PROFIT', label: 'Current Year Profit/(Loss)', glCode: '3100', kw: [] }, // Computed, same GL as retained
    ],
  },
  // Non-FS items (transfers, drawings, tax payments, PAYMENT CLASSIFICATIONS)
  other: [
    { id: 'DRAWINGS', label: 'Drawings', glCode: '3900', kw: ['drawings', 'personal withdrawal', 'director withdrawal', 'owner withdrawal'], type: 'drawings' },
    { id: 'TRANSFER', label: 'Transfer (Internal)', glCode: null, kw: ['ibg transfer', 'interbank giro', 'internal transfer', 'own account transfer', 'transfer to own', 'transfer from own', 'self transfer'], type: 'transfer' },
    { id: 'CASH_TRANSFER', label: 'Cash Transfer (Bank↔Cash)', glCode: null, kw: ['petty cash', 'cash withdrawal', 'cash deposit', 'atm withdrawal', 'atm deposit', 'cash top up', 'cash topup'], type: 'cash_transfer' },
    { id: 'TAX_PAYMENT', label: 'Tax Payment', glCode: '2800', kw: ['tax payment', 'lhdn', 'income tax', 'cp204', 'cp500', 'pcb', 'mtd'], type: 'tax_payment' },
    // PAYMENT CLASSIFICATIONS - These reduce liabilities
    { id: 'PAY_SUPPLIER', label: 'Payment to Supplier', glCode: '2600', kw: ['payment to supplier', 'supplier payment', 'vendor payment', 'creditor payment'], type: 'pay_supplier' },
    { id: 'PAY_CREDITOR', label: 'Payment to Creditor', glCode: '2700', kw: ['payment to creditor', 'creditor', 'accrual payment'], type: 'pay_creditor' },
    { id: 'LOAN_REPAY_ST', label: 'Loan Repayment (ST)', glCode: '2500', kw: ['loan repayment', 'loan payment', 'instalment', 'installment', 'monthly repayment', 'loan instalment'], type: 'loan_repay_st' },
    { id: 'LOAN_REPAY_LT', label: 'Loan Repayment (LT)', glCode: '2000', kw: ['term loan repayment', 'hp repayment', 'hire purchase repayment', 'mortgage payment'], type: 'loan_repay_lt' },
    { id: 'LOAN_DRAWDOWN', label: 'Loan Drawdown', glCode: '2500', kw: ['loan disbursement', 'loan drawdown', 'loan proceeds', 'facility drawdown', 'od utilization', 'overdraft'], type: 'loan_drawdown' },
    // RECEIPT CLASSIFICATIONS - These reduce receivables or increase liabilities
    { id: 'RECEIPT_DEBTOR', label: 'Receipt from Debtor', glCode: '1600', kw: ['receipt from debtor', 'debtor receipt', 'customer receipt', 'collection', 'received from customer'], type: 'receipt_debtor' },
    { id: 'DEPOSIT_RECEIVED', label: 'Deposit Received', glCode: '2700', kw: ['deposit received', 'advance received', 'customer deposit'], type: 'deposit_received' },
    // DUITNOW - Context-dependent
    { id: 'DUITNOW_OUT', label: 'DuitNow (Payment)', glCode: '2600', kw: ['duitnow'], type: 'duitnow_payment' },
    { id: 'SUSPENSE', label: 'Suspense', glCode: '9999', kw: [], type: 'suspense' },
  ]
};

// ============================================
// CLASSIFICATION ALIAS MAP (normalize codes)
// ============================================
const CLASS_ALIAS = {
  'PURCHASES': 'PURCHASE',
  'COST_OF_SALES': 'PURCHASE',
  'COGS': 'PURCHASE',
  'MISC_EXPENSE': 'MISCELLANEOUS',
  'OFFICE': 'OFFICE_SUPPLIES',
};

// Build FSEngine.rules from FS_STRUCTURE
const FSEngine = {
  rules: (() => {
    const rules = {};
    // Income Statement items
    FS_STRUCTURE.income.revenue.forEach(item => { rules[item.id] = { kw: item.kw, type: 'revenue', label: item.label }; });
    FS_STRUCTURE.income.cost_of_sales.forEach(item => { rules[item.id] = { kw: item.kw, type: 'cogs', label: item.label }; });
    FS_STRUCTURE.income.other_income.forEach(item => { rules[item.id] = { kw: item.kw, type: 'other_income', label: item.label }; });
    FS_STRUCTURE.income.operating_expenses.forEach(item => { rules[item.id] = { kw: item.kw, type: 'expense', label: item.label, group: item.group }; });
    FS_STRUCTURE.income.other_expenses.forEach(item => { rules[item.id] = { kw: item.kw, type: 'other_expense', label: item.label }; });
    FS_STRUCTURE.income.finance_costs.forEach(item => { rules[item.id] = { kw: item.kw, type: 'finance', label: item.label }; });
    // Balance Sheet items
    FS_STRUCTURE.balance.non_current_assets.forEach(item => { 
      if (item.kw.length > 0) rules[item.classCode || item.id] = { kw: item.kw, type: 'asset', label: item.label }; 
    });
    FS_STRUCTURE.balance.current_liabilities.forEach(item => { 
      if (item.kw.length > 0 && item.classCode) rules[item.classCode] = { kw: item.kw, type: 'liability', label: item.label }; 
    });
    FS_STRUCTURE.balance.equity.forEach(item => { 
      if (item.kw.length > 0 && item.classCode) rules[item.classCode] = { kw: item.kw, type: 'equity', label: item.label }; 
    });
    // Other items
    FS_STRUCTURE.other.forEach(item => { rules[item.id] = { kw: item.kw, type: item.type, label: item.label }; });
    return rules;
  })(),
  classify(desc) {
    if (!desc) return { code: 'SUSPENSE', type: 'suspense' };
    const d = desc.toLowerCase();
    for (const [code, rule] of Object.entries(this.rules)) {
      if (rule.kw.some(k => d.includes(k))) return { code, type: rule.type };
    }
    return { code: 'SUSPENSE', type: 'suspense' };
  },
  createJE(tx, cls) {
    const entries = [], amt = Math.abs(tx.amount || 0), isIn = (tx.amount || 0) > 0;
    
    // ============================================
    // CASH VOUCHER SUPPORT: Determine money account
    // ============================================
    const CASH_ACC = 'cash_on_hand'; // Petty cash GL account
    const isCashVoucher = tx.source === 'Cash' || tx.source === 'CashVoucher' || tx.cashLedger === 'PETTY_CASH';
    const bankAcc = tx.bankAccount ? `bank_${tx.bankAccount.toLowerCase().replace(/\s+/g, '_')}` : 'bank';
    const moneyAcc = isCashVoucher ? CASH_ACC : bankAcc; // Use cash_on_hand for cash vouchers
    
    // ============================================
    // CASH TRANSFER HANDLING (Bank <-> Cash)
    // ============================================
    if (cls.type === 'cash_transfer' || tx.transferDirection) {
      // These are internal transfers - no P&L impact
      if (tx.transferDirection === 'bank_to_cash') {
        // ATM withdrawal: Dr Cash on Hand, Cr Bank
        entries.push({ acc: CASH_ACC, dr: amt, cr: 0 }, { acc: bankAcc, dr: 0, cr: amt });
      } else if (tx.transferDirection === 'cash_to_bank') {
        // Cash deposit: Dr Bank, Cr Cash on Hand
        entries.push({ acc: bankAcc, dr: amt, cr: 0 }, { acc: CASH_ACC, dr: 0, cr: amt });
      } else {
        // Generic transfer - use suspense
        entries.push({ acc: moneyAcc, dr: isIn ? amt : 0, cr: isIn ? 0 : amt }, { acc: 'transfer_suspense', dr: isIn ? 0 : amt, cr: isIn ? amt : 0 });
      }
      return { date: tx.date || '', desc: tx.description || '', ref: tx.reference || '', entries, cls: cls.code, source: tx.source || 'Manual', bank: tx.bankAccount || 'Default', documentType: isCashVoucher ? 'CV' : 'BT' };
    }
    
    // ============================================
    // STANDARD JE CREATION (now uses moneyAcc)
    // ============================================
    if (cls.type === 'revenue' || cls.type === 'other_income') { 
      // Revenue: Dr Money (Bank/Cash), Cr Revenue
      entries.push({ acc: moneyAcc, dr: amt, cr: 0 }, { acc: cls.code.toLowerCase(), dr: 0, cr: amt }); 
    }
    else if (cls.type === 'cogs' || cls.type === 'expense' || cls.type === 'finance' || cls.type === 'other_expense') { 
      // Expense: Dr Expense, Cr Money (Bank/Cash)
      entries.push({ acc: cls.code.toLowerCase(), dr: amt, cr: 0 }, { acc: moneyAcc, dr: 0, cr: amt }); 
    }
    else if (cls.type === 'asset') { 
      entries.push({ acc: isIn ? moneyAcc : cls.code.toLowerCase(), dr: amt, cr: 0 }, { acc: isIn ? cls.code.toLowerCase() : moneyAcc, dr: 0, cr: amt }); 
    }
    else if (cls.type === 'liability') { 
      entries.push({ acc: moneyAcc, dr: isIn ? amt : 0, cr: isIn ? 0 : amt }, { acc: cls.code.toLowerCase(), dr: isIn ? 0 : amt, cr: isIn ? amt : 0 }); 
    }
    else if (cls.type === 'transfer') { 
      entries.push({ acc: moneyAcc, dr: isIn ? amt : 0, cr: isIn ? 0 : amt }, { acc: 'transfer_suspense', dr: isIn ? 0 : amt, cr: isIn ? amt : 0 }); 
    }
    else if (cls.type === 'equity') { 
      entries.push({ acc: moneyAcc, dr: isIn ? amt : 0, cr: isIn ? 0 : amt }, { acc: cls.code.toLowerCase(), dr: isIn ? 0 : amt, cr: isIn ? amt : 0 }); 
    }
    else if (cls.type === 'drawings') { 
      // Drawings: Dr Drawings, Cr Money (Bank/Cash)
      entries.push({ acc: cls.code.toLowerCase(), dr: amt, cr: 0 }, { acc: moneyAcc, dr: 0, cr: amt }); 
    }
    else if (cls.type === 'tax_payment') { 
      // Tax payment: Dr Tax Payable, Cr Money (Bank/Cash)
      entries.push({ acc: 'tax_payable', dr: amt, cr: 0 }, { acc: moneyAcc, dr: 0, cr: amt }); 
    }
    else if (cls.type === 'pay_supplier') { 
      // Payment to supplier: Dr Trade Payables, Cr Money (Bank/Cash)
      entries.push({ acc: 'trade_payables', dr: amt, cr: 0 }, { acc: moneyAcc, dr: 0, cr: amt }); 
    }
    else if (cls.type === 'pay_creditor') { 
      // Payment to creditor: Dr Other Payables, Cr Money (Bank/Cash)
      entries.push({ acc: 'other_payables', dr: amt, cr: 0 }, { acc: moneyAcc, dr: 0, cr: amt }); 
    }
    else if (cls.type === 'loan_repay_st') { 
      // ST loan repayment: Dr Short Term Borrowings, Cr Money (Bank/Cash)
      entries.push({ acc: 'short_term_loan', dr: amt, cr: 0 }, { acc: moneyAcc, dr: 0, cr: amt }); 
    }
    else if (cls.type === 'loan_repay_lt') { 
      // LT loan repayment: Dr Long Term Borrowings, Cr Money (Bank/Cash)
      entries.push({ acc: 'long_term_loan', dr: amt, cr: 0 }, { acc: moneyAcc, dr: 0, cr: amt }); 
    }
    else if (cls.type === 'loan_drawdown') { 
      // Loan drawdown: Dr Money (Bank/Cash), Cr Short Term Borrowings
      entries.push({ acc: moneyAcc, dr: amt, cr: 0 }, { acc: 'short_term_loan', dr: 0, cr: amt }); 
    }
    else if (cls.type === 'receipt_debtor') { 
      // Receipt from debtor: Dr Money (Bank/Cash), Cr Trade Receivables
      entries.push({ acc: moneyAcc, dr: amt, cr: 0 }, { acc: 'trade_receivables', dr: 0, cr: amt }); 
    }
    else if (cls.type === 'deposit_received') { 
      // Deposit received: Dr Money (Bank/Cash), Cr Other Payables
      entries.push({ acc: moneyAcc, dr: amt, cr: 0 }, { acc: 'other_payables', dr: 0, cr: amt }); 
    }
    else if (cls.type === 'duitnow_payment') { 
      if (isIn) {
        entries.push({ acc: moneyAcc, dr: amt, cr: 0 }, { acc: 'trade_receivables', dr: 0, cr: amt }); 
      } else {
        entries.push({ acc: 'trade_payables', dr: amt, cr: 0 }, { acc: moneyAcc, dr: 0, cr: amt }); 
      }
    }
    else { 
      // SUSPENSE - use correct money account (cash_on_hand for cash vouchers)
      entries.push({ acc: 'suspense', dr: isIn ? amt : 0, cr: isIn ? 0 : amt }, { acc: moneyAcc, dr: isIn ? 0 : amt, cr: isIn ? amt : 0 }); 
    }
    return { date: tx.date || '', desc: tx.description || '', ref: tx.reference || '', entries, cls: cls.code, source: tx.source || 'Manual', bank: tx.bankAccount || 'Default', documentType: isCashVoucher ? 'CV' : 'BT' };
  },
  // Generate subledger adjustment journal entries
  createSubledgerJEs(subledgerData) {
    const jes = [];
    const today = new Date().toISOString().split('T')[0];
    
    // 1. Depreciation Entry: Dr Depreciation Expense, Cr Accumulated Depreciation
    if (subledgerData.depreciation > 0) {
      jes.push({
        date: today,
        desc: 'Depreciation for the year (from PPE Register)',
        ref: 'SL-DEP',
        entries: [
          { acc: 'depreciation', dr: subledgerData.depreciation, cr: 0 },
          { acc: 'accumulated_depreciation', dr: 0, cr: subledgerData.depreciation }
        ],
        cls: 'DEPRECIATION',
        source: 'Subledger',
        bank: 'N/A'
      });
    }
    
    // 2. Inventory Adjustment (if different from GL)
    // This assumes inventory is tracked at cost in the subledger
    // No JE needed if using periodic inventory - it's adjusted via opening balance
    
    // 3. Trade Receivables and Payables are typically adjusted via bank transactions
    // The subledger provides detail but the GL is updated via SALES/PURCHASE entries
    
    return jes;
  },
  buildTB(jes, ob = {}) {
    const accs = {};
    for (const [a, b] of Object.entries(ob)) accs[a] = { op: b, dr: 0, cr: 0 };
    for (const je of jes) for (const e of je.entries) {
      if (!accs[e.acc]) accs[e.acc] = { op: 0, dr: 0, cr: 0 };
      accs[e.acc].dr += e.dr; accs[e.acc].cr += e.cr;
    }
    return Object.entries(accs).map(([acc, d]) => ({ acc, op: d.op, dr: d.dr, cr: d.cr, cl: d.op + d.dr - d.cr }));
  },
  genFS(tb, priorIS = null, priorBS = null, taxCalculator = null, subledgerData = null, priorISItems = [], priorBSItems = [], ob = {}) {
    // Initialize IS with line items from FS_STRUCTURE
    const is = { 
      // Aggregated totals
      rev: 0, cos: 0, gp: 0, adm: 0, dep: 0, op: 0, oi: 0, oe: 0, fin: 0, pbt: 0, tax: 0, np: 0,
      // Detailed breakdown by classification code
      details: {}
    };
    const bs = { 
      ppe_cost: 0, ppe_accDep: 0, ppe: 0,
      intangibles: 0, investments: 0,
      inv: 0, tr: 0, or: 0, cash: 0, 
      totNCA: 0, totCA: 0, totA: 0, 
      ltBorr: 0, defTax: 0, borr: 0, tp: 0, op: 0, taxPay: 0, gstSst: 0,
      totNCL: 0, totCL: 0, totL: 0, 
      cap: 0, ret: 0, cyp: 0, totE: 0,
      details: {}
    };
    
    // Initialize details for each classification code
    Object.keys(FSEngine.rules).forEach(code => {
      is.details[code] = 0;
    });
    
    for (const r of tb) {
      const accUpper = r.acc.toUpperCase();
      const rule = FSEngine.rules[accUpper];
      
      if (rule) {
        // For P&L accounts, use movements (DR - CR for expenses, CR - DR for income)
        // This is more accurate than using closing balance which can be affected by OB
        let amt = 0;
        if (rule.type === 'revenue' || rule.type === 'other_income') {
          // Income accounts: Credit increases, so use CR - DR (typically CR only)
          amt = r.cr - r.dr;
          if (amt < 0) amt = 0; // Shouldn't happen but safeguard
        } else if (rule.type === 'cogs' || rule.type === 'expense' || rule.type === 'finance' || rule.type === 'other_expense') {
          // Expense accounts: Debit increases, so use DR - CR (typically DR only)
          amt = r.dr - r.cr;
          if (amt < 0) amt = 0; // Shouldn't happen but safeguard
        } else {
          // For non-P&L items that might slip through, use absolute closing
          amt = Math.abs(r.cl);
        }
        
        is.details[accUpper] = amt;
        
        // Aggregate by type
        if (rule.type === 'revenue') is.rev += amt;
        else if (rule.type === 'cogs') is.cos += amt;
        else if (rule.type === 'expense') {
          is.adm += amt;
          if (accUpper === 'DEPRECIATION') is.dep += amt;
        }
        else if (rule.type === 'other_income') is.oi += amt;
        else if (rule.type === 'other_expense') is.oe += amt;
        else if (rule.type === 'finance') is.fin += amt;
      }
      
      // Balance Sheet accounts - use closing balance (op + dr - cr)
      // These run independently of IS rules check
      const acc = r.acc.toLowerCase();
      
      // Bank accounts (including multiple banks) and Cash on Hand
      if (acc === 'bank' || acc.startsWith('bank_') || acc === 'cash_on_hand') {
        bs.cash += r.cl;
        // Track cash in hand separately for notes disclosure
        if (acc === 'cash_on_hand') {
          bs.cashInHand = (bs.cashInHand || 0) + r.cl;
        }
      }
      // Non-Current Assets
      else if (acc === 'fixed_asset' || acc === 'ppe') {
        bs.ppe_cost += r.cl;
      }
      else if (acc === 'accumulated_depreciation') {
        bs.ppe_accDep += Math.abs(r.cl);
      }
      else if (acc === 'intangibles' || acc === 'intangible_assets') {
        bs.intangibles = (bs.intangibles || 0) + r.cl;
      }
      else if (acc === 'investments') {
        bs.investments = (bs.investments || 0) + r.cl;
      }
      // Current Assets
      else if (acc === 'inventory') {
        bs.inv += r.cl;
      }
      else if (acc === 'trade_receivables') {
        bs.tr += r.cl;
      }
      else if (acc === 'other_receivables') {
        bs.or += r.cl;
      }
      // Non-Current Liabilities
      else if (acc === 'long_term_loan' || acc === 'lt_loan') {
        bs.ltBorr += Math.abs(r.cl);
      }
      else if (acc === 'deferred_tax') {
        bs.defTax = (bs.defTax || 0) + Math.abs(r.cl);
      }
      // Current Liabilities
      else if (acc === 'loan' || acc === 'short_term_loan') {
        bs.borr += Math.abs(r.cl);
      }
      else if (acc === 'trade_payables') {
        bs.tp += Math.abs(r.cl);
      }
      else if (acc === 'other_payables') {
        bs.op += Math.abs(r.cl);
      }
      else if (acc === 'tax_payable') {
        // Tax payable: credit balance = liability, debit balance = prepaid/asset
        // Track both separately for proper presentation
        if (r.cl < 0) {
          bs.taxPay += Math.abs(r.cl); // Credit balance = liability
        } else if (r.cl > 0) {
          bs.taxPrepaid = (bs.taxPrepaid || 0) + r.cl; // Debit balance = prepaid tax (asset)
        }
      }
      else if (acc === 'gst_sst') {
        // GST/SST follows same logic
        if (r.cl < 0) {
          bs.gstSst = (bs.gstSst || 0) + Math.abs(r.cl);
        } else {
          bs.gstSst = (bs.gstSst || 0) - r.cl;
        }
      }
      // Equity
      else if (acc === 'capital' || acc === 'share_capital') {
        bs.cap += Math.abs(r.cl);
      }
      else if (acc === 'retained_profits' || acc === 'retained_earnings') {
        bs.ret += Math.abs(r.cl);
      }
    }
    
    // If subledger data provided, use it for more accurate figures
    // IMPORTANT: Subledgers override TB only for items that don't flow through bank transactions
    // - PPE: Use subledger (depreciation calc is authoritative)
    // - Inventory: Use subledger (physical count is authoritative) - only if explicitly provided
    // - AR/AP: TB shows opening only; subledger shows actual outstanding - only if transactions don't exist
    // - Other Receivables/Payables: Use subledger (accruals/prepayments)
    // - Cash: NEVER override - this comes from OB + bank transactions
    if (subledgerData) {
      // PPE: Use subledger NBV (Cost - Accumulated Depreciation) only if subledger has PPE
      if (subledgerData.ppe && subledgerData.ppe.cost > 0) {
        bs.ppe_cost = subledgerData.ppe.cost;
        bs.ppe_accDep = subledgerData.ppe.accDepCF;
        // Depreciation expense from subledger
        if (subledgerData.ppe.currentDep > 0) {
          // Check if depreciation was already recorded via transactions
          // Look for DEPRECIATION in details (from TB) 
          const depFromTx = is.details['DEPRECIATION'] || 0;
          
          if (depFromTx === 0) {
            // No depreciation from transactions, add subledger depreciation
            is.dep = subledgerData.ppe.currentDep;
            is.details['DEPRECIATION'] = subledgerData.ppe.currentDep;
            is.adm += subledgerData.ppe.currentDep;
          } else {
            // Depreciation already exists from transactions, use that
            is.dep = depFromTx;
            // Don't add again - it's already in is.adm from TB processing
          }
        }
      }
      
      // Inventory from subledger - only override if TB has no inventory from transactions
      // (Opening inventory is in TB, subledger closing should reconcile)
      if (subledgerData.inventory > 0 && bs.inv === 0) {
        bs.inv = subledgerData.inventory;
      }
      
      // Trade Receivables from subledger - only override if TB only has opening balance
      if (subledgerData.receivables > 0 && bs.tr === 0) {
        bs.tr = subledgerData.receivables;
      }
      
      // Trade Payables from subledger - only override if TB only has opening balance
      if (subledgerData.payables > 0 && bs.tp === 0) {
        bs.tp = subledgerData.payables;
      }
      
      // Other Receivables (Debtors) from subledger - accruals/prepayments usually from subledger
      if (subledgerData.otherDebtors > 0) {
        bs.or = subledgerData.otherDebtors;
      }
      
      // Other Payables (Creditors) from subledger - accruals usually from subledger
      if (subledgerData.otherCreditors > 0) {
        bs.op = subledgerData.otherCreditors;
      }
      
      // Short-Term Borrowings from subledger - OVERRIDE TB value if subledger has data
      // The subledger is source of truth for loan balances
      // Only override if user has actually entered borrowings in subledger (hasSTBorrowings flag)
      if (subledgerData.hasSTBorrowings) {
        bs.stBorr = subledgerData.shortTermBorrowings || 0;
        bs.borr = subledgerData.shortTermBorrowings || 0; // Keep borr in sync
      }
      
      // Long-Term Borrowings from subledger - OVERRIDE TB value if subledger has data
      if (subledgerData.hasLTBorrowings) {
        bs.ltBorr = subledgerData.longTermBorrowings || 0;
      }
      
      // Store borrowing movements for Cash Flow Statement
      if (subledgerData.borrowingsDrawdowns !== undefined) {
        bs.loanDrawdowns = subledgerData.borrowingsDrawdowns;
      }
      if (subledgerData.borrowingsRepayments !== undefined) {
        bs.loanRepayments = subledgerData.borrowingsRepayments;
      }
      
      // Store opening balances for borrowings (for prior year comparison)
      if (subledgerData.stBorrOpening !== undefined) {
        bs.py_stBorr = subledgerData.stBorrOpening;
      }
      if (subledgerData.ltBorrOpening !== undefined) {
        bs.py_ltBorr = subledgerData.ltBorrOpening;
      }
      
      // Note: Cash & Bank is NEVER overridden from subledger
      // BS cash = Opening Cash + Bank Transactions (from TB)
      // Cash & Bank subledger is for RECONCILIATION purposes only
    }
    
    // Calculate PPE NBV
    bs.ppe = bs.ppe_cost - bs.ppe_accDep;
    
    // Income Statement calculations
    is.gp = is.rev - is.cos; 
    is.op = is.gp - is.adm; 
    is.pbt = is.op + is.oi - is.oe - is.fin; 
    // Calculate tax using provided calculator function
    is.tax = taxCalculator ? taxCalculator(is.pbt) : 0;
    is.np = is.pbt - is.tax;
    
    // Add current year tax to tax payable (this is the tax liability for the year)
    // If there's prepaid tax, use it first before creating liability
    if (bs.taxPrepaid && bs.taxPrepaid > 0) {
      const netTax = is.tax - bs.taxPrepaid;
      if (netTax > 0) {
        bs.taxPay += netTax; // Net liability after using prepaid
        bs.taxPrepaid = 0; // Fully utilized
      } else {
        bs.taxPrepaid = -netTax; // Still have prepaid remaining
        // bs.taxPay stays as is (no additional liability)
      }
    } else {
      bs.taxPay += is.tax;
    }
    
    // Balance Sheet calculations
    // Include tax prepaid as current asset if exists
    bs.totNCA = bs.ppe + bs.intangibles + bs.investments; 
    bs.totCA = bs.cash + bs.tr + bs.or + bs.inv + (bs.taxPrepaid || 0); 
    bs.totA = bs.totNCA + bs.totCA;
    
    // Use stBorr (short-term borrowings) - either from subledger or from borr (legacy)
    const shortTermBorr = bs.stBorr || bs.borr || 0;
    bs.stBorr = shortTermBorr; // Ensure stBorr is set
    
    bs.totNCL = bs.ltBorr + bs.defTax; 
    bs.totCL = shortTermBorr + bs.tp + bs.op + bs.taxPay; 
    bs.totL = bs.totNCL + bs.totCL;
    
    // Total borrowings for display
    bs.borr = shortTermBorr; // Keep borr in sync with stBorr for backward compatibility
    
    // Current year profit
    bs.cyp = is.np;
    
    // Total Equity = Share Capital + Opening Retained + Current Year Profit
    bs.totE = bs.cap + bs.ret + bs.cyp;
    
    // Prior Year Income Statement
    if (priorIS) {
      is.py_rev = parseFloat(priorIS.revenue) || 0; 
      is.py_cos = parseFloat(priorIS.cost_of_sales) || 0;
      is.py_gp = is.py_rev - is.py_cos; 
      is.py_dep = parseFloat(priorIS.depreciation) || 0; // Prior year depreciation
      is.py_adm = parseFloat(priorIS.admin_expenses) || 0; // Admin expenses excluding depreciation
      is.py_totalAdm = is.py_dep + is.py_adm; // Total admin including depreciation
      is.py_op = is.py_gp - is.py_totalAdm; 
      is.py_oi = parseFloat(priorIS.other_income) || 0;
      is.py_oe = parseFloat(priorIS.other_expenses) || 0;
      is.py_fin = parseFloat(priorIS.finance_costs) || 0; 
      is.py_pbt = is.py_op + is.py_oi - is.py_oe - is.py_fin;
      is.py_tax = parseFloat(priorIS.tax) || 0; 
      is.py_np = is.py_pbt - is.py_tax;
    }
    
    // Prior Year Balance Sheet
    if (priorBS) {
      // Prior year PPE (just NBV from user input)
      bs.py_ppe = parseFloat(priorBS.ppe) || 0;
      bs.py_intangibles = parseFloat(priorBS.intangibles) || 0;
      bs.py_investments = parseFloat(priorBS.investments) || 0;
      bs.py_inv = parseFloat(priorBS.inventory) || 0;
      bs.py_tr = parseFloat(priorBS.trade_receivables) || 0;
      bs.py_or = parseFloat(priorBS.other_receivables) || 0;
      bs.py_cash = parseFloat(priorBS.bank) || 0;
      
      // Calculate totals
      bs.py_totNCA = bs.py_ppe + bs.py_intangibles + bs.py_investments;
      bs.py_totCA = bs.py_cash + bs.py_tr + bs.py_or + bs.py_inv;
      bs.py_totA = bs.py_totNCA + bs.py_totCA;
      
      // Liabilities
      bs.py_ltLoan = parseFloat(priorBS.long_term_loan) || 0;
      bs.py_defTax = parseFloat(priorBS.deferred_tax) || 0;
      bs.py_loan = parseFloat(priorBS.loan) || 0;
      bs.py_tp = parseFloat(priorBS.trade_payables) || 0;
      bs.py_op = parseFloat(priorBS.other_payables) || 0;
      bs.py_taxPay = parseFloat(priorBS.tax_payable) || 0;
      bs.py_borr = bs.py_ltLoan + bs.py_loan; // Combined borrowings for display
      
      bs.py_totNCL = bs.py_ltLoan + bs.py_defTax;
      bs.py_totCL = bs.py_loan + bs.py_tp + bs.py_op + bs.py_taxPay;
      bs.py_totL = bs.py_totNCL + bs.py_totCL;
      
      // Equity
      bs.py_cap = parseFloat(priorBS.share_capital) || 0;
      bs.py_ret = parseFloat(priorBS.retained_profits) || 0;
      bs.py_reserves = parseFloat(priorBS.reserves) || 0;
      bs.py_totE = bs.py_cap + bs.py_ret + bs.py_reserves;
      
      // Check balance
      bs.py_diff = bs.py_totA - (bs.py_totL + bs.py_totE);
    }
    
    // ========================================
    // CASH FLOW STATEMENT (IAS 7 / IFRS 18)
    // Using Indirect Method
    // ========================================
    const cf = {
      // Operating Activities
      pbt: is.pbt,
      adjustments: {
        depreciation: is.dep || 0,
        interestExpense: is.fin || 0,
        interestIncome: -(is.details['INTEREST_INC'] || 0), // Deduct from operating (will show in investing)
        // Non-cash items - can be expanded
      },
      workingCapitalChanges: {
        // Increase in asset = cash outflow (negative)
        // Decrease in asset = cash inflow (positive)
        // Increase in liability = cash inflow (positive)
        // Decrease in liability = cash outflow (negative)
        inventory: (bs.py_inv || 0) - bs.inv,
        tradeReceivables: (bs.py_tr || 0) - bs.tr,
        otherReceivables: (bs.py_or || 0) - bs.or,
        tradePayables: bs.tp - (bs.py_tp || 0),
        otherPayables: bs.op - (bs.py_op || 0),
      },
      taxPaid: 0, // Would need to track actual tax payments from transactions
      interestPaid: 0, // Usually equals interest expense for simplicity
      
      // Investing Activities
      // PPE: Use NBV change + depreciation to estimate purchases (since we don't have PY cost)
      // Change in NBV = Purchases - Disposals - Depreciation
      // Purchases = Change in NBV + Depreciation (assuming no disposals)
      ppePurchases: -(Math.max(0, (bs.ppe - (bs.py_ppe || 0)) + (is.dep || 0))),
      ppeDisposals: 0, // Would need disposal tracking
      investmentPurchases: -Math.max(0, (bs.investments || 0) - (bs.py_investments || 0)),
      investmentDisposals: Math.max(0, (bs.py_investments || 0) - (bs.investments || 0)),
      interestReceived: is.details['INTEREST_INC'] || 0, // Interest received shown in Investing (IFRS 18/IAS 7 Option)
      
      // Financing Activities - Use subledger data if available, otherwise calculate from BS movement
      loanProceeds: bs.loanDrawdowns !== undefined ? bs.loanDrawdowns : Math.max(0, (bs.stBorr + (bs.ltBorr || 0)) - ((bs.py_stBorr || bs.py_loan || 0) + (bs.py_ltBorr || bs.py_ltLoan || 0))),
      loanRepayments: bs.loanRepayments !== undefined ? -bs.loanRepayments : -Math.max(0, ((bs.py_stBorr || bs.py_loan || 0) + (bs.py_ltBorr || bs.py_ltLoan || 0)) - (bs.stBorr + (bs.ltBorr || 0))),
      capitalInjection: Math.max(0, bs.cap - (bs.py_cap || 0)),
      dividendsPaid: 0, // Would need dividend tracking
      drawingsWithdrawals: 0, // Would need drawings tracking
    };
    
    // Calculate totals
    cf.totalAdjustments = cf.adjustments.depreciation + cf.adjustments.interestExpense + cf.adjustments.interestIncome;
    
    cf.totalWCChanges = cf.workingCapitalChanges.inventory + 
                        cf.workingCapitalChanges.tradeReceivables + 
                        cf.workingCapitalChanges.otherReceivables +
                        cf.workingCapitalChanges.tradePayables + 
                        cf.workingCapitalChanges.otherPayables;
    
    cf.cashFromOperations = cf.pbt + cf.totalAdjustments + cf.totalWCChanges;
    cf.netOperating = cf.cashFromOperations - cf.taxPaid - cf.interestPaid;
    
    // Investing includes interest received (IFRS 18/IAS 7 compliant - Option B)
    cf.netInvesting = cf.ppePurchases + cf.ppeDisposals + cf.investmentPurchases + cf.investmentDisposals + cf.interestReceived;
    
    cf.netFinancing = cf.loanProceeds + cf.loanRepayments + cf.capitalInjection + cf.dividendsPaid + cf.drawingsWithdrawals;
    
    cf.netChangeInCash = cf.netOperating + cf.netInvesting + cf.netFinancing;
    
    // Opening cash: prefer PY BS cash, fallback to OB bank accounts
    if (bs.py_cash && bs.py_cash > 0) {
      cf.openingCash = bs.py_cash;
    } else {
      // Calculate from OB bank accounts
      cf.openingCash = Object.entries(ob).reduce((sum, [acc, amt]) => 
        (acc === 'bank' || acc.startsWith('bank_')) ? sum + (parseFloat(amt) || 0) : sum
      , 0);
    }
    cf.closingCash = cf.openingCash + cf.netChangeInCash;
    
    // Reconciliation check
    cf.cashPerBS = bs.cash;
    cf.difference = cf.closingCash - cf.cashPerBS;
    
    return { is, bs, cf };
  },
  process(txs, ob = {}, priorIS = null, priorBS = null, taxCalculator = null, subledgerData = null, priorISItems = [], priorBSItems = []) {
    const jes = [], susp = [];
    for (const tx of txs) { 
      // Resolve classification alias (e.g., PURCHASES -> PURCHASE)
      const rawClassification = tx.classification;
      const canonicalCode = rawClassification ? (CLASS_ALIAS[rawClassification] || rawClassification) : null;
      
      // Use manual classification if available, otherwise auto-classify
      const c = canonicalCode 
        ? { code: canonicalCode, type: this.rules[canonicalCode]?.type || 'suspense' }
        : this.classify(tx.description); 
      
      // Create JE with resolved classification
      const txResolved = { ...tx, classification: c.code };
      jes.push(this.createJE(txResolved, c)); 
      if (c.code === 'SUSPENSE') susp.push(tx); 
    }
    
    // Add subledger adjustment JEs (e.g., depreciation)
    if (subledgerData) {
      const slJEs = this.createSubledgerJEs(subledgerData);
      jes.push(...slJEs);
    }
    
    const tb = this.buildTB(jes, ob);
    const fs = this.genFS(tb, priorIS, priorBS, taxCalculator, subledgerData, priorISItems, priorBSItems, ob);
    return { jes, tb, is: fs.is, bs: fs.bs, cf: fs.cf, susp };
  }
};

// CSV/Text Parser - fyYear is the financial year for date parsing
const parseCSVText = (text, fileName, bankAccount, month, fyYear = null) => {
  const lines = text.split('\n').filter(l => l.trim());
  const transactions = [];
  
  // Month name to number mapping
  const monthMap = { 'jan': '01', 'feb': '02', 'mar': '03', 'apr': '04', 'may': '05', 'jun': '06',
                     'jul': '07', 'aug': '08', 'sep': '09', 'oct': '10', 'nov': '11', 'dec': '12' };
  
  // Skip patterns - transactions that should be ignored
  const skipPatterns = [
    /balance\s*(c\/f|b\/f|from|brought|carried)/i,
    /^date[\s,]+transaction/i,
    /^tarikh/i,
    /closing\s*balance/i,
    /opening\s*balance/i,
    /baki\s*(harian|penutup)/i
  ];
  
  // Use provided FY year or fall back to current year
  const yearForParsing = fyYear || new Date().getFullYear();
  
  // Simple CSV parser that handles quoted fields
  const parseCSVLine = (line) => {
    const cells = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        cells.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    cells.push(current.trim());
    return cells;
  };
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.length < 5) continue;
    
    // Skip header and balance lines
    if (skipPatterns.some(p => p.test(line))) continue;
    
    // Parse CSV line properly (handle quoted fields with commas)
    let cells;
    if (line.includes(',')) {
      cells = parseCSVLine(line);
    } else {
      // Tab-separated
      cells = line.split(/\t/).map(c => c.trim());
    }
    
    // Try to parse date from first cell
    let date = null;
    const firstCell = (cells[0] || '').trim();
    
    // Try DD/MM format (e.g., 01/04, 31/03) - no year
    const ddmmMatch = firstCell.match(/^(\d{1,2})[\/\-](\d{1,2})$/);
    if (ddmmMatch) {
      const day = ddmmMatch[1].padStart(2, '0');
      const mon = ddmmMatch[2].padStart(2, '0');
      date = `${yearForParsing}-${mon}-${day}`;
    }
    
    // Try DD-Mon format (e.g., 01-Apr)
    if (!date) {
      const ddMonMatch = firstCell.match(/^(\d{1,2})[\/\-\.]?([A-Za-z]{3})/i);
      if (ddMonMatch) {
        const day = ddMonMatch[1].padStart(2, '0');
        const monthStr = ddMonMatch[2].toLowerCase();
        const monthNum = monthMap[monthStr];
        if (monthNum) {
          date = `${yearForParsing}-${monthNum}-${day}`;
        }
      }
    }
    
    // Try DD/MM/YYYY or DD-MM-YY format
    if (!date) {
      const ddmmyyMatch = firstCell.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/);
      if (ddmmyyMatch) {
        const day = ddmmyyMatch[1].padStart(2, '0');
        const mon = ddmmyyMatch[2].padStart(2, '0');
        let year = ddmmyyMatch[3];
        if (year.length === 2) year = parseInt(year) > 50 ? '19' + year : '20' + year;
        date = `${year}-${mon}-${day}`;
      }
    }
    
    // Try YYYY-MM-DD format
    if (!date) {
      const yyyymmddMatch = firstCell.match(/^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})/);
      if (yyyymmddMatch) {
        date = `${yyyymmddMatch[1]}-${yyyymmddMatch[2].padStart(2, '0')}-${yyyymmddMatch[3].padStart(2, '0')}`;
      }
    }
    
    if (!date) continue;
    
    // Get description (second column)
    let desc = '';
    if (cells.length >= 2) {
      desc = (cells[1] || '').trim();
    }
    
    // Skip balance entries in description
    if (/balance\s*(c\/f|b\/f|from|brought|carried)/i.test(desc)) continue;
    
    // Find debit and credit amounts from columns 3 and 4
    let debit = 0;
    let credit = 0;
    
    if (cells.length >= 4) {
      // CSV format: Date, Description, Debit, Credit, Balance
      const debitStr = (cells[2] || '').replace(/"/g, '').trim();
      const creditStr = (cells[3] || '').replace(/"/g, '').trim();
      
      // Parse amounts (remove commas and quotes)
      if (debitStr) {
        const debitClean = debitStr.replace(/,/g, '');
        const debitVal = parseFloat(debitClean);
        if (!isNaN(debitVal) && debitVal > 0) debit = debitVal;
      }
      if (creditStr) {
        const creditClean = creditStr.replace(/,/g, '');
        const creditVal = parseFloat(creditClean);
        if (!isNaN(creditVal) && creditVal > 0) credit = creditVal;
      }
    } else {
      // Single line format - extract amounts and check for DR keywords
      const amounts = [];
      const amountMatches = line.match(/([\d,]+\.\d{2})/g) || [];
      for (const m of amountMatches) {
        const amt = parseFloat(m.replace(/,/g, ''));
        if (!isNaN(amt) && amt > 0) amounts.push(amt);
      }
      
      if (amounts.length >= 1) {
        const isDebit = /\b(dr|debit|withdrawal|payment|paid|transfer\s*dr|trsf\s*dr)\b/i.test(line);
        if (isDebit) {
          debit = amounts[0];
        } else {
          credit = amounts[0];
        }
      }
    }
    
    // Skip if no amount
    if (debit === 0 && credit === 0) continue;
    
    // Calculate net amount (credit positive, debit negative)
    const amount = credit > 0 ? credit : -debit;
    
    // Clean up description - remove amounts
    desc = desc.replace(/([\d,]+\.\d{2})/g, '').trim();
    desc = desc.replace(/\s+/g, ' ').trim();
    if (desc.length < 2) desc = 'Bank Transaction';
    
    transactions.push({ 
      date, 
      description: desc.substring(0, 100), 
      reference: `${(bankAccount || 'BNK').substring(0,3).toUpperCase()}-${month}-${transactions.length + 1}`, 
      amount, 
      source: fileName, 
      bankAccount: bankAccount || 'Unknown', 
      month 
    });
  }
  return transactions;
};

const fmt = (n) => new Intl.NumberFormat('en-MY', { style: 'currency', currency: 'MYR' }).format(n || 0);

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const sampleBanks = [
  { id: 'maybank', name: 'Maybank', accNo: '5123456789' },
  { id: 'cimb', name: 'CIMB', accNo: '8001234567' }
];

const sampleTxs = [
  { date: '2024-01-05', description: 'Sales collection - ABC Sdn Bhd', reference: 'MAY-Jan-1', amount: 50000, source: 'Sample', bankAccount: 'Maybank', month: 'Jan' },
  { date: '2024-01-08', description: 'Purchase inventory - Supplier XYZ', reference: 'MAY-Jan-2', amount: -20000, source: 'Sample', bankAccount: 'Maybank', month: 'Jan' },
  { date: '2024-02-15', description: 'Salary February 2024', reference: 'MAY-Feb-1', amount: -12000, source: 'Sample', bankAccount: 'Maybank', month: 'Feb' },
  { date: '2024-02-18', description: 'Office rent payment', reference: 'CIM-Feb-1', amount: -3500, source: 'Sample', bankAccount: 'CIMB', month: 'Feb' },
  { date: '2024-03-22', description: 'Sales collection - DEF Enterprise', reference: 'MAY-Mar-1', amount: 28000, source: 'Sample', bankAccount: 'Maybank', month: 'Mar' },
  { date: '2024-03-25', description: 'TNB Electric bill', reference: 'CIM-Mar-1', amount: -850, source: 'Sample', bankAccount: 'CIMB', month: 'Mar' },
];

export default function App() {
  const [tab, setTab] = useState('setup');
  const [companyType, setCompanyType] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [companyRegNo, setCompanyRegNo] = useState('');
  const [financialYearEnd, setFinancialYearEnd] = useState('12'); // Month (1-12)
  const [accountingStandard, setAccountingStandard] = useState(''); // MFRS, MPERS, MPERS-Micro
  const [txs, setTxs] = useState([]);
  const [cashTxs, setCashTxs] = useState([]); // Cash voucher transactions (petty cash)
  const [classifyFilter, setClassifyFilter] = useState('ALL'); // Filter for classify page
  const [classifySearch, setClassifySearch] = useState(''); // Search text for classify page
  const [selectedTxIndices, setSelectedTxIndices] = useState(new Set()); // Selected transactions for bulk edit
  const [bulkClassification, setBulkClassification] = useState(''); // Bulk classification target
  const [ob, setOb] = useState({});
  const [res, setRes] = useState(null);
  const [busy, setBusy] = useState(false);
  const [logs, setLogs] = useState([]);
  const [newOb, setNewOb] = useState({ acc: '', amt: '' });
  const fileRef = useRef(null);
  const [priorFSYear, setPriorFSYear] = useState(new Date().getFullYear() - 1);
  const [priorFSApplied, setPriorFSApplied] = useState(false); // Track if prior FS applied
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [showExportModal, setShowExportModal] = useState(false);
  const [previewContent, setPreviewContent] = useState(null);
  const [previewType, setPreviewType] = useState(null); // 'html' or 'json'
  
  // FS Snapshots - Delivered packs for versioning
  const [fsSnapshots, setFsSnapshots] = useState([]);
  const [showSnapshotModal, setShowSnapshotModal] = useState(false);
  const [snapshotForm, setSnapshotForm] = useState({
    periodType: 'Monthly',
    periodLabel: '',
    note: '',
    createdBy: 'Accountant'
  });
  
  // Adjustment Log - Track changes between snapshots
  const [adjustmentLog, setAdjustmentLog] = useState([]);
  const [adjustmentForm, setAdjustmentForm] = useState({
    periodLabel: '',
    type: 'Correction',
    amount: '',
    description: ''
  });
  
  // Cash Voucher Form
  const [cvForm, setCvForm] = useState({
    date: new Date().toISOString().split('T')[0],
    description: '',
    reference: 'CV-001',
    amount: '',
    type: 'out',
    classification: ''
  });
  
  // Accounting Standards options
  const ACCOUNTING_STANDARDS = {
    'MFRS': { name: 'MFRS', fullName: 'Malaysian Financial Reporting Standards', desc: 'Full IFRS-equivalent standards for public companies' },
    'MPERS': { name: 'MPERS', fullName: 'Malaysian Private Entities Reporting Standard', desc: 'Simplified standards for private entities' },
    'MPERS-Micro': { name: 'MPERS for Micro Entities', fullName: 'MPERS for Micro Entities', desc: 'Simplified standards for micro entities' },
  };
  
  // Get default standard based on company type
  const getDefaultStandard = (type) => {
    if (type === 'BERHAD') return 'MFRS';
    if (type === 'ENTERPRISE') return 'MPERS-Micro';
    return 'MPERS';
  };
  
  // Config based on company type with overridable standard
  const baseConfig = COMPANY_TYPES[companyType];
  const config = baseConfig ? {
    ...baseConfig,
    standard: accountingStandard || baseConfig.standard,
    fullStandard: accountingStandard ? ACCOUNTING_STANDARDS[accountingStandard]?.fullName : baseConfig.fullStandard,
  } : null;
  
  // Financial year end display helper
  const fyeMonthNames = ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const fyeDisplay = financialYearEnd ? `${fyeMonthNames[parseInt(financialYearEnd)]} ${currentYear}` : '';
  
  // Tax Settings State
  const [taxSettings, setTaxSettings] = useState({
    // Sdn Bhd SME rates
    sdnBhd: {
      tier1Limit: 500000,
      tier1Rate: 17,
      tier2Rate: 24,
    },
    // Enterprise personal tax brackets
    enterprise: {
      brackets: [
        { limit: 5000, rate: 0 },
        { limit: 15000, rate: 1 },
        { limit: 15000, rate: 3 },
        { limit: 15000, rate: 6 },
        { limit: 20000, rate: 11 },
        { limit: 30000, rate: 19 },
        { limit: 150000, rate: 25 },
        { limit: 150000, rate: 26 },
        { limit: Infinity, rate: 28 },
      ]
    },
    // Berhad flat rate
    berhad: {
      rate: 24,
    },
    // Corporate deductions (Sdn Bhd / Berhad)
    corporateDeductions: {
      capitalAllowance: '',
      reinvestmentAllowance: '',
      pioneerStatus: '',
      investmentTaxAllowance: '',
      exportIncentive: '',
      rdDeduction: '',
      lossCarryForward: '',
    },
    // Personal/Enterprise deductions (sole prop/partnership)
    personalDeductions: {
      selfRelief: '9000',
      spouseRelief: '',
      childRelief: '',
      parentsMedical: '',
      epfContribution: '',
      lifeInsurance: '',
      educationFees: '',
      medicalExpenses: '',
      lifestyleRelief: '',
      socsoContribution: '',
      privateRetirement: '',
      sspnDeposit: '',
      domesticTravel: '',
      evCharging: '',
    },
    // Non-deductible expenses to be added back (Section 39 ITA 1967)
    addBackExpenses: {
      depreciation: '', // Accounting depreciation (replaced by Capital Allowance)
      generalProvisionBadDebt: '', // General provision for doubtful debts
      entertainmentClients: '', // Entertainment for clients/suppliers (50% disallowed)
      entertainmentPotential: '', // Entertainment for potential customers (100% disallowed)
      privateExpenses: '', // Private or domestic expenses
      finesAndPenalties: '', // Fines, penalties, summons
      donationsUnapproved: '', // Donations to non-approved bodies
      capitalExpenditure: '', // Capital expenditure charged to P&L
      leavePasages: '', // Leave passages (except yearly event in Malaysia)
      excessiveCarLease: '', // Car lease > RM50k/RM100k limit
      excessiveEpfContribution: '', // EPF contribution > 19% of remuneration
      withholdingTaxNotPaid: '', // Payments to non-residents without WHT
      foreignExchangeLossUnrealised: '', // Unrealised forex loss
      provisionForExpenses: '', // General provisions for expenses
      lossOnDisposalAssets: '', // Loss on disposal of capital assets
      clubEntranceFees: '', // Club entrance/membership fees
      taxPenalties: '', // Income tax penalties and appeal costs
      preCommencementExpenses: '', // Pre-commencement/pre-operational expenses
      otherNonDeductible: '', // Other non-deductible expenses
    },
    // Tax rebates (deducted from tax payable)
    taxRebates: {
      zakat: '', // Zakat paid - rebate up to tax payable amount
      taxRebateIndividual: '', // Individual rebate (if chargeable income <= RM35,000)
      spouseRebate: '', // Spouse rebate
      departureLevyRebate: '', // Departure levy rebate
    }
  });
  
  // Non-deductible expenses reference guide (LHDN Section 39 ITA 1967)
  const NON_DEDUCTIBLE_EXPENSES_GUIDE = [
    { 
      category: 'Depreciation & Provisions',
      items: [
        { key: 'depreciation', label: 'Accounting Depreciation', tooltip: 'Depreciation is not tax deductible. Claim Capital Allowance instead under Schedule 3 ITA 1967.' },
        { key: 'generalProvisionBadDebt', label: 'General Bad Debt Provision', tooltip: 'Only specific bad debts written off are deductible. General provisions must be added back.' },
        { key: 'provisionForExpenses', label: 'General Provisions', tooltip: 'Provisions for future expenses are not incurred and must be added back.' },
        { key: 'foreignExchangeLossUnrealised', label: 'Unrealised Forex Loss', tooltip: 'Only realised foreign exchange losses are deductible.' },
      ]
    },
    {
      category: 'Entertainment Expenses',
      items: [
        { key: 'entertainmentClients', label: 'Entertainment (Clients) - 50%', tooltip: 'Entertainment for existing clients/suppliers: only 50% is deductible. Add back the other 50%.' },
        { key: 'entertainmentPotential', label: 'Entertainment (Potential Clients)', tooltip: 'Entertainment for potential customers is 100% non-deductible per Section 39(1)(l) ITA.' },
      ]
    },
    {
      category: 'Private & Capital Expenses',
      items: [
        { key: 'privateExpenses', label: 'Private/Domestic Expenses', tooltip: 'Personal expenses like personal travel, home utilities, personal phone bills are not deductible.' },
        { key: 'capitalExpenditure', label: 'Capital Expenditure in P&L', tooltip: 'Capital items wrongly expensed (e.g., renovation, equipment) must be added back. Claim CA instead.' },
        { key: 'lossOnDisposalAssets', label: 'Loss on Disposal of Assets', tooltip: 'Loss on sale of capital assets is not deductible for tax purposes.' },
        { key: 'preCommencementExpenses', label: 'Pre-Commencement Expenses', tooltip: 'Expenses incurred before business commencement are capital in nature (except Schedule 4B items).' },
      ]
    },
    {
      category: 'Staff & Benefits',
      items: [
        { key: 'leavePasages', label: 'Leave Passages', tooltip: 'Leave passages are not deductible except for yearly company events in Malaysia for employees.' },
        { key: 'excessiveEpfContribution', label: 'Excess EPF (>19%)', tooltip: 'Employer EPF contributions exceeding 19% of employee remuneration must be added back.' },
        { key: 'excessiveCarLease', label: 'Excess Car Lease Rental', tooltip: 'Car lease exceeding RM50,000 (or RM100,000 for cars ≤RM150,000) per car per year is disallowed.' },
      ]
    },
    {
      category: 'Fines, Donations & Others',
      items: [
        { key: 'finesAndPenalties', label: 'Fines & Penalties', tooltip: 'All fines, penalties, compounds, and summons are not tax deductible.' },
        { key: 'taxPenalties', label: 'Tax Penalties & Appeal Costs', tooltip: 'Income tax penalties and costs of tax appeals are expressly disallowed.' },
        { key: 'donationsUnapproved', label: 'Unapproved Donations', tooltip: 'Only donations to LHDN-approved institutions are deductible. Unapproved donations must be added back.' },
        { key: 'clubEntranceFees', label: 'Club Entrance/Membership', tooltip: 'Club entrance fees and subscriptions are capital in nature and not deductible.' },
      ]
    },
    {
      category: 'Payments to Non-Residents',
      items: [
        { key: 'withholdingTaxNotPaid', label: 'WHT Not Deducted', tooltip: 'Payments to non-residents (royalties, fees, interest, rent) without deducting withholding tax are disallowed until WHT is paid.' },
      ]
    },
    {
      category: 'Other Non-Deductible',
      items: [
        { key: 'otherNonDeductible', label: 'Other Non-Deductible', tooltip: 'Any other expenses not wholly and exclusively incurred for business purposes.' },
      ]
    },
  ];
  
  // Calculate tax based on settings
  // Returns object with breakdown: { grossTax, zakat, netTax, taxableIncome, brackets }
  const calculateTaxDetailed = (profit) => {
    const result = { 
      grossTax: 0, 
      zakat: 0, 
      netTax: 0, 
      taxableIncome: 0, 
      adjustedProfit: 0,
      totalDeductions: 0,
      capitalAllowance: 0,
      brackets: [] 
    };
    
    // Step 1: Add back non-deductible expenses (do this BEFORE checking if profit is positive)
    let totalAddBack = 0;
    if (taxSettings.addBackExpenses) {
      Object.values(taxSettings.addBackExpenses).forEach(v => {
        totalAddBack += parseFloat(v) || 0;
      });
    }
    
    // Adjusted profit after add-backs
    result.adjustedProfit = profit + totalAddBack;
    
    // If adjusted profit is still <= 0, no tax payable
    if (result.adjustedProfit <= 0) return result;
    
    // Step 2: Capital Allowance - use manual override if provided, otherwise from CA Schedule
    const manualCA = parseFloat(taxSettings.corporateDeductions?.capitalAllowanceManual) || 0;
    result.capitalAllowance = manualCA > 0 ? manualCA : computeTotalCapitalAllowance();
    result.totalDeductions = result.capitalAllowance;
    
    // Step 3: Apply additional deductions based on company type
    if (companyType === 'ENTERPRISE') {
      // Personal deductions for Enterprise (in addition to CA)
      Object.values(taxSettings.personalDeductions).forEach(v => {
        result.totalDeductions += parseFloat(v) || 0;
      });
    } else {
      // Other corporate deductions for Sdn Bhd / Berhad
      Object.entries(taxSettings.corporateDeductions).forEach(([key, v]) => {
        if (key !== 'capitalAllowance' && key !== 'capitalAllowanceManual') {
          result.totalDeductions += parseFloat(v) || 0;
        }
      });
    }
    
    result.taxableIncome = Math.max(0, result.adjustedProfit - result.totalDeductions);
    if (result.taxableIncome <= 0) return result;
    
    // Step 4: Calculate gross tax based on company type
    if (companyType === 'SDN_BHD') {
      const { tier1Limit, tier1Rate, tier2Rate } = taxSettings.sdnBhd;
      if (result.taxableIncome <= tier1Limit) {
        result.grossTax = Math.round(result.taxableIncome * (tier1Rate / 100));
        result.brackets = [{ range: `First RM${tier1Limit.toLocaleString()}`, amount: result.taxableIncome, rate: tier1Rate, tax: result.grossTax }];
      } else {
        const tier1Tax = Math.round(tier1Limit * (tier1Rate / 100));
        const tier2Tax = Math.round((result.taxableIncome - tier1Limit) * (tier2Rate / 100));
        result.grossTax = tier1Tax + tier2Tax;
        result.brackets = [
          { range: `First RM${tier1Limit.toLocaleString()}`, amount: tier1Limit, rate: tier1Rate, tax: tier1Tax },
          { range: `Balance RM${(result.taxableIncome - tier1Limit).toLocaleString()}`, amount: result.taxableIncome - tier1Limit, rate: tier2Rate, tax: tier2Tax }
        ];
      }
    }
    
    if (companyType === 'ENTERPRISE') {
      let tax = 0, remaining = result.taxableIncome;
      let cumulative = 0;
      const bracketRanges = [
        { min: 0, max: 5000, rate: 0 },
        { min: 5001, max: 20000, rate: 1 },
        { min: 20001, max: 35000, rate: 3 },
        { min: 35001, max: 50000, rate: 6 },
        { min: 50001, max: 70000, rate: 11 },
        { min: 70001, max: 100000, rate: 19 },
        { min: 100001, max: 250000, rate: 25 },
        { min: 250001, max: 400000, rate: 26 },
        { min: 400001, max: Infinity, rate: 28 },
      ];
      
      for (const bracket of taxSettings.enterprise.brackets) {
        if (remaining <= 0) break;
        const taxable = Math.min(remaining, bracket.limit);
        const bracketTax = Math.round(taxable * (bracket.rate / 100));
        tax += bracketTax;
        
        if (taxable > 0) {
          const rangeInfo = bracketRanges.find(r => cumulative >= r.min - 1 && cumulative < r.max) || bracketRanges[bracketRanges.length - 1];
          result.brackets.push({ 
            range: `RM${(cumulative + 1).toLocaleString()} - RM${(cumulative + taxable).toLocaleString()}`, 
            amount: taxable, 
            rate: bracket.rate, 
            tax: bracketTax 
          });
        }
        
        cumulative += bracket.limit;
        remaining -= bracket.limit;
      }
      result.grossTax = Math.round(tax);
    }
    
    if (companyType === 'BERHAD') {
      result.grossTax = Math.round(result.taxableIncome * (taxSettings.berhad.rate / 100));
      result.brackets = [{ range: 'All chargeable income', amount: result.taxableIncome, rate: taxSettings.berhad.rate, tax: result.grossTax }];
    }
    
    // Step 5: Apply tax rebates (Zakat for Enterprise/Individual)
    if (taxSettings.taxRebates) {
      result.zakat = Math.min(parseFloat(taxSettings.taxRebates.zakat) || 0, result.grossTax); // Zakat limited to tax payable
    }
    
    result.netTax = Math.max(0, result.grossTax - result.zakat);
    
    return result;
  };
  
  // Simple tax calculation (returns just the net tax amount)
  const calculateTax = (profit) => {
    return calculateTaxDetailed(profit).netTax;
  };
  
  // Helper to compute total add-back expenses
  const computeTotalAddBack = () => {
    if (!taxSettings.addBackExpenses) return 0;
    return Object.values(taxSettings.addBackExpenses).reduce((sum, v) => sum + (parseFloat(v) || 0), 0);
  };
  
  // ============================================
  // DASHBOARD METRICS COMPUTATION
  // ============================================
  const computeDashboardMetrics = () => {
    if (!res) return null;
    
    // Income Statement figures (correct field names from res)
    const revenue = res.is.rev || 0;
    const cogs = res.is.cos || 0;
    const grossProfit = res.is.gp || 0;
    const otherIncome = res.is.oi || 0;
    const adminExpenses = res.is.adm || 0;
    const financeExpenses = res.is.fin || 0;
    const operatingProfit = grossProfit + otherIncome - adminExpenses;
    const pbt = res.is.pbt || 0;
    const tax = res.is.tax || 0;
    const pat = res.is.np || 0;
    
    // Balance Sheet figures (correct field names from res)
    const totalAssets = res.bs.totA || 0;
    const totalLiabilities = res.bs.totL || 0;
    const totalEquity = res.bs.totE || 0;
    const currentAssets = res.bs.totCA || 0;
    const currentLiabilities = res.bs.totCL || (res.bs.tp || 0) + (res.bs.borr || 0) + (res.bs.op || 0) + (res.bs.taxPayable || 0);
    const nonCurrentAssets = res.bs.totNCA || 0;
    const nonCurrentLiabilities = res.bs.totNCL || (res.bs.ltl || 0);
    
    // Working capital items from subledgers
    const arTotal = tradeReceivables.reduce((sum, r) => sum + (parseFloat(r.amount) || 0) - (parseFloat(r.paid) || 0), 0);
    const apTotal = tradePayables.reduce((sum, p) => sum + (parseFloat(p.amount) || 0) - (parseFloat(p.paid) || 0), 0);
    const inventoryTotal = inventoryLedger.reduce((sum, i) => sum + ((parseFloat(i.qty) || 0) * (parseFloat(i.unitCost) || 0)), 0);
    const cashTotal = cashBankLedger.reduce((sum, c) => sum + (parseFloat(c.closingBalance) || 0), 0);
    
    // Prior year figures (correct field names)
    const pyRevenue = res.is.py_rev || 0;
    const pyPat = res.is.py_np || 0;
    const pyGp = res.is.py_gp || 0;
    const pyTotalAssets = res.bs.py_totA || 0;
    const pyTotalEquity = res.bs.py_totE || 0;
    
    // ============================================
    // KEY RATIOS & KPIs
    // ============================================
    
    // Profitability Ratios
    const grossMargin = revenue > 0 ? (grossProfit / revenue) * 100 : 0;
    const netMargin = revenue > 0 ? (pat / revenue) * 100 : 0;
    const operatingMargin = revenue > 0 ? (operatingProfit / revenue) * 100 : 0;
    const roe = totalEquity > 0 ? (pat / totalEquity) * 100 : 0;
    const roa = totalAssets > 0 ? (pat / totalAssets) * 100 : 0;
    
    // Liquidity Ratios
    const currentRatio = currentLiabilities > 0 ? currentAssets / currentLiabilities : (currentAssets > 0 ? 999 : 0);
    const quickRatio = currentLiabilities > 0 ? (currentAssets - inventoryTotal) / currentLiabilities : 0;
    const cashRatio = currentLiabilities > 0 ? cashTotal / currentLiabilities : 0;
    
    // Efficiency Ratios (Days)
    const dso = revenue > 0 ? (arTotal / revenue) * 365 : 0;
    const dpo = cogs > 0 ? (apTotal / cogs) * 365 : 0;
    const dio = cogs > 0 ? (inventoryTotal / cogs) * 365 : 0;
    const ccc = dso + dio - dpo;
    
    // Leverage Ratios
    const debtToEquity = totalEquity > 0 ? totalLiabilities / totalEquity : 0;
    const debtToAssets = totalAssets > 0 ? totalLiabilities / totalAssets : 0;
    
    // Growth (vs Prior Year)
    const revenueGrowth = pyRevenue > 0 ? ((revenue - pyRevenue) / pyRevenue) * 100 : 0;
    const profitGrowth = pyPat !== 0 ? ((pat - pyPat) / Math.abs(pyPat)) * 100 : (pat > 0 ? 100 : 0);
    const assetGrowth = pyTotalAssets > 0 ? ((totalAssets - pyTotalAssets) / pyTotalAssets) * 100 : 0;
    const equityGrowth = pyTotalEquity > 0 ? ((totalEquity - pyTotalEquity) / pyTotalEquity) * 100 : 0;
    
    // Working Capital
    const workingCapital = currentAssets - currentLiabilities;
    
    // ============================================
    // DETAILED INSIGHTS (Auto-generated commentary)
    // ============================================
    const insights = [];
    
    // === PROFITABILITY INSIGHTS ===
    if (pat > 0) {
      insights.push({ 
        type: 'success', 
        icon: '✅', 
        category: 'Profitability',
        title: 'Profitable Operation',
        text: `The company generated a net profit of RM ${fmt(pat)} for FY${currentYear}.`,
        detail: `Net profit margin is ${netMargin.toFixed(1)}%, meaning RM ${(netMargin/100).toFixed(2)} is retained from every RM 1 of revenue.`
      });
    } else if (pat < 0) {
      insights.push({ 
        type: 'danger', 
        icon: '🔴', 
        category: 'Profitability',
        title: 'Loss-Making Operation',
        text: `The company incurred a net loss of RM ${fmt(Math.abs(pat))} for FY${currentYear}.`,
        detail: `Urgent review of cost structure and revenue streams recommended. Consider cost-cutting measures or pricing strategy revision.`
      });
    }
    
    if (grossMargin < 20 && revenue > 0) {
      insights.push({ 
        type: 'warning', 
        icon: '⚠️', 
        category: 'Profitability',
        title: 'Low Gross Margin',
        text: `Gross margin is ${grossMargin.toFixed(1)}% which is below industry standard (20-30%).`,
        detail: `This may indicate: (1) High cost of goods, (2) Pricing pressure, (3) Inefficient production. Review supplier contracts and pricing strategy.`
      });
    } else if (grossMargin > 40 && revenue > 0) {
      insights.push({ 
        type: 'success', 
        icon: '💪', 
        category: 'Profitability',
        title: 'Strong Gross Margin',
        text: `Excellent gross margin at ${grossMargin.toFixed(1)}%.`,
        detail: `The company maintains strong pricing power and/or efficient cost management. This provides buffer for operating expenses.`
      });
    }
    
    // === GROWTH INSIGHTS ===
    if (revenueGrowth > 15) {
      insights.push({ 
        type: 'success', 
        icon: '📈', 
        category: 'Growth',
        title: 'Strong Revenue Growth',
        text: `Revenue grew ${revenueGrowth.toFixed(1)}% from RM ${fmt(pyRevenue)} to RM ${fmt(revenue)}.`,
        detail: `This growth rate exceeds typical market growth. Assess if growth is sustainable and whether infrastructure can support continued expansion.`
      });
    } else if (revenueGrowth < -10 && pyRevenue > 0) {
      insights.push({ 
        type: 'danger', 
        icon: '📉', 
        category: 'Growth',
        title: 'Revenue Decline',
        text: `Revenue declined ${Math.abs(revenueGrowth).toFixed(1)}% from RM ${fmt(pyRevenue)} to RM ${fmt(revenue)}.`,
        detail: `Investigate causes: market conditions, lost customers, competitive pressure, or product lifecycle issues.`
      });
    }
    
    if (profitGrowth > 20 && pyPat > 0) {
      insights.push({ 
        type: 'success', 
        icon: '🚀', 
        category: 'Growth',
        title: 'Profit Growth Momentum',
        text: `Net profit increased ${profitGrowth.toFixed(1)}% year-on-year.`,
        detail: `Profit growth outpacing revenue growth indicates improving operational efficiency and cost management.`
      });
    } else if (profitGrowth < -20 && pyPat > 0) {
      insights.push({ 
        type: 'danger', 
        icon: '⚡', 
        category: 'Growth',
        title: 'Profit Erosion',
        text: `Net profit declined ${Math.abs(profitGrowth).toFixed(1)}% year-on-year.`,
        detail: `Profit declining faster than revenue suggests cost pressures or margin compression. Review expense categories.`
      });
    }
    
    // === LIQUIDITY INSIGHTS ===
    if (currentRatio < 1) {
      insights.push({ 
        type: 'danger', 
        icon: '🚨', 
        category: 'Liquidity',
        title: 'Liquidity Risk',
        text: `Current ratio is ${currentRatio.toFixed(2)}x (below 1.0).`,
        detail: `The company may struggle to meet short-term obligations. Current liabilities (RM ${fmt(currentLiabilities)}) exceed current assets (RM ${fmt(currentAssets)}). Consider: (1) Accelerating receivables collection, (2) Extending payables terms, (3) Short-term financing.`
      });
    } else if (currentRatio >= 1.5 && currentRatio < 999) {
      insights.push({ 
        type: 'success', 
        icon: '💰', 
        category: 'Liquidity',
        title: 'Healthy Liquidity',
        text: `Current ratio of ${currentRatio.toFixed(2)}x indicates strong short-term financial health.`,
        detail: `Sufficient current assets to cover current liabilities. Working capital position is sound.`
      });
    } else if (currentRatio > 3) {
      insights.push({ 
        type: 'warning', 
        icon: '💭', 
        category: 'Liquidity',
        title: 'Excess Liquidity',
        text: `Current ratio of ${currentRatio.toFixed(2)}x may indicate excess idle assets.`,
        detail: `Consider deploying excess cash into productive investments or returning to shareholders.`
      });
    }
    
    // === EFFICIENCY INSIGHTS ===
    if (dso > 60 && revenue > 0) {
      insights.push({ 
        type: 'warning', 
        icon: '⏰', 
        category: 'Efficiency',
        title: 'Slow Receivables Collection',
        text: `Days Sales Outstanding is ${dso.toFixed(0)} days.`,
        detail: `Cash is tied up in receivables. Review credit terms and collection procedures. Consider: (1) Tighter credit policy, (2) Early payment discounts, (3) Factoring.`
      });
    }
    
    if (dio > 90 && cogs > 0) {
      insights.push({ 
        type: 'warning', 
        icon: '📦', 
        category: 'Efficiency',
        title: 'High Inventory Days',
        text: `Days Inventory Outstanding is ${dio.toFixed(0)} days.`,
        detail: `Inventory turnover is slow. Risk of obsolescence and storage costs. Review: (1) Demand forecasting, (2) SKU rationalization, (3) Supplier lead times.`
      });
    }
    
    // === LEVERAGE INSIGHTS ===
    if (debtToEquity > 2) {
      insights.push({ 
        type: 'warning', 
        icon: '⚖️', 
        category: 'Leverage',
        title: 'High Financial Leverage',
        text: `Debt-to-equity ratio is ${debtToEquity.toFixed(2)}x.`,
        detail: `Heavy reliance on debt financing increases financial risk and interest burden. Consider equity injection or debt reduction.`
      });
    } else if (debtToEquity < 0.5 && debtToEquity > 0) {
      insights.push({ 
        type: 'success', 
        icon: '🛡️', 
        category: 'Leverage',
        title: 'Conservative Capital Structure',
        text: `Low debt-to-equity ratio of ${debtToEquity.toFixed(2)}x.`,
        detail: `Conservative financing provides financial flexibility. May consider strategic debt to optimize capital structure if growth opportunities exist.`
      });
    }
    
    // === RETURN INSIGHTS ===
    if (roe > 15) {
      insights.push({ 
        type: 'success', 
        icon: '🎯', 
        category: 'Returns',
        title: 'Strong Return on Equity',
        text: `ROE of ${roe.toFixed(1)}% exceeds cost of equity benchmark.`,
        detail: `Shareholders are earning attractive returns. The business is creating value above the opportunity cost of capital.`
      });
    } else if (roe < 8 && roe > 0) {
      insights.push({ 
        type: 'warning', 
        icon: '📊', 
        category: 'Returns',
        title: 'Below-Average ROE',
        text: `ROE of ${roe.toFixed(1)}% is below typical market returns.`,
        detail: `Returns may not justify the risk of equity investment. Review business model efficiency and capital allocation.`
      });
    }
    
    return {
      kpis: {
        revenue, cogs, grossProfit, operatingProfit, pbt, tax, pat,
        otherIncome, adminExpenses, financeExpenses,
        totalAssets, totalLiabilities, totalEquity,
        currentAssets, currentLiabilities, nonCurrentAssets, nonCurrentLiabilities,
        arTotal, apTotal, inventoryTotal, cashTotal, workingCapital
      },
      ratios: {
        grossMargin, netMargin, operatingMargin, roe, roa,
        currentRatio, quickRatio, cashRatio,
        dso, dpo, dio, ccc,
        debtToEquity, debtToAssets,
        revenueGrowth, profitGrowth, assetGrowth, equityGrowth
      },
      comparatives: {
        pyRevenue, pyPat, pyGp, pyTotalAssets, pyTotalEquity
      },
      insights
    };
  };

  // Bank Accounts
  const [banks, setBanks] = useState([]);
  const [newBank, setNewBank] = useState({ name: '', accNo: '' });
  const [selectedBank, setSelectedBank] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('Jan');
  
  // Bank Statements tracking (bank -> month -> { file, txCount, uploaded })
  const [bankStatements, setBankStatements] = useState({});
  
  // PDF text for manual paste (when PDF can't be parsed)
  const [pdfText, setPdfText] = useState('');
  
  // Prior Year FS - Dynamic structure
  const [priorFSMode, setPriorFSMode] = useState('manual'); // 'manual' or 'upload'
  const [priorFSFile, setPriorFSFile] = useState(null);
  const [priorFSRawData, setPriorFSRawData] = useState([]);
  const [priorFSMapping, setPriorFSMapping] = useState({});
  const [priorFSPastedText, setPriorFSPastedText] = useState(''); // For PDF text paste
  
  // Generate initial Prior FS items from FS_STRUCTURE
  const generateInitialPriorIS = () => {
    const items = [];
    // Revenue
    FS_STRUCTURE.income.revenue.forEach(item => {
      items.push({ id: item.id, label: item.label, value: '', type: 'revenue', section: 'revenue' });
    });
    // Cost of Sales
    FS_STRUCTURE.income.cost_of_sales.forEach(item => {
      items.push({ id: item.id, label: item.label, value: '', type: 'cogs', section: 'cost_of_sales' });
    });
    // Operating Expenses
    FS_STRUCTURE.income.operating_expenses.forEach(item => {
      items.push({ id: item.id, label: item.label, value: '', type: 'expense', section: 'operating_expenses', group: item.group });
    });
    // Other Income
    FS_STRUCTURE.income.other_income.forEach(item => {
      items.push({ id: item.id, label: item.label, value: '', type: 'other_income', section: 'other_income' });
    });
    // Other Expenses
    FS_STRUCTURE.income.other_expenses.forEach(item => {
      items.push({ id: item.id, label: item.label, value: '', type: 'other_expense', section: 'other_expenses' });
    });
    // Finance Costs
    FS_STRUCTURE.income.finance_costs.forEach(item => {
      items.push({ id: item.id, label: item.label, value: '', type: 'finance', section: 'finance_costs' });
    });
    // Tax
    items.push({ id: 'TAX_EXPENSE', label: 'Tax Expense', value: '', type: 'tax', section: 'tax' });
    return items;
  };
  
  const generateInitialPriorBS = () => {
    const items = [];
    // Non-Current Assets
    FS_STRUCTURE.balance.non_current_assets.forEach(item => {
      items.push({ id: item.id, label: item.label, value: '', type: 'nca', section: 'non_current_assets' });
    });
    // Current Assets
    FS_STRUCTURE.balance.current_assets.forEach(item => {
      items.push({ id: item.id, label: item.label, value: '', type: 'ca', section: 'current_assets' });
    });
    // Non-Current Liabilities
    FS_STRUCTURE.balance.non_current_liabilities.forEach(item => {
      items.push({ id: item.id, label: item.label, value: '', type: 'ncl', section: 'non_current_liabilities' });
    });
    // Current Liabilities
    FS_STRUCTURE.balance.current_liabilities.forEach(item => {
      items.push({ id: item.id, label: item.label, value: '', type: 'cl', section: 'current_liabilities' });
    });
    // Equity (exclude current year profit - that's computed)
    FS_STRUCTURE.balance.equity.filter(item => item.id !== 'CURRENT_YEAR_PROFIT').forEach(item => {
      items.push({ id: item.id, label: item.label, value: '', type: 'equity', section: 'equity' });
    });
    return items;
  };
  
  // Dynamic Prior FS line items - initialized from FS_STRUCTURE
  const [priorISItems, setPriorISItems] = useState(generateInitialPriorIS);
  const [priorBSItems, setPriorBSItems] = useState(generateInitialPriorBS);
  
  // Prior IS depreciation (separate from admin expenses)
  const [priorDepreciation, setPriorDepreciation] = useState('');
  
  // Subledger States
  
  // PPE Asset Categories with MFRS useful life guidelines (Malaysia)
  const PPE_CATEGORIES = {
    'LAND': { label: 'Land', years: 0, rate: 0 }, // Land not depreciated
    'BUILDING': { label: 'Buildings', years: 50, rate: 2 },
    'RENOVATION': { label: 'Renovation & Improvements', years: 10, rate: 10 },
    'PLANT_MACHINERY': { label: 'Plant & Machinery', years: 10, rate: 10 },
    'FACTORY_EQUIPMENT': { label: 'Factory Equipment', years: 10, rate: 10 },
    'OFFICE_EQUIPMENT': { label: 'Office Equipment', years: 10, rate: 10 },
    'FURNITURE_FITTINGS': { label: 'Furniture & Fittings', years: 10, rate: 10 },
    'MOTOR_VEHICLES': { label: 'Motor Vehicles', years: 5, rate: 20 },
    'COMPUTER_EQUIPMENT': { label: 'Computer & IT Equipment', years: 3, rate: 33.33 },
    'ELECTRICAL_FITTINGS': { label: 'Electrical Fittings', years: 10, rate: 10 },
    'AIR_CONDITIONING': { label: 'Air Conditioning', years: 10, rate: 10 },
    'SIGNBOARD': { label: 'Signboard', years: 10, rate: 10 },
    'TOOLS_EQUIPMENT': { label: 'Tools & Small Equipment', years: 5, rate: 20 },
  };
  
  const [ppeRegister, setPpeRegister] = useState([
    // { id, description, category, acquisitionDate, cost, residualValue, accDepBF, currentDep, accDepCF, nbv }
  ]);
  const [inventoryLedger, setInventoryLedger] = useState([
    // { id, itemCode, description, qty, unitCost, totalCost, category }
  ]);
  const [tradeReceivables, setTradeReceivables] = useState([
    // { id, customerName, invoiceNo, invoiceDate, dueDate, amount, paid, balance }
  ]);
  const [tradePayables, setTradePayables] = useState([
    // { id, supplierName, invoiceNo, invoiceDate, dueDate, amount, paid, balance }
  ]);
  const [otherDebtors, setOtherDebtors] = useState([
    // { id, description, type, amount, remarks }
    // Types: 'DEPOSIT', 'PREPAID', 'ADVANCE', 'LOAN_RECEIVABLE', 'OTHER'
  ]);
  const [otherCreditors, setOtherCreditors] = useState([
    // { id, description, type, amount, remarks }
    // Types: 'ACCRUAL', 'DEPOSIT_RECEIVED', 'ADVANCE_RECEIVED', 'OTHER'
  ]);
  const [cashBankLedger, setCashBankLedger] = useState([
    // { id, accountName, bankName, accountNo, openingBalance, closingBalance, reconciled }
  ]);
  
  // Borrowings Subledgers - NEW
  const [shortTermBorrowings, setShortTermBorrowings] = useState([
    // { id, lender, loanType, loanNo, openingBalance, drawdown, repayment, closingBalance, interestRate, remarks }
    // loanType: 'BANK_OVERDRAFT', 'SHORT_TERM_LOAN', 'HP_CURRENT', 'TRADE_FINANCING', 'OTHER'
  ]);
  const [longTermBorrowings, setLongTermBorrowings] = useState([
    // { id, lender, loanType, loanNo, openingBalance, drawdown, repayment, closingBalance, interestRate, tenureMonths, startDate, remarks }
    // loanType: 'TERM_LOAN', 'HIRE_PURCHASE', 'MORTGAGE', 'DIRECTORS_LOAN', 'RELATED_PARTY_LOAN', 'OTHER'
  ]);
  
  // Subledger helper functions
  const addPPE = () => {
    const id = `ppe_${Date.now()}`;
    setPpeRegister(prev => [...prev, { 
      id, 
      description: '', 
      category: 'OFFICE_EQUIPMENT',
      acquisitionDate: '', 
      cost: 0, 
      residualValue: 0, 
      accDepBF: 0 // Accumulated depreciation brought forward (from prior years)
    }]);
  };
  
  const updatePPE = (id, field, value) => {
    setPpeRegister(prev => prev.map(item => item.id === id ? { ...item, [field]: value } : item));
  };
  
  const removePPE = (id) => setPpeRegister(prev => prev.filter(item => item.id !== id));
  
  // Calculate PPE depreciation for each asset
  const calculatePPEDepreciation = (asset) => {
    const cost = parseFloat(asset.cost) || 0;
    const residual = parseFloat(asset.residualValue) || 0;
    const accDepBF = parseFloat(asset.accDepBF) || 0;
    const categoryInfo = PPE_CATEGORIES[asset.category] || PPE_CATEGORIES['OFFICE_EQUIPMENT'];
    const usefulLife = categoryInfo.years;
    
    // No depreciation for land
    if (usefulLife === 0) {
      return { 
        depreciableAmount: 0, 
        annualDep: 0, 
        currentDep: 0, 
        accDepCF: 0, 
        nbv: cost 
      };
    }
    
    const depreciableAmount = cost - residual;
    const annualDep = depreciableAmount / usefulLife; // Straight-line
    
    // Current year depreciation (capped so total acc dep doesn't exceed depreciable amount)
    const maxAccDep = depreciableAmount;
    const remainingDep = Math.max(0, maxAccDep - accDepBF);
    const currentDep = Math.min(annualDep, remainingDep);
    
    const accDepCF = accDepBF + currentDep; // Accumulated depreciation carried forward
    const nbv = cost - accDepCF;
    
    return { depreciableAmount, annualDep, currentDep, accDepCF, nbv };
  };
  
  // Calculate total Capital Allowance from PPE Register
  // In Malaysia, CA rates differ from accounting depreciation
  // Default CA Rates by asset class (LHDN Malaysia)
  // Reference: Schedule 3 of Income Tax Act 1967
  const DEFAULT_CA_RATES = {
    'LAND': { ia: 0, aa: 0, label: 'Land (No CA)' },
    'BUILDING': { ia: 10, aa: 3, label: 'Industrial Building' },
    'RENOVATION': { ia: 0, aa: 0, label: 'Renovation (S.Deduction)' }, // Special deduction, not CA
    'PLANT_MACHINERY': { ia: 20, aa: 14, label: 'Plant & Machinery' },
    'FACTORY_EQUIPMENT': { ia: 20, aa: 14, label: 'Factory Equipment' },
    'OFFICE_EQUIPMENT': { ia: 20, aa: 10, label: 'Office Equipment' },
    'FURNITURE_FITTINGS': { ia: 20, aa: 10, label: 'Furniture & Fittings' },
    'MOTOR_VEHICLES': { ia: 20, aa: 20, label: 'Motor Vehicles' },
    'COMPUTER_EQUIPMENT': { ia: 20, aa: 40, label: 'Computer/ICT Equipment' },
    'ELECTRICAL_FITTINGS': { ia: 20, aa: 10, label: 'Electrical Fittings' },
    'AIR_CONDITIONING': { ia: 20, aa: 10, label: 'Air Conditioning' },
    'SIGNBOARD': { ia: 20, aa: 10, label: 'Signboard' },
    'TOOLS_EQUIPMENT': { ia: 20, aa: 20, label: 'Tools & Equipment' },
    'HEAVY_MACHINERY': { ia: 20, aa: 10, label: 'Heavy Machinery' },
    'ENVIRONMENTAL': { ia: 40, aa: 20, label: 'Environmental Equipment' }, // Accelerated
    'SMALL_VALUE': { ia: 0, aa: 100, label: 'Small Value Asset (<RM2000)' }, // Full write-off
  };
  
  // CA Schedule - Independent user-input schedule
  // Structure: [{ id, acquisitionDate, description, category, cost }]
  const [caScheduleItems, setCaScheduleItems] = useState([]);
  
  // Add new CA Schedule item
  const addCAScheduleItem = () => {
    const id = `ca_${Date.now()}`;
    setCaScheduleItems(prev => [...prev, {
      id,
      acquisitionDate: '',
      description: '',
      category: 'OFFICE_EQUIPMENT',
      cost: 0
    }]);
  };
  
  // Update CA Schedule item
  const updateCAScheduleItem = (id, field, value) => {
    setCaScheduleItems(prev => prev.map(item => 
      item.id === id ? { ...item, [field]: value } : item
    ));
  };
  
  // Remove CA Schedule item
  const removeCAScheduleItem = (id) => {
    setCaScheduleItems(prev => prev.filter(item => item.id !== id));
  };
  
  // Calculate CA for a single item based on acquisition date
  const calculateItemCA = (item) => {
    const cost = parseFloat(item.cost) || 0;
    const rates = DEFAULT_CA_RATES[item.category] || DEFAULT_CA_RATES['OFFICE_EQUIPMENT'];
    const currentYearNum = parseInt(currentYear) || new Date().getFullYear();
    
    // Parse acquisition date
    let acquisitionYear = currentYearNum;
    if (item.acquisitionDate) {
      const date = new Date(item.acquisitionDate);
      if (!isNaN(date.getTime())) {
        acquisitionYear = date.getFullYear();
      }
    }
    
    // Calculate CA based on acquisition year
    // If acquired in current FYE year → IA + AA
    // If acquired in prior years → AA only (assuming IA already claimed)
    const isCurrentYear = acquisitionYear >= currentYearNum;
    
    const ia = isCurrentYear ? cost * (rates.ia / 100) : 0;
    const aa = cost * (rates.aa / 100);
    const totalCA = ia + aa;
    
    return { ia, aa, totalCA, isCurrentYear, rates };
  };
  
  // Compute total Capital Allowance from CA Schedule
  const computeTotalCapitalAllowance = () => {
    return caScheduleItems.reduce((total, item) => {
      const calc = calculateItemCA(item);
      return total + calc.totalCA;
    }, 0);
  };
  
  // Get total CA Schedule cost
  const getTotalCAScheduleCost = () => {
    return caScheduleItems.reduce((sum, item) => sum + (parseFloat(item.cost) || 0), 0);
  };
  
  // Get total PPE cost from subledger
  const getTotalPPECost = () => {
    return ppeRegister.reduce((sum, a) => sum + (parseFloat(a.cost) || 0), 0);
  };
  
  // Check if CA Schedule is reconciled with PPE
  const isCAReconciled = () => {
    return Math.abs(getTotalCAScheduleCost() - getTotalPPECost()) < 0.01;
  };

  const addInventoryItem = () => {
    const id = `inv_${Date.now()}`;
    setInventoryLedger(prev => [...prev, { 
      id, itemCode: '', description: '', qty: 0, unitCost: 0, category: 'Raw Materials' 
    }]);
  };
  
  const updateInventoryItem = (id, field, value) => {
    setInventoryLedger(prev => prev.map(item => item.id === id ? { ...item, [field]: value } : item));
  };
  
  const removeInventoryItem = (id) => setInventoryLedger(prev => prev.filter(item => item.id !== id));
  
  const addReceivable = () => {
    const id = `ar_${Date.now()}`;
    setTradeReceivables(prev => [...prev, { 
      id, customerName: '', invoiceNo: '', invoiceDate: '', dueDate: '', amount: 0, paid: 0 
    }]);
  };
  
  const updateReceivable = (id, field, value) => {
    setTradeReceivables(prev => prev.map(item => item.id === id ? { ...item, [field]: value } : item));
  };
  
  const removeReceivable = (id) => setTradeReceivables(prev => prev.filter(item => item.id !== id));
  
  const addPayable = () => {
    const id = `ap_${Date.now()}`;
    setTradePayables(prev => [...prev, { 
      id, supplierName: '', invoiceNo: '', invoiceDate: '', dueDate: '', amount: 0, paid: 0 
    }]);
  };
  
  const updatePayable = (id, field, value) => {
    setTradePayables(prev => prev.map(item => item.id === id ? { ...item, [field]: value } : item));
  };
  
  const removePayable = (id) => setTradePayables(prev => prev.filter(item => item.id !== id));
  
  // Other Debtors helper functions
  const addOtherDebtor = () => {
    const id = `od_${Date.now()}`;
    setOtherDebtors(prev => [...prev, { id, description: '', type: 'DEPOSIT', amount: 0, remarks: '' }]);
  };
  const updateOtherDebtor = (id, field, value) => {
    setOtherDebtors(prev => prev.map(item => item.id === id ? { ...item, [field]: value } : item));
  };
  const removeOtherDebtor = (id) => setOtherDebtors(prev => prev.filter(item => item.id !== id));
  
  // Other Creditors helper functions
  const addOtherCreditor = () => {
    const id = `oc_${Date.now()}`;
    setOtherCreditors(prev => [...prev, { id, description: '', type: 'ACCRUAL', amount: 0, remarks: '' }]);
  };
  const updateOtherCreditor = (id, field, value) => {
    setOtherCreditors(prev => prev.map(item => item.id === id ? { ...item, [field]: value } : item));
  };
  const removeOtherCreditor = (id) => setOtherCreditors(prev => prev.filter(item => item.id !== id));
  
  // Cash & Bank helper functions
  const addCashBankAccount = () => {
    const id = `cb_${Date.now()}`;
    setCashBankLedger(prev => [...prev, { id, accountName: '', bankName: '', accountNo: '', openingBalance: 0, closingBalance: 0, reconciled: false }]);
  };
  const updateCashBankAccount = (id, field, value) => {
    setCashBankLedger(prev => prev.map(item => item.id === id ? { ...item, [field]: value } : item));
  };
  const removeCashBankAccount = (id) => setCashBankLedger(prev => prev.filter(item => item.id !== id));
  
  // Short-Term Borrowings helper functions
  const addShortTermBorrowing = () => {
    const id = `stb_${Date.now()}`;
    setShortTermBorrowings(prev => [...prev, { 
      id, 
      lender: '', 
      loanType: 'SHORT_TERM_LOAN', 
      loanNo: '', 
      openingBalance: 0, 
      drawdown: 0, 
      repayment: 0, 
      interestRate: 0,
      remarks: '' 
    }]);
  };
  const updateShortTermBorrowing = (id, field, value) => {
    setShortTermBorrowings(prev => prev.map(item => item.id === id ? { ...item, [field]: value } : item));
  };
  const removeShortTermBorrowing = (id) => setShortTermBorrowings(prev => prev.filter(item => item.id !== id));
  
  // Long-Term Borrowings helper functions
  const addLongTermBorrowing = () => {
    const id = `ltb_${Date.now()}`;
    setLongTermBorrowings(prev => [...prev, { 
      id, 
      lender: '', 
      loanType: 'TERM_LOAN', 
      loanNo: '', 
      openingBalance: 0, 
      drawdown: 0, 
      repayment: 0, 
      interestRate: 0,
      tenureMonths: 60,
      startDate: '',
      remarks: '' 
    }]);
  };
  const updateLongTermBorrowing = (id, field, value) => {
    setLongTermBorrowings(prev => prev.map(item => item.id === id ? { ...item, [field]: value } : item));
  };
  const removeLongTermBorrowing = (id) => setLongTermBorrowings(prev => prev.filter(item => item.id !== id));
  
  // Calculate subledger totals
  const subledgerTotals = React.useMemo(() => {
    // PPE - calculate NBV and depreciation using the category-based calculation
    const ppeTotal = ppeRegister.reduce((acc, item) => {
      const cost = parseFloat(item.cost) || 0;
      const accDepBF = parseFloat(item.accDepBF) || 0;
      const dep = calculatePPEDepreciation(item);
      
      return { 
        cost: acc.cost + cost, 
        accDepBF: acc.accDepBF + accDepBF,
        currentDep: acc.currentDep + dep.currentDep,
        accDepCF: acc.accDepCF + dep.accDepCF, 
        nbv: acc.nbv + dep.nbv
      };
    }, { cost: 0, accDepBF: 0, currentDep: 0, accDepCF: 0, nbv: 0 });
    
    // Inventory
    const invTotal = inventoryLedger.reduce((acc, item) => {
      const qty = parseFloat(item.qty) || 0;
      const unitCost = parseFloat(item.unitCost) || 0;
      return acc + (qty * unitCost);
    }, 0);
    
    // Trade Receivables
    const arTotal = tradeReceivables.reduce((acc, item) => {
      const amount = parseFloat(item.amount) || 0;
      const paid = parseFloat(item.paid) || 0;
      return acc + (amount - paid);
    }, 0);
    
    // Trade Payables
    const apTotal = tradePayables.reduce((acc, item) => {
      const amount = parseFloat(item.amount) || 0;
      const paid = parseFloat(item.paid) || 0;
      return acc + (amount - paid);
    }, 0);
    
    // Other Debtors (Receivables)
    const odTotal = otherDebtors.reduce((acc, item) => {
      return acc + (parseFloat(item.amount) || 0);
    }, 0);
    
    // Other Creditors (Payables)
    const ocTotal = otherCreditors.reduce((acc, item) => {
      return acc + (parseFloat(item.amount) || 0);
    }, 0);
    
    // Cash & Bank
    const cashTotal = cashBankLedger.reduce((acc, item) => {
      return acc + (parseFloat(item.closingBalance) || 0);
    }, 0);
    
    // Short-Term Borrowings
    const stBorrTotal = shortTermBorrowings.reduce((acc, item) => {
      const opening = parseFloat(item.openingBalance) || 0;
      const drawdown = parseFloat(item.drawdown) || 0;
      const repayment = parseFloat(item.repayment) || 0;
      return acc + (opening + drawdown - repayment);
    }, 0);
    
    // Long-Term Borrowings
    const ltBorrTotal = longTermBorrowings.reduce((acc, item) => {
      const opening = parseFloat(item.openingBalance) || 0;
      const drawdown = parseFloat(item.drawdown) || 0;
      const repayment = parseFloat(item.repayment) || 0;
      return acc + (opening + drawdown - repayment);
    }, 0);
    
    // Calculate total drawdowns and repayments for Cash Flow
    const totalDrawdowns = shortTermBorrowings.reduce((acc, item) => acc + (parseFloat(item.drawdown) || 0), 0) +
                          longTermBorrowings.reduce((acc, item) => acc + (parseFloat(item.drawdown) || 0), 0);
    const totalRepayments = shortTermBorrowings.reduce((acc, item) => acc + (parseFloat(item.repayment) || 0), 0) +
                           longTermBorrowings.reduce((acc, item) => acc + (parseFloat(item.repayment) || 0), 0);
    
    // Opening balances for borrowings
    const stBorrOpening = shortTermBorrowings.reduce((acc, item) => acc + (parseFloat(item.openingBalance) || 0), 0);
    const ltBorrOpening = longTermBorrowings.reduce((acc, item) => acc + (parseFloat(item.openingBalance) || 0), 0);
    
    return { 
      ppe: ppeTotal, 
      inventory: invTotal, 
      receivables: arTotal, 
      payables: apTotal,
      otherDebtors: odTotal,
      otherCreditors: ocTotal,
      cashBank: cashTotal,
      shortTermBorrowings: stBorrTotal,
      longTermBorrowings: ltBorrTotal,
      borrowingsDrawdowns: totalDrawdowns,
      borrowingsRepayments: totalRepayments,
      stBorrOpening: stBorrOpening,
      ltBorrOpening: ltBorrOpening,
      // Flags to indicate if user has entered data in borrowings subledgers
      hasSTBorrowings: shortTermBorrowings.length > 0,
      hasLTBorrowings: longTermBorrowings.length > 0
    };
  }, [ppeRegister, inventoryLedger, tradeReceivables, tradePayables, otherDebtors, otherCreditors, cashBankLedger, shortTermBorrowings, longTermBorrowings]);
  
  // Add new line item
  // Add new line item with specific type
  const addPriorISItem = (type = 'expense') => {
    const id = `custom_is_${Date.now()}`;
    setPriorISItems(prev => [...prev, { id, label: 'New Item', value: '', type, mapped: '', custom: true }]);
  };
  
  const addPriorBSItem = (type = 'ca') => {
    const id = `custom_bs_${Date.now()}`;
    setPriorBSItems(prev => [...prev, { id, label: 'New Item', value: '', type, mapped: '', custom: true }]);
  };
  
  const removePriorISItem = (id) => setPriorISItems(prev => prev.filter(item => item.id !== id));
  const removePriorBSItem = (id) => setPriorBSItems(prev => prev.filter(item => item.id !== id));
  
  const updatePriorISItem = (id, field, value) => {
    setPriorISItems(prev => prev.map(item => item.id === id ? { ...item, [field]: value } : item));
  };
  
  const updatePriorBSItem = (id, field, value) => {
    setPriorBSItems(prev => prev.map(item => item.id === id ? { ...item, [field]: value } : item));
  };
  
  // Parse uploaded Prior FS file (CSV/Excel)
  const handlePriorFSUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    setPriorFSFile(file);
    const fileName = file.name.toLowerCase();
    
    try {
      if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
        // Excel file - read all sheets
        const arrayBuffer = await file.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: 'array', cellDates: true });
        const data = [];
        
        // Process each sheet
        workbook.SheetNames.forEach((sheetName, sheetIdx) => {
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
          
          jsonData.forEach((row, rowIdx) => {
            if (!Array.isArray(row) || row.length < 2) return;
            
            // Find label and value in row
            let label = '';
            let value = null;
            
            row.forEach(cell => {
              if (cell === null || cell === undefined || cell === '') return;
              const cellStr = String(cell).trim();
              const numStr = cellStr.replace(/[,\s()RM$]/gi, '');
              const num = parseFloat(numStr);
              
              if (!isNaN(num) && value === null && numStr !== '') {
                // Check if negative (in parentheses)
                value = cellStr.includes('(') ? -Math.abs(num) : num;
              } else if (cellStr && !label && isNaN(parseFloat(cellStr.replace(/[,\s]/g, '')))) {
                label = cellStr;
              }
            });
            
            if (label && value !== null) {
              data.push({ 
                idx: data.length, 
                label, 
                value, 
                cells: row.map(c => String(c || '')),
                sheet: sheetName,
                sheetIdx
              });
            }
          });
        });
        
        setPriorFSRawData(data);
        setLogs(prev => [...prev, { 
          t: 'ok', 
          m: `✓ Excel: ${data.length} items from ${workbook.SheetNames.length} sheets (${workbook.SheetNames.join(', ')})` 
        }]);
        
      } else if (fileName.endsWith('.pdf')) {
        // PDF file - show instruction for manual paste
        setLogs(prev => [...prev, { 
          t: 'warn', 
          m: `📄 PDF detected. Please open the PDF, copy (Ctrl+A, Ctrl+C) and paste the text below.` 
        }]);
        setPriorFSRawData([]);
        // Show the PDF paste area
        setPriorFSMode('upload');
        
      } else {
        // CSV/TXT file
        const text = await file.text();
        const lines = text.split('\n').filter(l => l.trim());
        const data = [];
        
        lines.forEach((line, idx) => {
          // Try to parse as CSV
          const cells = line.split(/[,\t]/).map(c => c.trim().replace(/^["']|["']$/g, ''));
          if (cells.length >= 2) {
            // Find numeric value in the row
            let label = '';
            let value = null;
            
            cells.forEach(cell => {
              const numStr = cell.replace(/[,\s()RM$]/gi, '');
              const num = parseFloat(numStr);
              if (!isNaN(num) && value === null && numStr !== '') {
                value = cell.includes('(') ? -Math.abs(num) : num;
              } else if (cell && !label && isNaN(parseFloat(cell.replace(/[,\s]/g, '')))) {
                label = cell;
              }
            });
            
            if (label && value !== null) {
              data.push({ idx, label, value, cells });
            }
          }
        });
        
        setPriorFSRawData(data);
        setLogs(prev => [...prev, { t: 'ok', m: `✓ Parsed ${data.length} line items from ${file.name}` }]);
      }
    } catch (err) {
      setLogs(prev => [...prev, { t: 'err', m: `✗ Error reading file: ${err.message}` }]);
    }
  };
  
  // Parse pasted PDF text for Prior FS
  const parsePriorFSText = (text) => {
    if (!text.trim()) return;
    
    const lines = text.split('\n').filter(l => l.trim());
    const data = [];
    
    lines.forEach((line, idx) => {
      // Skip header-like lines
      if (line.match(/^(note|rm|page|\d{4}|total|as at|for the)/i) && line.length < 50) return;
      
      // Try multiple parsing strategies
      // Strategy 1: Label followed by number(s)
      const match1 = line.match(/^(.+?)\s+([\d,]+(?:\.\d{2})?)\s*(?:[\d,]+(?:\.\d{2})?)?\s*$/);
      // Strategy 2: Number in parentheses (negative)
      const match2 = line.match(/^(.+?)\s+\(([\d,]+(?:\.\d{2})?)\)\s*$/);
      // Strategy 3: Just looking for any label-value pair
      const match3 = line.match(/^([A-Za-z][A-Za-z\s&,\-]+?)\s{2,}([\d,]+(?:\.\d{2})?)/);
      
      let label = '';
      let value = null;
      
      if (match2) {
        label = match2[1].trim();
        value = -parseFloat(match2[2].replace(/,/g, ''));
      } else if (match1) {
        label = match1[1].trim();
        value = parseFloat(match1[2].replace(/,/g, ''));
      } else if (match3) {
        label = match3[1].trim();
        value = parseFloat(match3[2].replace(/,/g, ''));
      }
      
      // Filter out non-meaningful labels
      if (label && value !== null && label.length > 2 && !label.match(/^\d+$/) && Math.abs(value) > 0) {
        data.push({ idx: data.length, label, value, source: 'pdf' });
      }
    });
    
    setPriorFSRawData(data);
    setLogs(prev => [...prev, { t: 'ok', m: `✓ Parsed ${data.length} items from pasted text` }]);
  };
  
  // Auto-map uploaded data to FS items
  const autoMapPriorFS = () => {
    // Keywords map using actual FS_STRUCTURE IDs (uppercase)
    const keywords = {
      // Income Statement - map by ID
      SALES: ['revenue', 'sales', 'turnover', 'income from operations', 'jualan', 'pendapatan'],
      PURCHASE: ['cost of sales', 'cost of goods', 'cogs', 'direct costs', 'kos jualan', 'purchase'],
      DIRECT_LABOUR: ['direct labour', 'direct labor', 'buruh langsung'],
      DEPRECIATION: ['depreciation', 'susutnilai', 'amortisation', 'amortization'],
      SALARY: ['salary', 'wages', 'staff cost', 'employee', 'gaji'],
      RENT: ['rental', 'rent', 'sewa'],
      UTILITIES: ['utility', 'utilities', 'electric', 'water', 'tnb', 'air'],
      INTEREST_INC: ['interest income', 'pendapatan faedah'],
      INTEREST_EXP: ['interest expense', 'finance cost', 'borrowing cost', 'kos kewangan', 'faedah'],
      TAX_EXPENSE: ['tax', 'taxation', 'income tax', 'cukai'],
      
      // Balance Sheet - Assets
      PPE: ['property plant equipment', 'ppe', 'fixed asset', 'net book value', 'nbv', 'aset tetap'],
      INTANGIBLES: ['intangible', 'goodwill', 'trademark'],
      INVESTMENTS: ['investment', 'pelaburan'],
      INVENTORY: ['inventory', 'stock', 'inventories', 'inventori'],
      TRADE_RECEIVABLES: ['trade receivable', 'accounts receivable', 'debtors', 'penghutang dagangan'],
      OTHER_RECEIVABLES: ['other receivable', 'prepaid', 'deposit', 'penghutang lain'],
      CASH_BANK: ['cash', 'bank', 'cash and cash equivalent', 'tunai'],
      
      // Balance Sheet - Liabilities
      LONG_TERM_LOAN: ['long term', 'term loan', 'long-term borrowing', 'pinjaman jangka panjang'],
      DEFERRED_TAX: ['deferred tax', 'cukai tertunda'],
      SHORT_TERM_LOAN: ['short term borrowing', 'bank overdraft', 'pinjaman jangka pendek', 'loan'],
      TRADE_PAYABLES: ['trade payable', 'accounts payable', 'creditors', 'pemiutang dagangan'],
      OTHER_PAYABLES: ['other payable', 'accrual', 'accrued', 'pemiutang lain'],
      TAX_PAYABLE: ['tax payable', 'cukai kena bayar'],
      
      // Balance Sheet - Equity
      SHARE_CAPITAL: ['share capital', 'issued capital', 'paid-up capital', 'modal saham'],
      RETAINED_PROFITS: ['retained', 'accumulated profit', 'retained earning', 'keuntungan terkumpul'],
    };
    
    let mapped = 0;
    
    // Items that should always be positive (assets, revenue, expenses as absolute values)
    // Use actual IDs from FS_STRUCTURE
    const alwaysPositive = ['SALES', 'SERVICE_REVENUE', 'PURCHASE', 'DIRECT_COSTS', 'SALARY', 'RENT', 
      'UTILITIES', 'DEPRECIATION', 'OFFICE_SUPPLIES', 'PROFESSIONAL_FEES', 'MARKETING', 'TRANSPORT',
      'ENTERTAINMENT', 'INSURANCE', 'REPAIR_MAINTENANCE', 'TELEPHONE', 'BANK_CHARGES', 'MISC_EXPENSE',
      'INTEREST_EXP', 'TAX_EXPENSE', 'PPE', 'INTANGIBLES', 'INVESTMENTS',
      'INVENTORY', 'TRADE_RECEIVABLES', 'OTHER_RECEIVABLES', 'CASH_BANK', 'LONG_TERM_LOAN', 'DEFERRED_TAX',
      'SHORT_TERM_LOAN', 'TRADE_PAYABLES', 'OTHER_PAYABLES', 'TAX_PAYABLE', 'SHARE_CAPITAL', 'RETAINED_PROFITS'];
    
    // Map IS items
    setPriorISItems(prev => prev.map(item => {
      const kws = keywords[item.id] || [item.label.toLowerCase()];
      const match = priorFSRawData.find(d => 
        kws.some(kw => d.label.toLowerCase().includes(kw))
      );
      if (match) {
        mapped++;
        // Use abs for items that should be positive, keep sign for others
        const value = alwaysPositive.includes(item.id) ? Math.abs(match.value) : match.value;
        return { ...item, value: String(value), mapped: match.label };
      }
      return item;
    }));
    
    // Map BS items
    setPriorBSItems(prev => prev.map(item => {
      const kws = keywords[item.id] || [item.label.toLowerCase()];
      const match = priorFSRawData.find(d => 
        kws.some(kw => d.label.toLowerCase().includes(kw))
      );
      if (match) {
        mapped++;
        // Use abs for items that should be positive (all BS items in presentation)
        const value = alwaysPositive.includes(item.id) ? Math.abs(match.value) : match.value;
        return { ...item, value: String(value), mapped: match.label };
      }
      return item;
    }));
    
    setLogs(prev => [...prev, { t: 'ok', m: `✓ Auto-mapped ${mapped} items` }]);
  };

  // Calculate prior year totals from dynamic items
  const priorCalc = (() => {
    const calc = { revenue: 0, cos: 0, depreciation: 0, admin: 0, oi: 0, oe: 0, fin: 0, tax: 0 };
    
    priorISItems.forEach(item => {
      const val = parseFloat(item.value) || 0;
      if (item.section === 'revenue' || item.type === 'revenue') calc.revenue += val;
      else if (item.section === 'cost_of_sales' || item.type === 'cogs') calc.cos += val;
      else if (item.section === 'operating_expenses' || item.type === 'expense') {
        if (item.id === 'DEPRECIATION') calc.depreciation += val;
        calc.admin += val;
      }
      else if (item.section === 'other_income' || item.type === 'other_income') calc.oi += val;
      else if (item.section === 'other_expenses' || item.type === 'other_expense') calc.oe += val;
      else if (item.section === 'finance_costs' || item.type === 'finance') calc.fin += val;
      else if (item.section === 'tax' || item.type === 'tax') calc.tax += val;
    });
    
    calc.gp = calc.revenue - calc.cos;
    calc.totalAdminWithDep = calc.admin; // Admin already includes depreciation
    calc.op = calc.gp - calc.admin;
    calc.pbt = calc.op + calc.oi - calc.oe - calc.fin;
    calc.np = calc.pbt - calc.tax;
    
    // BS calculations
    calc.nca = 0; calc.ca = 0; calc.ncl = 0; calc.cl = 0; calc.equity = 0;
    calc.ppe = 0; // Simple NBV for prior year
    calc.intangibles = 0; calc.investments = 0;
    calc.bank = 0; calc.tr = 0; calc.or = 0; calc.inv = 0; 
    calc.ltLoan = 0; calc.defTax = 0;
    calc.loan = 0; calc.tp = 0; calc.op_pay = 0; calc.taxPay = 0; calc.gstSst = 0;
    calc.cap = 0; calc.ret = 0; calc.reserves = 0;
    
    priorBSItems.forEach(item => {
      const val = parseFloat(item.value) || 0;
      if (item.type === 'nca') calc.nca += val;
      else if (item.type === 'ca') calc.ca += val;
      else if (item.type === 'ncl') calc.ncl += val;
      else if (item.type === 'cl') calc.cl += val;
      else if (item.type === 'equity') calc.equity += val;
      
      // Individual mappings using new IDs
      if (item.id === 'PPE') calc.ppe = val;
      if (item.id === 'INTANGIBLES') calc.intangibles = val;
      if (item.id === 'INVESTMENTS') calc.investments = val;
      if (item.id === 'CASH_BANK') calc.bank = val;
      if (item.id === 'TRADE_RECEIVABLES') calc.tr = val;
      if (item.id === 'OTHER_RECEIVABLES') calc.or = val;
      if (item.id === 'INVENTORY') calc.inv = val;
      if (item.id === 'LONG_TERM_LOAN') calc.ltLoan = val;
      if (item.id === 'DEFERRED_TAX') calc.defTax = val;
      if (item.id === 'SHORT_TERM_LOAN') calc.loan = val;
      if (item.id === 'TRADE_PAYABLES') calc.tp = val;
      if (item.id === 'OTHER_PAYABLES') calc.op_pay = val;
      if (item.id === 'TAX_PAYABLE') calc.taxPay = val;
      if (item.id === 'GST_SST_PAYABLE') calc.gstSst = val;
      if (item.id === 'SHARE_CAPITAL') calc.cap = val;
      if (item.id === 'RETAINED_PROFITS') calc.ret = val;
    });
    
    calc.totA = calc.nca + calc.ca;
    calc.totL = calc.ncl + calc.cl;
    calc.totE = calc.equity;
    calc.totLE = calc.totL + calc.totE;
    calc.diff = calc.totA - calc.totLE; // Difference should be 0
    calc.balanced = Math.abs(calc.diff) < 1;
    
    return calc;
  })();
  
  // Legacy priorIS/priorBS for backward compatibility
  const priorIS = {
    revenue: String(priorCalc.revenue),
    cost_of_sales: String(priorCalc.cos),
    depreciation: String(priorCalc.depreciation),
    admin_expenses: String(priorCalc.admin),
    other_income: String(priorCalc.oi),
    other_expenses: String(priorCalc.oe),
    finance_costs: String(priorCalc.fin),
    tax: String(priorCalc.tax),
  };
  
  const priorBS = {
    ppe: String(priorCalc.ppe),
    intangibles: String(priorCalc.intangibles),
    investments: String(priorCalc.investments),
    bank: String(priorCalc.bank),
    trade_receivables: String(priorCalc.tr),
    other_receivables: String(priorCalc.or),
    inventory: String(priorCalc.inv),
    long_term_loan: String(priorCalc.ltLoan),
    deferred_tax: String(priorCalc.defTax),
    loan: String(priorCalc.loan),
    trade_payables: String(priorCalc.tp),
    other_payables: String(priorCalc.op_pay),
    tax_payable: String(priorCalc.taxPay),
    share_capital: String(priorCalc.cap),
    retained_profits: String(priorCalc.ret),
    reserves: String(priorCalc.reserves),
  };

  // Add bank account
  const addBank = () => {
    if (newBank.name) {
      const id = newBank.name.toLowerCase().replace(/\s+/g, '_');
      setBanks(prev => [...prev, { id, name: newBank.name, accNo: newBank.accNo }]);
      // Initialize statements tracking for this bank
      const stmts = {};
      MONTHS.forEach(m => { stmts[m] = { uploaded: false, txCount: 0, file: null }; });
      setBankStatements(prev => ({ ...prev, [id]: stmts }));
      setNewBank({ name: '', accNo: '' });
      setLogs(prev => [...prev, { t: 'ok', m: `✓ Added bank: ${newBank.name}` }]);
    }
  };

  // Remove transactions for a specific bank/month
  const removeStatementTxs = (bankId, month) => {
    const bank = banks.find(b => b.id === bankId);
    const bankName = bank?.name || bankId;
    
    // Count transactions to be removed
    const toRemove = txs.filter(tx => tx.bankAccount === bankName && tx.month === month);
    if (toRemove.length === 0) {
      setLogs(prev => [...prev, { t: 'warn', m: `⚠ No transactions found for ${bankName} - ${month}` }]);
      return;
    }
    
    // Remove transactions
    setTxs(prev => prev.filter(tx => !(tx.bankAccount === bankName && tx.month === month)));
    
    // Reset statement status
    setBankStatements(prev => ({
      ...prev,
      [bankId]: {
        ...prev[bankId],
        [month]: { uploaded: false, txCount: 0, file: null }
      }
    }));
    
    setLogs(prev => [...prev, { t: 'ok', m: `✓ Removed ${toRemove.length} transactions (${bankName} - ${month})` }]);
  };

  // Handle file upload for bank statement
  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length || !selectedBank) return;
    
    setBusy(true);
    let newLogs = [...logs];
    
    for (const file of files) {
      try {
        const isPDF = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
        const isExcel = file.name.toLowerCase().endsWith('.xlsx') || file.name.toLowerCase().endsWith('.xls');
        
        if (isPDF) {
          newLogs.push({ t: 'info', m: `📄 PDF detected: ${file.name}` });
          newLogs.push({ t: 'warn', m: `⚠ PDF parsing requires manual text extraction. Please copy text from PDF and paste below.` });
          setLogs([...newLogs]);
          
          // Store file info but mark as needs manual processing
          setBankStatements(prev => ({
            ...prev,
            [selectedBank]: {
              ...prev[selectedBank],
              [selectedMonth]: { uploaded: true, txCount: 0, file: file.name, needsManual: true }
            }
          }));
        } else if (isExcel) {
          // Excel file processing using SheetJS
          const readingMsg = `Reading Excel: ${file.name}...`;
          newLogs.push({ t: 'info', m: readingMsg });
          setLogs([...newLogs]);
          
          const arrayBuffer = await file.arrayBuffer();
          const workbook = XLSX.read(arrayBuffer, { type: 'array', cellDates: true });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
          
          // Convert to CSV-like text for parsing
          const csvText = jsonData.map(row => row.join(',')).join('\n');
          const bank = banks.find(b => b.id === selectedBank);
          const parsed = parseCSVText(csvText, file.name, bank?.name || selectedBank, selectedMonth, currentYear);
          
          newLogs = newLogs.filter(log => log.m !== readingMsg);
          
          if (parsed.length > 0) {
            setTxs(prev => [...prev, ...parsed]);
            setBankStatements(prev => ({
              ...prev,
              [selectedBank]: {
                ...prev[selectedBank],
                [selectedMonth]: { uploaded: true, txCount: parsed.length, file: file.name }
              }
            }));
            newLogs.push({ t: 'ok', m: `✓ ${file.name}: ${parsed.length} transactions (${bank?.name} - ${selectedMonth})` });
          } else {
            newLogs.push({ t: 'warn', m: `⚠ ${file.name}: No transactions found` });
          }
        } else {
          // CSV/TXT processing
          const readingMsg = `Reading: ${file.name}...`;
          newLogs.push({ t: 'info', m: readingMsg });
          setLogs([...newLogs]);
          
          const text = await file.text();
          const bank = banks.find(b => b.id === selectedBank);
          const parsed = parseCSVText(text, file.name, bank?.name || selectedBank, selectedMonth, currentYear);
          
          // Remove the "Reading:" message since we're done
          newLogs = newLogs.filter(log => log.m !== readingMsg);
          
          if (parsed.length > 0) {
            setTxs(prev => [...prev, ...parsed]);
            setBankStatements(prev => ({
              ...prev,
              [selectedBank]: {
                ...prev[selectedBank],
                [selectedMonth]: { uploaded: true, txCount: parsed.length, file: file.name }
              }
            }));
            newLogs.push({ t: 'ok', m: `✓ ${file.name}: ${parsed.length} transactions (${bank?.name} - ${selectedMonth})` });
          } else {
            newLogs.push({ t: 'warn', m: `⚠ ${file.name}: No transactions found` });
          }
        }
      } catch (err) {
        // Remove any "Reading:" message on error too
        newLogs = newLogs.filter(log => !log.m.includes('Reading:'));
        newLogs.push({ t: 'err', m: `✗ ${file.name}: ${err.message}` });
      }
      setLogs([...newLogs]);
    }
    
    setBusy(false);
    if (fileRef.current) fileRef.current.value = '';
  };

  // Parse pasted PDF text
  const parsePastedText = () => {
    if (!pdfText.trim() || !selectedBank) return;
    
    const bank = banks.find(b => b.id === selectedBank);
    const parsed = parseCSVText(pdfText, 'PDF-Paste', bank?.name || selectedBank, selectedMonth, currentYear);
    
    if (parsed.length > 0) {
      setTxs(prev => [...prev, ...parsed]);
      setBankStatements(prev => ({
        ...prev,
        [selectedBank]: {
          ...prev[selectedBank],
          [selectedMonth]: { uploaded: true, txCount: parsed.length, file: 'Pasted PDF text' }
        }
      }));
      setLogs(prev => [...prev, { t: 'ok', m: `✓ Parsed ${parsed.length} transactions from pasted text (${bank?.name} - ${selectedMonth})` }]);
      setPdfText('');
    } else {
      setLogs(prev => [...prev, { t: 'warn', m: '⚠ No transactions found in pasted text' }]);
    }
  };

  // Apply prior year FS to opening balances
  const applyPriorFS = () => {
    const newOB = {};
    
    // PPE: Prior year PPE is NBV. We need to split it into cost and acc dep.
    // Since we only have NBV, we set it as cost with zero acc dep (conservative approach).
    // The user should adjust the PPE register to reflect actual cost/acc dep.
    if (priorBS.ppe) {
      const ppeNBV = parseFloat(priorBS.ppe) || 0;
      newOB.fixed_asset = ppeNBV; // Set as cost (user should adjust via PPE register)
      newOB.accumulated_depreciation = 0; // No acc dep from prior since we only have NBV
      // Note: For accurate depreciation, user should update PPE register with actual cost/acc dep
    }
    
    if (priorBS.trade_receivables) newOB.trade_receivables = parseFloat(priorBS.trade_receivables) || 0;
    if (priorBS.inventory) newOB.inventory = parseFloat(priorBS.inventory) || 0;
    if (priorBS.other_receivables) newOB.other_receivables = parseFloat(priorBS.other_receivables) || 0;
    
    // Distribute bank balance across bank accounts or use single bank
    if (priorBS.bank) {
      if (banks.length > 0) {
        // For simplicity, put all in first bank account
        newOB[`bank_${banks[0].name.toLowerCase().replace(/\s+/g, '_')}`] = parseFloat(priorBS.bank) || 0;
      } else {
        newOB.bank = parseFloat(priorBS.bank) || 0;
      }
    }
    
    // Liabilities - stored as negative (credit) balances
    if (priorBS.long_term_loan) newOB.long_term_loan = -(parseFloat(priorBS.long_term_loan) || 0);
    if (priorBS.loan) newOB.loan = -(parseFloat(priorBS.loan) || 0);
    if (priorBS.trade_payables) newOB.trade_payables = -(parseFloat(priorBS.trade_payables) || 0);
    if (priorBS.other_payables) newOB.other_payables = -(parseFloat(priorBS.other_payables) || 0);
    if (priorBS.tax_payable) newOB.tax_payable = -(parseFloat(priorBS.tax_payable) || 0);
    
    // Equity - stored as negative (credit) balances
    if (priorBS.share_capital) newOB.share_capital = -(parseFloat(priorBS.share_capital) || 0);
    if (priorBS.retained_profits) newOB.retained_profits = -(parseFloat(priorBS.retained_profits) || 0);
    if (priorBS.reserves) newOB.reserves = -(parseFloat(priorBS.reserves) || 0);
    
    setOb(newOB);
    setLogs(prev => [...prev, { t: 'ok', m: `✓ Prior year (${priorFSYear}) balances applied` }]);
    setLogs(prev => [...prev, { t: 'warn', m: `⚠ PPE set as NBV. Update PPE register with actual cost/acc dep for accurate depreciation.` }]);
  };

  const loadSample = () => {
    setCompanyType('SDN_BHD');
    setCompanyName('ABC Trading Sdn Bhd');
    setCompanyRegNo('202401012345');
    setFinancialYearEnd('12');
    setAccountingStandard('MPERS');
    setCurrentYear(2024);
    setPriorFSYear(2023);
    
    setBanks(sampleBanks);
    const stmts = {};
    sampleBanks.forEach(bank => {
      stmts[bank.id] = {};
      MONTHS.forEach(m => { stmts[bank.id][m] = { uploaded: false, txCount: 0, file: null }; });
    });
    stmts['maybank']['Jan'] = { uploaded: true, txCount: 2, file: 'Sample' };
    stmts['maybank']['Feb'] = { uploaded: true, txCount: 1, file: 'Sample' };
    stmts['maybank']['Mar'] = { uploaded: true, txCount: 1, file: 'Sample' };
    stmts['cimb']['Feb'] = { uploaded: true, txCount: 1, file: 'Sample' };
    stmts['cimb']['Mar'] = { uploaded: true, txCount: 1, file: 'Sample' };
    setBankStatements(stmts);
    setTxs(sampleTxs);
    
    // Set sample Prior FS items using FS_STRUCTURE
    const samplePriorIS = generateInitialPriorIS();
    // Set sample values for some items
    samplePriorIS.forEach(item => {
      if (item.id === 'SALES') item.value = '500000';
      else if (item.id === 'PURCHASE') item.value = '280000';
      else if (item.id === 'FREIGHT_IN') item.value = '20000';
      else if (item.id === 'SALARY') item.value = '50000';
      else if (item.id === 'EPF') item.value = '6000';
      else if (item.id === 'SOCSO') item.value = '1000';
      else if (item.id === 'RENT') item.value = '12000';
      else if (item.id === 'UTILITIES') item.value = '5000';
      else if (item.id === 'DEPRECIATION') item.value = '8000';
      else if (item.id === 'INTEREST_INC') item.value = '2000';
      else if (item.id === 'BANK_CHARGES') item.value = '1500';
      else if (item.id === 'INTEREST_EXP') item.value = '3500';
      else if (item.id === 'TAX_EXPENSE') item.value = '28250';
    });
    setPriorISItems(samplePriorIS);
    
    const samplePriorBS = generateInitialPriorBS();
    // Set sample values - these must tie to opening balances
    samplePriorBS.forEach(item => {
      if (item.id === 'PPE') item.value = '92000'; // Cost 120k - Acc Dep 28k = NBV 92k
      else if (item.id === 'INVENTORY') item.value = '35000';
      else if (item.id === 'TRADE_RECEIVABLES') item.value = '45000';
      else if (item.id === 'OTHER_RECEIVABLES') item.value = '12000'; // Deposits + Prepayments
      else if (item.id === 'CASH_BANK') item.value = '100000'; // Maybank 70k + CIMB 30k
      else if (item.id === 'SHORT_TERM_LOAN') item.value = '50000';
      else if (item.id === 'TRADE_PAYABLES') item.value = '25000';
      else if (item.id === 'OTHER_PAYABLES') item.value = '9000'; // Accruals
      else if (item.id === 'TAX_PAYABLE') item.value = '10000';
      else if (item.id === 'SHARE_CAPITAL') item.value = '100000';
      else if (item.id === 'RETAINED_PROFITS') item.value = '90000';
    });
    setPriorBSItems(samplePriorBS);
    
    // Set opening balances from prior year BS (these MUST match priorBS values)
    // Assets are positive (debit), Liabilities/Equity are negative (credit)
    setOb({
      // Non-Current Assets
      fixed_asset: 120000, // PPE at cost
      accumulated_depreciation: -28000, // Acc Dep (credit balance)
      // Current Assets
      inventory: 35000,
      trade_receivables: 45000,
      other_receivables: 12000,
      bank_maybank: 70000,
      bank_cimb: 30000,
      // Current Liabilities
      loan: -50000, // Short term loan (credit)
      trade_payables: -25000, // Credit
      other_payables: -9000, // Accruals (credit)
      tax_payable: -10000, // Tax owing (credit)
      // Equity
      share_capital: -100000, // Credit
      retained_profits: -90000, // Credit
    });
    
    // ========================================
    // SAMPLE SUBLEDGERS - Ties to BS figures
    // ========================================
    
    // PPE Register - Cost = 120,000, Acc Dep B/F = 28,000, NBV = 92,000
    setPpeRegister([
      { 
        id: 'ppe_1', 
        description: 'Office Computer (Dell Desktop)', 
        category: 'OFFICE_EQUIPMENT',
        acquisitionDate: '2022-01-01', 
        cost: 5000, 
        residualValue: 500, 
        accDepBF: 2250 // 2 years at (5000-500)/4 = 1125/year
      },
      { 
        id: 'ppe_2', 
        description: 'Office Furniture & Fittings', 
        category: 'FURNITURE_FITTINGS',
        acquisitionDate: '2021-01-01', 
        cost: 15000, 
        residualValue: 1500, 
        accDepBF: 4050 // 3 years at (15000-1500)/10 = 1350/year
      },
      { 
        id: 'ppe_3', 
        description: 'Company Vehicle (Proton X70)', 
        category: 'MOTOR_VEHICLES',
        acquisitionDate: '2022-07-01', 
        cost: 100000, 
        residualValue: 20000, 
        accDepBF: 21700 // 1.5 years at (100000-20000)/5.5 ≈ 14533/year (rounding)
      },
    ]);
    // Total Cost: 5000 + 15000 + 100000 = 120,000 ✓
    // Total Acc Dep B/F: 2250 + 4050 + 21700 = 28,000 ✓
    // NBV at start: 120,000 - 28,000 = 92,000 ✓
    
    // Inventory Ledger - Total should = 35,000 (matching opening balance)
    setInventoryLedger([
      { id: 'inv_1', itemCode: 'SKU-001', description: 'Product A - Widget Standard', qty: 100, unitCost: 120, category: 'Finished Goods' },
      { id: 'inv_2', itemCode: 'SKU-002', description: 'Product B - Widget Premium', qty: 50, unitCost: 200, category: 'Finished Goods' },
      { id: 'inv_3', itemCode: 'RAW-001', description: 'Raw Material - Steel Sheet', qty: 100, unitCost: 80, category: 'Raw Materials' },
      { id: 'inv_4', itemCode: 'RAW-002', description: 'Raw Material - Plastic Pellets', qty: 300, unitCost: 10, category: 'Raw Materials' },
    ]);
    // Total: (100*120) + (50*200) + (100*80) + (300*10) = 12000 + 10000 + 8000 + 5000 = 35,000 ✓
    
    // Trade Receivables - Total outstanding should = 45,000 (matching opening balance)
    setTradeReceivables([
      { id: 'ar_1', customerName: 'XYZ Enterprise Sdn Bhd', invoiceNo: 'INV-2023-088', invoiceDate: '2023-11-15', dueDate: '2023-12-14', amount: 20000, paid: 0 },
      { id: 'ar_2', customerName: 'ABC Trading Co', invoiceNo: 'INV-2023-092', invoiceDate: '2023-12-01', dueDate: '2024-01-01', amount: 15000, paid: 0 },
      { id: 'ar_3', customerName: 'DEF Industries', invoiceNo: 'INV-2023-095', invoiceDate: '2023-12-20', dueDate: '2024-01-19', amount: 10000, paid: 0 },
    ]);
    // Total outstanding: 20000 + 15000 + 10000 = 45,000 ✓
    
    // Trade Payables - Total outstanding should = 25,000 (matching opening balance)
    setTradePayables([
      { id: 'ap_1', supplierName: 'Supplier One Sdn Bhd', invoiceNo: 'SUP-2023-045', invoiceDate: '2023-11-20', dueDate: '2023-12-19', amount: 12000, paid: 0 },
      { id: 'ap_2', supplierName: 'Material Supplies Co', invoiceNo: 'SUP-2023-052', invoiceDate: '2023-12-15', dueDate: '2024-01-14', amount: 8000, paid: 0 },
      { id: 'ap_3', supplierName: 'Equipment Parts Ltd', invoiceNo: 'SUP-2023-058', invoiceDate: '2023-12-28', dueDate: '2024-01-27', amount: 5000, paid: 0 },
    ]);
    // Total outstanding: 12000 + 8000 + 5000 = 25,000 ✓
    
    // Other Debtors (Other Receivables) - Should = 12,000 (matching opening balance)
    setOtherDebtors([
      { id: 'od_1', description: 'Rental Deposit - Office', type: 'DEPOSIT', amount: 6000, remarks: '3 months deposit for office rental' },
      { id: 'od_2', description: 'Utilities Deposit - TNB', type: 'DEPOSIT', amount: 2000, remarks: 'Electricity deposit' },
      { id: 'od_3', description: 'Prepaid Insurance', type: 'PREPAID', amount: 3000, remarks: 'Insurance premium paid in advance' },
      { id: 'od_4', description: 'Staff Advance - Ahmad', type: 'ADVANCE', amount: 1000, remarks: 'Salary advance to be deducted' },
    ]);
    // Total: 6000 + 2000 + 3000 + 1000 = 12,000 ✓
    
    // Other Creditors (Other Payables) - Should = 9,000 (matching opening balance)
    setOtherCreditors([
      { id: 'oc_1', description: 'Accrued Audit Fee', type: 'ACCRUAL', amount: 4000, remarks: 'Year-end audit fee' },
      { id: 'oc_2', description: 'Accrued Bonus', type: 'ACCRUAL', amount: 3000, remarks: 'Staff bonus payable' },
      { id: 'oc_3', description: 'Customer Deposit Received', type: 'DEPOSIT_RECEIVED', amount: 2000, remarks: 'Deposit from customer for future order' },
    ]);
    // Total: 4000 + 3000 + 2000 = 9,000 ✓
    
    // Cash & Bank Ledger - Should tie to BS Cash figure
    setCashBankLedger([
      { 
        id: 'cb_1', 
        accountName: 'Maybank Current Account', 
        bankName: 'Maybank', 
        accountNo: '5123-4567-8901', 
        openingBalance: 70000, 
        closingBalance: 116000, // After transactions: 70000 + 50000 - 20000 - 12000 + 28000 = 116000
        reconciled: true 
      },
      { 
        id: 'cb_2', 
        accountName: 'CIMB Current Account', 
        bankName: 'CIMB', 
        accountNo: '1234-5678-9012', 
        openingBalance: 30000, 
        closingBalance: 25650, // After transactions: 30000 - 3500 - 850 = 25650
        reconciled: true 
      },
    ]);
    // Total opening: 70000 + 30000 = 100,000 ✓ (matches PY BS)
    // Total closing: 116000 + 25650 = 141,650
    
    setLogs([{ 
      t: 'ok', 
      m: '✓ Comprehensive sample loaded: Sdn Bhd, 2 banks, 6 transactions, Prior FS, Opening Balances, PPE Register (3 assets), Inventory (4 items), AR (3 customers), AP (3 suppliers), Other Debtors (4 items), Other Creditors (3 items), Cash Ledger (2 accounts)' 
    }]);
    setTab('priorfs');
  };

  const addOb = () => {
    if (newOb.acc && newOb.amt) {
      setOb(prev => ({ ...prev, [newOb.acc.toLowerCase().replace(/\s+/g, '_')]: parseFloat(newOb.amt) }));
      setNewOb({ acc: '', amt: '' });
    }
  };

  const rmTx = (i) => setTxs(prev => prev.filter((_, j) => j !== i));
  const updateTx = (i, field, val) => setTxs(prev => prev.map((tx, j) => j === i ? { ...tx, [field]: field === 'amount' ? parseFloat(val) || 0 : val } : tx));

  // ============================================
  // SNAPSHOT & ADJUSTMENT HELPERS
  // ============================================
  
  // Generate inputs hash/fingerprint for snapshot
  const generateInputsHash = () => {
    const fingerprint = JSON.stringify({
      ob,
      banks,
      txsLength: txs.length,
      cashTxsLength: cashTxs.length,
      subledgerCounts: {
        ppe: ppeRegister.length,
        inv: inventoryLedger.length,
        ar: tradeReceivables.length,
        ap: tradePayables.length
      },
      currentYear,
      companyName
    });
    return `${fingerprint.length}-${txs.length + cashTxs.length}`;
  };
  
  // Create a new snapshot
  // Detect changes between two snapshots and generate adjustment entries
  const detectSnapshotChanges = (oldSnap, newRes, periodLabel) => {
    const adjustments = [];
    const oldRes = oldSnap.snapshotRes;
    const threshold = 0.01; // Ignore differences less than 1 sen
    
    // Helper to check if values differ significantly
    const differs = (a, b) => Math.abs((a || 0) - (b || 0)) > threshold;
    
    // =============================================
    // 1. INCOME STATEMENT - Summary Totals
    // =============================================
    const isSummaryFields = [
      { key: 'rev', label: 'Total Revenue', type: 'Reclass', category: 'IS' },
      { key: 'cos', label: 'Total Cost of Sales', type: 'Reclass', category: 'IS' },
      { key: 'gp', label: 'Gross Profit', type: 'Reclass', category: 'IS' },
      { key: 'adm', label: 'Total Admin Expenses', type: 'Reclass', category: 'IS' },
      { key: 'oi', label: 'Total Other Income', type: 'Reclass', category: 'IS' },
      { key: 'oe', label: 'Total Other Expenses', type: 'Reclass', category: 'IS' },
      { key: 'fin', label: 'Total Finance Costs', type: 'Reclass', category: 'IS' },
      { key: 'dep', label: 'Depreciation', type: 'Depreciation', category: 'IS' },
      { key: 'pbt', label: 'Profit Before Tax', type: 'Reclass', category: 'IS' },
      { key: 'tax', label: 'Tax Expense', type: 'TaxAdj', category: 'IS' },
      { key: 'np', label: 'Net Profit', type: 'Reclass', category: 'IS' },
    ];
    
    isSummaryFields.forEach(({ key, label, type, category }) => {
      const oldVal = oldRes.is?.[key] || 0;
      const newVal = newRes.is?.[key] || 0;
      if (differs(oldVal, newVal)) {
        const diff = newVal - oldVal;
        adjustments.push({
          id: `ADJ-${Date.now()}-is-${key}`,
          date: new Date().toISOString().split('T')[0],
          periodLabel,
          type,
          category,
          field: label,
          oldValue: oldVal,
          newValue: newVal,
          amount: diff,
          description: `${label}: ${fmt(oldVal)} → ${fmt(newVal)}`,
          isAuto: true,
          createdAt: new Date().toISOString()
        });
      }
    });
    
    // =============================================
    // 2. INCOME STATEMENT - Detailed Line Items
    // =============================================
    const oldDetails = oldRes.is?.details || {};
    const newDetails = newRes.is?.details || {};
    const allDetailKeys = new Set([...Object.keys(oldDetails), ...Object.keys(newDetails)]);
    
    allDetailKeys.forEach(key => {
      const oldVal = oldDetails[key] || 0;
      const newVal = newDetails[key] || 0;
      if (differs(oldVal, newVal)) {
        const diff = newVal - oldVal;
        const rule = FSEngine.rules[key];
        const label = rule?.label || key;
        const type = rule?.type === 'revenue' || rule?.type === 'other_income' ? 'Reclass' :
                     rule?.type === 'cogs' ? 'Reclass' :
                     rule?.type === 'expense' ? 'Reclass' : 'Correction';
        adjustments.push({
          id: `ADJ-${Date.now()}-det-${key}`,
          date: new Date().toISOString().split('T')[0],
          periodLabel,
          type,
          category: 'IS-Detail',
          field: label,
          glCode: key,
          oldValue: oldVal,
          newValue: newVal,
          amount: diff,
          description: `${label} (${key}): ${fmt(oldVal)} → ${fmt(newVal)}`,
          isAuto: true,
          createdAt: new Date().toISOString()
        });
      }
    });
    
    // =============================================
    // 3. BALANCE SHEET - Summary Items
    // =============================================
    const bsFields = [
      { key: 'ppe', label: 'PPE (Net)', type: 'Correction', category: 'BS-NCA' },
      { key: 'ppe_cost', label: 'PPE Cost', type: 'Correction', category: 'BS-NCA' },
      { key: 'ppe_accDep', label: 'Accumulated Depreciation', type: 'Depreciation', category: 'BS-NCA' },
      { key: 'inv', label: 'Inventory', type: 'Correction', category: 'BS-CA' },
      { key: 'tr', label: 'Trade Receivables', type: 'Correction', category: 'BS-CA' },
      { key: 'or', label: 'Other Receivables', type: 'Correction', category: 'BS-CA' },
      { key: 'cash', label: 'Cash & Bank', type: 'Correction', category: 'BS-CA' },
      { key: 'cashInHand', label: 'Cash in Hand', type: 'Correction', category: 'BS-CA' },
      { key: 'totCA', label: 'Total Current Assets', type: 'Correction', category: 'BS-CA' },
      { key: 'totNCA', label: 'Total Non-Current Assets', type: 'Correction', category: 'BS-NCA' },
      { key: 'totA', label: 'Total Assets', type: 'Correction', category: 'BS' },
      { key: 'tp', label: 'Trade Payables', type: 'Correction', category: 'BS-CL' },
      { key: 'op', label: 'Other Payables', type: 'Correction', category: 'BS-CL' },
      { key: 'borr', label: 'ST Borrowings', type: 'Correction', category: 'BS-CL' },
      { key: 'ltBorr', label: 'LT Borrowings', type: 'Correction', category: 'BS-NCL' },
      { key: 'taxPay', label: 'Tax Payable', type: 'TaxAdj', category: 'BS-CL' },
      { key: 'totCL', label: 'Total Current Liabilities', type: 'Correction', category: 'BS-CL' },
      { key: 'totNCL', label: 'Total Non-Current Liabilities', type: 'Correction', category: 'BS-NCL' },
      { key: 'totL', label: 'Total Liabilities', type: 'Correction', category: 'BS' },
      { key: 'cap', label: 'Share Capital', type: 'Correction', category: 'BS-EQ' },
      { key: 'ret', label: 'Retained Earnings', type: 'Correction', category: 'BS-EQ' },
      { key: 'cyp', label: 'Current Year Profit', type: 'Correction', category: 'BS-EQ' },
      { key: 'totE', label: 'Total Equity', type: 'Correction', category: 'BS-EQ' },
    ];
    
    bsFields.forEach(({ key, label, type, category }) => {
      const oldVal = oldRes.bs?.[key] || 0;
      const newVal = newRes.bs?.[key] || 0;
      if (differs(oldVal, newVal)) {
        const diff = newVal - oldVal;
        adjustments.push({
          id: `ADJ-${Date.now()}-bs-${key}`,
          date: new Date().toISOString().split('T')[0],
          periodLabel,
          type,
          category,
          field: label,
          oldValue: oldVal,
          newValue: newVal,
          amount: diff,
          description: `${label}: ${fmt(oldVal)} → ${fmt(newVal)}`,
          isAuto: true,
          createdAt: new Date().toISOString()
        });
      }
    });
    
    // =============================================
    // 4. TRANSACTION & JE COUNTS
    // =============================================
    const oldBankTxs = oldSnap.snapshotMeta?.counts?.bankTxs || 0;
    const oldCashTxs = oldSnap.snapshotMeta?.counts?.cashTxs || 0;
    const newBankTxs = txs.length;
    const newCashTxs = cashTxs.length;
    
    if (oldBankTxs !== newBankTxs) {
      adjustments.push({
        id: `ADJ-${Date.now()}-banktx`,
        date: new Date().toISOString().split('T')[0],
        periodLabel,
        type: 'Other',
        category: 'Count',
        field: 'Bank Transactions',
        oldValue: oldBankTxs,
        newValue: newBankTxs,
        amount: newBankTxs - oldBankTxs,
        description: `Bank Transactions: ${oldBankTxs} → ${newBankTxs}`,
        isAuto: true,
        createdAt: new Date().toISOString()
      });
    }
    
    if (oldCashTxs !== newCashTxs) {
      adjustments.push({
        id: `ADJ-${Date.now()}-cashtx`,
        date: new Date().toISOString().split('T')[0],
        periodLabel,
        type: 'Other',
        category: 'Count',
        field: 'Cash Vouchers',
        oldValue: oldCashTxs,
        newValue: newCashTxs,
        amount: newCashTxs - oldCashTxs,
        description: `Cash Vouchers: ${oldCashTxs} → ${newCashTxs}`,
        isAuto: true,
        createdAt: new Date().toISOString()
      });
    }
    
    const oldJECount = oldSnap.snapshotMeta?.counts?.jes || 0;
    const newJECount = newRes.jes?.length || 0;
    if (oldJECount !== newJECount) {
      adjustments.push({
        id: `ADJ-${Date.now()}-jecount`,
        date: new Date().toISOString().split('T')[0],
        periodLabel,
        type: 'Other',
        category: 'Count',
        field: 'Journal Entries',
        oldValue: oldJECount,
        newValue: newJECount,
        amount: newJECount - oldJECount,
        description: `Journal Entries: ${oldJECount} → ${newJECount}`,
        isAuto: true,
        createdAt: new Date().toISOString()
      });
    }
    
    return adjustments;
  };

  const createSnapshot = () => {
    if (!res) {
      alert('Please generate FS first before saving a snapshot.');
      return;
    }
    
    const { periodType, periodLabel, note, createdBy } = snapshotForm;
    
    if (!periodLabel.trim()) {
      alert('Please enter a period label (e.g., "2025-01" for monthly or "FY2025" for yearly)');
      return;
    }
    
    // Find existing snapshots for the same period to detect changes
    const existingForPeriod = fsSnapshots
      .filter(s => s.periodLabel === periodLabel && s.periodType === periodType)
      .sort((a, b) => b.version - a.version); // Sort by version descending
    
    const existingVersions = existingForPeriod.map(s => s.version);
    const version = existingVersions.length > 0 ? Math.max(...existingVersions) + 1 : 1;
    
    // Auto-detect changes if this is not the first version
    let autoAdjustments = [];
    if (existingForPeriod.length > 0) {
      const previousSnap = existingForPeriod[0]; // Most recent version
      autoAdjustments = detectSnapshotChanges(previousSnap, res, periodLabel.trim());
    }
    
    const snapshot = {
      id: `SNAP-${Date.now()}`,
      periodType,
      periodLabel: periodLabel.trim(),
      version,
      createdAt: new Date().toISOString(),
      createdBy: createdBy || 'Accountant',
      note: note.trim(),
      inputsHash: generateInputsHash(),
      snapshotRes: JSON.parse(JSON.stringify(res)),
      snapshotMeta: {
        companyName,
        companyRegNo,
        companyType,
        accountingStandard,
        currentYear,
        financialYearEnd,
        counts: {
          bankTxs: txs.length,
          cashTxs: cashTxs.length,
          jes: res.jes ? res.jes.length : 0
        }
      },
      // Link to previous version if exists
      previousVersionId: existingForPeriod.length > 0 ? existingForPeriod[0].id : null
    };
    
    // Add auto-detected adjustments to the log
    if (autoAdjustments.length > 0) {
      setAdjustmentLog(prev => [...autoAdjustments, ...prev]);
    }
    
    setFsSnapshots(prev => [snapshot, ...prev]);
    setShowSnapshotModal(false);
    setSnapshotForm({ periodType: 'Monthly', periodLabel: '', note: '', createdBy: 'Accountant' });
    
    if (autoAdjustments.length > 0) {
      alert(`Snapshot saved: ${periodLabel} v${version}\n\n${autoAdjustments.length} change(s) auto-detected and logged.`);
    } else {
      alert(`Snapshot saved: ${periodLabel} v${version}`);
    }
  };
  
  // Load snapshot into preview
  const loadSnapshot = (snapshot) => {
    if (confirm(`Load snapshot "${snapshot.periodLabel} v${snapshot.version}"?\n\nThis will show the snapshot's FS in the preview.`)) {
      setRes(snapshot.snapshotRes);
      setTab('journal');
    }
  };
  
  // Delete a snapshot
  const deleteSnapshot = (snapshotId) => {
    if (confirm('Delete this snapshot?')) {
      setFsSnapshots(prev => prev.filter(s => s.id !== snapshotId));
    }
  };
  
  // Add adjustment log entry
  const addAdjustment = () => {
    const { periodLabel, type, amount, description } = adjustmentForm;
    
    if (!periodLabel.trim() || !description.trim()) {
      alert('Please enter period label and description');
      return;
    }
    
    const adjustment = {
      id: `ADJ-${Date.now()}`,
      date: new Date().toISOString().split('T')[0],
      periodLabel: periodLabel.trim(),
      type,
      amount: parseFloat(amount) || 0,
      description: description.trim(),
      isAuto: false, // Manual entry
      createdAt: new Date().toISOString()
    };
    
    setAdjustmentLog(prev => [adjustment, ...prev]);
    setAdjustmentForm({ periodLabel: '', type: 'Correction', amount: '', description: '' });
  };
  
  // Delete adjustment
  const deleteAdjustment = (adjId) => {
    if (confirm('Delete this adjustment entry?')) {
      setAdjustmentLog(prev => prev.filter(a => a.id !== adjId));
    }
  };

  // Preview suggested JE for cash voucher (before adding)
  const suggestJEForCashVoucher = () => {
    if (!cvForm.amount) return null;
    const amt = Math.abs(parseFloat(cvForm.amount) || 0);
    if (amt === 0) return null;
    
    const isIn = cvForm.type === 'in';
    const isTransfer = cvForm.type.includes('bank');
    const classification = cvForm.classification || (isTransfer ? 'CASH_TRANSFER' : 'SUSPENSE');
    const canonicalCode = CLASS_ALIAS[classification] || classification;
    const rule = FSEngine.rules[canonicalCode];
    
    // Determine accounts
    const CASH_ACC = 'Cash on Hand';
    const BANK_ACC = 'Bank';
    let drAcc = '', crAcc = '';
    
    if (cvForm.type === 'bank_to_cash') {
      drAcc = CASH_ACC; crAcc = BANK_ACC;
    } else if (cvForm.type === 'cash_to_bank') {
      drAcc = BANK_ACC; crAcc = CASH_ACC;
    } else if (rule) {
      const ruleType = rule.type;
      if (ruleType === 'revenue' || ruleType === 'other_income') {
        drAcc = CASH_ACC; crAcc = rule.label || canonicalCode;
      } else if (ruleType === 'cogs' || ruleType === 'expense' || ruleType === 'finance' || ruleType === 'other_expense') {
        drAcc = rule.label || canonicalCode; crAcc = CASH_ACC;
      } else if (ruleType === 'drawings') {
        drAcc = rule.label || canonicalCode; crAcc = CASH_ACC;
      } else {
        drAcc = isIn ? CASH_ACC : 'Suspense'; crAcc = isIn ? 'Suspense' : CASH_ACC;
      }
    } else {
      drAcc = isIn ? CASH_ACC : 'Suspense'; crAcc = isIn ? 'Suspense' : CASH_ACC;
    }
    
    return { drAcc, crAcc, amt };
  };

  // Add cash voucher
  const addCashVoucher = () => {
    if (!cvForm.description || !cvForm.amount) {
      alert('Please enter description and amount');
      return;
    }
    const amt = parseFloat(cvForm.amount);
    if (isNaN(amt) || amt === 0) {
      alert('Please enter a valid amount');
      return;
    }
    
    // Determine final amount sign based on type
    let finalAmt = Math.abs(amt);
    if (cvForm.type === 'out' || cvForm.type === 'cash_to_bank') {
      finalAmt = -finalAmt;
    }
    
    const newTx = {
      date: cvForm.date,
      description: cvForm.description,
      reference: cvForm.reference,
      amount: finalAmt,
      month: new Date(cvForm.date).toLocaleString('en', { month: 'short' }).toUpperCase(),
      classification: cvForm.classification || (cvForm.type.includes('bank') ? 'CASH_TRANSFER' : ''),
      source: 'Cash',
      cashLedger: 'PETTY_CASH',
      transferDirection: cvForm.type.includes('bank') ? cvForm.type : null
    };
    
    setCashTxs(prev => [...prev, newTx]);
    setCvForm({
      date: new Date().toISOString().split('T')[0],
      description: '',
      reference: `CV-${String(cashTxs.length + 2).padStart(3, '0')}`,
      amount: '',
      type: 'out',
      classification: ''
    });
  };

  const run = () => {
    setBusy(true);
    setTimeout(() => {
      const priorISData = {
        revenue: parseFloat(priorIS.revenue) || 0, cost_of_sales: parseFloat(priorIS.cost_of_sales) || 0,
        admin_expenses: parseFloat(priorIS.admin_expenses) || 0, other_income: parseFloat(priorIS.other_income) || 0,
        other_expenses: priorCalc.oe || 0,
        finance_costs: parseFloat(priorIS.finance_costs) || 0, tax: parseFloat(priorIS.tax) || 0,
      };
      const priorBSData = {
        // Non-Current Assets
        ppe: parseFloat(priorBS.ppe) || 0,
        intangibles: parseFloat(priorBS.intangibles) || 0,
        investments: parseFloat(priorBS.investments) || 0,
        // Current Assets
        inventory: parseFloat(priorBS.inventory) || 0,
        trade_receivables: parseFloat(priorBS.trade_receivables) || 0,
        other_receivables: parseFloat(priorBS.other_receivables) || 0,
        bank: parseFloat(priorBS.bank) || 0,
        // Non-Current Liabilities
        long_term_loan: parseFloat(priorBS.long_term_loan) || 0,
        deferred_tax: parseFloat(priorBS.deferred_tax) || 0,
        // Current Liabilities
        loan: parseFloat(priorBS.loan) || 0,
        trade_payables: parseFloat(priorBS.trade_payables) || 0,
        other_payables: parseFloat(priorBS.other_payables) || 0,
        tax_payable: parseFloat(priorBS.tax_payable) || 0,
        // Equity
        share_capital: parseFloat(priorBS.share_capital) || 0,
        retained_profits: parseFloat(priorBS.retained_profits) || 0,
        reserves: parseFloat(priorBS.reserves) || 0,
      };
      // Pass subledger data for proper integration
      const subledgerData = {
        ppe: subledgerTotals.ppe,
        inventory: subledgerTotals.inventory,
        receivables: subledgerTotals.receivables,
        payables: subledgerTotals.payables,
        otherDebtors: subledgerTotals.otherDebtors,
        otherCreditors: subledgerTotals.otherCreditors,
        cashBank: subledgerTotals.cashBank,
        depreciation: subledgerTotals.ppe.currentDep,
        // Borrowings data
        shortTermBorrowings: subledgerTotals.shortTermBorrowings,
        longTermBorrowings: subledgerTotals.longTermBorrowings,
        hasSTBorrowings: subledgerTotals.hasSTBorrowings,
        hasLTBorrowings: subledgerTotals.hasLTBorrowings,
        borrowingsDrawdowns: subledgerTotals.borrowingsDrawdowns,
        borrowingsRepayments: subledgerTotals.borrowingsRepayments,
        stBorrOpening: subledgerTotals.stBorrOpening,
        ltBorrOpening: subledgerTotals.ltBorrOpening
      };
      
      // Generate base FS - combine bank transactions with cash vouchers
      const allTxs = [...txs, ...cashTxs];
      const fsResult = FSEngine.process(allTxs, ob, priorISData, priorBSData, calculateTax, subledgerData, priorISItems, priorBSItems);
      
      // Add tax computation details to result
      const taxDetail = calculateTaxDetailed(fsResult.is.pbt);
      fsResult.taxComputation = {
        pbt: fsResult.is.pbt,
        totalAddBack: computeTotalAddBack(),
        adjustedProfit: taxDetail.adjustedProfit,
        capitalAllowance: taxDetail.capitalAllowance,
        otherDeductions: taxDetail.totalDeductions - taxDetail.capitalAllowance,
        taxableIncome: taxDetail.taxableIncome,
        grossTax: taxDetail.grossTax,
        zakat: taxDetail.zakat,
        netTax: taxDetail.netTax,
        brackets: taxDetail.brackets
      };
      
      setRes(fsResult);
      setBusy(false);
      setTab('journal');
    }, 400);
  };
  
  // Generate full MASB-compliant Financial Statements
  const generateFullFS = (lang = 'EN') => {
    if (!res) {
      alert('Please generate financial statements first before exporting.');
      return null;
    }
    
    try {
      const coName = companyName || 'Company Name';
      const coReg = companyRegNo || '____________';
      const stdName = config?.fullStandard || 'Malaysian Private Entities Reporting Standard';
      const stdShort = config?.standard || 'MPERS';
      const taxInfo = config?.taxInfo || '24%';
      const coType = config?.name || 'Private Limited Company';
      
      // Labels based on language
      const isEN = lang === 'EN';
      const L = {
        title: isEN ? 'FINANCIAL STATEMENTS' : 'PENYATA KEWANGAN',
        forYear: isEN ? 'FOR THE FINANCIAL YEAR ENDED' : 'BAGI TAHUN KEWANGAN BERAKHIR',
        asAt: isEN ? 'AS AT' : 'PADA',
        regNo: isEN ? 'Registration No.' : 'No. Pendaftaran',
        contents: isEN ? 'CONTENTS' : 'KANDUNGAN',
        sofp: isEN ? 'STATEMENT OF FINANCIAL POSITION' : 'PENYATA KEDUDUKAN KEWANGAN',
        sopl: isEN ? 'STATEMENT OF PROFIT OR LOSS AND OTHER COMPREHENSIVE INCOME' : 'PENYATA UNTUNG RUGI DAN PENDAPATAN KOMPREHENSIF LAIN',
        soce: isEN ? 'STATEMENT OF CHANGES IN EQUITY' : 'PENYATA PERUBAHAN EKUITI',
        socf: isEN ? 'STATEMENT OF CASH FLOWS' : 'PENYATA ALIRAN TUNAI',
        notes: isEN ? 'NOTES TO THE FINANCIAL STATEMENTS' : 'NOTA-NOTA KEPADA PENYATA KEWANGAN',
        statementByDirectors: isEN ? 'STATEMENT BY DIRECTORS' : 'PENYATA PENGARAH',
        statutoryDeclaration: isEN ? 'STATUTORY DECLARATION' : 'AKUAN BERKANUN',
        revenue: isEN ? 'Revenue' : 'Hasil',
        costOfSales: isEN ? 'Cost of sales' : 'Kos jualan',
        grossProfit: isEN ? 'Gross profit' : 'Untung kasar',
        otherIncome: isEN ? 'Other income' : 'Pendapatan lain',
        adminExp: isEN ? 'Administrative expenses' : 'Perbelanjaan pentadbiran',
        finCosts: isEN ? 'Finance costs' : 'Kos kewangan',
        pbt: isEN ? 'Profit before taxation' : 'Untung sebelum cukai',
        tax: isEN ? 'Taxation' : 'Cukai',
        profitYear: isEN ? 'Profit for the financial year' : 'Untung bagi tahun kewangan',
        oci: isEN ? 'Other comprehensive income' : 'Pendapatan komprehensif lain',
        totalCI: isEN ? 'Total comprehensive income for the year' : 'Jumlah pendapatan komprehensif bagi tahun',
        assets: isEN ? 'ASSETS' : 'ASET',
        nca: isEN ? 'Non-Current Assets' : 'Aset Bukan Semasa',
        ppe: isEN ? 'Property, plant and equipment' : 'Hartanah, loji dan peralatan',
        ca: isEN ? 'Current Assets' : 'Aset Semasa',
        inventories: isEN ? 'Inventories' : 'Inventori',
        tradeRec: isEN ? 'Trade and other receivables' : 'Penghutang perdagangan dan lain-lain',
        cashBank: isEN ? 'Cash and bank balances' : 'Tunai dan baki bank',
        totalAssets: isEN ? 'TOTAL ASSETS' : 'JUMLAH ASET',
        equityLiab: isEN ? 'EQUITY AND LIABILITIES' : 'EKUITI DAN LIABILITI',
        equity: isEN ? 'Equity' : 'Ekuiti',
        shareCap: isEN ? 'Share capital' : 'Modal saham',
        retained: isEN ? 'Retained earnings' : 'Pendapatan tertahan',
        totalEquity: isEN ? 'Total Equity' : 'Jumlah Ekuiti',
        liabilities: isEN ? 'Liabilities' : 'Liabiliti',
        cl: isEN ? 'Current Liabilities' : 'Liabiliti Semasa',
        tradePay: isEN ? 'Trade and other payables' : 'Pemiutang perdagangan dan lain-lain',
        borrowings: isEN ? 'Borrowings' : 'Pinjaman',
        totalLiab: isEN ? 'Total Liabilities' : 'Jumlah Liabiliti',
        totalEL: isEN ? 'TOTAL EQUITY AND LIABILITIES' : 'JUMLAH EKUITI DAN LIABILITI',
        note: isEN ? 'Note' : 'Nota',
        rm: 'RM',
        balanceAt: isEN ? 'Balance at' : 'Baki pada',
        total: isEN ? 'Total' : 'Jumlah',
        notesIntegral: isEN ? 'The accompanying notes form an integral part of these financial statements.' : 'Nota-nota yang disertakan merupakan sebahagian daripada penyata kewangan ini.',
        incMalaysia: isEN ? 'Incorporated in Malaysia' : 'Diperbadankan di Malaysia',
        page: isEN ? 'Page' : 'Muka Surat',
      };
      
      const fmtNum = (n) => {
        if (n === undefined || n === null) return '-';
        return Number(n).toLocaleString('en-MY', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
      };
      
      const fmtBracket = (n) => {
        if (n === undefined || n === null) return '-';
        return n < 0 ? '(' + fmtNum(Math.abs(n)) + ')' : fmtNum(n);
      };
      
      // Build PPE rows if any
      let ppeRows = '';
      if (ppeRegister && ppeRegister.length > 0) {
        ppeRegister.forEach(item => {
          const dep = calculatePPEDepreciation(item);
          ppeRows += '<tr><td>' + (item.description || '-') + '</td>';
          ppeRows += '<td class="right">' + fmtNum(item.cost) + '</td>';
          ppeRows += '<td class="right">' + fmtNum(dep.accDepCF) + '</td>';
          ppeRows += '<td class="right">' + fmtNum(dep.nbv) + '</td></tr>';
        });
      }
      
      const html = '<!DOCTYPE html>' +
'<html lang="' + (isEN ? 'en' : 'ms') + '">' +
'<head>' +
'<meta charset="UTF-8">' +
'<meta name="viewport" content="width=device-width, initial-scale=1.0">' +
'<title>' + coName + ' - ' + L.title + ' ' + currentYear + '</title>' +
'<style>' +
'@page { size: A4; margin: 2cm; }' +
'@media print { .page { page-break-after: always; } .page:last-child { page-break-after: avoid; } }' +
'* { box-sizing: border-box; }' +
'body { font-family: "Times New Roman", Times, serif; font-size: 11pt; line-height: 1.5; color: #000; max-width: 210mm; margin: 0 auto; padding: 20px; }' +
'.page { page-break-after: always; page-break-inside: avoid; padding-bottom: 20px; margin-bottom: 20px; }' +
'.page:last-child { page-break-after: avoid; }' +
'.header { text-align: center; margin-bottom: 25px; page-break-after: avoid; }' +
'.header h1 { font-size: 14pt; font-weight: bold; margin: 0 0 5px 0; text-transform: uppercase; }' +
'.header h2 { font-size: 12pt; font-weight: bold; margin: 0 0 5px 0; text-transform: uppercase; }' +
'.header p { font-size: 11pt; margin: 3px 0; }' +
'.section-title { font-size: 11pt; font-weight: bold; text-transform: uppercase; margin: 20px 0 10px 0; page-break-after: avoid; }' +
'.subsection { font-size: 11pt; font-weight: bold; margin: 15px 0 8px 0; page-break-after: avoid; }' +
'table { width: 100%; border-collapse: collapse; margin: 10px 0; page-break-inside: avoid; }' +
'table.fs th, table.fs td { padding: 4px 8px; text-align: left; vertical-align: top; font-size: 10pt; }' +
'.right { text-align: right; }' +
'.center { text-align: center; }' +
'.bold { font-weight: bold; }' +
'.indent { padding-left: 15px; }' +
'.indent2 { padding-left: 30px; }' +
'.total td { border-top: 1px solid #000; font-weight: bold; }' +
'.double td { border-top: 2px solid #000; font-weight: bold; }' +
'.subtotal td { border-top: 1px solid #000; }' +
'.underline { border-bottom: 1px solid #000; }' +
'.note-text { font-size: 10pt; margin: 8px 0; text-align: justify; line-height: 1.6; }' +
'.note-table th, .note-table td { border: 1px solid #000; padding: 4px 6px; font-size: 9pt; }' +
'.note-table th { background: #f5f5f5; font-weight: bold; }' +
'.toc-item { display: flex; justify-content: space-between; padding: 5px 0; border-bottom: 1px dotted #ccc; }' +
'.company-header { text-align: right; font-size: 9pt; margin-bottom: 10px; color: #666; }' +
'.keep-together { page-break-inside: avoid; }' +
'</style>' +
'</head>' +
'<body>' +

// Cover Page
'<div class="page" style="display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center;">' +
'<div style="margin-bottom: 80px;">' +
'<h1 style="font-size: 22pt; margin-bottom: 15px; letter-spacing: 1px;">' + coName.toUpperCase() + '</h1>' +
'<p style="font-size: 11pt;">(' + L.regNo + ': ' + coReg + ')</p>' +
'<p style="font-size: 10pt; margin-top: 3px;">(' + L.incMalaysia + ')</p>' +
'</div>' +
'<div style="margin-bottom: 80px;">' +
'<h2 style="font-size: 18pt; font-weight: bold; letter-spacing: 2px;">' + L.title + '</h2>' +
'<p style="font-size: 12pt; margin-top: 25px;">' + L.forYear + '</p>' +
'<p style="font-size: 14pt; font-weight: bold; margin-top: 5px;">' + fyeDisplay.toUpperCase() + '</p>' +
'</div>' +
'<div style="margin-top: 60px;">' +
'<p style="font-size: 10pt; font-style: italic;">' + stdName + '</p>' +
'</div>' +
'</div>' +

// Contents Page
'<div class="page">' +
'<div class="header"><h1>' + coName.toUpperCase() + '</h1></div>' +
'<h2 style="text-align:center; margin-bottom:30px;">' + L.contents + '</h2>' +
'<div style="max-width:400px; margin:0 auto;">' +
'<div class="toc-item"><span>' + L.sofp + '</span><span>3</span></div>' +
'<div class="toc-item"><span>' + L.sopl + '</span><span>4</span></div>' +
'<div class="toc-item"><span>' + L.soce + '</span><span>5</span></div>' +
'<div class="toc-item"><span>' + L.socf + '</span><span>6</span></div>' +
'<div class="toc-item"><span>' + L.notes + '</span><span>7 - 11</span></div>' +
'</div>' +
'</div>' +

// Statement of Financial Position
'<div class="page">' +
'<div class="company-header">' + coName.toUpperCase() + ' (' + coReg + ')</div>' +
'<div class="header">' +
'<h2>' + L.sofp + '</h2>' +
'<p>' + L.asAt + ' ' + fyeDisplay.toUpperCase() + '</p>' +
'</div>' +
'<table class="fs">' +
'<thead><tr><th style="width:50%"></th><th class="center" style="width:8%">' + L.note + '</th><th class="right" style="width:21%">' + currentYear + '<br>' + L.rm + '</th><th class="right" style="width:21%">' + priorFSYear + '<br>' + L.rm + '</th></tr></thead>' +
'<tbody>' +
'<tr><td class="bold">' + L.assets + '</td><td></td><td></td><td></td></tr>' +
'<tr><td class="bold indent">' + L.nca + '</td><td></td><td></td><td></td></tr>' +
'<tr><td class="indent2">' + L.ppe + '</td><td class="center">3</td><td class="right">' + fmtNum(res.bs.ppe) + '</td><td class="right">' + fmtNum(res.bs.py_ppe) + '</td></tr>' +
'<tr class="subtotal"><td></td><td></td><td class="right">' + fmtNum(res.bs.totNCA) + '</td><td class="right">' + fmtNum(res.bs.py_totNCA) + '</td></tr>' +
'<tr><td class="bold indent">' + L.ca + '</td><td></td><td></td><td></td></tr>' +
'<tr><td class="indent2">' + L.inventories + '</td><td class="center">4</td><td class="right">' + fmtNum(res.bs.inv) + '</td><td class="right">' + fmtNum(res.bs.py_inv) + '</td></tr>' +
'<tr><td class="indent2">' + L.tradeRec + '</td><td class="center">5</td><td class="right">' + fmtNum(res.bs.tr) + '</td><td class="right">' + fmtNum(res.bs.py_tr) + '</td></tr>' +
'<tr><td class="indent2">' + L.cashBank + '</td><td class="center">6</td><td class="right">' + fmtNum(res.bs.cash) + '</td><td class="right">' + fmtNum(res.bs.py_cash) + '</td></tr>' +
'<tr class="subtotal"><td></td><td></td><td class="right">' + fmtNum(res.bs.totCA) + '</td><td class="right">' + fmtNum(res.bs.py_totCA) + '</td></tr>' +
'<tr class="double"><td class="bold">' + L.totalAssets + '</td><td></td><td class="right">' + fmtNum(res.bs.totA) + '</td><td class="right">' + fmtNum(res.bs.py_totA) + '</td></tr>' +
'<tr><td colspan="4" style="height:15px"></td></tr>' +
'<tr><td class="bold">' + L.equityLiab + '</td><td></td><td></td><td></td></tr>' +
'<tr><td class="bold indent">' + L.equity + '</td><td></td><td></td><td></td></tr>' +
'<tr><td class="indent2">' + L.shareCap + '</td><td class="center">7</td><td class="right">' + fmtNum(res.bs.cap) + '</td><td class="right">' + fmtNum(res.bs.py_cap) + '</td></tr>' +
'<tr><td class="indent2">' + L.retained + '</td><td></td><td class="right">' + fmtNum(res.bs.ret + res.bs.cyp) + '</td><td class="right">' + fmtNum(res.bs.py_ret) + '</td></tr>' +
'<tr class="subtotal"><td class="bold indent">' + L.totalEquity + '</td><td></td><td class="right">' + fmtNum(res.bs.totE) + '</td><td class="right">' + fmtNum(res.bs.py_totE) + '</td></tr>' +
'<tr><td class="bold indent">' + L.cl + '</td><td></td><td></td><td></td></tr>' +
'<tr><td class="indent2">' + L.tradePay + '</td><td class="center">8</td><td class="right">' + fmtNum(res.bs.tp) + '</td><td class="right">' + fmtNum(res.bs.py_tp) + '</td></tr>' +
'<tr><td class="indent2">' + L.borrowings + '</td><td class="center">9</td><td class="right">' + fmtNum(res.bs.borr) + '</td><td class="right">' + fmtNum(res.bs.py_borr) + '</td></tr>' +
'<tr class="subtotal"><td class="bold indent">' + L.totalLiab + '</td><td></td><td class="right">' + fmtNum(res.bs.totL) + '</td><td class="right">' + fmtNum(res.bs.py_totL) + '</td></tr>' +
'<tr class="double"><td class="bold">' + L.totalEL + '</td><td></td><td class="right">' + fmtNum(res.bs.totE + res.bs.totL) + '</td><td class="right">' + fmtNum((res.bs.py_totE || 0) + (res.bs.py_totL || 0)) + '</td></tr>' +
'</tbody></table>' +
'<p style="font-size:9pt; margin-top:20px; font-style:italic">' + L.notesIntegral + '</p>' +
'</div>' +

// Statement of Profit or Loss
'<div class="page">' +
'<div class="company-header">' + coName.toUpperCase() + ' (' + coReg + ')</div>' +
'<div class="header">' +
'<h2>' + L.sopl + '</h2>' +
'<p>' + L.forYear + ' ' + fyeDisplay.toUpperCase() + '</p>' +
'</div>' +
'<table class="fs">' +
'<thead><tr><th style="width:50%"></th><th class="center" style="width:8%">' + L.note + '</th><th class="right" style="width:21%">' + currentYear + '<br>' + L.rm + '</th><th class="right" style="width:21%">' + priorFSYear + '<br>' + L.rm + '</th></tr></thead>' +
'<tbody>' +
'<tr><td>' + L.revenue + '</td><td class="center">10</td><td class="right">' + fmtNum(res.is.rev) + '</td><td class="right">' + fmtNum(res.is.py_rev) + '</td></tr>' +
'<tr><td>' + L.costOfSales + '</td><td></td><td class="right">' + fmtBracket(-res.is.cos) + '</td><td class="right">' + fmtBracket(-(res.is.py_cos || 0)) + '</td></tr>' +
'<tr class="subtotal"><td class="bold">' + L.grossProfit + '</td><td></td><td class="right">' + fmtNum(res.is.gp) + '</td><td class="right">' + fmtNum(res.is.py_gp) + '</td></tr>' +
'<tr><td>' + L.otherIncome + '</td><td></td><td class="right">' + fmtNum(res.is.oi) + '</td><td class="right">' + fmtNum(res.is.py_oi) + '</td></tr>' +
'<tr><td>' + L.adminExp + '</td><td class="center">11</td><td class="right">' + fmtBracket(-res.is.adm) + '</td><td class="right">' + fmtBracket(-(res.is.py_adm || 0)) + '</td></tr>' +
'<tr><td>' + L.finCosts + '</td><td class="center">12</td><td class="right">' + fmtBracket(-res.is.fin) + '</td><td class="right">' + fmtBracket(-(res.is.py_fin || 0)) + '</td></tr>' +
'<tr class="subtotal"><td class="bold">' + L.pbt + '</td><td></td><td class="right">' + fmtNum(res.is.pbt) + '</td><td class="right">' + fmtNum(res.is.py_pbt) + '</td></tr>' +
'<tr><td>' + L.tax + '</td><td class="center">13</td><td class="right">' + fmtBracket(-res.is.tax) + '</td><td class="right">' + fmtBracket(-(res.is.py_tax || 0)) + '</td></tr>' +
'<tr class="subtotal"><td class="bold">' + L.profitYear + '</td><td></td><td class="right">' + fmtNum(res.is.np) + '</td><td class="right">' + fmtNum(res.is.py_np) + '</td></tr>' +
'<tr><td>' + L.oci + '</td><td></td><td class="right">-</td><td class="right">-</td></tr>' +
'<tr class="double"><td class="bold">' + L.totalCI + '</td><td></td><td class="right">' + fmtNum(res.is.np) + '</td><td class="right">' + fmtNum(res.is.py_np) + '</td></tr>' +
'</tbody></table>' +
'<p style="font-size:9pt; margin-top:20px; font-style:italic">' + L.notesIntegral + '</p>' +
'</div>' +

// Statement of Changes in Equity
'<div class="page">' +
'<div class="company-header">' + coName.toUpperCase() + ' (' + coReg + ')</div>' +
'<div class="header">' +
'<h2>' + L.soce + '</h2>' +
'<p>' + L.forYear + ' ' + fyeDisplay.toUpperCase() + '</p>' +
'</div>' +
'<table class="fs">' +
'<thead><tr><th style="width:40%"></th><th class="right" style="width:20%">' + L.shareCap + '<br>' + L.rm + '</th><th class="right" style="width:20%">' + L.retained + '<br>' + L.rm + '</th><th class="right" style="width:20%">' + L.total + '<br>' + L.rm + '</th></tr></thead>' +
'<tbody>' +
'<tr><td>' + L.balanceAt + ' 1.1.' + priorFSYear + '</td><td class="right">' + fmtNum(res.bs.py_cap) + '</td><td class="right">' + fmtNum((res.bs.py_ret || 0) - (res.is.py_np || 0)) + '</td><td class="right">' + fmtNum((res.bs.py_totE || 0) - (res.is.py_np || 0)) + '</td></tr>' +
'<tr><td class="indent">' + L.profitYear + '</td><td class="right">-</td><td class="right">' + fmtNum(res.is.py_np) + '</td><td class="right">' + fmtNum(res.is.py_np) + '</td></tr>' +
'<tr><td class="indent">' + L.totalCI + '</td><td class="right">-</td><td class="right">' + fmtNum(res.is.py_np) + '</td><td class="right">' + fmtNum(res.is.py_np) + '</td></tr>' +
'<tr class="subtotal"><td class="bold">' + L.balanceAt + ' 31.12.' + priorFSYear + '</td><td class="right">' + fmtNum(res.bs.py_cap) + '</td><td class="right">' + fmtNum(res.bs.py_ret) + '</td><td class="right">' + fmtNum(res.bs.py_totE) + '</td></tr>' +
'<tr><td class="indent">' + L.profitYear + '</td><td class="right">-</td><td class="right">' + fmtNum(res.is.np) + '</td><td class="right">' + fmtNum(res.is.np) + '</td></tr>' +
'<tr><td class="indent">' + L.totalCI + '</td><td class="right">-</td><td class="right">' + fmtNum(res.is.np) + '</td><td class="right">' + fmtNum(res.is.np) + '</td></tr>' +
'<tr class="double"><td class="bold">' + L.balanceAt + ' 31.12.' + currentYear + '</td><td class="right">' + fmtNum(res.bs.cap) + '</td><td class="right">' + fmtNum(res.bs.ret + res.bs.cyp) + '</td><td class="right">' + fmtNum(res.bs.totE) + '</td></tr>' +
'</tbody></table>' +
'<p style="font-size:9pt; margin-top:20px; font-style:italic">' + L.notesIntegral + '</p>' +
'</div>' +

// Statement of Cash Flows
'<div class="page">' +
'<div class="company-header">' + coName.toUpperCase() + ' (' + coReg + ')</div>' +
'<div class="header">' +
'<h2>' + L.socf + '</h2>' +
'<p>' + L.forYear + ' ' + fyeDisplay.toUpperCase() + '</p>' +
'</div>' +
'<table class="fs">' +
'<thead><tr><th style="width:70%"></th><th class="right" style="width:15%">' + currentYear + '<br>' + L.rm + '</th><th class="right" style="width:15%">' + priorFSYear + '<br>' + L.rm + '</th></tr></thead>' +
'<tbody>' +
// Operating Activities
'<tr><td class="bold">' + (isEN ? 'CASH FLOWS FROM OPERATING ACTIVITIES' : 'ALIRAN TUNAI DARIPADA AKTIVITI OPERASI') + '</td><td></td><td></td></tr>' +
'<tr><td class="indent">' + (isEN ? 'Profit before taxation' : 'Untung sebelum cukai') + '</td><td class="right">' + fmtNum(res.cf.pbt) + '</td><td class="right">' + fmtNum(res.is.py_pbt || 0) + '</td></tr>' +
'<tr><td class="indent">' + (isEN ? 'Adjustments for:' : 'Pelarasan untuk:') + '</td><td></td><td></td></tr>' +
'<tr><td class="indent2">' + (isEN ? 'Depreciation' : 'Susut nilai') + '</td><td class="right">' + fmtNum(res.cf.adjustments.depreciation) + '</td><td class="right">-</td></tr>' +
'<tr><td class="indent2">' + (isEN ? 'Interest expense' : 'Perbelanjaan faedah') + '</td><td class="right">' + fmtNum(res.cf.adjustments.interestExpense) + '</td><td class="right">-</td></tr>' +
(res.cf.adjustments.interestIncome !== 0 ? '<tr><td class="indent2">' + (isEN ? 'Interest income' : 'Pendapatan faedah') + '</td><td class="right">' + fmtBracket(res.cf.adjustments.interestIncome) + '</td><td class="right">-</td></tr>' : '') +
'<tr class="subtotal"><td class="indent">' + (isEN ? 'Operating profit before working capital changes' : 'Keuntungan operasi sebelum perubahan modal kerja') + '</td><td class="right">' + fmtNum(res.cf.pbt + res.cf.totalAdjustments) + '</td><td class="right">-</td></tr>' +
'<tr><td class="indent">' + (isEN ? 'Changes in working capital:' : 'Perubahan dalam modal kerja:') + '</td><td></td><td></td></tr>' +
(res.cf.workingCapitalChanges.inventory !== 0 ? '<tr><td class="indent2">' + (isEN ? '(Increase)/Decrease in inventories' : '(Pertambahan)/Pengurangan dalam inventori') + '</td><td class="right">' + fmtBracket(res.cf.workingCapitalChanges.inventory) + '</td><td class="right">-</td></tr>' : '') +
(res.cf.workingCapitalChanges.tradeReceivables !== 0 ? '<tr><td class="indent2">' + (isEN ? '(Increase)/Decrease in trade receivables' : '(Pertambahan)/Pengurangan dalam penghutang perdagangan') + '</td><td class="right">' + fmtBracket(res.cf.workingCapitalChanges.tradeReceivables) + '</td><td class="right">-</td></tr>' : '') +
(res.cf.workingCapitalChanges.otherReceivables !== 0 ? '<tr><td class="indent2">' + (isEN ? '(Increase)/Decrease in other receivables' : '(Pertambahan)/Pengurangan dalam penghutang lain') + '</td><td class="right">' + fmtBracket(res.cf.workingCapitalChanges.otherReceivables) + '</td><td class="right">-</td></tr>' : '') +
(res.cf.workingCapitalChanges.tradePayables !== 0 ? '<tr><td class="indent2">' + (isEN ? 'Increase/(Decrease) in trade payables' : 'Pertambahan/(Pengurangan) dalam pemiutang perdagangan') + '</td><td class="right">' + fmtBracket(res.cf.workingCapitalChanges.tradePayables) + '</td><td class="right">-</td></tr>' : '') +
(res.cf.workingCapitalChanges.otherPayables !== 0 ? '<tr><td class="indent2">' + (isEN ? 'Increase/(Decrease) in other payables' : 'Pertambahan/(Pengurangan) dalam pemiutang lain') + '</td><td class="right">' + fmtBracket(res.cf.workingCapitalChanges.otherPayables) + '</td><td class="right">-</td></tr>' : '') +
'<tr class="subtotal"><td class="indent bold">' + (isEN ? 'Cash generated from operations' : 'Tunai dijana daripada operasi') + '</td><td class="right">' + fmtNum(res.cf.cashFromOperations) + '</td><td class="right">-</td></tr>' +
(res.cf.taxPaid !== 0 ? '<tr><td class="indent2">' + (isEN ? 'Tax paid' : 'Cukai dibayar') + '</td><td class="right">' + fmtBracket(res.cf.taxPaid) + '</td><td class="right">-</td></tr>' : '') +
(res.cf.interestPaid !== 0 ? '<tr><td class="indent2">' + (isEN ? 'Interest paid' : 'Faedah dibayar') + '</td><td class="right">' + fmtBracket(res.cf.interestPaid) + '</td><td class="right">-</td></tr>' : '') +
'<tr class="subtotal"><td class="bold">' + (isEN ? 'Net cash from operating activities' : 'Tunai bersih daripada aktiviti operasi') + '</td><td class="right bold">' + fmtNum(res.cf.netOperating) + '</td><td class="right">-</td></tr>' +
'<tr><td colspan="3" style="height:10px"></td></tr>' +
// Investing Activities
'<tr><td class="bold">' + (isEN ? 'CASH FLOWS FROM INVESTING ACTIVITIES' : 'ALIRAN TUNAI DARIPADA AKTIVITI PELABURAN') + '</td><td></td><td></td></tr>' +
(res.cf.ppePurchases !== 0 ? '<tr><td class="indent">' + (isEN ? 'Purchase of property, plant and equipment' : 'Pembelian hartanah, loji dan peralatan') + '</td><td class="right">' + fmtBracket(res.cf.ppePurchases) + '</td><td class="right">-</td></tr>' : '') +
(res.cf.ppeDisposals !== 0 ? '<tr><td class="indent">' + (isEN ? 'Proceeds from disposal of PPE' : 'Hasil daripada pelupusan PPE') + '</td><td class="right">' + fmtNum(res.cf.ppeDisposals) + '</td><td class="right">-</td></tr>' : '') +
(res.cf.investmentPurchases !== 0 ? '<tr><td class="indent">' + (isEN ? 'Purchase of investments' : 'Pembelian pelaburan') + '</td><td class="right">' + fmtBracket(res.cf.investmentPurchases) + '</td><td class="right">-</td></tr>' : '') +
(res.cf.investmentDisposals !== 0 ? '<tr><td class="indent">' + (isEN ? 'Proceeds from disposal of investments' : 'Hasil daripada pelupusan pelaburan') + '</td><td class="right">' + fmtNum(res.cf.investmentDisposals) + '</td><td class="right">-</td></tr>' : '') +
(res.cf.interestReceived !== 0 ? '<tr><td class="indent">' + (isEN ? 'Interest received' : 'Faedah diterima') + '</td><td class="right">' + fmtNum(res.cf.interestReceived) + '</td><td class="right">-</td></tr>' : '') +
(res.cf.netInvesting === 0 ? '<tr><td class="indent" style="font-style:italic;color:#666">' + (isEN ? 'No investing activities' : 'Tiada aktiviti pelaburan') + '</td><td class="right">-</td><td class="right">-</td></tr>' : '') +
'<tr class="subtotal"><td class="bold">' + (isEN ? 'Net cash from investing activities' : 'Tunai bersih daripada aktiviti pelaburan') + '</td><td class="right bold">' + fmtBracket(res.cf.netInvesting) + '</td><td class="right">-</td></tr>' +
'<tr><td colspan="3" style="height:10px"></td></tr>' +
// Financing Activities
'<tr><td class="bold">' + (isEN ? 'CASH FLOWS FROM FINANCING ACTIVITIES' : 'ALIRAN TUNAI DARIPADA AKTIVITI PEMBIAYAAN') + '</td><td></td><td></td></tr>' +
(res.cf.loanProceeds !== 0 ? '<tr><td class="indent">' + (isEN ? 'Proceeds from borrowings' : 'Penerimaan daripada pinjaman') + '</td><td class="right">' + fmtNum(res.cf.loanProceeds) + '</td><td class="right">-</td></tr>' : '') +
(res.cf.loanRepayments !== 0 ? '<tr><td class="indent">' + (isEN ? 'Repayment of borrowings' : 'Bayaran balik pinjaman') + '</td><td class="right">' + fmtBracket(res.cf.loanRepayments) + '</td><td class="right">-</td></tr>' : '') +
(res.cf.capitalInjection !== 0 ? '<tr><td class="indent">' + (isEN ? 'Capital injection / Share issuance' : 'Suntikan modal / Terbitan saham') + '</td><td class="right">' + fmtNum(res.cf.capitalInjection) + '</td><td class="right">-</td></tr>' : '') +
(res.cf.dividendsPaid !== 0 ? '<tr><td class="indent">' + (isEN ? 'Dividends paid' : 'Dividen dibayar') + '</td><td class="right">' + fmtBracket(res.cf.dividendsPaid) + '</td><td class="right">-</td></tr>' : '') +
(res.cf.drawingsWithdrawals !== 0 ? '<tr><td class="indent">' + (isEN ? 'Drawings / Withdrawals' : 'Pengeluaran') + '</td><td class="right">' + fmtBracket(res.cf.drawingsWithdrawals) + '</td><td class="right">-</td></tr>' : '') +
(res.cf.netFinancing === 0 ? '<tr><td class="indent" style="font-style:italic;color:#666">' + (isEN ? 'No financing activities' : 'Tiada aktiviti pembiayaan') + '</td><td class="right">-</td><td class="right">-</td></tr>' : '') +
'<tr class="subtotal"><td class="bold">' + (isEN ? 'Net cash from financing activities' : 'Tunai bersih daripada aktiviti pembiayaan') + '</td><td class="right bold">' + fmtBracket(res.cf.netFinancing) + '</td><td class="right">-</td></tr>' +
'<tr><td colspan="3" style="height:15px"></td></tr>' +
// Summary
'<tr class="subtotal"><td class="bold">' + (isEN ? 'Net increase/(decrease) in cash and cash equivalents' : 'Pertambahan/(Pengurangan) bersih dalam tunai dan setara tunai') + '</td><td class="right bold">' + fmtBracket(res.cf.netChangeInCash) + '</td><td class="right">-</td></tr>' +
'<tr><td>' + (isEN ? 'Cash and cash equivalents at beginning of year' : 'Tunai dan setara tunai pada awal tahun') + '</td><td class="right">' + fmtNum(res.cf.openingCash) + '</td><td class="right">' + fmtNum(res.bs.py_cash || 0) + '</td></tr>' +
'<tr class="double"><td class="bold">' + (isEN ? 'Cash and cash equivalents at end of year' : 'Tunai dan setara tunai pada akhir tahun') + '</td><td class="right bold">' + fmtNum(res.cf.closingCash) + '</td><td class="right">' + fmtNum(res.cf.openingCash) + '</td></tr>' +
'</tbody></table>' +
'<p style="font-size:9pt; margin-top:20px; font-style:italic">' + L.notesIntegral + '</p>' +
'</div>' +

// Notes to Financial Statements
'<div class="page">' +
'<div class="company-header">' + coName.toUpperCase() + ' (' + coReg + ')</div>' +
'<div class="header"><h2>' + L.notes + '</h2></div>' +

// Note 1 - Corporate Information
'<div class="section-title">1. ' + (isEN ? 'GENERAL INFORMATION' : 'MAKLUMAT AM') + '</div>' +
'<p class="note-text">' + coName + (isEN ? ' is a ' + coType.toLowerCase() + ', incorporated and domiciled in Malaysia.' : ' adalah sebuah ' + coType.toLowerCase() + ', diperbadankan dan bermastautin di Malaysia.') + '</p>' +
'<p class="note-text">' + (isEN ? 'The registered office of the Company is located in Malaysia.' : 'Pejabat berdaftar Syarikat terletak di Malaysia.') + '</p>' +
'<p class="note-text">' + (isEN ? 'The principal activities of the Company are ' : 'Aktiviti utama Syarikat adalah ') + (isEN ? 'general trading and provision of services.' : 'perdagangan am dan penyediaan perkhidmatan.') + '</p>' +
'<p class="note-text">' + (isEN ? 'The financial statements were authorised for issue by the Board of Directors on ' : 'Penyata kewangan ini telah diluluskan untuk diterbitkan oleh Lembaga Pengarah pada ') + new Date().toLocaleDateString(isEN ? 'en-MY' : 'ms-MY', { day: 'numeric', month: 'long', year: 'numeric' }) + '.</p>' +

// Note 2 - Basis of Preparation
'<div class="section-title">2. ' + (isEN ? 'BASIS OF PREPARATION' : 'ASAS PENYEDIAAN') + '</div>' +
'<p class="note-text"><strong>2.1 ' + (isEN ? 'Statement of compliance' : 'Penyata pematuhan') + '</strong></p>' +
'<p class="note-text">' + (isEN ? 'The financial statements of the Company have been prepared in accordance with ' + stdName + ' ("' + stdShort + '") and the requirements of the Companies Act 2016 in Malaysia.' : 'Penyata kewangan Syarikat telah disediakan mengikut ' + stdName + ' ("' + stdShort + '") dan keperluan Akta Syarikat 2016 di Malaysia.') + '</p>' +
'<p class="note-text"><strong>2.2 ' + (isEN ? 'Basis of measurement' : 'Asas pengukuran') + '</strong></p>' +
'<p class="note-text">' + (isEN ? 'The financial statements have been prepared on the historical cost basis.' : 'Penyata kewangan telah disediakan berdasarkan kos sejarah.') + '</p>' +
'<p class="note-text"><strong>2.3 ' + (isEN ? 'Functional and presentation currency' : 'Mata wang fungsian dan pembentangan') + '</strong></p>' +
'<p class="note-text">' + (isEN ? 'The financial statements are presented in Ringgit Malaysia ("RM"), which is the Company\'s functional currency.' : 'Penyata kewangan ini dibentangkan dalam Ringgit Malaysia ("RM"), iaitu mata wang fungsian Syarikat.') + '</p>' +
'</div>' +

// Notes Page 2 - Significant Accounting Policies
'<div class="page">' +
'<div class="company-header">' + coName.toUpperCase() + ' (' + coReg + ')</div>' +
'<div class="header"><h2>' + L.notes + ' (' + (isEN ? 'continued' : 'sambungan') + ')</h2></div>' +

// Note 3 - Significant Accounting Policies
'<div class="section-title">3. ' + (isEN ? 'SIGNIFICANT ACCOUNTING POLICIES' : 'DASAR PERAKAUNAN PENTING') + '</div>' +

// 3.1 Property, Plant and Equipment Policy
'<p class="note-text"><strong>3.1 ' + (isEN ? 'Property, plant and equipment' : 'Hartanah, loji dan peralatan') + '</strong></p>' +
'<p class="note-text">' + (isEN ? 'Property, plant and equipment are measured at cost less accumulated depreciation and any accumulated impairment losses.' : 'Hartanah, loji dan peralatan diukur pada kos ditolak susut nilai terkumpul dan kerugian rosot nilai terkumpul.') + '</p>' +
'<p class="note-text">' + (isEN ? 'Depreciation is calculated using the straight-line method to allocate the cost of assets over their estimated useful lives. The annual depreciation rates used are as follows:' : 'Susut nilai dikira menggunakan kaedah garis lurus untuk memperuntukkan kos aset sepanjang anggaran hayat berguna. Kadar susut nilai tahunan yang digunakan adalah seperti berikut:') + '</p>' +
'<table class="fs" style="margin:10px 0 10px 20px;width:90%"><tbody>' +
(res.bs.ppe > 0 ? (
// Only show categories that exist in the PPE register
(ppeRegister && ppeRegister.length > 0 ? 
  [...new Set(ppeRegister.map(p => p.category))].map(cat => {
    const catInfo = PPE_CATEGORIES[cat] || PPE_CATEGORIES['OFFICE_EQUIPMENT'];
    return '<tr><td style="width:60%">' + catInfo.label + '</td><td class="right">' + (catInfo.rate > 0 ? catInfo.rate + '%' : (isEN ? 'Not depreciated' : 'Tidak disusutnilaikan')) + '</td></tr>';
  }).join('') :
  // Default categories if no PPE register
  '<tr><td style="width:60%">' + (isEN ? 'Buildings' : 'Bangunan') + '</td><td class="right">2%</td></tr>' +
  '<tr><td>' + (isEN ? 'Renovation' : 'Pengubahsuaian') + '</td><td class="right">10%</td></tr>' +
  '<tr><td>' + (isEN ? 'Plant and machinery' : 'Loji dan jentera') + '</td><td class="right">10%</td></tr>' +
  '<tr><td>' + (isEN ? 'Motor vehicles' : 'Kenderaan bermotor') + '</td><td class="right">20%</td></tr>' +
  '<tr><td>' + (isEN ? 'Office equipment' : 'Peralatan pejabat') + '</td><td class="right">10%</td></tr>' +
  '<tr><td>' + (isEN ? 'Computer equipment' : 'Peralatan komputer') + '</td><td class="right">33.33%</td></tr>' +
  '<tr><td>' + (isEN ? 'Furniture and fittings' : 'Perabot dan kelengkapan') + '</td><td class="right">10%</td></tr>'
)
) : '') +
'</tbody></table>' +

// 3.2 Inventories Policy
'<p class="note-text"><strong>3.2 ' + (isEN ? 'Inventories' : 'Inventori') + '</strong></p>' +
'<p class="note-text">' + (isEN ? 'Inventories are measured at the lower of cost and net realisable value. Cost is determined using the first-in, first-out (FIFO) method.' : 'Inventori diukur pada kos atau nilai boleh realis bersih yang lebih rendah. Kos ditentukan menggunakan kaedah masuk-dahulu-keluar-dahulu (FIFO).') + '</p>' +

// 3.3 Financial Instruments Policy
'<p class="note-text"><strong>3.3 ' + (isEN ? 'Financial instruments' : 'Instrumen kewangan') + '</strong></p>' +
'<p class="note-text">' + (isEN ? 'Financial assets and liabilities are recognised when the Company becomes a party to the contractual provisions. Trade receivables and payables are initially measured at the transaction price and subsequently at amortised cost.' : 'Aset dan liabiliti kewangan diiktiraf apabila Syarikat menjadi pihak kepada peruntukan kontrak. Penghutang dan pemiutang perdagangan diukur pada mulanya pada harga transaksi dan seterusnya pada kos terlunas.') + '</p>' +

// 3.4 Revenue Recognition Policy
'<p class="note-text"><strong>3.4 ' + (isEN ? 'Revenue recognition' : 'Pengiktirafan hasil') + '</strong></p>' +
'<p class="note-text">' + (isEN ? 'Revenue is measured at the fair value of the consideration received or receivable. Revenue from sale of goods is recognised when the significant risks and rewards of ownership have been transferred to the buyer. Revenue from services is recognised when the services are rendered.' : 'Hasil diukur pada nilai saksama balasan yang diterima atau akan diterima. Hasil daripada jualan barangan diiktiraf apabila risiko dan ganjaran pemilikan yang ketara telah dipindahkan kepada pembeli. Hasil daripada perkhidmatan diiktiraf apabila perkhidmatan diberikan.') + '</p>' +
'</div>' +

// Notes Page 3 - PPE Details
'<div class="page">' +
'<div class="company-header">' + coName.toUpperCase() + ' (' + coReg + ')</div>' +
'<div class="header"><h2>' + L.notes + ' (' + (isEN ? 'continued' : 'sambungan') + ')</h2></div>' +

// Note 4 - Property, Plant and Equipment Details
'<div class="section-title">4. ' + (isEN ? 'PROPERTY, PLANT AND EQUIPMENT' : 'HARTANAH, LOJI DAN PERALATAN') + '</div>' +
(ppeRegister && ppeRegister.length > 0 ? (
'<table class="note-table"><thead><tr><th style="width:35%">' + (isEN ? 'Description' : 'Keterangan') + '</th><th class="right" style="width:15%">' + (isEN ? 'Cost' : 'Kos') + '<br>RM</th><th class="right" style="width:20%">' + (isEN ? 'Accumulated Depreciation' : 'Susut Nilai Terkumpul') + '<br>RM</th><th class="right" style="width:15%">' + (isEN ? 'Net Book Value' : 'Nilai Buku Bersih') + '<br>RM</th><th class="right" style="width:15%">' + (isEN ? 'Rate' : 'Kadar') + '<br>%</th></tr></thead><tbody>' +
ppeRegister.map(item => {
  const categoryInfo = PPE_CATEGORIES[item.category] || PPE_CATEGORIES['OFFICE_EQUIPMENT'];
  const cost = parseFloat(item.cost) || 0;
  const accDepBF = parseFloat(item.accDepBF) || 0;
  const currentDep = Math.min(cost * (categoryInfo.rate / 100), cost - accDepBF);
  const accDepCF = accDepBF + currentDep;
  const nbv = cost - accDepCF;
  return '<tr><td>' + (item.description || '-') + '</td><td class="right">' + fmtNum(cost) + '</td><td class="right">' + fmtNum(accDepCF) + '</td><td class="right">' + fmtNum(nbv) + '</td><td class="right">' + categoryInfo.rate + '</td></tr>';
}).join('') +
'<tr style="font-weight:bold;border-top:2px solid #000"><td>' + (isEN ? 'Total' : 'Jumlah') + '</td><td class="right">' + fmtNum(subledgerTotals.ppe.cost) + '</td><td class="right">' + fmtNum(subledgerTotals.ppe.accDepCF) + '</td><td class="right">' + fmtNum(subledgerTotals.ppe.nbv) + '</td><td></td></tr>' +
'</tbody></table>'
) : (
'<table class="fs"><tbody>' +
'<tr><td style="width:60%">' + (isEN ? 'At cost' : 'Pada kos') + '</td><td class="right">' + fmtNum((res.bs.ppe || 0) + (res.bs.accDep || 0)) + '</td></tr>' +
'<tr><td>' + (isEN ? 'Less: Accumulated depreciation' : 'Tolak: Susut nilai terkumpul') + '</td><td class="right">(' + fmtNum(res.bs.accDep || 0) + ')</td></tr>' +
'<tr style="border-top:1px solid #000"><td class="bold">' + (isEN ? 'Net book value' : 'Nilai buku bersih') + '</td><td class="right bold">' + fmtNum(res.bs.ppe) + '</td></tr>' +
'</tbody></table>'
)) +
'<p class="note-text" style="margin-top:10px">' + (isEN ? 'Depreciation charge for the year: RM ' + fmtNum(subledgerTotals.ppe.currentDep || res.is.details['DEPRECIATION'] || 0) : 'Caj susut nilai bagi tahun: RM ' + fmtNum(subledgerTotals.ppe.currentDep || res.is.details['DEPRECIATION'] || 0)) + '</p>' +

// Note 5 - Inventories
'<div class="section-title">5. ' + (isEN ? 'INVENTORIES' : 'INVENTORI') + '</div>' +
'<table class="fs"><tbody>' +
'<tr><td style="width:60%">' + (isEN ? 'Trading goods / Finished goods' : 'Barang dagangan / Barang siap') + '</td><td class="right">' + fmtNum(res.bs.inv) + '</td></tr>' +
'</tbody></table>' +
(res.bs.inv > 0 ? '<p class="note-text">' + (isEN ? 'Inventories are stated at the lower of cost and net realisable value.' : 'Inventori dinyatakan pada kos atau nilai boleh realis bersih yang lebih rendah.') + '</p>' : '') +

// Note 6 - Trade and Other Receivables
'<div class="section-title">6. ' + (isEN ? 'TRADE AND OTHER RECEIVABLES' : 'PENGHUTANG PERDAGANGAN DAN LAIN-LAIN') + '</div>' +
'<table class="fs"><tbody>' +
'<tr><td style="width:60%">' + (isEN ? 'Trade receivables' : 'Penghutang perdagangan') + '</td><td class="right">' + fmtNum(res.bs.tr) + '</td></tr>' +
(res.bs.or > 0 ? '<tr><td>' + (isEN ? 'Other receivables' : 'Penghutang lain') + '</td><td class="right">' + fmtNum(res.bs.or) + '</td></tr>' : '') +
(res.bs.prepaid > 0 ? '<tr><td>' + (isEN ? 'Prepayments' : 'Bayaran terdahulu') + '</td><td class="right">' + fmtNum(res.bs.prepaid) + '</td></tr>' : '') +
(res.bs.deposits > 0 ? '<tr><td>' + (isEN ? 'Deposits' : 'Deposit') + '</td><td class="right">' + fmtNum(res.bs.deposits) + '</td></tr>' : '') +
'<tr style="border-top:1px solid #000"><td class="bold">' + (isEN ? 'Total' : 'Jumlah') + '</td><td class="right bold">' + fmtNum((res.bs.tr || 0) + (res.bs.or || 0) + (res.bs.prepaid || 0) + (res.bs.deposits || 0)) + '</td></tr>' +
'</tbody></table>' +
'</div>' +

// Notes Page 4 - Cash, Share Capital, Payables
'<div class="page">' +
'<div class="company-header">' + coName.toUpperCase() + ' (' + coReg + ')</div>' +
'<div class="header"><h2>' + L.notes + ' (' + (isEN ? 'continued' : 'sambungan') + ')</h2></div>' +

// Note 7 - Cash and Bank Balances
'<div class="section-title">7. ' + (isEN ? 'CASH AND BANK BALANCES' : 'TUNAI DAN BAKI BANK') + '</div>' +
'<table class="fs"><tbody>' +
'<tr><td style="width:60%">' + (isEN ? 'Cash in hand' : 'Tunai dalam tangan') + '</td><td class="right">' + fmtNum(res.bs.cashInHand || 0) + '</td></tr>' +
'<tr><td>' + (isEN ? 'Cash at bank' : 'Tunai di bank') + '</td><td class="right">' + fmtNum(res.bs.cash - (res.bs.cashInHand || 0)) + '</td></tr>' +
'<tr style="border-top:1px solid #000"><td class="bold">' + (isEN ? 'Total' : 'Jumlah') + '</td><td class="right bold">' + fmtNum(res.bs.cash) + '</td></tr>' +
'</tbody></table>' +

// Note 8 - Share Capital
'<div class="section-title">8. ' + (isEN ? 'SHARE CAPITAL' : 'MODAL SAHAM') + '</div>' +
'<table class="fs"><tbody>' +
'<tr><td style="width:60%">' + (isEN ? 'Issued and fully paid:' : 'Diterbitkan dan berbayar penuh:') + '</td><td></td></tr>' +
'<tr><td class="indent">' + (isEN ? 'Ordinary shares' : 'Saham biasa') + '</td><td class="right">' + fmtNum(res.bs.cap) + '</td></tr>' +
'</tbody></table>' +

// Note 9 - Trade and Other Payables
'<div class="section-title">9. ' + (isEN ? 'TRADE AND OTHER PAYABLES' : 'PEMIUTANG PERDAGANGAN DAN LAIN-LAIN') + '</div>' +
'<table class="fs"><tbody>' +
'<tr><td style="width:60%">' + (isEN ? 'Trade payables' : 'Pemiutang perdagangan') + '</td><td class="right">' + fmtNum(res.bs.tp) + '</td></tr>' +
(res.bs.op > 0 ? '<tr><td>' + (isEN ? 'Other payables and accruals' : 'Pemiutang lain dan akruan') + '</td><td class="right">' + fmtNum(res.bs.op) + '</td></tr>' : '') +
'<tr style="border-top:1px solid #000"><td class="bold">' + (isEN ? 'Total' : 'Jumlah') + '</td><td class="right bold">' + fmtNum((res.bs.tp || 0) + (res.bs.op || 0)) + '</td></tr>' +
'</tbody></table>' +

// Note 10 - Borrowings (if any)
(res.bs.borr > 0 ? 
'<div class="section-title">10. ' + (isEN ? 'BORROWINGS' : 'PINJAMAN') + '</div>' +
'<table class="fs"><tbody>' +
'<tr><td style="width:60%">' + (isEN ? 'Bank loan - secured' : 'Pinjaman bank - bercagar') + '</td><td class="right">' + fmtNum(res.bs.borr) + '</td></tr>' +
'</tbody></table>' +
'<p class="note-text">' + (isEN ? 'The bank loan is secured by a charge over the Company\'s assets.' : 'Pinjaman bank dijamin oleh gadaian ke atas aset Syarikat.') + '</p>'
: '') +
'</div>' +

// Notes Page 5 - Revenue, Expenses, Tax
'<div class="page">' +
'<div class="company-header">' + coName.toUpperCase() + ' (' + coReg + ')</div>' +
'<div class="header"><h2>' + L.notes + ' (' + (isEN ? 'continued' : 'sambungan') + ')</h2></div>' +

// Note 11 - Revenue
'<div class="section-title">' + (res.bs.borr > 0 ? '11' : '10') + '. ' + (isEN ? 'REVENUE' : 'HASIL') + '</div>' +
'<table class="fs"><tbody>' +
'<tr><td style="width:60%">' + (isEN ? 'Sale of goods' : 'Jualan barangan') + '</td><td class="right">' + fmtNum(res.is.details['SALES'] || res.is.rev) + '</td></tr>' +
(res.is.details['SERVICE_REVENUE'] > 0 ? '<tr><td>' + (isEN ? 'Rendering of services' : 'Pemberian perkhidmatan') + '</td><td class="right">' + fmtNum(res.is.details['SERVICE_REVENUE']) + '</td></tr>' : '') +
'<tr style="border-top:1px solid #000"><td class="bold">' + (isEN ? 'Total revenue' : 'Jumlah hasil') + '</td><td class="right bold">' + fmtNum(res.is.rev) + '</td></tr>' +
'</tbody></table>' +

// Note 12 - Cost of Sales
'<div class="section-title">' + (res.bs.borr > 0 ? '12' : '11') + '. ' + (isEN ? 'COST OF SALES' : 'KOS JUALAN') + '</div>' +
'<table class="fs"><tbody>' +
(res.is.details['OPENING_STOCK'] > 0 ? '<tr><td style="width:60%">' + (isEN ? 'Opening inventory' : 'Inventori awal') + '</td><td class="right">' + fmtNum(res.is.details['OPENING_STOCK']) + '</td></tr>' : '') +
'<tr><td style="width:60%">' + (isEN ? 'Purchases' : 'Belian') + '</td><td class="right">' + fmtNum(res.is.details['PURCHASE'] || res.is.cos) + '</td></tr>' +
(res.is.details['DIRECT_COSTS'] > 0 ? '<tr><td>' + (isEN ? 'Direct costs' : 'Kos langsung') + '</td><td class="right">' + fmtNum(res.is.details['DIRECT_COSTS']) + '</td></tr>' : '') +
(res.is.details['CLOSING_STOCK'] > 0 ? '<tr><td>' + (isEN ? 'Less: Closing inventory' : 'Tolak: Inventori akhir') + '</td><td class="right">(' + fmtNum(res.is.details['CLOSING_STOCK']) + ')</td></tr>' : '') +
'<tr style="border-top:1px solid #000"><td class="bold">' + (isEN ? 'Total cost of sales' : 'Jumlah kos jualan') + '</td><td class="right bold">' + fmtNum(res.is.cos) + '</td></tr>' +
'</tbody></table>' +

// Note 13 - Administrative Expenses
'<div class="section-title">' + (res.bs.borr > 0 ? '13' : '12') + '. ' + (isEN ? 'ADMINISTRATIVE EXPENSES' : 'PERBELANJAAN PENTADBIRAN') + '</div>' +
'<p class="note-text">' + (isEN ? 'Included in administrative expenses are:' : 'Termasuk dalam perbelanjaan pentadbiran adalah:') + '</p>' +
'<table class="fs"><tbody>' +
(res.is.details['SALARY'] > 0 ? '<tr><td style="width:60%">' + (isEN ? 'Staff costs (salaries, wages, EPF, SOCSO)' : 'Kos kakitangan (gaji, upah, KWSP, PERKESO)') + '</td><td class="right">' + fmtNum(res.is.details['SALARY'] + (res.is.details['EPF'] || 0) + (res.is.details['SOCSO'] || 0)) + '</td></tr>' : '') +
((subledgerTotals.ppe.currentDep || res.is.details['DEPRECIATION'] || 0) > 0 ? '<tr><td>' + (isEN ? 'Depreciation of property, plant and equipment' : 'Susut nilai hartanah, loji dan peralatan') + '</td><td class="right">' + fmtNum(subledgerTotals.ppe.currentDep || res.is.details['DEPRECIATION'] || 0) + '</td></tr>' : '') +
(res.is.details['RENT'] > 0 ? '<tr><td>' + (isEN ? 'Rental of premises' : 'Sewa premis') + '</td><td class="right">' + fmtNum(res.is.details['RENT']) + '</td></tr>' : '') +
(res.is.details['UTILITIES'] > 0 ? '<tr><td>' + (isEN ? 'Utilities' : 'Utiliti') + '</td><td class="right">' + fmtNum(res.is.details['UTILITIES']) + '</td></tr>' : '') +
(res.is.details['PROFESSIONAL_FEES'] > 0 ? '<tr><td>' + (isEN ? 'Professional fees' : 'Yuran profesional') + '</td><td class="right">' + fmtNum(res.is.details['PROFESSIONAL_FEES']) + '</td></tr>' : '') +
(res.is.details['MARKETING'] > 0 ? '<tr><td>' + (isEN ? 'Marketing and advertising' : 'Pemasaran dan pengiklanan') + '</td><td class="right">' + fmtNum(res.is.details['MARKETING']) + '</td></tr>' : '') +
(res.is.details['TRANSPORT'] > 0 ? '<tr><td>' + (isEN ? 'Transport and travelling' : 'Pengangkutan dan perjalanan') + '</td><td class="right">' + fmtNum(res.is.details['TRANSPORT']) + '</td></tr>' : '') +
(res.is.details['REPAIR_MAINTENANCE'] > 0 ? '<tr><td>' + (isEN ? 'Repairs and maintenance' : 'Pembaikan dan penyelenggaraan') + '</td><td class="right">' + fmtNum(res.is.details['REPAIR_MAINTENANCE']) + '</td></tr>' : '') +
(res.is.details['INSURANCE'] > 0 ? '<tr><td>' + (isEN ? 'Insurance' : 'Insurans') + '</td><td class="right">' + fmtNum(res.is.details['INSURANCE']) + '</td></tr>' : '') +
(res.is.details['BANK_CHARGES'] > 0 ? '<tr><td>' + (isEN ? 'Bank charges' : 'Caj bank') + '</td><td class="right">' + fmtNum(res.is.details['BANK_CHARGES']) + '</td></tr>' : '') +
(res.is.details['ENTERTAINMENT'] > 0 ? '<tr><td>' + (isEN ? 'Entertainment' : 'Keraian') + '</td><td class="right">' + fmtNum(res.is.details['ENTERTAINMENT']) + '</td></tr>' : '') +
// Calculate other expenses
(() => {
  const knownExp = (res.is.details['SALARY'] || 0) + (res.is.details['EPF'] || 0) + (res.is.details['SOCSO'] || 0) + 
    (subledgerTotals.ppe.currentDep || res.is.details['DEPRECIATION'] || 0) + (res.is.details['RENT'] || 0) + 
    (res.is.details['UTILITIES'] || 0) + (res.is.details['PROFESSIONAL_FEES'] || 0) + (res.is.details['MARKETING'] || 0) + 
    (res.is.details['TRANSPORT'] || 0) + (res.is.details['REPAIR_MAINTENANCE'] || 0) + (res.is.details['INSURANCE'] || 0) + 
    (res.is.details['BANK_CHARGES'] || 0) + (res.is.details['ENTERTAINMENT'] || 0);
  const other = (res.is.adm || 0) - knownExp;
  return other > 100 ? '<tr><td>' + (isEN ? 'Other expenses' : 'Perbelanjaan lain') + '</td><td class="right">' + fmtNum(Math.round(other)) + '</td></tr>' : '';
})() +
'<tr style="border-top:1px solid #000"><td class="bold">' + (isEN ? 'Total administrative expenses' : 'Jumlah perbelanjaan pentadbiran') + '</td><td class="right bold">' + fmtNum(res.is.adm) + '</td></tr>' +
'</tbody></table>' +
'</div>' +

// Notes Page 6 - Finance Costs, Tax, Related Parties
'<div class="page">' +
'<div class="company-header">' + coName.toUpperCase() + ' (' + coReg + ')</div>' +
'<div class="header"><h2>' + L.notes + ' (' + (isEN ? 'continued' : 'sambungan') + ')</h2></div>' +

// Note 14 - Finance Costs
(res.is.fin > 0 ?
'<div class="section-title">' + (res.bs.borr > 0 ? '14' : '13') + '. ' + (isEN ? 'FINANCE COSTS' : 'KOS KEWANGAN') + '</div>' +
'<table class="fs"><tbody>' +
'<tr><td style="width:60%">' + (isEN ? 'Interest expense on borrowings' : 'Perbelanjaan faedah atas pinjaman') + '</td><td class="right">' + fmtNum(res.is.fin) + '</td></tr>' +
'</tbody></table>'
: '') +

// Note 15 - Taxation
'<div class="section-title">' + (res.bs.borr > 0 ? (res.is.fin > 0 ? '15' : '14') : (res.is.fin > 0 ? '14' : '13')) + '. ' + (isEN ? 'TAXATION' : 'CUKAI') + '</div>' +
'<table class="fs"><tbody>' +
'<tr><td style="width:60%">' + (isEN ? 'Current tax' : 'Cukai semasa') + '</td><td class="right">' + fmtNum(res.is.tax) + '</td></tr>' +
'</tbody></table>' +
'<p class="note-text">' + (isEN ? 'Malaysian income tax is calculated at the statutory tax rate of ' + taxInfo + ' on the estimated chargeable income for the year.' : 'Cukai pendapatan Malaysia dikira pada kadar cukai berkanun sebanyak ' + taxInfo + ' ke atas anggaran pendapatan bercukai bagi tahun tersebut.') + '</p>' +

// Tax Computation Schedule
'<p class="note-text"><strong>' + (isEN ? 'Tax Computation:' : 'Pengiraan Cukai:') + '</strong></p>' +
'<table class="fs"><tbody>' +
'<tr><td style="width:60%">' + (isEN ? 'Profit/(Loss) before taxation' : 'Untung/(Rugi) sebelum cukai') + '</td><td class="right">' + fmtNum(res.is.pbt) + '</td></tr>' +
(res.taxComputation?.totalAddBack > 0 ? '<tr><td>' + (isEN ? 'Add: Non-deductible expenses' : 'Tambah: Perbelanjaan tidak dibenarkan') + '</td><td class="right">' + fmtNum(res.taxComputation.totalAddBack) + '</td></tr>' : '') +
'<tr><td><strong>' + (isEN ? 'Adjusted profit' : 'Keuntungan terlaras') + '</strong></td><td class="right"><strong>' + fmtNum(res.taxComputation?.adjustedProfit || res.is.pbt) + '</strong></td></tr>' +
(res.taxComputation?.capitalAllowance > 0 ? '<tr><td>' + (isEN ? 'Less: Capital allowance' : 'Tolak: Elaun modal') + '</td><td class="right">(' + fmtNum(res.taxComputation.capitalAllowance) + ')</td></tr>' : '') +
(res.taxComputation?.otherDeductions > 0 ? '<tr><td>' + (isEN ? 'Less: Other deductions/reliefs' : 'Tolak: Potongan/pelepasan lain') + '</td><td class="right">(' + fmtNum(res.taxComputation.otherDeductions) + ')</td></tr>' : '') +
'<tr><td><strong>' + (isEN ? 'Chargeable income' : 'Pendapatan bercukai') + '</strong></td><td class="right"><strong>' + fmtNum(res.taxComputation?.taxableIncome || Math.max(0, res.is.pbt)) + '</strong></td></tr>' +
'<tr><td>' + (isEN ? 'Tax at statutory rate' : 'Cukai pada kadar berkanun') + '</td><td class="right">' + fmtNum(res.taxComputation?.grossTax || res.is.tax) + '</td></tr>' +
(res.taxComputation?.zakat > 0 ? '<tr><td>' + (isEN ? 'Less: Zakat rebate' : 'Tolak: Rebat zakat') + '</td><td class="right">(' + fmtNum(res.taxComputation.zakat) + ')</td></tr>' : '') +
'<tr style="border-top: 2px solid #000;"><td><strong>' + (isEN ? 'Tax payable' : 'Cukai kena bayar') + '</strong></td><td class="right"><strong>' + fmtNum(res.is.tax) + '</strong></td></tr>' +
'</tbody></table>' +

(isEN ? '<p class="note-text">A reconciliation of income tax expense applicable to profit before taxation at the statutory income tax rate to income tax expense at the effective income tax rate of the Company is not presented as there are no material reconciling items.</p>' : '<p class="note-text">Penyesuaian perbelanjaan cukai pendapatan yang berkenaan dengan keuntungan sebelum cukai pada kadar cukai berkanun kepada perbelanjaan cukai pendapatan pada kadar cukai efektif Syarikat tidak dibentangkan kerana tiada item penyesuaian yang material.</p>') +

// Note 16 - Related Party Disclosures
'<div class="section-title">' + (res.bs.borr > 0 ? (res.is.fin > 0 ? '16' : '15') : (res.is.fin > 0 ? '15' : '14')) + '. ' + (isEN ? 'RELATED PARTY DISCLOSURES' : 'PENDEDAHAN PIHAK BERKAITAN') + '</div>' +
'<p class="note-text"><strong>(a) ' + (isEN ? 'Identities of related parties' : 'Identiti pihak berkaitan') + '</strong></p>' +
'<p class="note-text">' + (isEN ? 'The Company has related party relationships with its directors and key management personnel.' : 'Syarikat mempunyai hubungan pihak berkaitan dengan pengarahnya dan kakitangan pengurusan utama.') + '</p>' +
'<p class="note-text"><strong>(b) ' + (isEN ? 'Key management personnel compensation' : 'Pampasan kakitangan pengurusan utama') + '</strong></p>' +
'<table class="fs"><tbody>' +
'<tr><td style="width:60%">' + (isEN ? 'Directors\' remuneration' : 'Imbuhan pengarah') + '</td><td class="right">' + fmtNum(res.is.details['DIRECTOR_FEE'] || Math.round((res.is.adm || 0) * 0.15)) + '</td></tr>' +
'</tbody></table>' +
'<p class="note-text">' + (isEN ? 'The remuneration of directors is determined by the shareholders having regard to the performance of individuals and market trends.' : 'Imbuhan pengarah ditentukan oleh pemegang saham dengan mengambil kira prestasi individu dan trend pasaran.') + '</p>' +

// Note 17 - Auditors' Remuneration
'<div class="section-title">' + (res.bs.borr > 0 ? (res.is.fin > 0 ? '17' : '16') : (res.is.fin > 0 ? '16' : '15')) + '. ' + (isEN ? 'AUDITORS\' REMUNERATION' : 'IMBUHAN JURUAUDIT') + '</div>' +
'<table class="fs"><tbody>' +
'<tr><td style="width:60%">' + (isEN ? 'Statutory audit fees' : 'Yuran audit berkanun') + '</td><td class="right">' + fmtNum(res.is.details['AUDIT_FEE'] || Math.round((res.is.adm || 0) * 0.02)) + '</td></tr>' +
'</tbody></table>' +
'</div>' +

'</body></html>';
      
      return html;
    } catch (err) {
      console.error('Error generating FS:', err);
      alert('Error generating financial statements: ' + err.message);
      return null;
    }
  };
  
  // ============================================
  // PROFESSIONAL WORD DOCUMENT GENERATOR (HTML-based)
  // Word-stable with proper borders on amount columns only
  // ============================================
  
  // Escape HTML helper
  const escapeHtml = (s) => String(s || '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  
  // Word CSS - professional formatting
  const WORD_CSS = `
@page { size: A4; margin: 2cm; }
body { font-family: "Times New Roman", Times, serif; font-size: 11pt; color: #000; line-height: 1.4; }
h1, h2, h3 { margin: 0; padding: 0; }
.p-center { text-align: center; }
.small { font-size: 10pt; }
.muted { color: #333; }
.sp-1 { margin-top: 6pt; }
.sp-2 { margin-top: 12pt; }
.sp-3 { margin-top: 18pt; }

/* Page blocks */
.page { page-break-after: always; }
.page:last-child { page-break-after: auto; }

/* Word page break hint */
.w-pb { mso-special-character: line-break; page-break-before: always; }

/* Financial Statement Tables */
table.fs { width: 100%; border-collapse: separate; border-spacing: 0; table-layout: fixed; margin: 10pt 0; }
table.fs th, table.fs td { padding: 3pt 5pt; vertical-align: top; border: none; }
table.fs thead th { font-weight: bold; text-align: center; }
.desc { text-align: left; }
.note { text-align: center; width: 8%; }
.amt { text-align: right; white-space: nowrap; }
.bold { font-weight: bold; }
.ind1 { padding-left: 15pt !important; }
.ind2 { padding-left: 30pt !important; }

/* Lines ONLY under amount columns - inner div prevents border bleed */
.amt-line-top > div { border-top: 1px solid #000; padding-top: 2pt; }
.amt-line-bottom > div { border-bottom: 1px solid #000; padding-bottom: 2pt; }
.amt-line-double > div { border-bottom: 3px double #000; padding-bottom: 2pt; }

/* Header row bottom border */
.hdr-border > div { border-bottom: 1px solid #000; padding-bottom: 3pt; font-weight: bold; }

/* Notes tables */
table.noteTbl { width: 100%; border-collapse: separate; border-spacing: 0; table-layout: fixed; margin: 8pt 0; }
table.noteTbl th, table.noteTbl td { padding: 2pt 4pt; border: none; vertical-align: top; }

/* Section headers */
.section-title { font-size: 12pt; font-weight: bold; text-align: center; margin: 15pt 0 10pt 0; text-transform: uppercase; }
.section-subtitle { font-size: 11pt; text-align: center; margin-bottom: 15pt; }

/* Integral notes text */
.integral-note { font-size: 9pt; font-style: italic; text-align: center; margin-top: 20pt; color: #333; }

/* Note section styling */
.note-title { font-size: 11pt; font-weight: bold; margin: 15pt 0 8pt 0; }
.note-text { margin: 5pt 0 10pt 0; text-align: justify; }
`;

  // Wrap HTML for Word
  const wrapWordHtml = ({ title, bodyHtml }) => {
    return `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:w="urn:schemas-microsoft-com:office:word"
      xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="utf-8"/>
<meta http-equiv="Content-Type" content="text/html; charset=utf-8"/>
<meta name="ProgId" content="Word.Document"/>
<meta name="Generator" content="FS Automation V8"/>
<title>${escapeHtml(title)}</title>
<style>${WORD_CSS}</style>
</head>
<body>
${bodyHtml}
</body>
</html>`.trim();
  };

  // Generate Professional Word Document
  const generateProfessionalWordDoc = (lang = 'EN') => {
    if (!res) return null;
    
    const coName = companyName || 'Company Name';
    const coReg = companyRegNo || '____________';
    const isEN = lang === 'EN';
    const stdName = config?.fullStandard || 'Malaysian Private Entities Reporting Standard';
    const genDate = new Date().toLocaleDateString('en-MY', { day: 'numeric', month: 'long', year: 'numeric' });
    
    // Labels
    const L = {
      title: isEN ? 'FINANCIAL STATEMENTS' : 'PENYATA KEWANGAN',
      forYear: isEN ? 'FOR THE FINANCIAL YEAR ENDED' : 'BAGI TAHUN KEWANGAN BERAKHIR',
      contents: isEN ? 'CONTENTS' : 'KANDUNGAN',
      page: isEN ? 'Page' : 'Muka Surat',
      sofp: isEN ? 'STATEMENT OF FINANCIAL POSITION' : 'PENYATA KEDUDUKAN KEWANGAN',
      sopl: isEN ? 'STATEMENT OF PROFIT OR LOSS AND OTHER COMPREHENSIVE INCOME' : 'PENYATA UNTUNG RUGI DAN PENDAPATAN KOMPREHENSIF LAIN',
      soce: isEN ? 'STATEMENT OF CHANGES IN EQUITY' : 'PENYATA PERUBAHAN EKUITI',
      socf: isEN ? 'STATEMENT OF CASH FLOWS' : 'PENYATA ALIRAN TUNAI',
      notes: isEN ? 'NOTES TO THE FINANCIAL STATEMENTS' : 'NOTA-NOTA KEPADA PENYATA KEWANGAN',
      asAt: isEN ? 'AS AT' : 'PADA',
      note: isEN ? 'Note' : 'Nota',
      rm: 'RM',
      assets: isEN ? 'ASSETS' : 'ASET',
      nca: isEN ? 'Non-Current Assets' : 'Aset Bukan Semasa',
      ppe: isEN ? 'Property, plant and equipment' : 'Hartanah, loji dan peralatan',
      ca: isEN ? 'Current Assets' : 'Aset Semasa',
      inventories: isEN ? 'Inventories' : 'Inventori',
      tradeRec: isEN ? 'Trade and other receivables' : 'Penghutang perdagangan dan lain-lain',
      cashBank: isEN ? 'Cash and bank balances' : 'Tunai dan baki bank',
      totalAssets: isEN ? 'TOTAL ASSETS' : 'JUMLAH ASET',
      equityLiab: isEN ? 'EQUITY AND LIABILITIES' : 'EKUITI DAN LIABILITI',
      equity: isEN ? 'Equity' : 'Ekuiti',
      shareCap: isEN ? 'Share capital' : 'Modal saham',
      retained: isEN ? 'Retained earnings' : 'Pendapatan tertahan',
      totalEquity: isEN ? 'Total Equity' : 'Jumlah Ekuiti',
      cl: isEN ? 'Current Liabilities' : 'Liabiliti Semasa',
      tradePay: isEN ? 'Trade and other payables' : 'Pemiutang perdagangan dan lain-lain',
      borrowings: isEN ? 'Borrowings' : 'Pinjaman',
      taxPayable: isEN ? 'Tax payable' : 'Cukai kena bayar',
      totalLiab: isEN ? 'Total Liabilities' : 'Jumlah Liabiliti',
      totalEL: isEN ? 'TOTAL EQUITY AND LIABILITIES' : 'JUMLAH EKUITI DAN LIABILITI',
      revenue: isEN ? 'Revenue' : 'Hasil',
      costOfSales: isEN ? 'Cost of sales' : 'Kos jualan',
      grossProfit: isEN ? 'Gross profit' : 'Untung kasar',
      otherIncome: isEN ? 'Other income' : 'Pendapatan lain',
      adminExp: isEN ? 'Administrative expenses' : 'Perbelanjaan pentadbiran',
      finCosts: isEN ? 'Finance costs' : 'Kos kewangan',
      pbt: isEN ? 'Profit before taxation' : 'Untung sebelum cukai',
      tax: isEN ? 'Taxation' : 'Cukai',
      profitYear: isEN ? 'Profit for the financial year' : 'Untung bagi tahun kewangan',
      oci: isEN ? 'Other comprehensive income' : 'Pendapatan komprehensif lain',
      totalCI: isEN ? 'Total comprehensive income for the year' : 'Jumlah pendapatan komprehensif bagi tahun',
      integral: isEN ? 'The accompanying notes form an integral part of these financial statements.' : 'Nota-nota yang dilampirkan merupakan sebahagian yang tidak terpisahkan daripada penyata kewangan ini.',
      genOn: isEN ? 'Generated on' : 'Dijana pada',
      incMalaysia: isEN ? 'Incorporated in Malaysia' : 'Diperbadankan di Malaysia',
      regNo: isEN ? 'Registration No.' : 'No. Pendaftaran',
    };
    
    const fmtNum = (n) => {
      if (n == null || n === 0) return '-';
      const num = Number(n);
      if (num < 0) return `(${Math.abs(num).toLocaleString('en-MY')})`;
      return num.toLocaleString('en-MY');
    };
    
    // Amount cell with optional line style (inner div for border isolation)
    const amtCell = (val, lineType = '', bold = false) => {
      const cls = ['amt', lineType, bold ? 'bold' : ''].filter(Boolean).join(' ');
      return `<td class="${cls}"><div>${val}</div></td>`;
    };
    
    // Standard colgroup for 4-column tables
    const colgroup4 = `<colgroup><col style="width:60%"/><col style="width:8%"/><col style="width:16%"/><col style="width:16%"/></colgroup>`;
    
    // Standard colgroup for 3-column tables (equity, some CF)
    const colgroup3eq = `<colgroup><col style="width:40%"/><col style="width:20%"/><col style="width:20%"/><col style="width:20%"/></colgroup>`;
    const colgroup3cf = `<colgroup><col style="width:60%"/><col style="width:20%"/><col style="width:20%"/></colgroup>`;
    
    // ========== PAGE 1: COVER ==========
    const coverPage = `
<div class="page">
  <table style="width:100%; height:22cm;">
    <tr>
      <td style="text-align:center; vertical-align:middle;">
        <div style="font-size:16pt; font-weight:bold;">${escapeHtml(coName.toUpperCase())}</div>
        <div class="sp-1" style="font-size:11pt;">(${L.regNo} ${escapeHtml(coReg)})</div>
        <div style="font-size:11pt;">(${L.incMalaysia})</div>
        <div class="sp-3" style="font-size:14pt; font-weight:bold;">${L.title}</div>
        <div class="sp-2" style="font-size:12pt;">${L.forYear}</div>
        <div style="font-size:12pt; font-weight:bold;">31 DECEMBER ${currentYear}</div>
        <div class="sp-3 small muted">${escapeHtml(stdName)}</div>
        <div class="sp-2 small muted">${L.genOn}: ${escapeHtml(genDate)}</div>
      </td>
    </tr>
  </table>
</div>`;

    // ========== PAGE 2: TABLE OF CONTENTS ==========
    const tocPage = `
<div class="page">
  <div class="section-title">${L.contents}</div>
  <table style="width:60%; margin:30pt auto;">
    <tr><td style="padding:5pt 0;">${L.sofp}</td><td style="text-align:right; width:50px;">1</td></tr>
    <tr><td style="padding:5pt 0;">${L.sopl}</td><td style="text-align:right;">2</td></tr>
    <tr><td style="padding:5pt 0;">${L.soce}</td><td style="text-align:right;">3</td></tr>
    <tr><td style="padding:5pt 0;">${L.socf}</td><td style="text-align:right;">4</td></tr>
    <tr><td style="padding:5pt 0;">${L.notes}</td><td style="text-align:right;">5 - 8</td></tr>
  </table>
</div>`;

    // ========== PAGE 3: STATEMENT OF FINANCIAL POSITION ==========
    let bsRows = '';
    
    // Header row
    bsRows += `<tr>
      <td class="desc"></td>
      <td class="note hdr-border"><div>${L.note}</div></td>
      <td class="amt hdr-border"><div>${currentYear}<br/>${L.rm}</div></td>
      <td class="amt hdr-border"><div>${currentYear - 1}<br/>${L.rm}</div></td>
    </tr>`;
    
    // ASSETS
    bsRows += `<tr><td class="desc bold">${L.assets}</td><td class="note"></td><td class="amt"><div></div></td><td class="amt"><div></div></td></tr>`;
    bsRows += `<tr><td class="desc bold">${L.nca}</td><td class="note"></td><td class="amt"><div></div></td><td class="amt"><div></div></td></tr>`;
    if (res.bs.ppe > 0) {
      bsRows += `<tr><td class="desc ind1">${L.ppe}</td><td class="note">3</td>${amtCell(fmtNum(res.bs.ppe))}${amtCell('-')}</tr>`;
    }
    bsRows += `<tr><td class="desc"></td><td class="note"></td>${amtCell(fmtNum(res.bs.ppe || 0), 'amt-line-bottom')}${amtCell('-', 'amt-line-bottom')}</tr>`;
    
    bsRows += `<tr><td class="desc bold" style="padding-top:10pt;">${L.ca}</td><td class="note"></td><td class="amt"><div></div></td><td class="amt"><div></div></td></tr>`;
    if (res.bs.inv > 0) {
      bsRows += `<tr><td class="desc ind1">${L.inventories}</td><td class="note">4</td>${amtCell(fmtNum(res.bs.inv))}${amtCell('-')}</tr>`;
    }
    if (res.bs.recv > 0) {
      bsRows += `<tr><td class="desc ind1">${L.tradeRec}</td><td class="note">5</td>${amtCell(fmtNum(res.bs.recv))}${amtCell('-')}</tr>`;
    }
    bsRows += `<tr><td class="desc ind1">${L.cashBank}</td><td class="note">6</td>${amtCell(fmtNum(res.bs.cash))}${amtCell('-')}</tr>`;
    bsRows += `<tr><td class="desc"></td><td class="note"></td>${amtCell(fmtNum(res.bs.totCA), 'amt-line-bottom')}${amtCell('-', 'amt-line-bottom')}</tr>`;
    
    bsRows += `<tr><td class="desc bold">${L.totalAssets}</td><td class="note"></td>${amtCell(fmtNum(res.bs.totA), 'amt-line-double', true)}${amtCell('-', 'amt-line-double', true)}</tr>`;
    
    // EQUITY AND LIABILITIES
    bsRows += `<tr><td class="desc bold" style="padding-top:15pt;">${L.equityLiab}</td><td class="note"></td><td class="amt"><div></div></td><td class="amt"><div></div></td></tr>`;
    bsRows += `<tr><td class="desc bold">${L.equity}</td><td class="note"></td><td class="amt"><div></div></td><td class="amt"><div></div></td></tr>`;
    bsRows += `<tr><td class="desc ind1">${L.shareCap}</td><td class="note">7</td>${amtCell(fmtNum(res.bs.shareCap))}${amtCell('-')}</tr>`;
    bsRows += `<tr><td class="desc ind1">${L.retained}</td><td class="note"></td>${amtCell(fmtNum(res.bs.retainedEarnings))}${amtCell('-')}</tr>`;
    bsRows += `<tr><td class="desc bold">${L.totalEquity}</td><td class="note"></td>${amtCell(fmtNum(res.bs.totE), 'amt-line-bottom', true)}${amtCell('-', 'amt-line-bottom', true)}</tr>`;
    
    bsRows += `<tr><td class="desc bold" style="padding-top:10pt;">${L.cl}</td><td class="note"></td><td class="amt"><div></div></td><td class="amt"><div></div></td></tr>`;
    if (res.bs.payables > 0) {
      bsRows += `<tr><td class="desc ind1">${L.tradePay}</td><td class="note">8</td>${amtCell(fmtNum(res.bs.payables))}${amtCell('-')}</tr>`;
    }
    if (res.bs.borrowings > 0) {
      bsRows += `<tr><td class="desc ind1">${L.borrowings}</td><td class="note">9</td>${amtCell(fmtNum(res.bs.borrowings))}${amtCell('-')}</tr>`;
    }
    if (res.bs.taxPayable > 0) {
      bsRows += `<tr><td class="desc ind1">${L.taxPayable}</td><td class="note"></td>${amtCell(fmtNum(res.bs.taxPayable))}${amtCell('-')}</tr>`;
    }
    bsRows += `<tr><td class="desc bold">${L.totalLiab}</td><td class="note"></td>${amtCell(fmtNum(res.bs.totL), 'amt-line-bottom', true)}${amtCell('-', 'amt-line-bottom', true)}</tr>`;
    
    bsRows += `<tr><td class="desc bold" style="padding-top:8pt;">${L.totalEL}</td><td class="note"></td>${amtCell(fmtNum(res.bs.totA), 'amt-line-double', true)}${amtCell('-', 'amt-line-double', true)}</tr>`;
    
    const bsPage = `
<div class="page">
  <div class="section-title">${L.sofp}</div>
  <div class="section-subtitle">${L.asAt} 31 DECEMBER ${currentYear}</div>
  <table class="fs">${colgroup4}<tbody>${bsRows}</tbody></table>
  <div class="integral-note">${L.integral}</div>
</div>`;

    // ========== PAGE 4: INCOME STATEMENT ==========
    let isRows = '';
    
    isRows += `<tr>
      <td class="desc"></td>
      <td class="note hdr-border"><div>${L.note}</div></td>
      <td class="amt hdr-border"><div>${currentYear}<br/>${L.rm}</div></td>
      <td class="amt hdr-border"><div>${currentYear - 1}<br/>${L.rm}</div></td>
    </tr>`;
    
    isRows += `<tr><td class="desc">${L.revenue}</td><td class="note">10</td>${amtCell(fmtNum(res.is.rev))}${amtCell('-')}</tr>`;
    isRows += `<tr><td class="desc">${L.costOfSales}</td><td class="note"></td>${amtCell('(' + fmtNum(res.is.cos) + ')')}${amtCell('-')}</tr>`;
    isRows += `<tr><td class="desc bold">${L.grossProfit}</td><td class="note"></td>${amtCell(fmtNum(res.is.gp), 'amt-line-bottom', true)}${amtCell('-', 'amt-line-bottom', true)}</tr>`;
    
    if (res.is.oi > 0) {
      isRows += `<tr><td class="desc">${L.otherIncome}</td><td class="note">11</td>${amtCell(fmtNum(res.is.oi))}${amtCell('-')}</tr>`;
    }
    isRows += `<tr><td class="desc">${L.adminExp}</td><td class="note">12</td>${amtCell('(' + fmtNum(res.is.adm) + ')')}${amtCell('-')}</tr>`;
    if (res.is.fin > 0) {
      isRows += `<tr><td class="desc">${L.finCosts}</td><td class="note"></td>${amtCell('(' + fmtNum(res.is.fin) + ')')}${amtCell('-')}</tr>`;
    }
    
    isRows += `<tr><td class="desc bold">${L.pbt}</td><td class="note"></td>${amtCell(fmtNum(res.is.pbt), 'amt-line-bottom', true)}${amtCell('-', 'amt-line-bottom', true)}</tr>`;
    isRows += `<tr><td class="desc">${L.tax}</td><td class="note">13</td>${amtCell(res.is.tax > 0 ? '(' + fmtNum(res.is.tax) + ')' : '-')}${amtCell('-')}</tr>`;
    isRows += `<tr><td class="desc bold">${L.profitYear}</td><td class="note"></td>${amtCell(fmtNum(res.is.np), 'amt-line-double', true)}${amtCell('-', 'amt-line-double', true)}</tr>`;
    
    isRows += `<tr><td class="desc" style="padding-top:12pt;"><em>${L.oci}</em></td><td class="note"></td>${amtCell('-')}${amtCell('-')}</tr>`;
    isRows += `<tr><td class="desc bold">${L.totalCI}</td><td class="note"></td>${amtCell(fmtNum(res.is.np), 'amt-line-double', true)}${amtCell('-', 'amt-line-double', true)}</tr>`;
    
    const isPage = `
<div class="page">
  <div class="section-title">${L.sopl}</div>
  <div class="section-subtitle">${L.forYear} 31 DECEMBER ${currentYear}</div>
  <table class="fs">${colgroup4}<tbody>${isRows}</tbody></table>
  <div class="integral-note">${L.integral}</div>
</div>`;

    // ========== PAGE 5: STATEMENT OF CHANGES IN EQUITY ==========
    const openingRE = (res.bs.retainedEarnings || 0) - (res.is.np || 0);
    const openingTotal = (res.bs.shareCap || 0) + openingRE;
    
    let eqRows = '';
    eqRows += `<tr>
      <td class="desc"></td>
      <td class="amt hdr-border"><div>${L.shareCap}<br/>${L.rm}</div></td>
      <td class="amt hdr-border"><div>${L.retained}<br/>${L.rm}</div></td>
      <td class="amt hdr-border"><div>${isEN ? 'Total' : 'Jumlah'}<br/>${L.rm}</div></td>
    </tr>`;
    
    eqRows += `<tr><td class="desc">${isEN ? 'Balance at 1 January' : 'Baki pada 1 Januari'} ${currentYear}</td>${amtCell(fmtNum(res.bs.shareCap))}${amtCell(fmtNum(openingRE))}${amtCell(fmtNum(openingTotal))}</tr>`;
    eqRows += `<tr><td class="desc">${L.profitYear}</td>${amtCell('-')}${amtCell(fmtNum(res.is.np))}${amtCell(fmtNum(res.is.np))}</tr>`;
    eqRows += `<tr><td class="desc bold">${isEN ? 'Balance at 31 December' : 'Baki pada 31 Disember'} ${currentYear}</td>${amtCell(fmtNum(res.bs.shareCap), 'amt-line-double', true)}${amtCell(fmtNum(res.bs.retainedEarnings), 'amt-line-double', true)}${amtCell(fmtNum(res.bs.totE), 'amt-line-double', true)}</tr>`;
    
    const eqPage = `
<div class="page">
  <div class="section-title">${L.soce}</div>
  <div class="section-subtitle">${L.forYear} 31 DECEMBER ${currentYear}</div>
  <table class="fs">${colgroup3eq}<tbody>${eqRows}</tbody></table>
  <div class="integral-note">${L.integral}</div>
</div>`;

    // ========== PAGE 6: CASH FLOW STATEMENT ==========
    let cfRows = '';
    cfRows += `<tr>
      <td class="desc"></td>
      <td class="amt hdr-border"><div>${currentYear}<br/>${L.rm}</div></td>
      <td class="amt hdr-border"><div>${currentYear - 1}<br/>${L.rm}</div></td>
    </tr>`;
    
    cfRows += `<tr><td class="desc bold">${isEN ? 'Cash flows from operating activities' : 'Aliran tunai daripada aktiviti operasi'}</td><td class="amt"><div></div></td><td class="amt"><div></div></td></tr>`;
    cfRows += `<tr><td class="desc ind1">${L.profitYear}</td>${amtCell(fmtNum(res.is.np))}${amtCell('-')}</tr>`;
    cfRows += `<tr><td class="desc ind1">${isEN ? 'Adjustments for:' : 'Pelarasan untuk:'}</td><td class="amt"><div></div></td><td class="amt"><div></div></td></tr>`;
    if (res.is.dep > 0) {
      cfRows += `<tr><td class="desc ind2">${isEN ? 'Depreciation' : 'Susut nilai'}</td>${amtCell(fmtNum(res.is.dep))}${amtCell('-')}</tr>`;
    }
    cfRows += `<tr><td class="desc ind1">${isEN ? 'Operating profit before working capital changes' : 'Keuntungan operasi sebelum perubahan modal kerja'}</td>${amtCell(fmtNum((res.is.np || 0) + (res.is.dep || 0)), 'amt-line-bottom')}${amtCell('-', 'amt-line-bottom')}</tr>`;
    
    if (res.bs.inv > 0) {
      cfRows += `<tr><td class="desc ind1">${isEN ? 'Increase in inventories' : 'Kenaikan inventori'}</td>${amtCell('(' + fmtNum(res.bs.inv) + ')')}${amtCell('-')}</tr>`;
    }
    if (res.bs.recv > 0) {
      cfRows += `<tr><td class="desc ind1">${isEN ? 'Increase in receivables' : 'Kenaikan penghutang'}</td>${amtCell('(' + fmtNum(res.bs.recv) + ')')}${amtCell('-')}</tr>`;
    }
    if (res.bs.payables > 0) {
      cfRows += `<tr><td class="desc ind1">${isEN ? 'Increase in payables' : 'Kenaikan pemiutang'}</td>${amtCell(fmtNum(res.bs.payables))}${amtCell('-')}</tr>`;
    }
    const cashFromOps = (res.is.np || 0) + (res.is.dep || 0) - (res.bs.inv || 0) - (res.bs.recv || 0) + (res.bs.payables || 0);
    cfRows += `<tr><td class="desc bold">${isEN ? 'Cash generated from operations' : 'Tunai dijana daripada operasi'}</td>${amtCell(fmtNum(cashFromOps), 'amt-line-bottom', true)}${amtCell('-', 'amt-line-bottom', true)}</tr>`;
    
    cfRows += `<tr><td class="desc bold" style="padding-top:12pt;">${isEN ? 'Cash flows from investing activities' : 'Aliran tunai daripada aktiviti pelaburan'}</td><td class="amt"><div></div></td><td class="amt"><div></div></td></tr>`;
    if (res.bs.ppe > 0) {
      cfRows += `<tr><td class="desc ind1">${isEN ? 'Purchase of property, plant and equipment' : 'Pembelian hartanah, loji dan peralatan'}</td>${amtCell('(' + fmtNum(res.bs.ppe_cost || res.bs.ppe) + ')')}${amtCell('-')}</tr>`;
    }
    const invTotal = -(res.bs.ppe_cost || res.bs.ppe || 0);
    cfRows += `<tr><td class="desc bold">${isEN ? 'Net cash used in investing activities' : 'Tunai bersih digunakan dalam aktiviti pelaburan'}</td>${amtCell(fmtNum(invTotal), 'amt-line-bottom', true)}${amtCell('-', 'amt-line-bottom', true)}</tr>`;
    
    cfRows += `<tr><td class="desc bold" style="padding-top:12pt;">${isEN ? 'Cash flows from financing activities' : 'Aliran tunai daripada aktiviti pembiayaan'}</td><td class="amt"><div></div></td><td class="amt"><div></div></td></tr>`;
    cfRows += `<tr><td class="desc ind1">${isEN ? 'Proceeds from issuance of share capital' : 'Hasil daripada penerbitan modal saham'}</td>${amtCell(fmtNum(res.bs.shareCap))}${amtCell('-')}</tr>`;
    if (res.bs.borrowings > 0) {
      cfRows += `<tr><td class="desc ind1">${isEN ? 'Proceeds from borrowings' : 'Hasil daripada pinjaman'}</td>${amtCell(fmtNum(res.bs.borrowings))}${amtCell('-')}</tr>`;
    }
    const finTotal = (res.bs.shareCap || 0) + (res.bs.borrowings || 0);
    cfRows += `<tr><td class="desc bold">${isEN ? 'Net cash from financing activities' : 'Tunai bersih daripada aktiviti pembiayaan'}</td>${amtCell(fmtNum(finTotal), 'amt-line-bottom', true)}${amtCell('-', 'amt-line-bottom', true)}</tr>`;
    
    cfRows += `<tr><td class="desc bold" style="padding-top:12pt;">${isEN ? 'Net increase in cash and cash equivalents' : 'Kenaikan bersih dalam tunai dan setara tunai'}</td>${amtCell(fmtNum(res.bs.cash), '', true)}${amtCell('-')}</tr>`;
    cfRows += `<tr><td class="desc">${isEN ? 'Cash and cash equivalents at beginning of year' : 'Tunai dan setara tunai pada awal tahun'}</td>${amtCell('-')}${amtCell('-')}</tr>`;
    cfRows += `<tr><td class="desc bold">${isEN ? 'Cash and cash equivalents at end of year' : 'Tunai dan setara tunai pada akhir tahun'}</td>${amtCell(fmtNum(res.bs.cash), 'amt-line-double', true)}${amtCell('-', 'amt-line-double', true)}</tr>`;
    
    const cfPage = `
<div class="page">
  <div class="section-title">${L.socf}</div>
  <div class="section-subtitle">${L.forYear} 31 DECEMBER ${currentYear}</div>
  <table class="fs">${colgroup3cf}<tbody>${cfRows}</tbody></table>
  <div class="integral-note">${L.integral}</div>
</div>`;

    // ========== PAGES 7-8: NOTES TO FINANCIAL STATEMENTS ==========
    let notesHtml = `
<div class="section-title">${L.notes}</div>
<div class="section-subtitle">${L.forYear} 31 DECEMBER ${currentYear}</div>

<div class="note-title">1. ${isEN ? 'GENERAL INFORMATION' : 'MAKLUMAT AM'}</div>
<p class="note-text">${escapeHtml(coName)} ${isEN ? 'is a private limited company, incorporated and domiciled in Malaysia. The registered office and principal place of business of the Company is located in Malaysia.' : 'adalah sebuah syarikat sendirian berhad yang diperbadankan dan bermastautin di Malaysia. Pejabat berdaftar dan tempat perniagaan utama Syarikat terletak di Malaysia.'}</p>
<p class="note-text">${isEN ? 'The principal activity of the Company is' : 'Aktiviti utama Syarikat adalah'} ${escapeHtml(config?.activity || (isEN ? 'general trading and services.' : 'perdagangan dan perkhidmatan am.'))}</p>

<div class="note-title">2. ${isEN ? 'BASIS OF PREPARATION' : 'ASAS PENYEDIAAN'}</div>
<p class="note-text">${isEN ? 'The financial statements of the Company have been prepared in accordance with' : 'Penyata kewangan Syarikat telah disediakan mengikut'} ${escapeHtml(stdName)} ${isEN ? 'and the requirements of the Companies Act 2016 in Malaysia.' : 'dan keperluan Akta Syarikat 2016 di Malaysia.'}</p>

<div class="note-title">3. ${isEN ? 'PROPERTY, PLANT AND EQUIPMENT' : 'HARTANAH, LOJI DAN PERALATAN'}</div>
${res.bs.ppe > 0 ? `
<table class="noteTbl">
  <colgroup><col style="width:50%"/><col style="width:16%"/><col style="width:17%"/><col style="width:17%"/></colgroup>
  <tr>
    <td></td>
    <td class="amt hdr-border"><div>${isEN ? 'Cost' : 'Kos'}<br/>${L.rm}</div></td>
    <td class="amt hdr-border"><div>${isEN ? 'Acc. Dep.' : 'Susut Nilai'}<br/>${L.rm}</div></td>
    <td class="amt hdr-border"><div>NBV<br/>${L.rm}</div></td>
  </tr>
  <tr>
    <td>${isEN ? 'Plant & equipment' : 'Loji & peralatan'}</td>
    ${amtCell(fmtNum(res.bs.ppe_cost || res.bs.ppe))}
    ${amtCell(fmtNum(res.bs.ppe_accDep || 0))}
    ${amtCell(fmtNum(res.bs.ppe), 'amt-line-double')}
  </tr>
</table>
` : `<p class="note-text">${isEN ? 'The Company does not have any property, plant and equipment.' : 'Syarikat tidak mempunyai sebarang hartanah, loji dan peralatan.'}</p>`}

<div class="note-title">4. ${isEN ? 'SHARE CAPITAL' : 'MODAL SAHAM'}</div>
<table class="noteTbl">
  <colgroup><col style="width:70%"/><col style="width:30%"/></colgroup>
  <tr>
    <td>${isEN ? 'Issued and fully paid ordinary shares' : 'Saham biasa diterbitkan dan dibayar penuh'}</td>
    ${amtCell(fmtNum(res.bs.shareCap), 'amt-line-double')}
  </tr>
</table>

<div class="note-title">5. ${isEN ? 'REVENUE' : 'HASIL'}</div>
<table class="noteTbl">
  <colgroup><col style="width:70%"/><col style="width:30%"/></colgroup>
  <tr>
    <td>${isEN ? 'Revenue from contracts with customers' : 'Hasil daripada kontrak dengan pelanggan'}</td>
    ${amtCell(fmtNum(res.is.rev), 'amt-line-double')}
  </tr>
</table>

<div class="note-title">6. ${isEN ? 'ADMINISTRATIVE EXPENSES' : 'PERBELANJAAN PENTADBIRAN'}</div>
<table class="noteTbl">
  <colgroup><col style="width:70%"/><col style="width:30%"/></colgroup>
  ${res.is.details?.SALARY > 0 ? `<tr><td>${isEN ? 'Staff costs' : 'Kos kakitangan'}</td>${amtCell(fmtNum(res.is.details.SALARY))}</tr>` : ''}
  ${res.is.details?.RENT > 0 ? `<tr><td>${isEN ? 'Rental' : 'Sewa'}</td>${amtCell(fmtNum(res.is.details.RENT))}</tr>` : ''}
  ${res.is.details?.UTILITIES > 0 ? `<tr><td>${isEN ? 'Utilities' : 'Utiliti'}</td>${amtCell(fmtNum(res.is.details.UTILITIES))}</tr>` : ''}
  ${res.is.dep > 0 ? `<tr><td>${isEN ? 'Depreciation' : 'Susut nilai'}</td>${amtCell(fmtNum(res.is.dep))}</tr>` : ''}
  ${res.is.details?.PROFESSIONAL_FEES > 0 ? `<tr><td>${isEN ? 'Professional fees' : 'Yuran profesional'}</td>${amtCell(fmtNum(res.is.details.PROFESSIONAL_FEES))}</tr>` : ''}
  ${res.is.details?.MISCELLANEOUS > 0 ? `<tr><td>${isEN ? 'Other expenses' : 'Perbelanjaan lain'}</td>${amtCell(fmtNum(res.is.details.MISCELLANEOUS))}</tr>` : ''}
  <tr><td class="bold">${isEN ? 'Total' : 'Jumlah'}</td>${amtCell(fmtNum(res.is.adm), 'amt-line-double', true)}</tr>
</table>

<div class="note-title">7. ${isEN ? 'TAXATION' : 'CUKAI'}</div>
<table class="noteTbl">
  <colgroup><col style="width:70%"/><col style="width:30%"/></colgroup>
  <tr>
    <td>${isEN ? 'Current tax expense' : 'Perbelanjaan cukai semasa'}</td>
    ${amtCell(fmtNum(res.is.tax), 'amt-line-double')}
  </tr>
</table>
<p class="note-text small">${isEN ? 'The tax expense is calculated based on the estimated chargeable income at the prevailing tax rate.' : 'Perbelanjaan cukai dikira berdasarkan anggaran pendapatan boleh dicukai pada kadar cukai semasa.'}</p>
`;

    const notesPage = `<div class="page">${notesHtml}</div>`;

    // ========== COMBINE ALL PAGES ==========
    const pages = [coverPage, tocPage, bsPage, isPage, eqPage, cfPage, notesPage];
    const bodyHtml = pages[0] + pages.slice(1).map(p => `<br clear="all" class="w-pb"/>${p}`).join('');
    
    return wrapWordHtml({ title: `${coName} - Financial Statements ${currentYear}`, bodyHtml });
  };
  
  // ============================================
  // DOWNLOAD HELPER FUNCTIONS (Reliable cross-browser)
  // Must be defined before export functions that use them
  // ============================================
  
  // Generic blob download helper - with delayed revoke for Word
  const downloadBlob = (blob, filename) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  };

  // Print HTML to PDF using hidden iframe (more reliable than window.open)
  const printHtmlToPdf = (html, title = 'Report') => {
    try {
      // Create hidden iframe
      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      iframe.style.visibility = 'hidden';
      document.body.appendChild(iframe);

      const doc = iframe.contentWindow.document;
      doc.open();
      doc.write(html);
      doc.title = title;
      doc.close();

      // Wait for content to load then print
      iframe.onload = () => {
        try {
          iframe.contentWindow.focus();
          iframe.contentWindow.print();
        } catch (e) {
          console.error('Print failed:', e);
        }
        // Remove iframe after printing (give time for print dialog)
        setTimeout(() => {
          try { document.body.removeChild(iframe); } catch(e) {}
        }, 2000);
      };

      // Fallback: trigger print after delay if onload doesn't fire
      setTimeout(() => {
        try {
          iframe.contentWindow.focus();
          iframe.contentWindow.print();
        } catch (e) {
          // If iframe print fails, try window.open as last resort
          const w = window.open('', '_blank');
          if (w) {
            w.document.open();
            w.document.write(html);
            w.document.title = title;
            w.document.close();
            setTimeout(() => { w.focus(); w.print(); }, 500);
          } else {
            alert('Could not open print dialog. Please use "Download HTML" and print from your browser.');
          }
        }
      }, 1000);

      return true;
    } catch (err) {
      console.error('printHtmlToPdf error:', err);
      return false;
    }
  };

  // Excel export helper (most reliable in-browser method)
  const downloadXlsx = (wb, filename) => {
    try {
      // Use array type instead of writeFile for better compatibility
      const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([wbout], { 
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
      });
      downloadBlob(blob, filename);
      return true;
    } catch (err) {
      console.error('Excel export error:', err);
      return false;
    }
  };

  // Word export helper
  const downloadWord = (html, filename) => {
    const blob = new Blob([html], { type: 'application/msword;charset=utf-8' });
    downloadBlob(blob, filename);
  };

  // ===================== FULL FS EXPORT PATCH (V8) =====================
  // This section contains the improved Full FS generation system with:
  // - Entity type templates (Enterprise, SdnBhd, Public)
  // - Conditional note inclusion based on applicability
  // - Improved BM translations
  // - Real DOCX export using docx library
  // - Direct PDF export using jsPDF
  // - V8: Line styling only on amount columns
  // - V8: Management Pack export
  // ======================================================================

  // V8: Version constant
  const APP_VERSION = 'V8';

  // ===================== V8: LINE/BORDER HELPER SYSTEM =====================
  // Lines on subtotals/totals should ONLY appear under amount columns,
  // NOT under description or note columns.
  // ========================================================================

  // Line types for subtotals and totals
  const LINE_TYPE = {
    NONE: 'none',
    TOP: 'top',           // Single line above (for subtotals)
    BOTTOM: 'bottom',     // Single line below
    DOUBLE_TOP: 'double-top',     // Double line above (for grand totals)
    DOUBLE_BOTTOM: 'double-bottom' // Double line below
  };

  // Get inline border style for amount cells only
  // Returns empty string for non-amount columns
  const getAmtBorderStyle = (isAmtCol, lineType) => {
    if (!isAmtCol || lineType === LINE_TYPE.NONE) return '';
    const styles = {
      [LINE_TYPE.TOP]: 'border-top: 1px solid #000;',
      [LINE_TYPE.BOTTOM]: 'border-bottom: 1px solid #000;',
      [LINE_TYPE.DOUBLE_TOP]: 'border-top: 2px solid #000;',
      [LINE_TYPE.DOUBLE_BOTTOM]: 'border-bottom: 3px double #000;'
    };
    return styles[lineType] || '';
  };

  // Build a table row with proper line styling on amount columns only
  // cols: array of column configs [{content, isAmt, bold, indent, align}]
  // lineType: LINE_TYPE value to apply to amount columns
  const buildFsTableRow = (cols, lineType = LINE_TYPE.NONE) => {
    return '<tr>' + cols.map(col => {
      const isAmt = col.isAmt === true;
      const borderStyle = getAmtBorderStyle(isAmt, lineType);
      const alignClass = isAmt ? 'right' : (col.align === 'center' ? 'center' : '');
      const boldClass = col.bold ? ' bold' : '';
      const indentStyle = col.indent ? ` padding-left: ${col.indent * 15}px;` : '';
      const style = (borderStyle || indentStyle) ? ` style="${borderStyle}${indentStyle}"` : '';
      return `<td class="${alignClass}${boldClass}"${style}>${col.content || ''}</td>`;
    }).join('') + '</tr>';
  };

  // Shorthand for standard 4-column FS row: [desc, note, cy, py]
  const fsRow4 = (desc, note, cy, py, opts = {}) => {
    const { bold = false, indent = 0, line = LINE_TYPE.NONE } = opts;
    return buildFsTableRow([
      { content: desc, isAmt: false, bold, indent },
      { content: note, isAmt: false, align: 'center' },
      { content: cy, isAmt: true, bold },
      { content: py, isAmt: true, bold }
    ], line);
  };

  // Shorthand for 3-column CF row: [desc, cy, py]
  const fsRow3 = (desc, cy, py, opts = {}) => {
    const { bold = false, indent = 0, line = LINE_TYPE.NONE } = opts;
    return buildFsTableRow([
      { content: desc, isAmt: false, bold, indent },
      { content: cy, isAmt: true, bold },
      { content: py, isAmt: true, bold }
    ], line);
  };

  // Shorthand for SOCE 4-column row: [desc, cap, retained, total] - all amounts except first
  const soceRow4 = (desc, cap, ret, total, opts = {}) => {
    const { bold = false, line = LINE_TYPE.NONE } = opts;
    return buildFsTableRow([
      { content: desc, isAmt: false, bold },
      { content: cap, isAmt: true, bold },
      { content: ret, isAmt: true, bold },
      { content: total, isAmt: true, bold }
    ], line);
  };

  // Shorthand for 2-column notes row: [desc, amount]
  const noteRow2 = (desc, amt, opts = {}) => {
    const { bold = false, line = LINE_TYPE.NONE } = opts;
    return buildFsTableRow([
      { content: desc, isAmt: false, bold },
      { content: amt, isAmt: true, bold }
    ], line);
  };

  // Enhanced Language Pack with formal Malaysian Financial Statement terminology
  const FS_LANG = {
    EN: {
      // Cover & Headers
      title: 'FINANCIAL STATEMENTS',
      forYear: 'FOR THE FINANCIAL YEAR ENDED',
      asAt: 'AS AT',
      regNo: 'Registration No.',
      incMalaysia: 'Incorporated in Malaysia',
      contents: 'CONTENTS',
      page: 'Page',
      continued: 'continued',
      
      // Statements
      sofp: 'STATEMENT OF FINANCIAL POSITION',
      sopl: 'STATEMENT OF PROFIT OR LOSS AND OTHER COMPREHENSIVE INCOME',
      soplSimple: 'STATEMENT OF PROFIT OR LOSS',
      soce: 'STATEMENT OF CHANGES IN EQUITY',
      socf: 'STATEMENT OF CASH FLOWS',
      notes: 'NOTES TO THE FINANCIAL STATEMENTS',
      statementByDirectors: 'STATEMENT BY DIRECTORS',
      statutoryDeclaration: 'STATUTORY DECLARATION',
      
      // Income Statement Items
      revenue: 'Revenue',
      costOfSales: 'Cost of sales',
      grossProfit: 'Gross profit',
      otherIncome: 'Other income',
      adminExp: 'Administrative expenses',
      otherExp: 'Other expenses',
      finCosts: 'Finance costs',
      pbt: 'Profit before taxation',
      tax: 'Taxation',
      profitYear: 'Profit for the financial year',
      lossYear: 'Loss for the financial year',
      oci: 'Other comprehensive income for the year',
      totalCI: 'Total comprehensive income for the year',
      
      // Balance Sheet Items
      assets: 'ASSETS',
      nca: 'Non-Current Assets',
      ppe: 'Property, plant and equipment',
      intangibles: 'Intangible assets',
      investments: 'Investments',
      ca: 'Current Assets',
      inventories: 'Inventories',
      tradeRec: 'Trade receivables',
      otherRec: 'Other receivables, deposits and prepayments',
      taxRecoverable: 'Tax recoverable',
      cashBank: 'Cash and bank balances',
      totalAssets: 'TOTAL ASSETS',
      equityLiab: 'EQUITY AND LIABILITIES',
      equity: 'Equity',
      shareCap: 'Share capital',
      retained: 'Retained earnings/(accumulated losses)',
      totalEquity: 'Total Equity',
      ownerCapital: 'Owner\'s capital',
      drawings: 'Less: Drawings',
      liabilities: 'Liabilities',
      ncl: 'Non-Current Liabilities',
      ltBorrowings: 'Long-term borrowings',
      deferredTax: 'Deferred tax liabilities',
      cl: 'Current Liabilities',
      tradePay: 'Trade payables',
      otherPay: 'Other payables and accruals',
      stBorrowings: 'Short-term borrowings',
      taxPayable: 'Tax payable',
      totalLiab: 'Total Liabilities',
      totalEL: 'TOTAL EQUITY AND LIABILITIES',
      
      // Cash Flow Items
      cfOperating: 'Cash flows from operating activities',
      cfInvesting: 'Cash flows from investing activities',
      cfFinancing: 'Cash flows from financing activities',
      netCashOps: 'Net cash from operating activities',
      netCashInv: 'Net cash used in investing activities',
      netCashFin: 'Net cash from/(used in) financing activities',
      netIncrease: 'Net increase/(decrease) in cash and cash equivalents',
      cashBF: 'Cash and cash equivalents at beginning of year',
      cashCF: 'Cash and cash equivalents at end of year',
      
      // SOCE Items
      balanceAt: 'Balance at',
      profitForYear: 'Profit/(loss) for the year',
      dividendsPaid: 'Dividends paid',
      
      // Notes
      note: 'Note',
      rm: 'RM',
      total: 'Total',
      notesIntegral: 'The accompanying notes form an integral part of these financial statements.',
      basisOfPrep: 'BASIS OF PREPARATION',
      basisText: 'The financial statements of the Company have been prepared in accordance with',
      summaryPolicies: 'SUMMARY OF SIGNIFICANT ACCOUNTING POLICIES',
      revenueRecog: 'Revenue recognition',
      ppePolicy: 'Property, plant and equipment',
      inventoryPolicy: 'Inventories',
      financialInstr: 'Financial instruments',
      taxPolicy: 'Taxation',
      
      // Note Titles
      notePPE: 'PROPERTY, PLANT AND EQUIPMENT',
      noteInventory: 'INVENTORIES',
      noteTradeRec: 'TRADE AND OTHER RECEIVABLES',
      noteCash: 'CASH AND BANK BALANCES',
      noteShareCap: 'SHARE CAPITAL',
      noteOwnerCap: 'OWNER\'S CAPITAL',
      noteTradePay: 'TRADE AND OTHER PAYABLES',
      noteBorrowings: 'BORROWINGS',
      noteRevenue: 'REVENUE',
      noteExpenses: 'ADMINISTRATIVE EXPENSES',
      noteCostOfSales: 'COST OF SALES',
      noteFinCosts: 'FINANCE COSTS',
      noteTax: 'TAXATION',
      noteRelatedParty: 'RELATED PARTY DISCLOSURES',
      noteContingent: 'CONTINGENT LIABILITIES',
      noteCommitments: 'COMMITMENTS',
      noteSubseqEvents: 'SUBSEQUENT EVENTS',
      
      // Common phrases
      atCost: 'At cost',
      lessAccDep: 'Less: Accumulated depreciation',
      nbv: 'Net book value',
      depCharge: 'Depreciation charge for the year',
      tradingGoods: 'Trading goods / Finished goods',
      cashInHand: 'Cash in hand',
      cashAtBank: 'Cash at bank',
      issuedPaid: 'Issued and fully paid:',
      ordinaryShares: 'Ordinary shares',
      saleOfGoods: 'Sale of goods',
      renderingServices: 'Rendering of services',
      noContingent: 'There were no contingent liabilities as at the end of the financial year.',
      noCommitments: 'There were no capital commitments as at the end of the financial year.',
      noSubseqEvents: 'There were no significant events occurring after the balance sheet date that require adjustments or disclosure in the financial statements.',
    },
    BM: {
      // Cover & Headers
      title: 'PENYATA KEWANGAN',
      forYear: 'BAGI TAHUN KEWANGAN BERAKHIR',
      asAt: 'PADA',
      regNo: 'No. Pendaftaran',
      incMalaysia: 'Diperbadankan di Malaysia',
      contents: 'KANDUNGAN',
      page: 'Muka Surat',
      continued: 'sambungan',
      
      // Statements
      sofp: 'PENYATA KEDUDUKAN KEWANGAN',
      sopl: 'PENYATA UNTUNG RUGI DAN PENDAPATAN KOMPREHENSIF LAIN',
      soplSimple: 'PENYATA UNTUNG RUGI',
      soce: 'PENYATA PERUBAHAN EKUITI',
      socf: 'PENYATA ALIRAN TUNAI',
      notes: 'NOTA-NOTA KEPADA PENYATA KEWANGAN',
      statementByDirectors: 'PENYATA OLEH PENGARAH',
      statutoryDeclaration: 'AKUAN BERKANUN',
      
      // Income Statement Items
      revenue: 'Hasil',
      costOfSales: 'Kos jualan',
      grossProfit: 'Untung kasar',
      otherIncome: 'Pendapatan lain',
      adminExp: 'Perbelanjaan pentadbiran',
      otherExp: 'Perbelanjaan lain',
      finCosts: 'Kos kewangan',
      pbt: 'Untung sebelum cukai',
      tax: 'Cukai',
      profitYear: 'Untung bagi tahun kewangan',
      lossYear: 'Rugi bagi tahun kewangan',
      oci: 'Pendapatan komprehensif lain bagi tahun',
      totalCI: 'Jumlah pendapatan komprehensif bagi tahun',
      
      // Balance Sheet Items
      assets: 'ASET',
      nca: 'Aset Bukan Semasa',
      ppe: 'Hartanah, loji dan peralatan',
      intangibles: 'Aset tak ketara',
      investments: 'Pelaburan',
      ca: 'Aset Semasa',
      inventories: 'Inventori',
      tradeRec: 'Penghutang perdagangan',
      otherRec: 'Penghutang lain, deposit dan bayaran terdahulu',
      taxRecoverable: 'Cukai boleh pulih',
      cashBank: 'Tunai dan baki bank',
      totalAssets: 'JUMLAH ASET',
      equityLiab: 'EKUITI DAN LIABILITI',
      equity: 'Ekuiti',
      shareCap: 'Modal saham',
      retained: 'Pendapatan tertahan/(kerugian terkumpul)',
      totalEquity: 'Jumlah Ekuiti',
      ownerCapital: 'Modal pemilik',
      drawings: 'Tolak: Ambilan',
      liabilities: 'Liabiliti',
      ncl: 'Liabiliti Bukan Semasa',
      ltBorrowings: 'Pinjaman jangka panjang',
      deferredTax: 'Liabiliti cukai tertunda',
      cl: 'Liabiliti Semasa',
      tradePay: 'Pemiutang perdagangan',
      otherPay: 'Pemiutang lain dan akruan',
      stBorrowings: 'Pinjaman jangka pendek',
      taxPayable: 'Cukai kena bayar',
      totalLiab: 'Jumlah Liabiliti',
      totalEL: 'JUMLAH EKUITI DAN LIABILITI',
      
      // Cash Flow Items
      cfOperating: 'Aliran tunai daripada aktiviti operasi',
      cfInvesting: 'Aliran tunai daripada aktiviti pelaburan',
      cfFinancing: 'Aliran tunai daripada aktiviti pembiayaan',
      netCashOps: 'Tunai bersih daripada aktiviti operasi',
      netCashInv: 'Tunai bersih digunakan dalam aktiviti pelaburan',
      netCashFin: 'Tunai bersih daripada/(digunakan dalam) aktiviti pembiayaan',
      netIncrease: 'Kenaikan/(penurunan) bersih tunai dan kesetaraan tunai',
      cashBF: 'Tunai dan kesetaraan tunai pada awal tahun',
      cashCF: 'Tunai dan kesetaraan tunai pada akhir tahun',
      
      // SOCE Items
      balanceAt: 'Baki pada',
      profitForYear: 'Untung/(rugi) bagi tahun',
      dividendsPaid: 'Dividen dibayar',
      
      // Notes
      note: 'Nota',
      rm: 'RM',
      total: 'Jumlah',
      notesIntegral: 'Nota-nota yang dilampirkan merupakan sebahagian yang tidak terpisahkan daripada penyata kewangan ini.',
      basisOfPrep: 'ASAS PENYEDIAAN',
      basisText: 'Penyata kewangan Syarikat telah disediakan selaras dengan',
      summaryPolicies: 'RINGKASAN POLISI PERAKAUNAN YANG SIGNIFIKAN',
      revenueRecog: 'Pengiktirafan hasil',
      ppePolicy: 'Hartanah, loji dan peralatan',
      inventoryPolicy: 'Inventori',
      financialInstr: 'Instrumen kewangan',
      taxPolicy: 'Percukaian',
      
      // Note Titles
      notePPE: 'HARTANAH, LOJI DAN PERALATAN',
      noteInventory: 'INVENTORI',
      noteTradeRec: 'PENGHUTANG PERDAGANGAN DAN LAIN-LAIN',
      noteCash: 'TUNAI DAN BAKI BANK',
      noteShareCap: 'MODAL SAHAM',
      noteOwnerCap: 'MODAL PEMILIK',
      noteTradePay: 'PEMIUTANG PERDAGANGAN DAN LAIN-LAIN',
      noteBorrowings: 'PINJAMAN',
      noteRevenue: 'HASIL',
      noteExpenses: 'PERBELANJAAN PENTADBIRAN',
      noteCostOfSales: 'KOS JUALAN',
      noteFinCosts: 'KOS KEWANGAN',
      noteTax: 'PERCUKAIAN',
      noteRelatedParty: 'PENDEDAHAN PIHAK BERKAITAN',
      noteContingent: 'LIABILITI LUAR JANGKA',
      noteCommitments: 'KOMITMEN',
      noteSubseqEvents: 'PERISTIWA SELEPAS TARIKH PENYATA KEDUDUKAN KEWANGAN',
      
      // Common phrases
      atCost: 'Pada kos',
      lessAccDep: 'Tolak: Susut nilai terkumpul',
      nbv: 'Nilai buku bersih',
      depCharge: 'Caj susut nilai bagi tahun',
      tradingGoods: 'Barang dagangan / Barang siap',
      cashInHand: 'Tunai dalam tangan',
      cashAtBank: 'Tunai di bank',
      issuedPaid: 'Diterbitkan dan berbayar penuh:',
      ordinaryShares: 'Saham biasa',
      saleOfGoods: 'Jualan barangan',
      renderingServices: 'Pemberian perkhidmatan',
      noContingent: 'Tiada liabiliti luar jangka pada akhir tahun kewangan.',
      noCommitments: 'Tiada komitmen modal pada akhir tahun kewangan.',
      noSubseqEvents: 'Tiada peristiwa penting yang berlaku selepas tarikh penyata kedudukan kewangan yang memerlukan pelarasan atau pendedahan dalam penyata kewangan ini.',
    }
  };

  // Translation helper - returns BM if exists, else EN fallback
  const t = (key, lang = 'EN') => {
    const pack = FS_LANG[lang] || FS_LANG.EN;
    return pack[key] !== undefined ? pack[key] : (FS_LANG.EN[key] || key);
  };

  // Compute applicability flags for conditional note/section inclusion
  const computeApplicability = (fsRes, entityType, inputs = {}) => {
    if (!fsRes) return {};
    
    const threshold = 0.50; // RM 0.50 tolerance for rounding
    const abs = Math.abs;
    
    return {
      // Entity type flags
      isEnterprise: entityType === 'ENTERPRISE',
      isSdnBhd: entityType === 'SDN_BHD',
      isPublic: entityType === 'BERHAD' || entityType === 'LLP',
      
      // Balance Sheet items
      hasPPE: abs(fsRes.bs?.ppe || 0) > threshold || abs(fsRes.bs?.ppe_cost || 0) > threshold || (ppeRegister && ppeRegister.length > 0),
      hasIntangibles: abs(fsRes.bs?.intangibles || 0) > threshold,
      hasInvestments: abs(fsRes.bs?.investments || 0) > threshold,
      hasInventory: abs(fsRes.bs?.inv || 0) > threshold,
      hasTradeReceivables: abs(fsRes.bs?.tr || 0) > threshold,
      hasOtherReceivables: abs(fsRes.bs?.or || 0) > threshold || abs(fsRes.bs?.prepaid || 0) > threshold || abs(fsRes.bs?.deposits || 0) > threshold,
      hasCash: abs(fsRes.bs?.cash || 0) > threshold,
      hasCashInHand: abs(fsRes.bs?.cashInHand || 0) > threshold,
      
      hasShareCapital: entityType !== 'ENTERPRISE' && abs(fsRes.bs?.cap || 0) > threshold,
      hasRetainedEarnings: abs(fsRes.bs?.ret || 0) > threshold,
      
      hasTradePayables: abs(fsRes.bs?.tp || 0) > threshold,
      hasOtherPayables: abs(fsRes.bs?.op || 0) > threshold,
      hasSTBorrowings: abs(fsRes.bs?.borr || 0) > threshold,
      hasLTBorrowings: abs(fsRes.bs?.ltBorr || 0) > threshold,
      hasBorrowings: abs(fsRes.bs?.borr || 0) > threshold || abs(fsRes.bs?.ltBorr || 0) > threshold,
      hasTaxPayable: abs(fsRes.bs?.taxPay || 0) > threshold,
      hasDeferredTax: abs(fsRes.bs?.defTax || 0) > threshold,
      
      // Income Statement items
      hasRevenue: abs(fsRes.is?.rev || 0) > threshold,
      hasCostOfSales: abs(fsRes.is?.cos || 0) > threshold,
      hasOtherIncome: abs(fsRes.is?.oi || 0) > threshold,
      hasAdminExpenses: abs(fsRes.is?.adm || 0) > threshold,
      hasOtherExpenses: abs(fsRes.is?.oe || 0) > threshold,
      hasFinanceCosts: abs(fsRes.is?.fin || 0) > threshold,
      hasDepreciation: abs(fsRes.is?.dep || 0) > threshold,
      hasTaxExpense: abs(fsRes.is?.tax || 0) > threshold,
      
      // Cash Flow
      hasCashFlow: fsRes.cf && (abs(fsRes.cf?.operating || 0) > threshold || abs(fsRes.cf?.investing || 0) > threshold || abs(fsRes.cf?.financing || 0) > threshold),
      
      // Subledger data
      hasPPERegister: ppeRegister && ppeRegister.length > 0,
      hasLoanRegister: loanRegister && loanRegister.length > 0,
      hasReceivablesRegister: receivablesRegister && receivablesRegister.length > 0,
      hasPayablesRegister: payablesRegister && payablesRegister.length > 0,
    };
  };

  // Build Full FS Model - structured document for rendering
  const buildFullFSModel = ({ entityType, lang, company, fsRes, comparatives = {}, options = {} }) => {
    if (!fsRes) return null;
    
    const L = FS_LANG[lang] || FS_LANG.EN;
    const appl = computeApplicability(fsRes, entityType, {});
    const isEnterprise = appl.isEnterprise;
    const isSdnBhd = appl.isSdnBhd;
    const isPublic = appl.isPublic;
    
    const fmtNum = (n) => {
      if (n === undefined || n === null) return '-';
      return Number(n).toLocaleString('en-MY', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    };
    
    const fmtBracket = (n) => {
      if (n === undefined || n === null) return '-';
      return n < 0 ? '(' + fmtNum(Math.abs(n)) + ')' : fmtNum(n);
    };

    // Note numbering - dynamic based on included notes
    let noteNum = 1;
    const getNextNoteNum = () => noteNum++;
    
    // Build notes array with conditional inclusion
    const buildNotes = () => {
      const notes = [];
      
      // Note 1: Basis of Preparation (always included)
      notes.push({
        no: getNextNoteNum(),
        id: 'basis',
        title: L.basisOfPrep,
        include: true,
        content: {
          type: 'text',
          text: L.basisText + ' ' + (config?.fullStandard || 'Malaysian Private Entities Reporting Standard (MPERS)') + '.'
        }
      });
      
      // Note 2: Summary of Accounting Policies (always for SdnBhd/Public)
      if (!isEnterprise) {
        notes.push({
          no: getNextNoteNum(),
          id: 'policies',
          title: L.summaryPolicies,
          include: true,
          content: { type: 'policies' }
        });
      }
      
      // Note: PPE (if applicable)
      if (appl.hasPPE) {
        notes.push({
          no: getNextNoteNum(),
          id: 'ppe',
          title: L.notePPE,
          include: true,
          content: {
            type: 'ppe',
            cost: fsRes.bs.ppe_cost || 0,
            accDep: fsRes.bs.ppe_accDep || 0,
            nbv: fsRes.bs.ppe || 0,
            currentDep: fsRes.is.dep || 0,
            register: ppeRegister || []
          }
        });
      }
      
      // Note: Inventories (if applicable)
      if (appl.hasInventory) {
        notes.push({
          no: getNextNoteNum(),
          id: 'inventory',
          title: L.noteInventory,
          include: true,
          content: {
            type: 'simple',
            rows: [{ label: L.tradingGoods, amount: fsRes.bs.inv }]
          }
        });
      }
      
      // Note: Trade and Other Receivables (if applicable)
      if (appl.hasTradeReceivables || appl.hasOtherReceivables) {
        const rows = [];
        if (appl.hasTradeReceivables) rows.push({ label: L.tradeRec, amount: fsRes.bs.tr });
        if (fsRes.bs.or > 0) rows.push({ label: lang === 'BM' ? 'Penghutang lain' : 'Other receivables', amount: fsRes.bs.or });
        if (fsRes.bs.prepaid > 0) rows.push({ label: lang === 'BM' ? 'Bayaran terdahulu' : 'Prepayments', amount: fsRes.bs.prepaid });
        if (fsRes.bs.deposits > 0) rows.push({ label: lang === 'BM' ? 'Deposit' : 'Deposits', amount: fsRes.bs.deposits });
        
        notes.push({
          no: getNextNoteNum(),
          id: 'receivables',
          title: L.noteTradeRec,
          include: true,
          content: {
            type: 'simple',
            rows: rows,
            showTotal: rows.length > 1,
            total: (fsRes.bs.tr || 0) + (fsRes.bs.or || 0) + (fsRes.bs.prepaid || 0) + (fsRes.bs.deposits || 0)
          }
        });
      }
      
      // Note: Cash and Bank (always if has cash)
      if (appl.hasCash) {
        notes.push({
          no: getNextNoteNum(),
          id: 'cash',
          title: L.noteCash,
          include: true,
          content: {
            type: 'simple',
            rows: [
              { label: L.cashInHand, amount: fsRes.bs.cashInHand || 0 },
              { label: L.cashAtBank, amount: fsRes.bs.cash - (fsRes.bs.cashInHand || 0) }
            ],
            showTotal: true,
            total: fsRes.bs.cash
          }
        });
      }
      
      // Note: Share Capital (SdnBhd/Public only)
      if (!isEnterprise && appl.hasShareCapital) {
        notes.push({
          no: getNextNoteNum(),
          id: 'sharecapital',
          title: L.noteShareCap,
          include: true,
          content: {
            type: 'sharecapital',
            amount: fsRes.bs.cap
          }
        });
      }
      
      // Note: Owner's Capital (Enterprise only)
      if (isEnterprise) {
        notes.push({
          no: getNextNoteNum(),
          id: 'ownercapital',
          title: L.noteOwnerCap,
          include: true,
          content: {
            type: 'simple',
            rows: [
              { label: L.ownerCapital, amount: fsRes.bs.cap || 0 },
              { label: L.drawings, amount: -(fsRes.bs.drawings || 0) }
            ],
            showTotal: true,
            total: (fsRes.bs.cap || 0) - (fsRes.bs.drawings || 0)
          }
        });
      }
      
      // Note: Trade and Other Payables
      if (appl.hasTradePayables || appl.hasOtherPayables) {
        const rows = [];
        if (appl.hasTradePayables) rows.push({ label: L.tradePay, amount: fsRes.bs.tp });
        if (appl.hasOtherPayables) rows.push({ label: L.otherPay, amount: fsRes.bs.op });
        
        notes.push({
          no: getNextNoteNum(),
          id: 'payables',
          title: L.noteTradePay,
          include: true,
          content: {
            type: 'simple',
            rows: rows,
            showTotal: rows.length > 1,
            total: (fsRes.bs.tp || 0) + (fsRes.bs.op || 0)
          }
        });
      }
      
      // Note: Borrowings (if applicable)
      if (appl.hasBorrowings) {
        const rows = [];
        if (appl.hasSTBorrowings) rows.push({ label: L.stBorrowings, amount: fsRes.bs.borr });
        if (appl.hasLTBorrowings) rows.push({ label: L.ltBorrowings, amount: fsRes.bs.ltBorr });
        
        notes.push({
          no: getNextNoteNum(),
          id: 'borrowings',
          title: L.noteBorrowings,
          include: true,
          content: {
            type: 'simple',
            rows: rows,
            showTotal: rows.length > 1,
            total: (fsRes.bs.borr || 0) + (fsRes.bs.ltBorr || 0)
          }
        });
      }
      
      // Note: Revenue
      if (appl.hasRevenue) {
        notes.push({
          no: getNextNoteNum(),
          id: 'revenue',
          title: L.noteRevenue,
          include: true,
          content: {
            type: 'simple',
            rows: [{ label: L.saleOfGoods, amount: fsRes.is.rev }]
          }
        });
      }
      
      // Note: Cost of Sales (if applicable)
      if (appl.hasCostOfSales) {
        notes.push({
          no: getNextNoteNum(),
          id: 'costOfSales',
          title: L.noteCostOfSales,
          include: true,
          content: {
            type: 'simple',
            rows: [
              { label: lang === 'BM' ? 'Belian' : 'Purchases', amount: fsRes.is.details?.PURCHASE || fsRes.is.cos }
            ]
          }
        });
      }
      
      // Note: Administrative Expenses
      if (appl.hasAdminExpenses) {
        const expRows = [];
        // Add main expense categories from details
        const expenseKeys = ['SALARY', 'RENT', 'UTILITIES', 'DEPRECIATION', 'OFFICE_SUPPLIES', 'PROFESSIONAL_FEES', 'MARKETING', 'TRANSPORT', 'ENTERTAINMENT', 'INSURANCE', 'REPAIRS', 'COMMUNICATION'];
        expenseKeys.forEach(key => {
          if (fsRes.is.details?.[key] > 0) {
            const labels = {
              SALARY: lang === 'BM' ? 'Gaji dan upah' : 'Salaries and wages',
              RENT: lang === 'BM' ? 'Sewa' : 'Rental',
              UTILITIES: lang === 'BM' ? 'Utiliti' : 'Utilities',
              DEPRECIATION: lang === 'BM' ? 'Susut nilai' : 'Depreciation',
              OFFICE_SUPPLIES: lang === 'BM' ? 'Bekalan pejabat' : 'Office supplies',
              PROFESSIONAL_FEES: lang === 'BM' ? 'Yuran profesional' : 'Professional fees',
              MARKETING: lang === 'BM' ? 'Pemasaran dan pengiklanan' : 'Marketing and advertising',
              TRANSPORT: lang === 'BM' ? 'Pengangkutan' : 'Transport',
              ENTERTAINMENT: lang === 'BM' ? 'Keraian' : 'Entertainment',
              INSURANCE: lang === 'BM' ? 'Insurans' : 'Insurance',
              REPAIRS: lang === 'BM' ? 'Pembaikan dan penyelenggaraan' : 'Repairs and maintenance',
              COMMUNICATION: lang === 'BM' ? 'Komunikasi' : 'Communication'
            };
            expRows.push({ label: labels[key] || key, amount: fsRes.is.details[key] });
          }
        });
        
        // If no details, just show total
        if (expRows.length === 0) {
          expRows.push({ label: L.adminExp, amount: fsRes.is.adm });
        }
        
        notes.push({
          no: getNextNoteNum(),
          id: 'expenses',
          title: L.noteExpenses,
          include: true,
          content: {
            type: 'simple',
            rows: expRows,
            showTotal: expRows.length > 1,
            total: fsRes.is.adm
          }
        });
      }
      
      // Note: Finance Costs (if applicable)
      if (appl.hasFinanceCosts) {
        notes.push({
          no: getNextNoteNum(),
          id: 'fincosts',
          title: L.noteFinCosts,
          include: true,
          content: {
            type: 'simple',
            rows: [{ label: lang === 'BM' ? 'Faedah atas pinjaman' : 'Interest on borrowings', amount: fsRes.is.fin }]
          }
        });
      }
      
      // Note: Taxation (if applicable)
      if (appl.hasTaxExpense || appl.hasTaxPayable) {
        notes.push({
          no: getNextNoteNum(),
          id: 'tax',
          title: L.noteTax,
          include: true,
          content: {
            type: 'simple',
            rows: [
              { label: lang === 'BM' ? 'Cukai semasa' : 'Current tax', amount: fsRes.is.tax }
            ]
          }
        });
      }
      
      // Note: Related Party (SdnBhd/Public only)
      if (!isEnterprise) {
        notes.push({
          no: getNextNoteNum(),
          id: 'relatedparty',
          title: L.noteRelatedParty,
          include: true,
          content: {
            type: 'relatedparty',
            directorFees: fsRes.is.details?.DIRECTOR_FEE || Math.round((fsRes.is.adm || 0) * 0.15)
          }
        });
      }
      
      // Note: Contingent Liabilities (SdnBhd/Public placeholder)
      if (!isEnterprise) {
        notes.push({
          no: getNextNoteNum(),
          id: 'contingent',
          title: L.noteContingent,
          include: true,
          content: {
            type: 'text',
            text: L.noContingent
          }
        });
      }
      
      // Note: Commitments (SdnBhd/Public placeholder)
      if (!isEnterprise) {
        notes.push({
          no: getNextNoteNum(),
          id: 'commitments',
          title: L.noteCommitments,
          include: true,
          content: {
            type: 'text',
            text: L.noCommitments
          }
        });
      }
      
      // Note: Subsequent Events (SdnBhd/Public placeholder)
      if (!isEnterprise) {
        notes.push({
          no: getNextNoteNum(),
          id: 'subsequent',
          title: L.noteSubseqEvents,
          include: true,
          content: {
            type: 'text',
            text: L.noSubseqEvents
          }
        });
      }
      
      return notes.filter(n => n.include);
    };

    const notes = buildNotes();
    const lastNotePage = 7 + Math.ceil(notes.length / 3);
    
    return {
      meta: {
        entityType,
        lang,
        companyName: company.name || companyName,
        companyRegNo: company.regNo || companyRegNo,
        accountingStandard: config?.fullStandard || 'Malaysian Private Entities Reporting Standard (MPERS)',
        currentYear,
        priorYear: currentYear - 1,
        fyeDate: financialYearEnd,
        fyeDisplay: (() => {
          const [m, d] = (financialYearEnd || '12-31').split('-');
          const months = ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
          const monthsBM = ['', 'Januari', 'Februari', 'Mac', 'April', 'Mei', 'Jun', 'Julai', 'Ogos', 'September', 'Oktober', 'November', 'Disember'];
          const monthArr = lang === 'BM' ? monthsBM : months;
          return d + ' ' + monthArr[parseInt(m)] + ' ' + currentYear;
        })()
      },
      applicability: appl,
      labels: L,
      helpers: { fmtNum, fmtBracket },
      toc: [
        { title: L.sofp, page: 3, include: true },
        { title: isEnterprise ? L.soplSimple : L.sopl, page: 4, include: true },
        { title: L.soce, page: 5, include: !isEnterprise },
        { title: L.socf, page: 6, include: appl.hasCashFlow || !isEnterprise },
        { title: L.notes, page: '7 - ' + lastNotePage, include: true }
      ].filter(item => item.include),
      sections: {
        cover: { include: true },
        toc: { include: true },
        sofp: {
          include: true,
          title: L.sofp,
          data: fsRes.bs
        },
        sopl: {
          include: true,
          title: isEnterprise ? L.soplSimple : L.sopl,
          data: fsRes.is,
          showOCI: !isEnterprise
        },
        soce: {
          include: !isEnterprise,
          title: L.soce,
          data: {
            openingRE: fsRes.bs.ret - fsRes.bs.cyp,
            profit: fsRes.bs.cyp,
            closingRE: fsRes.bs.ret,
            shareCap: fsRes.bs.cap
          }
        },
        socf: {
          include: appl.hasCashFlow || !isEnterprise,
          title: L.socf,
          data: fsRes.cf
        },
        notes: {
          include: true,
          title: L.notes,
          items: notes
        }
      },
      includedNotes: notes.map(n => ({ no: n.no, title: n.title, id: n.id }))
    };
  };

  // Render Full FS Model to HTML
  const renderFullFSHtml = (model) => {
    if (!model) return '';
    
    const { meta, labels: L, helpers, sections, toc, applicability: appl } = model;
    const { fmtNum, fmtBracket } = helpers;
    const isEnterprise = appl.isEnterprise;
    const lang = meta.lang || 'EN';
    
    // V8: CSS Styles - borders applied via inline styles on amount cells only
    const styles = `
      @page { size: A4; margin: 2cm; }
      @media print { .page { page-break-after: always; } .page:last-child { page-break-after: avoid; } }
      * { box-sizing: border-box; }
      body { font-family: "Times New Roman", Times, serif; font-size: 11pt; line-height: 1.5; color: #000; max-width: 210mm; margin: 0 auto; padding: 20px; }
      .page { page-break-after: always; page-break-inside: avoid; padding-bottom: 20px; margin-bottom: 20px; min-height: 270mm; }
      .page:last-child { page-break-after: avoid; }
      .header { text-align: center; margin-bottom: 25px; }
      .header h1 { font-size: 14pt; font-weight: bold; margin: 0 0 5px 0; text-transform: uppercase; }
      .header h2 { font-size: 12pt; font-weight: bold; margin: 0 0 5px 0; text-transform: uppercase; }
      .section-title { font-size: 11pt; font-weight: bold; text-transform: uppercase; margin: 20px 0 10px 0; }
      .subsection { font-size: 11pt; font-weight: bold; margin: 15px 0 8px 0; }
      table { width: 100%; border-collapse: collapse; margin: 10px 0; }
      table.fs th, table.fs td { padding: 4px 8px; text-align: left; vertical-align: top; font-size: 10pt; }
      .right { text-align: right; }
      .center { text-align: center; }
      .bold { font-weight: bold; }
      .indent { padding-left: 15px; }
      .indent2 { padding-left: 30px; }
      .note-text { font-size: 10pt; margin: 8px 0; text-align: justify; line-height: 1.6; }
      .note-table th, .note-table td { border: 1px solid #000; padding: 4px 6px; font-size: 9pt; }
      .note-table th { background: #f5f5f5; font-weight: bold; }
      .toc-item { display: flex; justify-content: space-between; padding: 5px 0; border-bottom: 1px dotted #ccc; }
      .company-header { text-align: right; font-size: 9pt; margin-bottom: 10px; color: #666; }
      .integral-note { font-size: 9pt; font-style: italic; margin-top: 20px; text-align: center; }
      .version-footer { font-size: 8pt; color: #999; text-align: center; margin-top: 30px; }
    `;
    
    let html = `<!DOCTYPE html><html lang="${lang === 'BM' ? 'ms' : 'en'}"><head><meta charset="UTF-8"><title>${meta.companyName} - ${L.title} ${meta.currentYear}</title><style>${styles}</style></head><body>`;
    
    // Cover Page with version
    html += `<div class="page" style="display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;">
      <div style="margin-bottom:80px;">
        <h1 style="font-size:22pt;margin-bottom:15px;letter-spacing:1px;">${meta.companyName.toUpperCase()}</h1>
        <p style="font-size:11pt;">(${L.regNo}: ${meta.companyRegNo})</p>
        <p style="font-size:10pt;margin-top:3px;">(${L.incMalaysia})</p>
      </div>
      <div style="margin-bottom:80px;">
        <h2 style="font-size:18pt;font-weight:bold;letter-spacing:2px;">${L.title}</h2>
        <p style="font-size:12pt;margin-top:25px;">${L.forYear}</p>
        <p style="font-size:14pt;font-weight:bold;margin-top:5px;">${meta.fyeDisplay.toUpperCase()}</p>
      </div>
      <div style="margin-top:60px;">
        <p style="font-size:10pt;font-style:italic;">${meta.accountingStandard}</p>
        <p class="version-footer">Generated by FS Automation ${APP_VERSION}</p>
      </div>
    </div>`;
    
    // Contents Page
    html += `<div class="page">
      <div class="header"><h1>${meta.companyName.toUpperCase()}</h1></div>
      <h2 style="text-align:center;margin-bottom:30px;">${L.contents}</h2>
      <div style="max-width:400px;margin:0 auto;">
        ${toc.map(item => `<div class="toc-item"><span>${item.title}</span><span>${item.page}</span></div>`).join('')}
      </div>
    </div>`;
    
    // Statement of Financial Position (Balance Sheet)
    if (sections.sofp.include) {
      const bs = sections.sofp.data;
      html += `<div class="page">
        <div class="company-header">${meta.companyName.toUpperCase()} (${meta.companyRegNo})</div>
        <div class="header"><h2>${L.sofp}</h2><p>${L.asAt} ${meta.fyeDisplay.toUpperCase()}</p></div>
        <table class="fs">
          <thead><tr><th style="width:55%"></th><th class="center" style="width:10%">${L.note}</th><th class="right" style="width:17%">${meta.currentYear}<br>${L.rm}</th><th class="right" style="width:18%">${meta.priorYear}<br>${L.rm}</th></tr></thead>
          <tbody>
            ${fsRow4(L.assets, '', '', '', { bold: true })}
            ${fsRow4(L.nca, '', '', '', { bold: true })}
            ${appl.hasPPE ? fsRow4(L.ppe, sections.notes.items.find(n=>n.id==='ppe')?.no||'', fmtNum(bs.ppe), fmtNum(bs.py_ppe||0), { indent: 1 }) : ''}
            ${appl.hasIntangibles ? fsRow4(L.intangibles, '', fmtNum(bs.intangibles), '-', { indent: 1 }) : ''}
            ${fsRow4('', '', fmtNum(bs.totNCA || bs.ppe || 0), fmtNum(bs.py_totNCA||0), { bold: true, line: LINE_TYPE.TOP })}
            ${fsRow4(L.ca, '', '', '', { bold: true })}
            ${appl.hasInventory ? fsRow4(L.inventories, sections.notes.items.find(n=>n.id==='inventory')?.no||'', fmtNum(bs.inv), fmtNum(bs.py_inv||0), { indent: 1 }) : ''}
            ${appl.hasTradeReceivables || appl.hasOtherReceivables ? fsRow4(L.tradeRec, sections.notes.items.find(n=>n.id==='receivables')?.no||'', fmtNum((bs.tr||0)+(bs.or||0)), fmtNum((bs.py_tr||0)+(bs.py_or||0)), { indent: 1 }) : ''}
            ${appl.hasCash ? fsRow4(L.cashBank, sections.notes.items.find(n=>n.id==='cash')?.no||'', fmtNum(bs.cash), fmtNum(bs.py_cash||0), { indent: 1 }) : ''}
            ${fsRow4('', '', fmtNum(bs.totCA), fmtNum(bs.py_totCA||0), { bold: true, line: LINE_TYPE.TOP })}
            ${fsRow4(L.totalAssets, '', fmtNum(bs.totA), fmtNum(bs.py_totA||0), { bold: true, line: LINE_TYPE.DOUBLE_TOP })}
            <tr><td colspan="4" style="height:15px;"></td></tr>
            ${fsRow4(L.equityLiab, '', '', '', { bold: true })}
            ${fsRow4(L.equity, '', '', '', { bold: true })}
            ${!isEnterprise && appl.hasShareCapital ? fsRow4(L.shareCap, sections.notes.items.find(n=>n.id==='sharecapital')?.no||'', fmtNum(bs.cap), fmtNum(bs.py_cap||0), { indent: 1 }) : ''}
            ${isEnterprise ? fsRow4(L.ownerCapital, sections.notes.items.find(n=>n.id==='ownercapital')?.no||'', fmtNum(bs.cap), fmtNum(bs.py_cap||0), { indent: 1 }) : ''}
            ${fsRow4(L.retained, '', fmtNum(bs.ret), fmtNum(bs.py_ret||0), { indent: 1 })}
            ${fsRow4('', '', fmtNum(bs.totE), fmtNum(bs.py_totE||0), { bold: true, line: LINE_TYPE.TOP })}
            ${fsRow4(L.liabilities, '', '', '', { bold: true })}
            ${appl.hasLTBorrowings || appl.hasDeferredTax ? fsRow4(L.ncl, '', '', '', { bold: true }) : ''}
            ${appl.hasLTBorrowings ? fsRow4(L.ltBorrowings, '', fmtNum(bs.ltBorr), fmtNum(bs.py_ltBorr||0), { indent: 1 }) : ''}
            ${fsRow4(L.cl, '', '', '', { bold: true })}
            ${appl.hasTradePayables || appl.hasOtherPayables ? fsRow4(L.tradePay, sections.notes.items.find(n=>n.id==='payables')?.no||'', fmtNum((bs.tp||0)+(bs.op||0)), fmtNum((bs.py_tp||0)+(bs.py_op||0)), { indent: 1 }) : ''}
            ${appl.hasSTBorrowings ? fsRow4(L.stBorrowings, sections.notes.items.find(n=>n.id==='borrowings')?.no||'', fmtNum(bs.borr), fmtNum(bs.py_borr||0), { indent: 1 }) : ''}
            ${appl.hasTaxPayable ? fsRow4(L.taxPayable, '', fmtNum(bs.taxPay), fmtNum(bs.py_taxPay||0), { indent: 1 }) : ''}
            ${fsRow4('', '', fmtNum(bs.totL), fmtNum(bs.py_totL||0), { bold: true, line: LINE_TYPE.TOP })}
            ${fsRow4(L.totalEL, '', fmtNum(bs.totE + bs.totL), fmtNum((bs.py_totE||0)+(bs.py_totL||0)), { bold: true, line: LINE_TYPE.DOUBLE_TOP })}
          </tbody>
        </table>
        <p class="integral-note">${L.notesIntegral}</p>
      </div>`;
    }
    
    // Statement of Profit or Loss
    if (sections.sopl.include) {
      const is = sections.sopl.data;
      html += `<div class="page">
        <div class="company-header">${meta.companyName.toUpperCase()} (${meta.companyRegNo})</div>
        <div class="header"><h2>${sections.sopl.title}</h2><p>${L.forYear} ${meta.fyeDisplay.toUpperCase()}</p></div>
        <table class="fs">
          <thead><tr><th style="width:55%"></th><th class="center" style="width:10%">${L.note}</th><th class="right" style="width:17%">${meta.currentYear}<br>${L.rm}</th><th class="right" style="width:18%">${meta.priorYear}<br>${L.rm}</th></tr></thead>
          <tbody>
            ${fsRow4(L.revenue, sections.notes.items.find(n=>n.id==='revenue')?.no||'', fmtNum(is.rev), fmtNum(is.py_rev||0))}
            ${fsRow4(L.costOfSales, sections.notes.items.find(n=>n.id==='costOfSales')?.no||'', '('+fmtNum(is.cos)+')', '('+fmtNum(is.py_cos||0)+')')}
            ${fsRow4(L.grossProfit, '', fmtNum(is.gp), fmtNum(is.py_gp||0), { bold: true, line: LINE_TYPE.TOP })}
            ${appl.hasOtherIncome ? fsRow4(L.otherIncome, '', fmtNum(is.oi), fmtNum(is.py_oi||0)) : ''}
            ${fsRow4(L.adminExp, sections.notes.items.find(n=>n.id==='expenses')?.no||'', '('+fmtNum(is.adm)+')', '('+fmtNum(is.py_adm||0)+')')}
            ${appl.hasOtherExpenses ? fsRow4(L.otherExp, '', '('+fmtNum(is.oe)+')', '('+fmtNum(is.py_oe||0)+')') : ''}
            ${appl.hasFinanceCosts ? fsRow4(L.finCosts, sections.notes.items.find(n=>n.id==='fincosts')?.no||'', '('+fmtNum(is.fin)+')', '('+fmtNum(is.py_fin||0)+')') : ''}
            ${fsRow4(L.pbt, '', fmtNum(is.pbt), fmtNum(is.py_pbt||0), { bold: true, line: LINE_TYPE.TOP })}
            ${fsRow4(L.tax, sections.notes.items.find(n=>n.id==='tax')?.no||'', is.tax > 0 ? '('+fmtNum(is.tax)+')' : '-', (is.py_tax||0) > 0 ? '('+fmtNum(is.py_tax)+')' : '-')}
            ${fsRow4(is.np >= 0 ? L.profitYear : L.lossYear, '', fmtNum(is.np), fmtNum(is.py_np||0), { bold: true, line: LINE_TYPE.DOUBLE_TOP })}
            ${sections.sopl.showOCI ? `
            <tr><td colspan="4" style="height:10px;"></td></tr>
            ${fsRow4(L.oci, '', '-', '-')}
            ${fsRow4(L.totalCI, '', fmtNum(is.np), fmtNum(is.py_np||0), { bold: true, line: LINE_TYPE.DOUBLE_TOP })}
            ` : ''}
          </tbody>
        </table>
        <p class="integral-note">${L.notesIntegral}</p>
      </div>`;
    }
    
    // Statement of Changes in Equity (SdnBhd/Public only)
    if (sections.soce.include) {
      const soce = sections.soce.data;
      html += `<div class="page">
        <div class="company-header">${meta.companyName.toUpperCase()} (${meta.companyRegNo})</div>
        <div class="header"><h2>${L.soce}</h2><p>${L.forYear} ${meta.fyeDisplay.toUpperCase()}</p></div>
        <table class="fs" style="margin-top:30px;">
          <thead><tr><th style="width:40%"></th><th class="right" style="width:20%">${L.shareCap}<br>${L.rm}</th><th class="right" style="width:20%">${L.retained}<br>${L.rm}</th><th class="right" style="width:20%">${L.total}<br>${L.rm}</th></tr></thead>
          <tbody>
            ${soceRow4(L.balanceAt + ' 1.1.' + meta.priorYear, fmtNum(soce.shareCap), fmtNum(soce.openingRE - (soce.py_profit||0)), fmtNum(soce.shareCap + soce.openingRE - (soce.py_profit||0)))}
            ${soceRow4(L.profitForYear, '-', fmtNum(soce.py_profit||0), fmtNum(soce.py_profit||0))}
            ${soceRow4(L.balanceAt + ' 31.12.' + meta.priorYear, fmtNum(soce.shareCap), fmtNum(soce.openingRE), fmtNum(soce.shareCap + soce.openingRE), { line: LINE_TYPE.TOP })}
            ${soceRow4(L.profitForYear, '-', fmtNum(soce.profit), fmtNum(soce.profit))}
            ${soceRow4(L.balanceAt + ' 31.12.' + meta.currentYear, fmtNum(soce.shareCap), fmtNum(soce.closingRE), fmtNum(soce.shareCap + soce.closingRE), { bold: true, line: LINE_TYPE.DOUBLE_TOP })}
          </tbody>
        </table>
        <p class="integral-note">${L.notesIntegral}</p>
      </div>`;
    }
    
    // Statement of Cash Flows
    if (sections.socf.include && sections.socf.data) {
      const cf = sections.socf.data;
      html += `<div class="page">
        <div class="company-header">${meta.companyName.toUpperCase()} (${meta.companyRegNo})</div>
        <div class="header"><h2>${L.socf}</h2><p>${L.forYear} ${meta.fyeDisplay.toUpperCase()}</p></div>
        <table class="fs">
          <thead><tr><th style="width:70%"></th><th class="right" style="width:15%">${meta.currentYear}<br>${L.rm}</th><th class="right" style="width:15%">${meta.priorYear}<br>${L.rm}</th></tr></thead>
          <tbody>
            ${fsRow3(L.cfOperating, '', '', { bold: true })}
            ${fsRow3(L.pbt, fmtNum(cf.pbt || res.is.pbt), fmtNum(cf.py_pbt||0), { indent: 1 })}
            ${fsRow3(lang === 'BM' ? 'Pelarasan untuk:' : 'Adjustments for:', '', '', { indent: 1 })}
            ${fsRow3(L.ppe.split(',')[0] + (lang === 'BM' ? ' - susut nilai' : ' - depreciation'), fmtNum(cf.depreciation || res.is.dep), fmtNum(cf.py_dep||0), { indent: 2 })}
            ${appl.hasFinanceCosts ? fsRow3(L.finCosts, fmtNum(cf.interest || res.is.fin), fmtNum(cf.py_fin||0), { indent: 2 }) : ''}
            ${fsRow3(lang === 'BM' ? 'Tunai operasi sebelum perubahan modal kerja' : 'Operating cash before working capital changes', fmtNum(cf.opCashBefore || (res.is.pbt + (res.is.dep||0) + (res.is.fin||0))), '-', { indent: 1, line: LINE_TYPE.TOP })}
            ${fsRow3(lang === 'BM' ? 'Perubahan dalam inventori' : 'Change in inventories', fmtBracket(cf.invChange||0), '-', { indent: 1 })}
            ${fsRow3(lang === 'BM' ? 'Perubahan dalam penghutang' : 'Change in receivables', fmtBracket(cf.recChange||0), '-', { indent: 1 })}
            ${fsRow3(lang === 'BM' ? 'Perubahan dalam pemiutang' : 'Change in payables', fmtBracket(cf.payChange||0), '-', { indent: 1 })}
            ${fsRow3(lang === 'BM' ? 'Cukai dibayar' : 'Tax paid', fmtBracket(cf.taxPaid||0), '-', { indent: 1 })}
            ${fsRow3(L.netCashOps, fmtNum(cf.operating||0), fmtNum(cf.py_operating||0), { bold: true, line: LINE_TYPE.TOP })}
            <tr><td colspan="3" style="height:10px;"></td></tr>
            ${fsRow3(L.cfInvesting, '', '', { bold: true })}
            ${fsRow3(lang === 'BM' ? 'Pembelian hartanah, loji dan peralatan' : 'Purchase of property, plant and equipment', fmtBracket(cf.ppeAcq||0), '-', { indent: 1 })}
            ${fsRow3(L.netCashInv, fmtBracket(cf.investing||0), fmtNum(cf.py_investing||0), { bold: true, line: LINE_TYPE.TOP })}
            <tr><td colspan="3" style="height:10px;"></td></tr>
            ${fsRow3(L.cfFinancing, '', '', { bold: true })}
            ${appl.hasBorrowings ? fsRow3(lang === 'BM' ? 'Bayaran balik pinjaman' : 'Repayment of borrowings', fmtBracket(cf.loanRepay||0), '-', { indent: 1 }) : ''}
            ${appl.hasFinanceCosts ? fsRow3(lang === 'BM' ? 'Faedah dibayar' : 'Interest paid', fmtBracket(cf.interestPaid || res.is.fin), '-', { indent: 1 }) : ''}
            ${fsRow3(L.netCashFin, fmtBracket(cf.financing||0), fmtNum(cf.py_financing||0), { bold: true, line: LINE_TYPE.TOP })}
            <tr><td colspan="3" style="height:10px;"></td></tr>
            ${fsRow3(L.netIncrease, fmtNum((cf.operating||0)+(cf.investing||0)+(cf.financing||0)), '-', { bold: true, line: LINE_TYPE.TOP })}
            ${fsRow3(L.cashBF, fmtNum(cf.cashBF || res.bs.py_cash || 0), '-')}
            ${fsRow3(L.cashCF, fmtNum(cf.cashCF || res.bs.cash), fmtNum(cf.py_cashCF||0), { bold: true, line: LINE_TYPE.DOUBLE_TOP })}
          </tbody>
        </table>
        <p class="integral-note">${L.notesIntegral}</p>
      </div>`;
    }
    
    // Notes to the Financial Statements
    if (sections.notes.include) {
      const notes = sections.notes.items;
      let notesHtml = '';
      let noteIdx = 0;
      
      // Group notes into pages (roughly 3 notes per page)
      while (noteIdx < notes.length) {
        notesHtml += `<div class="page">
          <div class="company-header">${meta.companyName.toUpperCase()} (${meta.companyRegNo})</div>
          <div class="header"><h2>${L.notes}${noteIdx > 0 ? ' (' + L.continued + ')' : ''}</h2></div>`;
        
        // Add 2-3 notes per page
        const notesOnPage = Math.min(3, notes.length - noteIdx);
        for (let i = 0; i < notesOnPage && noteIdx < notes.length; i++, noteIdx++) {
          const note = notes[noteIdx];
          notesHtml += `<div class="section-title">${note.no}. ${note.title}</div>`;
          
          // Render note content based on type
          if (note.content.type === 'text') {
            notesHtml += `<p class="note-text">${note.content.text}</p>`;
          } else if (note.content.type === 'simple') {
            notesHtml += `<table class="fs"><tbody>`;
            note.content.rows.forEach(r => {
              notesHtml += noteRow2(r.label, fmtNum(r.amount));
            });
            if (note.content.showTotal) {
              notesHtml += noteRow2(L.total, fmtNum(note.content.total), { bold: true, line: LINE_TYPE.TOP });
            }
            notesHtml += `</tbody></table>`;
          } else if (note.content.type === 'ppe') {
            const ppe = note.content;
            if (ppe.register && ppe.register.length > 0) {
              notesHtml += `<table class="note-table"><thead><tr>
                <th style="width:35%">${lang === 'BM' ? 'Keterangan' : 'Description'}</th>
                <th class="right" style="width:20%">${lang === 'BM' ? 'Kos' : 'Cost'}<br>${L.rm}</th>
                <th class="right" style="width:20%">${lang === 'BM' ? 'Susut Nilai Terkumpul' : 'Accum. Dep.'}<br>${L.rm}</th>
                <th class="right" style="width:15%">${lang === 'BM' ? 'NBV' : 'NBV'}<br>${L.rm}</th>
              </tr></thead><tbody>`;
              ppe.register.forEach(item => {
                const cat = PPE_CATEGORIES[item.category] || PPE_CATEGORIES['OFFICE_EQUIPMENT'];
                const cost = parseFloat(item.cost) || 0;
                const accDepBF = parseFloat(item.accDepBF) || 0;
                const currDep = Math.min(cost * (cat.rate / 100), cost - accDepBF);
                const accDepCF = accDepBF + currDep;
                const nbv = cost - accDepCF;
                notesHtml += `<tr><td>${item.description || '-'}</td><td class="right">${fmtNum(cost)}</td><td class="right">${fmtNum(accDepCF)}</td><td class="right">${fmtNum(nbv)}</td></tr>`;
              });
              notesHtml += `<tr style="font-weight:bold;border-top:2px solid #000"><td>${L.total}</td><td class="right">${fmtNum(ppe.cost)}</td><td class="right">${fmtNum(ppe.accDep)}</td><td class="right">${fmtNum(ppe.nbv)}</td></tr>`;
              notesHtml += `</tbody></table>`;
            } else {
              notesHtml += `<table class="fs"><tbody>
                <tr><td style="width:60%">${L.atCost}</td><td class="right">${fmtNum(ppe.cost + ppe.accDep)}</td></tr>
                <tr><td>${L.lessAccDep}</td><td class="right">(${fmtNum(ppe.accDep)})</td></tr>
                <tr style="border-top:1px solid #000"><td class="bold">${L.nbv}</td><td class="right bold">${fmtNum(ppe.nbv)}</td></tr>
              </tbody></table>`;
            }
            notesHtml += `<p class="note-text">${L.depCharge}: ${L.rm} ${fmtNum(ppe.currentDep)}</p>`;
          } else if (note.content.type === 'sharecapital') {
            notesHtml += `<table class="fs"><tbody>
              <tr><td style="width:60%">${L.issuedPaid}</td><td></td></tr>
              <tr><td class="indent">${L.ordinaryShares}</td><td class="right">${fmtNum(note.content.amount)}</td></tr>
            </tbody></table>`;
          } else if (note.content.type === 'policies') {
            notesHtml += `<p class="note-text"><strong>2.1 ${L.revenueRecog}</strong></p>
              <p class="note-text">${lang === 'BM' ? 'Hasil diukur pada nilai saksama balasan yang diterima atau akan diterima. Hasil daripada jualan barangan diiktiraf apabila risiko dan ganjaran pemilikan yang ketara telah dipindahkan kepada pembeli.' : 'Revenue is measured at the fair value of consideration received or receivable. Revenue from sale of goods is recognised when significant risks and rewards of ownership have been transferred to the buyer.'}</p>
              <p class="note-text"><strong>2.2 ${L.ppePolicy}</strong></p>
              <p class="note-text">${lang === 'BM' ? 'Hartanah, loji dan peralatan dinyatakan pada kos tolak susut nilai terkumpul. Susut nilai dicaj ke penyata untung rugi secara garis lurus ke atas anggaran hayat berguna aset.' : 'Property, plant and equipment are stated at cost less accumulated depreciation. Depreciation is charged to profit or loss on a straight-line basis over the estimated useful lives of the assets.'}</p>
              <p class="note-text"><strong>2.3 ${L.financialInstr}</strong></p>
              <p class="note-text">${lang === 'BM' ? 'Aset dan liabiliti kewangan diiktiraf apabila Syarikat menjadi pihak kepada peruntukan kontrak instrumen tersebut.' : 'Financial assets and liabilities are recognised when the Company becomes a party to the contractual provisions of the instrument.'}</p>`;
          } else if (note.content.type === 'relatedparty') {
            notesHtml += `<p class="note-text"><strong>(a) ${lang === 'BM' ? 'Identiti pihak berkaitan' : 'Identities of related parties'}</strong></p>
              <p class="note-text">${lang === 'BM' ? 'Syarikat mempunyai hubungan pihak berkaitan dengan pengarah dan kakitangan pengurusan utama.' : 'The Company has related party relationships with its directors and key management personnel.'}</p>
              <p class="note-text"><strong>(b) ${lang === 'BM' ? 'Pampasan kakitangan pengurusan utama' : 'Key management personnel compensation'}</strong></p>
              <table class="fs"><tbody>
                <tr><td style="width:60%">${lang === 'BM' ? 'Imbuhan pengarah' : 'Directors\' remuneration'}</td><td class="right">${fmtNum(note.content.directorFees)}</td></tr>
              </tbody></table>`;
          }
        }
        
        notesHtml += `</div>`;
      }
      
      html += notesHtml;
    }
    
    html += `</body></html>`;
    return html;
  };

  // Export Full FS to PDF using jsPDF (if available)
  const exportFullFSPdf = async (model, filename) => {
    if (!model) {
      alert('Please generate financial statements first.');
      return;
    }
    
    // Check if jsPDF is available
    if (typeof jspdf === 'undefined' && typeof jsPDF === 'undefined') {
      // Fallback to print dialog
      const html = renderFullFSHtml(model);
      printHtmlToPdf(html, filename.replace('.pdf', ''));
      return;
    }
    
    try {
      const { jsPDF } = window.jspdf || window;
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      
      const { meta, labels: L, helpers, sections, applicability: appl } = model;
      const { fmtNum, fmtBracket } = helpers;
      const pageWidth = 210;
      const pageHeight = 297;
      const margin = 20;
      const contentWidth = pageWidth - (margin * 2);
      let y = margin;
      
      // Helper to add page number
      const addPageNumber = (pageNum) => {
        doc.setFontSize(9);
        doc.setTextColor(128);
        doc.text(`${L.page} ${pageNum}`, pageWidth - margin, pageHeight - 10, { align: 'right' });
        doc.setTextColor(0);
      };
      
      // Cover Page
      doc.setFontSize(22);
      doc.setFont('times', 'bold');
      doc.text(meta.companyName.toUpperCase(), pageWidth / 2, 80, { align: 'center' });
      doc.setFontSize(11);
      doc.setFont('times', 'normal');
      doc.text(`(${L.regNo}: ${meta.companyRegNo})`, pageWidth / 2, 90, { align: 'center' });
      doc.setFontSize(10);
      doc.text(`(${L.incMalaysia})`, pageWidth / 2, 97, { align: 'center' });
      doc.setFontSize(18);
      doc.setFont('times', 'bold');
      doc.text(L.title, pageWidth / 2, 130, { align: 'center' });
      doc.setFontSize(12);
      doc.setFont('times', 'normal');
      doc.text(L.forYear, pageWidth / 2, 145, { align: 'center' });
      doc.setFontSize(14);
      doc.setFont('times', 'bold');
      doc.text(meta.fyeDisplay.toUpperCase(), pageWidth / 2, 155, { align: 'center' });
      doc.setFontSize(10);
      doc.setFont('times', 'italic');
      doc.text(meta.accountingStandard, pageWidth / 2, 200, { align: 'center' });
      addPageNumber(1);
      
      // Contents Page
      doc.addPage();
      y = margin;
      doc.setFontSize(14);
      doc.setFont('times', 'bold');
      doc.text(meta.companyName.toUpperCase(), pageWidth / 2, y, { align: 'center' });
      y += 15;
      doc.setFontSize(12);
      doc.text(L.contents, pageWidth / 2, y, { align: 'center' });
      y += 20;
      doc.setFontSize(11);
      doc.setFont('times', 'normal');
      model.toc.forEach(item => {
        doc.text(item.title, margin + 30, y);
        doc.text(String(item.page), pageWidth - margin - 30, y, { align: 'right' });
        y += 8;
      });
      addPageNumber(2);
      
      // For remaining pages, use autoTable if available, otherwise show message
      if (typeof doc.autoTable === 'function') {
        // Add Statement pages using autoTable
        // This would be a more complete implementation
      }
      
      // Save the PDF
      doc.save(filename);
      
    } catch (err) {
      console.error('PDF export error:', err);
      // Fallback to HTML print
      const html = renderFullFSHtml(model);
      printHtmlToPdf(html, filename.replace('.pdf', ''));
    }
  };

  // Export Full FS to DOCX - Enhanced version
  const exportFullFSDocx = (model, filename) => {
    console.log('exportFullFSDocx called:', filename);
    
    if (!model) {
      alert('Please generate financial statements first.');
      return;
    }
    
    try {
      // Generate Word-compatible HTML with proper page breaks
      const html = renderFullFSHtml(model);
      
      // Enhanced Word HTML wrapper
      const wordHtml = `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
<!--[if gte mso 9]>
<xml>
<w:WordDocument>
<w:View>Print</w:View>
<w:Zoom>100</w:Zoom>
<w:DoNotOptimizeForBrowser/>
</w:WordDocument>
</xml>
<![endif]-->
<style>
@page { size: A4; margin: 2cm; }
body { font-family: "Times New Roman", Times, serif; font-size: 11pt; line-height: 1.5; }
.page { page-break-after: always; }
.page:last-child { page-break-after: avoid; }
table { width: 100%; border-collapse: collapse; page-break-inside: avoid; }
.right { text-align: right; }
.center { text-align: center; }
.bold { font-weight: bold; }
</style>
</head>
<body>
${html.replace(/<html[^>]*>/, '').replace(/<\/html>/, '').replace(/<head>[\s\S]*<\/head>/, '').replace(/<body>/, '').replace(/<\/body>/, '')}
</body>
</html>`;
      
      const blob = new Blob([wordHtml], { type: 'application/msword;charset=utf-8' });
      downloadBlob(blob, filename);
      console.log('Word document downloaded:', filename);
    } catch (err) {
      console.error('exportFullFSDocx error:', err);
      alert('Error exporting Word document: ' + err.message);
    }
  };

  // Preview Full FS with model info
  const previewFullFS = (lang = 'EN') => {
    if (!res) {
      alert('Please generate financial statements first.');
      return;
    }
    
    const model = buildFullFSModel({
      entityType: companyType,
      lang,
      company: { name: companyName, regNo: companyRegNo },
      fsRes: res
    });
    
    if (!model) {
      alert('Error building FS model.');
      return;
    }
    
    const html = renderFullFSHtml(model);
    
    // Open in new window
    const w = window.open('', '_blank');
    if (w) {
      w.document.open();
      w.document.write(html);
      w.document.close();
    } else {
      alert('Pop-up blocked. Please allow pop-ups for this site.');
    }
    
    return model;
  };

  // Download Full FS
  const downloadFullFS = (format, lang = 'EN') => {
    console.log('downloadFullFS called:', format, lang);
    
    if (!res) {
      alert('Please generate financial statements first.');
      return;
    }
    
    try {
      const model = buildFullFSModel({
        entityType: companyType,
        lang,
        company: { name: companyName, regNo: companyRegNo },
        fsRes: res
      });
      
      if (!model) {
        alert('Error building FS model.');
        return;
      }
      
      const coName = (companyName || 'Company').replace(/[^a-zA-Z0-9]/g, '_');
      const suffix = lang === 'BM' ? '_BM' : '_EN';
      
      if (format === 'html') {
        const html = renderFullFSHtml(model);
        const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
        downloadBlob(blob, `${coName}_FS_${currentYear}${suffix}.html`);
        setLogs(prev => [...prev, { t: 'ok', m: `✓ Full FS HTML downloaded (${lang})` }]);
      } else if (format === 'docx' || format === 'doc') {
        exportFullFSDocx(model, `${coName}_FS_${currentYear}${suffix}.doc`);
        setLogs(prev => [...prev, { t: 'ok', m: `✓ Full FS Word document downloaded (${lang})` }]);
      } else if (format === 'pdf') {
        exportFullFSPdf(model, `${coName}_FS_${currentYear}${suffix}.pdf`);
      }
    } catch (err) {
      console.error('downloadFullFS error:', err);
      alert('Error exporting: ' + err.message);
    }
  };


  // ===================== V8: MANAGEMENT PACK (ENHANCED) =====================
  
  const buildManagementPackModel = ({ lang = 'EN' }) => {
    if (!res) return null;
    const isEN = lang !== 'BM';
    const fmtNum = (n) => n == null ? '-' : Number(n).toLocaleString('en-MY', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    const fmtPct = (n) => n == null || isNaN(n) ? '-' : n.toFixed(1) + '%';
    const fmtK = (n) => n == null ? '-' : n >= 1000000 ? (n/1000000).toFixed(1) + 'M' : n >= 1000 ? (n/1000).toFixed(0) + 'K' : fmtNum(n);
    
    const expMap = { SALARY: isEN ? 'Salaries' : 'Gaji', RENT: isEN ? 'Rent' : 'Sewa', UTILITIES: isEN ? 'Utilities' : 'Utiliti', DEPRECIATION: isEN ? 'Depreciation' : 'Susut Nilai', PROFESSIONAL_FEES: isEN ? 'Prof. Fees' : 'Yuran Prof.', MARKETING: isEN ? 'Marketing' : 'Pemasaran', TRANSPORT: isEN ? 'Transport' : 'Pengangkutan', INSURANCE: isEN ? 'Insurance' : 'Insurans', BANK_CHARGES: isEN ? 'Bank Charges' : 'Caj Bank', MISCELLANEOUS: isEN ? 'Others' : 'Lain-lain' };
    const expenses = Object.entries(expMap).filter(([k]) => res.is.details?.[k] > 0).map(([k, label]) => ({ label, amount: res.is.details[k], pct: res.is.adm > 0 ? res.is.details[k] / res.is.adm * 100 : 0 })).sort((a, b) => b.amount - a.amount).slice(0, 8);
    
    const calcAgeing = (items) => { const a = { current: 0, d30: 0, d60: 0, d90: 0, over90: 0, total: 0 }; const today = new Date(); items.forEach(inv => { const amt = parseFloat(inv.amount) || 0; const days = Math.max(0, Math.floor((today - new Date(inv.dueDate)) / 86400000)); if (days <= 0) a.current += amt; else if (days <= 30) a.d30 += amt; else if (days <= 60) a.d60 += amt; else if (days <= 90) a.d90 += amt; else a.over90 += amt; a.total += amt; }); return a; };
    
    const ratios = { gpMargin: res.is.rev > 0 ? res.is.gp / res.is.rev * 100 : 0, npMargin: res.is.rev > 0 ? res.is.np / res.is.rev * 100 : 0, currentRatio: res.bs.totCL > 0 ? res.bs.totCA / res.bs.totCL : 0, quickRatio: res.bs.totCL > 0 ? (res.bs.totCA - (res.bs.inv || 0)) / res.bs.totCL : 0, debtToEquity: res.bs.totE > 0 ? res.bs.totL / res.bs.totE : 0, roe: res.bs.totE > 0 ? res.is.np / res.bs.totE * 100 : 0, roa: res.bs.totA > 0 ? res.is.np / res.bs.totA * 100 : 0, workingCapital: res.bs.totCA - res.bs.totCL };
    
    const ppeItems = ppeRegister.map(p => { const cost = parseFloat(p.cost) || 0; const accDep = parseFloat(p.accDepBF) || 0; const cat = PPE_CATEGORIES[p.category] || PPE_CATEGORIES['OFFICE_EQUIPMENT']; const currDep = Math.min(cost * (cat.rate / 100), cost - accDep); return { desc: p.description, cost, nbv: cost - accDep - currDep }; });
    const topDebtors = [...tradeReceivables].sort((a, b) => (parseFloat(b.amount)||0) - (parseFloat(a.amount)||0)).slice(0, 5);
    const topCreditors = [...tradePayables].sort((a, b) => (parseFloat(b.amount)||0) - (parseFloat(a.amount)||0)).slice(0, 5);
    
    return { meta: { companyName: companyName || 'Company', companyRegNo: companyRegNo || '', year: currentYear, lang, generated: new Date().toLocaleString() }, is: res.is, bs: res.bs, ratios, expenses, arAgeing: calcAgeing(tradeReceivables), apAgeing: calcAgeing(tradePayables), ppeItems, topDebtors, topCreditors, helpers: { fmtNum, fmtPct, fmtK } };
  };

  const renderManagementPackHtml = (model) => {
    if (!model) return '';
    const { meta, is, bs, ratios, expenses, arAgeing, apAgeing, ppeItems, topDebtors, topCreditors, helpers: { fmtNum, fmtPct, fmtK } } = model;
    const isEN = meta.lang !== 'BM';
    
    const bar = (pct, color) => `<div style="height:14px;background:#e5e7eb;border-radius:3px;overflow:hidden"><div style="height:100%;width:${Math.min(pct,100)}%;background:${color};border-radius:3px"></div></div>`;
    
    const css = `@page{size:A4;margin:8mm}@media print{.page{page-break-after:always}.page:last-child{page-break-after:avoid}}*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Segoe UI',Arial,sans-serif;font-size:9pt;color:#1f2937;max-width:210mm;margin:0 auto;background:#fff}.page{padding:12px;min-height:285mm;position:relative}.hdr{background:linear-gradient(135deg,#1e3a8a,#3b82f6);color:#fff;padding:12px 16px;border-radius:6px;margin-bottom:10px;display:flex;justify-content:space-between;align-items:center}.hdr h1{font-size:14pt;margin:0}.hdr .sub{font-size:8pt;opacity:.9}.hdr .meta{text-align:right;font-size:7pt;opacity:.8}.sec{margin-bottom:8px}.sec-title{font-size:10pt;font-weight:700;color:#1e3a8a;border-bottom:2px solid #3b82f6;padding-bottom:3px;margin-bottom:6px}.g2{display:grid;grid-template-columns:1fr 1fr;gap:8px}.g3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px}.g4{display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:6px}.card{background:#f8fafc;border:1px solid #e2e8f0;border-radius:5px;padding:8px}.card.blue{background:linear-gradient(135deg,#eff6ff,#dbeafe);border-color:#93c5fd}.card.green{background:linear-gradient(135deg,#f0fdf4,#dcfce7);border-color:#86efac}.card.red{background:linear-gradient(135deg,#fef2f2,#fee2e2);border-color:#fca5a5}.card.purple{background:linear-gradient(135deg,#faf5ff,#f3e8ff);border-color:#c4b5fd}.card.amber{background:linear-gradient(135deg,#fffbeb,#fef3c7);border-color:#fcd34d}.kpi{text-align:center}.kv{font-size:15pt;font-weight:700;color:#1e3a8a}.kv.grn{color:#059669}.kv.rd{color:#dc2626}.kl{font-size:7pt;color:#64748b;text-transform:uppercase;margin-top:1px}.ks{font-size:7pt;color:#6b7280}table{width:100%;border-collapse:collapse;font-size:8pt}th,td{padding:3px 5px;text-align:left;border-bottom:1px solid #e5e7eb}th{background:#f1f5f9;font-weight:600;color:#475569;font-size:7pt}.r{text-align:right}.b{font-weight:700}.tr{background:#f1f5f9;font-weight:700;border-top:2px solid #3b82f6}.ftr{position:absolute;bottom:6px;left:12px;right:12px;text-align:center;font-size:7pt;color:#9ca3af;border-top:1px solid #e5e7eb;padding-top:3px}.ct{font-weight:600;color:#1e3a8a;margin-bottom:5px;font-size:8pt}`;
    
    const hdr = `<div class="hdr"><div><h1>${meta.companyName}</h1><div class="sub">${isEN ? 'Management Report' : 'Laporan Pengurusan'} • FY ${meta.year}</div></div><div class="meta">${meta.companyRegNo ? meta.companyRegNo + '<br>' : ''}${isEN ? 'Generated' : 'Dijana'}: ${meta.generated}<br>FS Automation ${APP_VERSION}</div></div>`;
    
    let html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${meta.companyName} - Management Report</title><style>${css}</style></head><body>`;
    
    // PAGE 1: Dashboard
    html += `<div class="page">${hdr}
      <div class="sec"><div class="sec-title">📊 ${isEN ? 'Key Performance Indicators' : 'Petunjuk Prestasi Utama'}</div>
        <div class="g4">
          <div class="card blue kpi"><div class="kv">RM ${fmtK(is.rev)}</div><div class="kl">${isEN ? 'Revenue' : 'Hasil'}</div></div>
          <div class="card ${is.gp >= 0 ? 'green' : 'red'} kpi"><div class="kv ${is.gp >= 0 ? 'grn' : 'rd'}">RM ${fmtK(is.gp)}</div><div class="kl">${isEN ? 'Gross Profit' : 'Untung Kasar'}</div><div class="ks">${fmtPct(ratios.gpMargin)}</div></div>
          <div class="card ${is.np >= 0 ? 'green' : 'red'} kpi"><div class="kv ${is.np >= 0 ? 'grn' : 'rd'}">RM ${fmtK(is.np)}</div><div class="kl">${isEN ? 'Net Profit' : 'Untung Bersih'}</div><div class="ks">${fmtPct(ratios.npMargin)}</div></div>
          <div class="card blue kpi"><div class="kv">RM ${fmtK(bs.cash)}</div><div class="kl">${isEN ? 'Cash' : 'Tunai'}</div></div>
        </div>
      </div>
      <div class="sec"><div class="g2">
        <div class="card"><div class="ct">💰 ${isEN ? 'Profit & Loss Summary' : 'Ringkasan Untung Rugi'}</div>
          <table><tr><td>${isEN ? 'Revenue' : 'Hasil'}</td><td class="r b">${fmtNum(is.rev)}</td><td class="r">100%</td></tr>
          <tr><td>${isEN ? 'Cost of Sales' : 'Kos Jualan'}</td><td class="r">(${fmtNum(is.cos)})</td><td class="r" style="color:#dc2626">${fmtPct(is.rev > 0 ? is.cos/is.rev*100 : 0)}</td></tr>
          <tr class="tr"><td>${isEN ? 'Gross Profit' : 'Untung Kasar'}</td><td class="r">${fmtNum(is.gp)}</td><td class="r" style="color:#059669">${fmtPct(ratios.gpMargin)}</td></tr>
          ${is.oi > 0 ? `<tr><td>${isEN ? 'Other Income' : 'Pendapatan Lain'}</td><td class="r">${fmtNum(is.oi)}</td><td class="r">${fmtPct(is.rev > 0 ? is.oi/is.rev*100 : 0)}</td></tr>` : ''}
          <tr><td>${isEN ? 'Operating Expenses' : 'Perbelanjaan'}</td><td class="r">(${fmtNum(is.adm)})</td><td class="r">${fmtPct(is.rev > 0 ? is.adm/is.rev*100 : 0)}</td></tr>
          ${is.fin > 0 ? `<tr><td>${isEN ? 'Finance Costs' : 'Kos Kewangan'}</td><td class="r">(${fmtNum(is.fin)})</td><td class="r">${fmtPct(is.rev > 0 ? is.fin/is.rev*100 : 0)}</td></tr>` : ''}
          <tr class="tr"><td>${isEN ? 'Profit Before Tax' : 'Untung Sebelum Cukai'}</td><td class="r">${fmtNum(is.pbt)}</td><td></td></tr>
          <tr><td>${isEN ? 'Taxation' : 'Cukai'}</td><td class="r">${is.tax > 0 ? '('+fmtNum(is.tax)+')' : '-'}</td><td></td></tr>
          <tr class="tr" style="background:#dcfce7"><td class="b">${isEN ? 'Net Profit' : 'Untung Bersih'}</td><td class="r b" style="color:${is.np>=0?'#059669':'#dc2626'}">${fmtNum(is.np)}</td><td class="r b">${fmtPct(ratios.npMargin)}</td></tr></table>
        </div>
        <div class="card"><div class="ct">📈 ${isEN ? 'Financial Ratios' : 'Nisbah Kewangan'}</div>
          <table><tr><td>${isEN ? 'Current Ratio' : 'Nisbah Semasa'}</td><td class="r b" style="color:${ratios.currentRatio >= 1 ? '#059669' : '#dc2626'}">${ratios.currentRatio.toFixed(2)}</td><td style="width:80px">${bar(ratios.currentRatio/2*100, ratios.currentRatio >= 1 ? '#10b981' : '#ef4444')}</td></tr>
          <tr><td>${isEN ? 'Quick Ratio' : 'Nisbah Cepat'}</td><td class="r b" style="color:${ratios.quickRatio >= 1 ? '#059669' : '#dc2626'}">${ratios.quickRatio.toFixed(2)}</td><td>${bar(ratios.quickRatio/2*100, ratios.quickRatio >= 1 ? '#10b981' : '#ef4444')}</td></tr>
          <tr><td>${isEN ? 'Debt to Equity' : 'Hutang/Ekuiti'}</td><td class="r b" style="color:${ratios.debtToEquity <= 1 ? '#059669' : '#f59e0b'}">${ratios.debtToEquity.toFixed(2)}</td><td>${bar(ratios.debtToEquity/2*100, ratios.debtToEquity <= 1 ? '#10b981' : '#f59e0b')}</td></tr>
          <tr><td>${isEN ? 'Return on Equity' : 'Pulangan Ekuiti'}</td><td class="r b">${fmtPct(ratios.roe)}</td><td>${bar(Math.abs(ratios.roe)/30*100, ratios.roe >= 0 ? '#3b82f6' : '#ef4444')}</td></tr>
          <tr><td>${isEN ? 'Return on Assets' : 'Pulangan Aset'}</td><td class="r b">${fmtPct(ratios.roa)}</td><td>${bar(Math.abs(ratios.roa)/20*100, ratios.roa >= 0 ? '#3b82f6' : '#ef4444')}</td></tr>
          <tr class="tr"><td>${isEN ? 'Working Capital' : 'Modal Kerja'}</td><td class="r b" style="color:${ratios.workingCapital >= 0 ? '#059669' : '#dc2626'}">RM ${fmtNum(ratios.workingCapital)}</td><td></td></tr></table>
        </div>
      </div></div>
      <div class="sec"><div class="g2">
        <div class="card"><div class="ct">🏦 ${isEN ? 'Balance Sheet' : 'Kedudukan Kewangan'}</div>
          <table><tr><th colspan="2">${isEN ? 'ASSETS' : 'ASET'}</th></tr>
          ${bs.ppe > 0 ? `<tr><td style="padding-left:8px">PPE</td><td class="r">${fmtNum(bs.ppe)}</td></tr>` : ''}
          ${bs.inv > 0 ? `<tr><td style="padding-left:8px">${isEN ? 'Inventory' : 'Inventori'}</td><td class="r">${fmtNum(bs.inv)}</td></tr>` : ''}
          <tr><td style="padding-left:8px">${isEN ? 'Receivables' : 'Penghutang'}</td><td class="r">${fmtNum((bs.tr||0)+(bs.or||0))}</td></tr>
          <tr><td style="padding-left:8px">${isEN ? 'Cash' : 'Tunai'}</td><td class="r">${fmtNum(bs.cash)}</td></tr>
          <tr class="tr"><td>${isEN ? 'Total Assets' : 'Jumlah Aset'}</td><td class="r">${fmtNum(bs.totA)}</td></tr>
          <tr><th colspan="2">${isEN ? 'LIABILITIES' : 'LIABILITI'}</th></tr>
          <tr class="tr"><td>${isEN ? 'Total Liabilities' : 'Jumlah Liabiliti'}</td><td class="r">${fmtNum(bs.totL)}</td></tr>
          <tr><th colspan="2">${isEN ? 'EQUITY' : 'EKUITI'}</th></tr>
          <tr class="tr"><td>${isEN ? 'Total Equity' : 'Jumlah Ekuiti'}</td><td class="r">${fmtNum(bs.totE)}</td></tr></table>
        </div>
        <div class="card"><div class="ct">💸 ${isEN ? 'Expense Breakdown' : 'Pecahan Perbelanjaan'}</div>
          ${expenses.length > 0 ? `<table>${expenses.map(e => `<tr><td>${e.label}</td><td class="r">${fmtNum(e.amount)}</td><td style="width:80px">${bar(e.pct, '#f59e0b')}</td><td class="r" style="width:35px">${fmtPct(e.pct)}</td></tr>`).join('')}<tr class="tr"><td>${isEN ? 'Total' : 'Jumlah'}</td><td class="r">${fmtNum(is.adm)}</td><td colspan="2"></td></tr></table>` : `<div style="color:#9ca3af;text-align:center;padding:15px">${isEN ? 'No expense details' : 'Tiada butiran'}</div>`}
        </div>
      </div></div>
      <div class="ftr">${isEN ? 'Page' : 'Muka Surat'} 1 • ${meta.companyName}</div>
    </div>`;
    
    // Generate narrative insights
    const insights = [];
    if (ratios.gpMargin >= 30) insights.push({ type: 'good', text: isEN ? 'Strong gross margin above 30% indicates healthy pricing and cost control' : 'Margin kasar kukuh melebihi 30% menunjukkan penetapan harga dan kawalan kos yang sihat' });
    else if (ratios.gpMargin < 20) insights.push({ type: 'warn', text: isEN ? 'Gross margin below 20% may indicate pricing pressure or high direct costs' : 'Margin kasar di bawah 20% mungkin menunjukkan tekanan harga atau kos langsung yang tinggi' });
    if (ratios.currentRatio >= 1.5) insights.push({ type: 'good', text: isEN ? 'Current ratio above 1.5 shows healthy short-term liquidity' : 'Nisbah semasa melebihi 1.5 menunjukkan kecairan jangka pendek yang sihat' });
    else if (ratios.currentRatio < 1) insights.push({ type: 'warn', text: isEN ? 'Current ratio below 1 indicates potential liquidity risk' : 'Nisbah semasa di bawah 1 menunjukkan risiko kecairan' });
    if (arAgeing.over90 > arAgeing.total * 0.2) insights.push({ type: 'warn', text: isEN ? `${fmtPct(arAgeing.over90/arAgeing.total*100)} of receivables overdue >90 days - review collection efforts` : `${fmtPct(arAgeing.over90/arAgeing.total*100)} penghutang tertunggak >90 hari - semak usaha kutipan` });
    if (ratios.debtToEquity > 2) insights.push({ type: 'warn', text: isEN ? 'High leverage with debt-to-equity above 2x' : 'Leveraj tinggi dengan hutang/ekuiti melebihi 2x' });
    else if (ratios.debtToEquity <= 0.5) insights.push({ type: 'good', text: isEN ? 'Conservative capital structure with low debt' : 'Struktur modal konservatif dengan hutang rendah' });
    if (is.np > 0 && ratios.roe >= 15) insights.push({ type: 'good', text: isEN ? `Strong ROE of ${fmtPct(ratios.roe)} indicates efficient use of equity` : `ROE kukuh ${fmtPct(ratios.roe)} menunjukkan penggunaan ekuiti yang cekap` });
    if (ratios.workingCapital < 0) insights.push({ type: 'warn', text: isEN ? 'Negative working capital - may need to improve cash cycle' : 'Modal kerja negatif - mungkin perlu memperbaiki kitaran tunai' });
    
    // Add insights box at end of page 1
    if (insights.length > 0) {
      html = html.replace('</div>\n      <div class="ftr">' + (isEN ? 'Page' : 'Muka Surat') + ' 1', `
      <div class="sec"><div class="card amber"><div class="ct">💡 ${isEN ? 'Management Insights & Recommendations' : 'Pandangan & Cadangan Pengurusan'}</div>
        <ul style="margin:0;padding-left:15px;font-size:8pt">
          ${insights.map(i => `<li style="color:${i.type === 'good' ? '#059669' : '#dc2626'};margin:3px 0">${i.type === 'good' ? '✓' : '⚠'} ${i.text}</li>`).join('')}
        </ul>
      </div></div>
      </div>\n      <div class="ftr">${isEN ? 'Page' : 'Muka Surat'} 1`);
    }
    
    // PAGE 2: AR/AP & Details
    html += `<div class="page">${hdr}
      <div class="sec"><div class="sec-title">💳 ${isEN ? 'Receivables & Payables Analysis' : 'Analisis Penghutang & Pemiutang'}</div>
        <div class="g2">
          <div class="card ${arAgeing.over90 > arAgeing.total * 0.2 ? 'red' : ''}"><div class="ct">📥 ${isEN ? 'Accounts Receivable Ageing' : 'Pengumuran Penghutang'}</div>
            <table><tr><th>${isEN ? 'Ageing' : 'Umur'}</th><th class="r">${isEN ? 'Amount' : 'Jumlah'}</th><th class="r">%</th><th style="width:70px"></th></tr>
            <tr><td>${isEN ? 'Current' : 'Semasa'}</td><td class="r">${fmtNum(arAgeing.current)}</td><td class="r">${arAgeing.total > 0 ? fmtPct(arAgeing.current/arAgeing.total*100) : '-'}</td><td>${bar(arAgeing.total > 0 ? arAgeing.current/arAgeing.total*100 : 0, '#10b981')}</td></tr>
            <tr><td>1-30 ${isEN ? 'days' : 'hari'}</td><td class="r">${fmtNum(arAgeing.d30)}</td><td class="r">${arAgeing.total > 0 ? fmtPct(arAgeing.d30/arAgeing.total*100) : '-'}</td><td>${bar(arAgeing.total > 0 ? arAgeing.d30/arAgeing.total*100 : 0, '#3b82f6')}</td></tr>
            <tr><td>31-60 ${isEN ? 'days' : 'hari'}</td><td class="r">${fmtNum(arAgeing.d60)}</td><td class="r">${arAgeing.total > 0 ? fmtPct(arAgeing.d60/arAgeing.total*100) : '-'}</td><td>${bar(arAgeing.total > 0 ? arAgeing.d60/arAgeing.total*100 : 0, '#f59e0b')}</td></tr>
            <tr><td>61-90 ${isEN ? 'days' : 'hari'}</td><td class="r">${fmtNum(arAgeing.d90)}</td><td class="r">${arAgeing.total > 0 ? fmtPct(arAgeing.d90/arAgeing.total*100) : '-'}</td><td>${bar(arAgeing.total > 0 ? arAgeing.d90/arAgeing.total*100 : 0, '#f97316')}</td></tr>
            <tr style="background:#fef2f2"><td class="b">> 90 ${isEN ? 'days' : 'hari'}</td><td class="r b" style="color:#dc2626">${fmtNum(arAgeing.over90)}</td><td class="r b">${arAgeing.total > 0 ? fmtPct(arAgeing.over90/arAgeing.total*100) : '-'}</td><td>${bar(arAgeing.total > 0 ? arAgeing.over90/arAgeing.total*100 : 0, '#ef4444')}</td></tr>
            <tr class="tr"><td>${isEN ? 'Total' : 'Jumlah'}</td><td class="r">${fmtNum(arAgeing.total)}</td><td class="r">100%</td><td></td></tr></table>
          </div>
          <div class="card"><div class="ct">📤 ${isEN ? 'Accounts Payable Ageing' : 'Pengumuran Pemiutang'}</div>
            <table><tr><th>${isEN ? 'Ageing' : 'Umur'}</th><th class="r">${isEN ? 'Amount' : 'Jumlah'}</th><th class="r">%</th><th style="width:70px"></th></tr>
            <tr><td>${isEN ? 'Current' : 'Semasa'}</td><td class="r">${fmtNum(apAgeing.current)}</td><td class="r">${apAgeing.total > 0 ? fmtPct(apAgeing.current/apAgeing.total*100) : '-'}</td><td>${bar(apAgeing.total > 0 ? apAgeing.current/apAgeing.total*100 : 0, '#10b981')}</td></tr>
            <tr><td>1-30 ${isEN ? 'days' : 'hari'}</td><td class="r">${fmtNum(apAgeing.d30)}</td><td class="r">${apAgeing.total > 0 ? fmtPct(apAgeing.d30/apAgeing.total*100) : '-'}</td><td>${bar(apAgeing.total > 0 ? apAgeing.d30/apAgeing.total*100 : 0, '#3b82f6')}</td></tr>
            <tr><td>31-60 ${isEN ? 'days' : 'hari'}</td><td class="r">${fmtNum(apAgeing.d60)}</td><td class="r">${apAgeing.total > 0 ? fmtPct(apAgeing.d60/apAgeing.total*100) : '-'}</td><td>${bar(apAgeing.total > 0 ? apAgeing.d60/apAgeing.total*100 : 0, '#f59e0b')}</td></tr>
            <tr><td>61-90 ${isEN ? 'days' : 'hari'}</td><td class="r">${fmtNum(apAgeing.d90)}</td><td class="r">${apAgeing.total > 0 ? fmtPct(apAgeing.d90/apAgeing.total*100) : '-'}</td><td>${bar(apAgeing.total > 0 ? apAgeing.d90/apAgeing.total*100 : 0, '#f97316')}</td></tr>
            <tr><td>> 90 ${isEN ? 'days' : 'hari'}</td><td class="r">${fmtNum(apAgeing.over90)}</td><td class="r">${apAgeing.total > 0 ? fmtPct(apAgeing.over90/apAgeing.total*100) : '-'}</td><td>${bar(apAgeing.total > 0 ? apAgeing.over90/apAgeing.total*100 : 0, '#ef4444')}</td></tr>
            <tr class="tr"><td>${isEN ? 'Total' : 'Jumlah'}</td><td class="r">${fmtNum(apAgeing.total)}</td><td class="r">100%</td><td></td></tr></table>
          </div>
        </div>
      </div>
      ${topDebtors.length > 0 || topCreditors.length > 0 ? `<div class="sec"><div class="g2">
        ${topDebtors.length > 0 ? `<div class="card"><div class="ct">👥 ${isEN ? 'Top 5 Debtors' : 'Top 5 Penghutang'}</div>
          <table><tr><th>${isEN ? 'Customer' : 'Pelanggan'}</th><th class="r">${isEN ? 'Amount' : 'Jumlah'}</th></tr>
          ${topDebtors.map(c => `<tr><td>${c.customer || c.description || 'N/A'}</td><td class="r">${fmtNum(parseFloat(c.amount)||0)}</td></tr>`).join('')}</table></div>` : '<div></div>'}
        ${topCreditors.length > 0 ? `<div class="card"><div class="ct">🏭 ${isEN ? 'Top 5 Creditors' : 'Top 5 Pemiutang'}</div>
          <table><tr><th>${isEN ? 'Supplier' : 'Pembekal'}</th><th class="r">${isEN ? 'Amount' : 'Jumlah'}</th></tr>
          ${topCreditors.map(s => `<tr><td>${s.supplier || s.description || 'N/A'}</td><td class="r">${fmtNum(parseFloat(s.amount)||0)}</td></tr>`).join('')}</table></div>` : '<div></div>'}
      </div></div>` : ''}
      ${ppeItems.length > 0 ? `<div class="sec"><div class="sec-title">🏢 ${isEN ? 'Property, Plant & Equipment' : 'Hartanah, Loji & Peralatan'}</div>
        <table><tr><th>${isEN ? 'Description' : 'Keterangan'}</th><th class="r">${isEN ? 'Cost' : 'Kos'}</th><th class="r">${isEN ? 'NBV' : 'NBV'}</th></tr>
        ${ppeItems.map(p => `<tr><td>${p.desc}</td><td class="r">${fmtNum(p.cost)}</td><td class="r b">${fmtNum(p.nbv)}</td></tr>`).join('')}
        <tr class="tr"><td>${isEN ? 'Total' : 'Jumlah'}</td><td></td><td class="r">${fmtNum(bs.ppe)}</td></tr></table>
      </div>` : ''}
      <div class="sec"><div class="card" style="background:linear-gradient(135deg,#1e3a8a,#3b82f6);color:#fff;padding:15px">
        <div style="font-size:11pt;font-weight:700;margin-bottom:8px">⚡ ${isEN ? 'Financial Health Score' : 'Skor Kesihatan Kewangan'}</div>
        <div class="g4">
          <div style="text-align:center"><div style="font-size:20pt;font-weight:700">${ratios.gpMargin >= 30 ? 'A' : ratios.gpMargin >= 20 ? 'B' : ratios.gpMargin >= 10 ? 'C' : 'D'}</div><div style="font-size:7pt;opacity:.9">${isEN ? 'Profitability' : 'Keuntungan'}</div></div>
          <div style="text-align:center"><div style="font-size:20pt;font-weight:700">${ratios.currentRatio >= 2 ? 'A' : ratios.currentRatio >= 1.5 ? 'B' : ratios.currentRatio >= 1 ? 'C' : 'D'}</div><div style="font-size:7pt;opacity:.9">${isEN ? 'Liquidity' : 'Kecairan'}</div></div>
          <div style="text-align:center"><div style="font-size:20pt;font-weight:700">${ratios.debtToEquity <= 0.5 ? 'A' : ratios.debtToEquity <= 1 ? 'B' : ratios.debtToEquity <= 2 ? 'C' : 'D'}</div><div style="font-size:7pt;opacity:.9">${isEN ? 'Leverage' : 'Leveraj'}</div></div>
          <div style="text-align:center"><div style="font-size:20pt;font-weight:700">${arAgeing.over90 <= arAgeing.total * 0.1 ? 'A' : arAgeing.over90 <= arAgeing.total * 0.2 ? 'B' : arAgeing.over90 <= arAgeing.total * 0.3 ? 'C' : 'D'}</div><div style="font-size:7pt;opacity:.9">${isEN ? 'Collections' : 'Kutipan'}</div></div>
        </div>
      </div></div>
      <div class="ftr">${isEN ? 'Page' : 'Muka Surat'} 2 • ${meta.companyName} • ${isEN ? 'Generated by' : 'Dijana oleh'} FS Automation ${APP_VERSION}</div>
    </div>`;
    
    return html + '</body></html>';
  };

  const downloadManagementPack = (format = 'html', lang = 'EN') => {
    if (!res) { alert('Please generate financial statements first.'); return; }
    try {
      const model = buildManagementPackModel({ lang });
      if (!model) { alert('Error building Management Pack.'); return; }
      const html = renderManagementPackHtml(model);
      if (format === 'pdf') {
        setPreviewContent(html);
        setPreviewType('pdf');
        setShowExportModal(false);
        setLogs(prev => [...prev, { t: 'ok', m: `✓ Management Pack PDF ready (${lang}). Click "Print to PDF" or use Ctrl+P.` }]);
      } else if (format === 'pptx') {
        // Generate PowerPoint
        generateManagementPackPPTX(model, lang);
      } else {
        const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
        downloadBlob(blob, `${(companyName||'Company').replace(/[^a-zA-Z0-9]/g,'_')}_MgmtPack_${currentYear}_${lang}.html`);
        setLogs(prev => [...prev, { t: 'ok', m: `✓ Management Pack downloaded (${lang})` }]);
      }
    } catch (err) { console.error(err); alert('Error: ' + err.message); }
  };

  // Generate Management Pack PowerPoint
  const generateManagementPackPPTX = async (model, lang) => {
    const isEN = lang !== 'BM';
    const { meta, is, bs, ratios, expenses, arAgeing, apAgeing } = model;
    const { fmtNum, fmtPct, fmtK } = model.helpers;
    
    try {
      // Dynamic import PptxGenJS (browser & Electron safe)
      let PptxGenJS;
      if (typeof window !== 'undefined' && window.PptxGenJS) {
        PptxGenJS = window.PptxGenJS;
      } else {
        try {
          const module = await import('pptxgenjs');
          PptxGenJS = module.default || module;
        } catch (importErr) {
          console.error('Failed to import PptxGenJS:', importErr);
          alert('PowerPoint export requires PptxGenJS library.\n\nPlease use PDF or HTML export instead, or ensure pptxgenjs is installed.');
          return;
        }
      }
      
      // Create new presentation
      const pptx = new PptxGenJS();
      pptx.author = 'FS Automation V8';
      pptx.title = `${meta.companyName} - Management Report FY${meta.year}`;
      pptx.subject = 'Management Report';
      
      // Slide 1: Title
      let slide = pptx.addSlide();
      slide.addText(meta.companyName, { x: 0.5, y: 2, w: 9, h: 1, fontSize: 36, bold: true, color: '1e3a8a', align: 'center' });
      slide.addText(isEN ? 'Management Report' : 'Laporan Pengurusan', { x: 0.5, y: 3, w: 9, h: 0.5, fontSize: 24, color: '3b82f6', align: 'center' });
      slide.addText(`FY ${meta.year}`, { x: 0.5, y: 3.6, w: 9, h: 0.5, fontSize: 18, color: '64748b', align: 'center' });
      slide.addText(`${isEN ? 'Generated' : 'Dijana'}: ${meta.generated}`, { x: 0.5, y: 5, w: 9, h: 0.3, fontSize: 10, color: '9ca3af', align: 'center' });
      
      // Slide 2: KPIs
      slide = pptx.addSlide();
      slide.addText(isEN ? 'Key Performance Indicators' : 'Petunjuk Prestasi Utama', { x: 0.3, y: 0.3, w: 9.4, h: 0.5, fontSize: 24, bold: true, color: '1e3a8a' });
      
      const kpiData = [
        { label: isEN ? 'Revenue' : 'Hasil', value: `RM ${fmtK(is.rev)}`, color: '3b82f6' },
        { label: isEN ? 'Gross Profit' : 'Untung Kasar', value: `RM ${fmtK(is.gp)}`, sub: fmtPct(ratios.gpMargin), color: is.gp >= 0 ? '10b981' : 'ef4444' },
        { label: isEN ? 'Net Profit' : 'Untung Bersih', value: `RM ${fmtK(is.np)}`, sub: fmtPct(ratios.npMargin), color: is.np >= 0 ? '10b981' : 'ef4444' },
        { label: isEN ? 'Cash Balance' : 'Baki Tunai', value: `RM ${fmtK(bs.cash)}`, color: '3b82f6' }
      ];
      
      kpiData.forEach((kpi, i) => {
        const x = 0.3 + (i * 2.4);
        slide.addShape(pptx.ShapeType.roundRect, { x, y: 1, w: 2.2, h: 1.2, fill: { color: 'f8fafc' }, line: { color: kpi.color, pt: 2 } });
        slide.addText(kpi.value, { x, y: 1.1, w: 2.2, h: 0.6, fontSize: 18, bold: true, color: kpi.color, align: 'center' });
        slide.addText(kpi.label, { x, y: 1.6, w: 2.2, h: 0.3, fontSize: 10, color: '64748b', align: 'center' });
        if (kpi.sub) slide.addText(kpi.sub, { x, y: 1.9, w: 2.2, h: 0.2, fontSize: 9, color: '9ca3af', align: 'center' });
      });
      
      // Add narrative insights
      const insights = [];
      if (ratios.gpMargin >= 30) insights.push(isEN ? '✓ Strong gross margin above 30%' : '✓ Margin kasar kukuh melebihi 30%');
      else if (ratios.gpMargin < 20) insights.push(isEN ? '⚠ Gross margin below 20% needs attention' : '⚠ Margin kasar di bawah 20% perlu perhatian');
      if (ratios.currentRatio >= 1.5) insights.push(isEN ? '✓ Healthy liquidity position' : '✓ Kedudukan kecairan sihat');
      else if (ratios.currentRatio < 1) insights.push(isEN ? '⚠ Current ratio below 1 - liquidity risk' : '⚠ Nisbah semasa di bawah 1 - risiko kecairan');
      if (arAgeing.over90 > arAgeing.total * 0.2) insights.push(isEN ? '⚠ High overdue receivables (>20%)' : '⚠ Penghutang tertunggak tinggi (>20%)');
      if (ratios.debtToEquity > 2) insights.push(isEN ? '⚠ High leverage - debt/equity > 2' : '⚠ Leveraj tinggi - hutang/ekuiti > 2');
      
      slide.addText(isEN ? 'Key Insights:' : 'Pandangan Utama:', { x: 0.3, y: 2.5, w: 9.4, h: 0.4, fontSize: 14, bold: true, color: '1e3a8a' });
      insights.forEach((insight, i) => {
        slide.addText(insight, { x: 0.5, y: 2.9 + (i * 0.35), w: 9, h: 0.35, fontSize: 11, color: insight.startsWith('✓') ? '059669' : 'dc2626' });
      });
      
      // Slide 3: P&L
      slide = pptx.addSlide();
      slide.addText(isEN ? 'Profit & Loss Summary' : 'Ringkasan Untung Rugi', { x: 0.3, y: 0.3, w: 9.4, h: 0.5, fontSize: 24, bold: true, color: '1e3a8a' });
      
      const pnlRows = [
        [isEN ? 'Revenue' : 'Hasil', fmtNum(is.rev), '100%'],
        [isEN ? 'Cost of Sales' : 'Kos Jualan', `(${fmtNum(is.cos)})`, fmtPct(is.rev > 0 ? is.cos/is.rev*100 : 0)],
        [isEN ? 'Gross Profit' : 'Untung Kasar', fmtNum(is.gp), fmtPct(ratios.gpMargin)],
        [isEN ? 'Operating Expenses' : 'Perbelanjaan', `(${fmtNum(is.adm)})`, fmtPct(is.rev > 0 ? is.adm/is.rev*100 : 0)],
        [isEN ? 'Net Profit' : 'Untung Bersih', fmtNum(is.np), fmtPct(ratios.npMargin)]
      ];
      
      slide.addTable(pnlRows, { x: 0.5, y: 1, w: 6, colW: [3, 1.5, 1.5], border: { pt: 0.5, color: 'e5e7eb' }, fontFace: 'Arial', fontSize: 11,
        color: '1f2937', align: 'left', valign: 'middle' });
      
      // Slide 4: Financial Ratios
      slide = pptx.addSlide();
      slide.addText(isEN ? 'Financial Ratios' : 'Nisbah Kewangan', { x: 0.3, y: 0.3, w: 9.4, h: 0.5, fontSize: 24, bold: true, color: '1e3a8a' });
      
      const ratioRows = [
        [isEN ? 'Current Ratio' : 'Nisbah Semasa', ratios.currentRatio.toFixed(2), ratios.currentRatio >= 1 ? '✓' : '⚠'],
        [isEN ? 'Quick Ratio' : 'Nisbah Cepat', ratios.quickRatio.toFixed(2), ratios.quickRatio >= 1 ? '✓' : '⚠'],
        [isEN ? 'Debt to Equity' : 'Hutang/Ekuiti', ratios.debtToEquity.toFixed(2), ratios.debtToEquity <= 1 ? '✓' : '⚠'],
        [isEN ? 'Return on Equity' : 'Pulangan Ekuiti', fmtPct(ratios.roe), ratios.roe >= 10 ? '✓' : '⚠'],
        [isEN ? 'Working Capital' : 'Modal Kerja', `RM ${fmtNum(ratios.workingCapital)}`, ratios.workingCapital >= 0 ? '✓' : '⚠']
      ];
      
      slide.addTable(ratioRows, { x: 0.5, y: 1, w: 6, colW: [3, 1.5, 1], border: { pt: 0.5, color: 'e5e7eb' }, fontFace: 'Arial', fontSize: 11 });
      
      // Slide 5: AR/AP Ageing
      slide = pptx.addSlide();
      slide.addText(isEN ? 'Receivables & Payables' : 'Penghutang & Pemiutang', { x: 0.3, y: 0.3, w: 9.4, h: 0.5, fontSize: 24, bold: true, color: '1e3a8a' });
      
      const ageingHeaders = [[isEN ? 'Ageing' : 'Umur', isEN ? 'AR Amount' : 'Penghutang', isEN ? 'AP Amount' : 'Pemiutang']];
      const ageingRows = [
        [isEN ? 'Current' : 'Semasa', fmtNum(arAgeing.current), fmtNum(apAgeing.current)],
        ['1-30 ' + (isEN ? 'days' : 'hari'), fmtNum(arAgeing.d30), fmtNum(apAgeing.d30)],
        ['31-60 ' + (isEN ? 'days' : 'hari'), fmtNum(arAgeing.d60), fmtNum(apAgeing.d60)],
        ['61-90 ' + (isEN ? 'days' : 'hari'), fmtNum(arAgeing.d90), fmtNum(apAgeing.d90)],
        ['> 90 ' + (isEN ? 'days' : 'hari'), fmtNum(arAgeing.over90), fmtNum(apAgeing.over90)],
        [isEN ? 'Total' : 'Jumlah', fmtNum(arAgeing.total), fmtNum(apAgeing.total)]
      ];
      
      slide.addTable([...ageingHeaders, ...ageingRows], { x: 0.5, y: 1, w: 6, colW: [2, 2, 2], border: { pt: 0.5, color: 'e5e7eb' }, fontFace: 'Arial', fontSize: 11 });
      
      // Generate and download using Blob (browser & Electron safe)
      const fileName = `${(meta.companyName || 'Company').replace(/[^a-zA-Z0-9]/g, '_')}_MgmtPack_${meta.year}_${lang}.pptx`;
      const buffer = await pptx.write('arraybuffer');
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' });
      downloadBlob(blob, fileName);
      setLogs(prev => [...prev, { t: 'ok', m: `✓ Management Pack PPTX downloaded (${lang})` }]);
      setShowExportModal(false);
    } catch (err) {
      console.error('PPTX generation error:', err);
      alert('Error generating PowerPoint: ' + err.message + '\n\nNote: PowerPoint export requires PptxGenJS library. If not available, please use PDF or HTML export.');
    }
  };

  // ===================== END V8: MANAGEMENT PACK =====================

  // ===================== END FULL FS EXPORT PATCH =====================

  // Generate Word Document (using Word-compatible HTML format)
  const generateWordDoc = (lang) => {
    if (!res) {
      alert('Please generate financial statements first before exporting.');
      return;
    }
    
    const coName = companyName || 'Company Name';
    const coReg = companyRegNo || '____________';
    const stdName = config?.fullStandard || 'Malaysian Private Entities Reporting Standard';
    const isEN = lang === 'EN';
    
    const fmtNum = (n) => {
      if (n === undefined || n === null) return '-';
      return Number(n).toLocaleString('en-MY', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    };
    
    const fmtBracket = (n) => {
      if (n === undefined || n === null) return '-';
      return n < 0 ? '(' + fmtNum(Math.abs(n)) + ')' : fmtNum(n);
    };
    
    // Create Word-compatible HTML (Microsoft Word can open this as a .doc file)
    const wordHtml = `
<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
<!--[if gte mso 9]>
<xml>
<w:WordDocument>
<w:View>Print</w:View>
<w:Zoom>100</w:Zoom>
</w:WordDocument>
</xml>
<![endif]-->
<style>
@page { size: A4; margin: 2cm; }
@media print { 
  .page-break { page-break-after: always; } 
  h1, h2, h3 { page-break-after: avoid; }
  table { page-break-inside: avoid; }
}
body { font-family: "Times New Roman", Times, serif; font-size: 11pt; line-height: 1.4; }
.page-break { page-break-after: always; page-break-before: auto; }
.section { page-break-before: always; }
.center { text-align: center; }
.right { text-align: right; }
.bold { font-weight: bold; }
h1 { font-size: 18pt; font-weight: bold; text-align: center; margin: 0; page-break-after: avoid; page-break-inside: avoid; }
h2 { font-size: 14pt; font-weight: bold; text-align: center; margin: 10px 0; page-break-after: avoid; page-break-inside: avoid; }
h3 { font-size: 12pt; font-weight: bold; margin: 20px 0 10px 0; page-break-after: avoid; page-break-inside: avoid; }
table { width: 100%; border-collapse: collapse; margin: 15px 0; page-break-inside: avoid; }
table.fs td { padding: 4px 8px; vertical-align: top; }
table.fs .amt { text-align: right; width: 120px; }
table.fs .note { text-align: center; width: 50px; }
.underline { border-bottom: 1px solid #000; }
.double-underline { border-bottom: 3px double #000; }
.indent { padding-left: 20px; }
.spacer { height: 30px; }
.cover-spacer { height: 120px; }
.keep-together { page-break-inside: avoid; }
.notes-integral { font-size: 9pt; font-style: italic; margin-top: 15px; }
p { margin: 8px 0; }
</style>
<title>${coName} - Financial Statements ${currentYear}</title>
</head>
<body>

<!-- COVER PAGE -->
<div class="center">
<div class="cover-spacer"></div>
<h1 style="font-size: 24pt;">${coName.toUpperCase()}</h1>
<p>(${isEN ? 'Registration No.' : 'No. Pendaftaran'}: ${coReg})</p>
<p>(${isEN ? 'Incorporated in Malaysia' : 'Diperbadankan di Malaysia'})</p>
<div class="cover-spacer"></div>
<h1 style="font-size: 20pt;">${isEN ? 'FINANCIAL STATEMENTS' : 'PENYATA KEWANGAN'}</h1>
<p style="font-size: 14pt;">${isEN ? 'FOR THE FINANCIAL YEAR ENDED' : 'BAGI TAHUN KEWANGAN BERAKHIR'}</p>
<p style="font-size: 16pt; font-weight: bold;">${fyeDisplay.toUpperCase()}</p>
<div class="cover-spacer"></div>
<p style="font-style: italic;">${stdName}</p>
</div>
<div class="page-break"></div>

<!-- STATEMENT OF FINANCIAL POSITION -->
<h1>${coName.toUpperCase()}</h1>
<h2>${isEN ? 'STATEMENT OF FINANCIAL POSITION' : 'PENYATA KEDUDUKAN KEWANGAN'}</h2>
<p class="center">${isEN ? 'AS AT' : 'PADA'} ${fyeDisplay.toUpperCase()}</p>

<table class="fs">
<tr>
<td style="width: 50%;"></td>
<td class="amt bold">${currentYear}</td>
<td class="amt bold">${priorFSYear}</td>
</tr>
<tr>
<td></td>
<td class="amt bold">RM</td>
<td class="amt bold">RM</td>
</tr>
<tr><td colspan="3" class="bold">${isEN ? 'ASSETS' : 'ASET'}</td></tr>
<tr><td class="bold">${isEN ? 'Non-Current Assets' : 'Aset Bukan Semasa'}</td><td></td><td></td></tr>
<tr>
<td class="indent">${isEN ? 'Property, plant and equipment' : 'Hartanah, loji dan peralatan'}</td>
<td class="amt">${fmtNum(res.bs.ppe)}</td>
<td class="amt">${fmtNum(res.bs.py_ppe)}</td>
</tr>
<tr>
<td></td>
<td class="amt underline bold">${fmtNum(res.bs.totNCA)}</td>
<td class="amt underline">${fmtNum(res.bs.py_totNCA)}</td>
</tr>
<tr><td class="bold">${isEN ? 'Current Assets' : 'Aset Semasa'}</td><td></td><td></td></tr>
<tr>
<td class="indent">${isEN ? 'Inventories' : 'Inventori'}</td>
<td class="amt">${fmtNum(res.bs.inv)}</td>
<td class="amt">${fmtNum(res.bs.py_inv)}</td>
</tr>
<tr>
<td class="indent">${isEN ? 'Trade receivables' : 'Penghutang perdagangan'}</td>
<td class="amt">${fmtNum(res.bs.tr)}</td>
<td class="amt">${fmtNum(res.bs.py_tr)}</td>
</tr>
<tr>
<td class="indent">${isEN ? 'Cash and bank balances' : 'Tunai dan baki bank'}</td>
<td class="amt">${fmtNum(res.bs.cash)}</td>
<td class="amt">${fmtNum(res.bs.py_cash)}</td>
</tr>
<tr>
<td></td>
<td class="amt underline bold">${fmtNum(res.bs.totCA)}</td>
<td class="amt underline">${fmtNum(res.bs.py_totCA)}</td>
</tr>
<tr>
<td class="bold">${isEN ? 'TOTAL ASSETS' : 'JUMLAH ASET'}</td>
<td class="amt double-underline bold">${fmtNum(res.bs.totA)}</td>
<td class="amt double-underline bold">${fmtNum(res.bs.py_totA)}</td>
</tr>
<tr><td class="spacer" colspan="3"></td></tr>
<tr><td colspan="3" class="bold">${isEN ? 'EQUITY AND LIABILITIES' : 'EKUITI DAN LIABILITI'}</td></tr>
<tr><td class="bold">${isEN ? 'Equity' : 'Ekuiti'}</td><td></td><td></td></tr>
<tr>
<td class="indent">${isEN ? 'Share capital' : 'Modal saham'}</td>
<td class="amt">${fmtNum(res.bs.cap)}</td>
<td class="amt">${fmtNum(res.bs.py_cap)}</td>
</tr>
<tr>
<td class="indent">${isEN ? 'Retained earnings' : 'Pendapatan tertahan'}</td>
<td class="amt">${fmtNum(res.bs.ret + res.bs.cyp)}</td>
<td class="amt">${fmtNum(res.bs.py_ret)}</td>
</tr>
<tr>
<td class="bold">${isEN ? 'Total Equity' : 'Jumlah Ekuiti'}</td>
<td class="amt underline bold">${fmtNum(res.bs.totE)}</td>
<td class="amt underline">${fmtNum(res.bs.py_totE)}</td>
</tr>
<tr><td class="bold">${isEN ? 'Current Liabilities' : 'Liabiliti Semasa'}</td><td></td><td></td></tr>
<tr>
<td class="indent">${isEN ? 'Trade payables' : 'Pemiutang perdagangan'}</td>
<td class="amt">${fmtNum(res.bs.tp)}</td>
<td class="amt">${fmtNum(res.bs.py_tp)}</td>
</tr>
<tr>
<td class="indent">${isEN ? 'Borrowings' : 'Pinjaman'}</td>
<td class="amt">${fmtNum(res.bs.borr)}</td>
<td class="amt">${fmtNum(res.bs.py_borr)}</td>
</tr>
<tr>
<td class="bold">${isEN ? 'Total Liabilities' : 'Jumlah Liabiliti'}</td>
<td class="amt underline bold">${fmtNum(res.bs.totL)}</td>
<td class="amt underline">${fmtNum(res.bs.py_totL)}</td>
</tr>
<tr>
<td class="bold">${isEN ? 'TOTAL EQUITY AND LIABILITIES' : 'JUMLAH EKUITI DAN LIABILITI'}</td>
<td class="amt double-underline bold">${fmtNum(res.bs.totE + res.bs.totL)}</td>
<td class="amt double-underline bold">${fmtNum((res.bs.py_totE || 0) + (res.bs.py_totL || 0))}</td>
</tr>
</table>
<p class="notes-integral">${isEN ? 'The accompanying notes form an integral part of these financial statements.' : 'Nota-nota yang disertakan merupakan sebahagian daripada penyata kewangan ini.'}</p>
<div class="page-break"></div>

<!-- STATEMENT OF PROFIT OR LOSS -->
<h1>${coName.toUpperCase()}</h1>
<h2>${isEN ? 'STATEMENT OF PROFIT OR LOSS AND OTHER COMPREHENSIVE INCOME' : 'PENYATA UNTUNG RUGI DAN PENDAPATAN KOMPREHENSIF LAIN'}</h2>
<p class="center">${isEN ? 'FOR THE FINANCIAL YEAR ENDED' : 'BAGI TAHUN KEWANGAN BERAKHIR'} ${fyeDisplay.toUpperCase()}</p>

<table class="fs">
<tr>
<td style="width: 50%;"></td>
<td class="amt bold">${currentYear}</td>
<td class="amt bold">${priorFSYear}</td>
</tr>
<tr>
<td></td>
<td class="amt bold">RM</td>
<td class="amt bold">RM</td>
</tr>
<tr>
<td>${isEN ? 'Revenue' : 'Hasil'}</td>
<td class="amt">${fmtNum(res.is.rev)}</td>
<td class="amt">${fmtNum(res.is.py_rev)}</td>
</tr>
<tr>
<td>${isEN ? 'Cost of sales' : 'Kos jualan'}</td>
<td class="amt">${fmtBracket(-res.is.cos)}</td>
<td class="amt">${fmtBracket(-(res.is.py_cos || 0))}</td>
</tr>
<tr>
<td class="bold">${isEN ? 'Gross profit' : 'Untung kasar'}</td>
<td class="amt underline bold">${fmtNum(res.is.gp)}</td>
<td class="amt underline">${fmtNum(res.is.py_gp)}</td>
</tr>
<tr>
<td>${isEN ? 'Other income' : 'Pendapatan lain'}</td>
<td class="amt">${fmtNum(res.is.oi)}</td>
<td class="amt">${fmtNum(res.is.py_oi)}</td>
</tr>
<tr>
<td>${isEN ? 'Administrative expenses' : 'Perbelanjaan pentadbiran'}</td>
<td class="amt">${fmtBracket(-res.is.adm)}</td>
<td class="amt">${fmtBracket(-(res.is.py_adm || 0))}</td>
</tr>
<tr>
<td>${isEN ? 'Finance costs' : 'Kos kewangan'}</td>
<td class="amt">${fmtBracket(-res.is.fin)}</td>
<td class="amt">${fmtBracket(-(res.is.py_fin || 0))}</td>
</tr>
<tr>
<td class="bold">${isEN ? 'Profit before taxation' : 'Untung sebelum cukai'}</td>
<td class="amt underline bold">${fmtNum(res.is.pbt)}</td>
<td class="amt underline">${fmtNum(res.is.py_pbt)}</td>
</tr>
<tr>
<td>${isEN ? 'Taxation' : 'Cukai'}</td>
<td class="amt">${fmtBracket(-res.is.tax)}</td>
<td class="amt">${fmtBracket(-(res.is.py_tax || 0))}</td>
</tr>
<tr>
<td class="bold">${isEN ? 'Profit for the financial year' : 'Untung bagi tahun kewangan'}</td>
<td class="amt underline bold">${fmtNum(res.is.np)}</td>
<td class="amt underline">${fmtNum(res.is.py_np)}</td>
</tr>
<tr>
<td>${isEN ? 'Other comprehensive income' : 'Pendapatan komprehensif lain'}</td>
<td class="amt">-</td>
<td class="amt">-</td>
</tr>
<tr>
<td class="bold">${isEN ? 'Total comprehensive income for the year' : 'Jumlah pendapatan komprehensif bagi tahun'}</td>
<td class="amt double-underline bold">${fmtNum(res.is.np)}</td>
<td class="amt double-underline bold">${fmtNum(res.is.py_np)}</td>
</tr>
</table>
<p style="font-size: 9pt; font-style: italic; margin-top: 15px;">${isEN ? 'The accompanying notes form an integral part of these financial statements.' : 'Nota-nota yang disertakan merupakan sebahagian daripada penyata kewangan ini.'}</p>
<div class="page-break"></div>

<!-- STATEMENT OF CHANGES IN EQUITY -->
<h1>${coName.toUpperCase()}</h1>
<h2>${isEN ? 'STATEMENT OF CHANGES IN EQUITY' : 'PENYATA PERUBAHAN EKUITI'}</h2>
<p class="center">${isEN ? 'FOR THE FINANCIAL YEAR ENDED' : 'BAGI TAHUN KEWANGAN BERAKHIR'} ${fyeDisplay.toUpperCase()}</p>

<table class="fs">
<tr>
<td style="width: 40%;"></td>
<td class="amt bold">${isEN ? 'Share Capital' : 'Modal Saham'}</td>
<td class="amt bold">${isEN ? 'Retained Earnings' : 'Pendapatan Tertahan'}</td>
<td class="amt bold">${isEN ? 'Total' : 'Jumlah'}</td>
</tr>
<tr>
<td></td>
<td class="amt bold">RM</td>
<td class="amt bold">RM</td>
<td class="amt bold">RM</td>
</tr>
<tr>
<td>${isEN ? 'Balance at 1 January' : 'Baki pada 1 Januari'} ${priorFSYear}</td>
<td class="amt">${fmtNum(res.bs.py_cap)}</td>
<td class="amt">${fmtNum((res.bs.py_ret || 0) - (res.is.py_np || 0))}</td>
<td class="amt">${fmtNum((res.bs.py_totE || 0) - (res.is.py_np || 0))}</td>
</tr>
<tr>
<td class="indent">${isEN ? 'Profit for the year' : 'Keuntungan bagi tahun'}</td>
<td class="amt">-</td>
<td class="amt">${fmtNum(res.is.py_np)}</td>
<td class="amt">${fmtNum(res.is.py_np)}</td>
</tr>
<tr>
<td class="indent">${isEN ? 'Other comprehensive income' : 'Pendapatan komprehensif lain'}</td>
<td class="amt">-</td>
<td class="amt">-</td>
<td class="amt">-</td>
</tr>
<tr>
<td class="bold">${isEN ? 'Balance at 31 December' : 'Baki pada 31 Disember'} ${priorFSYear}</td>
<td class="amt underline bold">${fmtNum(res.bs.py_cap)}</td>
<td class="amt underline bold">${fmtNum(res.bs.py_ret)}</td>
<td class="amt underline bold">${fmtNum(res.bs.py_totE)}</td>
</tr>
<tr>
<td class="indent">${isEN ? 'Profit for the year' : 'Keuntungan bagi tahun'}</td>
<td class="amt">-</td>
<td class="amt">${fmtNum(res.is.np)}</td>
<td class="amt">${fmtNum(res.is.np)}</td>
</tr>
<tr>
<td class="indent">${isEN ? 'Other comprehensive income' : 'Pendapatan komprehensif lain'}</td>
<td class="amt">-</td>
<td class="amt">-</td>
<td class="amt">-</td>
</tr>
<tr>
<td class="bold">${isEN ? 'Balance at 31 December' : 'Baki pada 31 Disember'} ${currentYear}</td>
<td class="amt double-underline bold">${fmtNum(res.bs.cap)}</td>
<td class="amt double-underline bold">${fmtNum(res.bs.ret + res.bs.cyp)}</td>
<td class="amt double-underline bold">${fmtNum(res.bs.totE)}</td>
</tr>
</table>
<p style="font-size: 9pt; font-style: italic; margin-top: 15px;">${isEN ? 'The accompanying notes form an integral part of these financial statements.' : 'Nota-nota yang disertakan merupakan sebahagian daripada penyata kewangan ini.'}</p>
<div class="page-break"></div>

<!-- STATEMENT OF CASH FLOWS -->
<h1>${coName.toUpperCase()}</h1>
<h2>${isEN ? 'STATEMENT OF CASH FLOWS' : 'PENYATA ALIRAN TUNAI'}</h2>
<p class="center">${isEN ? 'FOR THE FINANCIAL YEAR ENDED' : 'BAGI TAHUN KEWANGAN BERAKHIR'} ${fyeDisplay.toUpperCase()}</p>

<table class="fs">
<tr>
<td style="width: 60%;"></td>
<td class="amt bold">${currentYear}</td>
<td class="amt bold">${priorFSYear}</td>
</tr>
<tr>
<td></td>
<td class="amt bold">RM</td>
<td class="amt bold">RM</td>
</tr>
<tr><td colspan="3" class="bold">${isEN ? 'CASH FLOWS FROM OPERATING ACTIVITIES' : 'ALIRAN TUNAI DARIPADA AKTIVITI OPERASI'}</td></tr>
<tr>
<td class="indent">${isEN ? 'Profit before taxation' : 'Untung sebelum cukai'}</td>
<td class="amt">${fmtNum(res.cf.pbt)}</td>
<td class="amt">${fmtNum(res.is.py_pbt || 0)}</td>
</tr>
<tr><td class="indent">${isEN ? 'Adjustments for:' : 'Pelarasan untuk:'}</td><td></td><td></td></tr>
<tr>
<td class="indent indent">${isEN ? 'Depreciation of property, plant and equipment' : 'Susut nilai hartanah, loji dan peralatan'}</td>
<td class="amt">${fmtNum(res.cf.adjustments.depreciation)}</td>
<td class="amt">-</td>
</tr>
${res.cf.adjustments.interestExpense > 0 ? `<tr>
<td class="indent indent">${isEN ? 'Interest expense' : 'Perbelanjaan faedah'}</td>
<td class="amt">${fmtNum(res.cf.adjustments.interestExpense)}</td>
<td class="amt">-</td>
</tr>` : ''}
${res.cf.adjustments.interestIncome !== 0 ? `<tr>
<td class="indent indent">${isEN ? 'Interest income' : 'Pendapatan faedah'}</td>
<td class="amt">${fmtBracket(res.cf.adjustments.interestIncome)}</td>
<td class="amt">-</td>
</tr>` : ''}
<tr>
<td class="bold indent">${isEN ? 'Operating profit before working capital changes' : 'Keuntungan operasi sebelum perubahan modal kerja'}</td>
<td class="amt underline">${fmtNum(res.cf.pbt + res.cf.totalAdjustments)}</td>
<td class="amt">-</td>
</tr>
${res.cf.workingCapitalChanges.inventory !== 0 ? `<tr>
<td class="indent">${isEN ? '(Increase)/Decrease in inventories' : '(Pertambahan)/Pengurangan dalam inventori'}</td>
<td class="amt">${fmtBracket(res.cf.workingCapitalChanges.inventory)}</td>
<td class="amt">-</td>
</tr>` : ''}
${res.cf.workingCapitalChanges.tradeReceivables !== 0 ? `<tr>
<td class="indent">${isEN ? '(Increase)/Decrease in trade and other receivables' : '(Pertambahan)/Pengurangan dalam penghutang perdagangan dan lain-lain'}</td>
<td class="amt">${fmtBracket(res.cf.workingCapitalChanges.tradeReceivables + res.cf.workingCapitalChanges.otherReceivables)}</td>
<td class="amt">-</td>
</tr>` : ''}
${res.cf.workingCapitalChanges.tradePayables !== 0 || res.cf.workingCapitalChanges.otherPayables !== 0 ? `<tr>
<td class="indent">${isEN ? 'Increase/(Decrease) in trade and other payables' : 'Pertambahan/(Pengurangan) dalam pemiutang perdagangan dan lain-lain'}</td>
<td class="amt">${fmtBracket(res.cf.workingCapitalChanges.tradePayables + res.cf.workingCapitalChanges.otherPayables)}</td>
<td class="amt">-</td>
</tr>` : ''}
<tr>
<td class="bold indent">${isEN ? 'Cash generated from operations' : 'Tunai dijana daripada operasi'}</td>
<td class="amt underline">${fmtNum(res.cf.cashFromOperations)}</td>
<td class="amt">-</td>
</tr>
${res.cf.taxPaid !== 0 ? `<tr>
<td class="indent">${isEN ? 'Tax paid' : 'Cukai dibayar'}</td>
<td class="amt">${fmtBracket(res.cf.taxPaid)}</td>
<td class="amt">-</td>
</tr>` : ''}
<tr>
<td class="bold">${isEN ? 'Net cash from operating activities' : 'Tunai bersih daripada aktiviti operasi'}</td>
<td class="amt underline bold">${fmtNum(res.cf.netOperating)}</td>
<td class="amt">-</td>
</tr>
<tr><td class="spacer" colspan="3"></td></tr>
<tr><td colspan="3" class="bold">${isEN ? 'CASH FLOWS FROM INVESTING ACTIVITIES' : 'ALIRAN TUNAI DARIPADA AKTIVITI PELABURAN'}</td></tr>
${res.cf.ppePurchases !== 0 ? `<tr>
<td class="indent">${isEN ? 'Purchase of property, plant and equipment' : 'Pembelian hartanah, loji dan peralatan'}</td>
<td class="amt">${fmtBracket(res.cf.ppePurchases)}</td>
<td class="amt">-</td>
</tr>` : ''}
${res.cf.ppeDisposals !== 0 ? `<tr>
<td class="indent">${isEN ? 'Proceeds from disposal of property, plant and equipment' : 'Hasil daripada pelupusan hartanah, loji dan peralatan'}</td>
<td class="amt">${fmtNum(res.cf.ppeDisposals)}</td>
<td class="amt">-</td>
</tr>` : ''}
${res.cf.interestReceived !== 0 ? `<tr>
<td class="indent">${isEN ? 'Interest received' : 'Faedah diterima'}</td>
<td class="amt">${fmtNum(res.cf.interestReceived)}</td>
<td class="amt">-</td>
</tr>` : ''}
${res.cf.netInvesting === 0 ? `<tr>
<td class="indent" style="font-style: italic; color: #666;">${isEN ? 'No investing activities during the year' : 'Tiada aktiviti pelaburan dalam tahun'}</td>
<td class="amt">-</td>
<td class="amt">-</td>
</tr>` : ''}
<tr>
<td class="bold">${isEN ? 'Net cash used in investing activities' : 'Tunai bersih digunakan dalam aktiviti pelaburan'}</td>
<td class="amt underline bold">${fmtBracket(res.cf.netInvesting)}</td>
<td class="amt">-</td>
</tr>
<tr><td class="spacer" colspan="3"></td></tr>
<tr><td colspan="3" class="bold">${isEN ? 'CASH FLOWS FROM FINANCING ACTIVITIES' : 'ALIRAN TUNAI DARIPADA AKTIVITI PEMBIAYAAN'}</td></tr>
${res.cf.loanProceeds !== 0 ? `<tr>
<td class="indent">${isEN ? 'Proceeds from borrowings' : 'Penerimaan daripada pinjaman'}</td>
<td class="amt">${fmtNum(res.cf.loanProceeds)}</td>
<td class="amt">-</td>
</tr>` : ''}
${res.cf.loanRepayments !== 0 ? `<tr>
<td class="indent">${isEN ? 'Repayment of borrowings' : 'Bayaran balik pinjaman'}</td>
<td class="amt">${fmtBracket(res.cf.loanRepayments)}</td>
<td class="amt">-</td>
</tr>` : ''}
${res.cf.capitalInjection !== 0 ? `<tr>
<td class="indent">${isEN ? 'Proceeds from issuance of shares' : 'Penerimaan daripada terbitan saham'}</td>
<td class="amt">${fmtNum(res.cf.capitalInjection)}</td>
<td class="amt">-</td>
</tr>` : ''}
${res.cf.dividendsPaid !== 0 ? `<tr>
<td class="indent">${isEN ? 'Dividends paid' : 'Dividen dibayar'}</td>
<td class="amt">${fmtBracket(res.cf.dividendsPaid)}</td>
<td class="amt">-</td>
</tr>` : ''}
${res.cf.netFinancing === 0 ? `<tr>
<td class="indent" style="font-style: italic; color: #666;">${isEN ? 'No financing activities during the year' : 'Tiada aktiviti pembiayaan dalam tahun'}</td>
<td class="amt">-</td>
<td class="amt">-</td>
</tr>` : ''}
<tr>
<td class="bold">${isEN ? 'Net cash from financing activities' : 'Tunai bersih daripada aktiviti pembiayaan'}</td>
<td class="amt underline bold">${fmtBracket(res.cf.netFinancing)}</td>
<td class="amt">-</td>
</tr>
<tr><td class="spacer" colspan="3"></td></tr>
<tr>
<td class="bold">${isEN ? 'NET INCREASE/(DECREASE) IN CASH AND CASH EQUIVALENTS' : 'PERTAMBAHAN/(PENGURANGAN) BERSIH DALAM TUNAI DAN SETARA TUNAI'}</td>
<td class="amt underline">${fmtBracket(res.cf.netChangeInCash)}</td>
<td class="amt">-</td>
</tr>
<tr>
<td>${isEN ? 'Cash and cash equivalents at beginning of year' : 'Tunai dan setara tunai pada awal tahun'}</td>
<td class="amt">${fmtNum(res.cf.openingCash)}</td>
<td class="amt">${fmtNum(res.bs.py_cash || 0)}</td>
</tr>
<tr>
<td class="bold">${isEN ? 'CASH AND CASH EQUIVALENTS AT END OF YEAR' : 'TUNAI DAN SETARA TUNAI PADA AKHIR TAHUN'}</td>
<td class="amt double-underline bold">${fmtNum(res.cf.closingCash)}</td>
<td class="amt double-underline bold">${fmtNum(res.cf.openingCash)}</td>
</tr>
</table>
<p style="font-size: 9pt; font-style: italic; margin-top: 15px;">${isEN ? 'The accompanying notes form an integral part of these financial statements.' : 'Nota-nota yang disertakan merupakan sebahagian daripada penyata kewangan ini.'}</p>
<div class="page-break"></div>

<!-- NOTES TO THE FINANCIAL STATEMENTS -->
<h1>${coName.toUpperCase()}</h1>
<h2>${isEN ? 'NOTES TO THE FINANCIAL STATEMENTS' : 'NOTA-NOTA KEPADA PENYATA KEWANGAN'}</h2>
<p class="center">${isEN ? 'FOR THE FINANCIAL YEAR ENDED' : 'BAGI TAHUN KEWANGAN BERAKHIR'} ${fyeDisplay.toUpperCase()}</p>

<h3>1. ${isEN ? 'CORPORATE INFORMATION' : 'MAKLUMAT KORPORAT'}</h3>
<p>${isEN 
  ? 'The Company is a private limited company, incorporated and domiciled in Malaysia. The registered office and principal place of business of the Company is located in Malaysia.'
  : 'Syarikat adalah sebuah syarikat sendirian berhad, diperbadankan dan bermastautin di Malaysia. Pejabat berdaftar dan tempat perniagaan utama Syarikat terletak di Malaysia.'}</p>
<p>${isEN
  ? 'The principal activities of the Company consist of general trading and provision of services.'
  : 'Aktiviti utama Syarikat terdiri daripada perdagangan am dan penyediaan perkhidmatan.'}</p>
<p>${isEN
  ? 'The financial statements were authorised for issue by the Board of Directors on ' + new Date().toLocaleDateString('en-MY', { day: 'numeric', month: 'long', year: 'numeric' }) + '.'
  : 'Penyata kewangan telah diluluskan untuk diterbitkan oleh Lembaga Pengarah pada ' + new Date().toLocaleDateString('ms-MY', { day: 'numeric', month: 'long', year: 'numeric' }) + '.'}</p>

<h3>2. ${isEN ? 'BASIS OF PREPARATION' : 'ASAS PENYEDIAAN'}</h3>
<p><strong>(a) ${isEN ? 'Statement of compliance' : 'Penyata pematuhan'}</strong></p>
<p>${isEN 
  ? 'The financial statements of the Company have been prepared in accordance with ' + stdName + ' and the requirements of the Companies Act 2016 in Malaysia.'
  : 'Penyata kewangan Syarikat telah disediakan mengikut ' + stdName + ' dan keperluan Akta Syarikat 2016 di Malaysia.'}</p>
<p><strong>(b) ${isEN ? 'Basis of measurement' : 'Asas pengukuran'}</strong></p>
<p>${isEN
  ? 'The financial statements have been prepared under the historical cost convention.'
  : 'Penyata kewangan telah disediakan di bawah konvensyen kos sejarah.'}</p>
<p><strong>(c) ${isEN ? 'Functional and presentation currency' : 'Mata wang fungsian dan pembentangan'}</strong></p>
<p>${isEN
  ? 'The financial statements are presented in Ringgit Malaysia (RM), which is the Company\'s functional currency.'
  : 'Penyata kewangan dibentangkan dalam Ringgit Malaysia (RM), yang merupakan mata wang fungsian Syarikat.'}</p>

<h3>3. ${isEN ? 'SIGNIFICANT ACCOUNTING POLICIES' : 'DASAR PERAKAUNAN PENTING'}</h3>
<p><strong>(a) ${isEN ? 'Revenue recognition' : 'Pengiktirafan hasil'}</strong></p>
<p>${isEN
  ? 'Revenue is measured at the fair value of the consideration received or receivable for goods sold and services rendered in the ordinary course of business.'
  : 'Hasil diukur pada nilai saksama balasan yang diterima atau akan diterima untuk barangan yang dijual dan perkhidmatan yang diberikan dalam perjalanan biasa perniagaan.'}</p>

<p><strong>(b) ${isEN ? 'Property, plant and equipment' : 'Hartanah, loji dan peralatan'}</strong></p>
<p>${isEN
  ? 'Property, plant and equipment are stated at cost less accumulated depreciation and impairment losses. Depreciation is calculated using the straight-line method to allocate the cost of assets over their estimated useful lives.'
  : 'Hartanah, loji dan peralatan dinyatakan pada kos ditolak susut nilai terkumpul dan kerugian rosot nilai. Susut nilai dikira menggunakan kaedah garis lurus untuk memperuntukkan kos aset sepanjang anggaran hayat berguna.'}</p>

<p><strong>(c) ${isEN ? 'Inventories' : 'Inventori'}</strong></p>
<p>${isEN
  ? 'Inventories are stated at the lower of cost and net realisable value. Cost is determined using the first-in, first-out method.'
  : 'Inventori dinyatakan pada nilai yang lebih rendah antara kos dan nilai boleh direalisasi bersih. Kos ditentukan menggunakan kaedah masuk-dahulu, keluar-dahulu.'}</p>

<p><strong>(d) ${isEN ? 'Financial instruments' : 'Instrumen kewangan'}</strong></p>
<p>${isEN
  ? 'Financial assets and financial liabilities are recognised when the Company becomes a party to the contractual provisions of the instruments. They are measured initially at fair value plus transaction costs.'
  : 'Aset kewangan dan liabiliti kewangan diiktiraf apabila Syarikat menjadi pihak kepada peruntukan kontrak instrumen tersebut. Ia diukur pada mulanya pada nilai saksama ditambah kos transaksi.'}</p>

<h3>4. ${isEN ? 'TAXATION' : 'CUKAI'}</h3>
<p>${isEN
  ? 'Malaysian income tax is calculated at the statutory tax rate from the estimated assessable profit for the year. The numerical reconciliation between the tax expense and accounting profit is not presented as there are no significant permanent differences.'
  : 'Cukai pendapatan Malaysia dikira pada kadar cukai berkanun daripada anggaran keuntungan boleh ditaksir bagi tahun tersebut. Penyesuaian berangka antara perbelanjaan cukai dan keuntungan perakaunan tidak dibentangkan kerana tiada perbezaan tetap yang ketara.'}</p>

<h3>5. ${isEN ? 'PROPERTY, PLANT AND EQUIPMENT' : 'HARTANAH, LOJI DAN PERALATAN'}</h3>
<table class="fs" style="border-collapse: collapse;">
<tr style="border-bottom: 1px solid #000;">
<td style="width: 50%; padding: 5px;">${isEN ? 'At cost' : 'Pada kos'}</td>
<td class="amt" style="padding: 5px;">${fmtNum(res.bs.ppe + (subledgerTotals?.ppe?.accDep || 0))}</td>
</tr>
<tr style="border-bottom: 1px solid #000;">
<td style="padding: 5px;">${isEN ? 'Less: Accumulated depreciation' : 'Tolak: Susut nilai terkumpul'}</td>
<td class="amt" style="padding: 5px;">(${fmtNum(subledgerTotals?.ppe?.accDep || 0)})</td>
</tr>
<tr style="border-bottom: 2px solid #000;">
<td class="bold" style="padding: 5px;">${isEN ? 'Net book value' : 'Nilai buku bersih'}</td>
<td class="amt bold" style="padding: 5px;">${fmtNum(res.bs.ppe)}</td>
</tr>
</table>

<h3>6. ${isEN ? 'TRADE AND OTHER RECEIVABLES' : 'PENGHUTANG PERDAGANGAN DAN LAIN-LAIN'}</h3>
<table class="fs">
<tr>
<td style="width: 50%;">${isEN ? 'Trade receivables' : 'Penghutang perdagangan'}</td>
<td class="amt">${fmtNum(res.bs.tr)}</td>
</tr>
<tr>
<td>${isEN ? 'Other receivables' : 'Penghutang lain'}</td>
<td class="amt">${fmtNum(res.bs.or)}</td>
</tr>
<tr style="border-top: 1px solid #000;">
<td class="bold">${isEN ? 'Total' : 'Jumlah'}</td>
<td class="amt bold">${fmtNum(res.bs.tr + res.bs.or)}</td>
</tr>
</table>

<h3>7. ${isEN ? 'CASH AND BANK BALANCES' : 'TUNAI DAN BAKI BANK'}</h3>
<table class="fs">
<tr>
<td style="width: 50%;">${isEN ? 'Cash and bank balances' : 'Tunai dan baki bank'}</td>
<td class="amt">${fmtNum(res.bs.cash)}</td>
</tr>
</table>

<h3>8. ${isEN ? 'SHARE CAPITAL' : 'MODAL SAHAM'}</h3>
<table class="fs">
<tr>
<td style="width: 50%;">${isEN ? 'Issued and fully paid ordinary shares' : 'Saham biasa diterbitkan dan berbayar penuh'}</td>
<td class="amt">${fmtNum(res.bs.cap)}</td>
</tr>
</table>

<h3>9. ${isEN ? 'TRADE AND OTHER PAYABLES' : 'PEMIUTANG PERDAGANGAN DAN LAIN-LAIN'}</h3>
<table class="fs">
<tr>
<td style="width: 50%;">${isEN ? 'Trade payables' : 'Pemiutang perdagangan'}</td>
<td class="amt">${fmtNum(res.bs.tp)}</td>
</tr>
<tr>
<td>${isEN ? 'Other payables and accruals' : 'Pemiutang lain dan akruan'}</td>
<td class="amt">${fmtNum(res.bs.op)}</td>
</tr>
<tr style="border-top: 1px solid #000;">
<td class="bold">${isEN ? 'Total' : 'Jumlah'}</td>
<td class="amt bold">${fmtNum(res.bs.tp + res.bs.op)}</td>
</tr>
</table>

${res.bs.borr > 0 ? `<h3>10. ${isEN ? 'BORROWINGS' : 'PINJAMAN'}</h3>
<table class="fs">
<tr>
<td style="width: 50%;">${isEN ? 'Bank borrowings - secured' : 'Pinjaman bank - bercagar'}</td>
<td class="amt">${fmtNum(res.bs.borr)}</td>
</tr>
</table>` : ''}

<h3>${res.bs.borr > 0 ? '11' : '10'}. ${isEN ? 'REVENUE' : 'HASIL'}</h3>
<table class="fs">
<tr>
<td style="width: 50%;">${isEN ? 'Sale of goods and services' : 'Jualan barangan dan perkhidmatan'}</td>
<td class="amt">${fmtNum(res.is.rev)}</td>
</tr>
</table>

<h3>${res.bs.borr > 0 ? '12' : '11'}. ${isEN ? 'RELATED PARTY DISCLOSURES' : 'PENDEDAHAN PIHAK BERKAITAN'}</h3>
<p>${isEN
  ? 'The directors are of the opinion that all transactions with related parties have been entered into in the normal course of business and have been established on terms and conditions that are no less favourable than those with unrelated parties.'
  : 'Para pengarah berpendapat bahawa semua transaksi dengan pihak berkaitan telah dibuat dalam perjalanan biasa perniagaan dan telah ditetapkan berdasarkan terma dan syarat yang tidak kurang menguntungkan daripada transaksi dengan pihak tidak berkaitan.'}</p>

</body>
</html>`;
    
    console.log('generateWordDoc called, lang:', lang, 'wordHtml length:', wordHtml.length);
    
    // Download as .doc file using helper
    const fileName = (companyName || 'Financial_Statements').replace(/[^a-zA-Z0-9]/g, '_') + '_FS_' + currentYear + '_' + lang + '.doc';
    downloadWord(wordHtml, fileName);
    setShowExportModal(false);
    setLogs(prev => [...prev, { t: 'ok', m: `✓ Word document ${fileName} downloaded` }]);
  };
  
  // Generate Excel Financial Statements (Professional format with proper styling)
  const generateExcelFS = (lang) => {
    if (!res) {
      alert('Please generate financial statements first before exporting.');
      return;
    }
    
    const coName = companyName || 'Company Name';
    const coReg = companyRegNo || '____________';
    const stdName = config?.fullStandard || 'Malaysian Private Entities Reporting Standard';
    const isEN = lang === 'EN';
    
    const fmtNum = (n) => {
      if (n === undefined || n === null || n === 0) return '-';
      return Number(n);
    };
    
    // Create workbook
    const wb = XLSX.utils.book_new();
    
    // Helper to create a sheet with data
    const createSheet = (data, name) => {
      const ws = XLSX.utils.aoa_to_sheet(data);
      
      // Set column widths
      ws['!cols'] = [
        { wch: 45 }, // Description column
        { wch: 15 }, // Current year
        { wch: 15 }, // Prior year
      ];
      
      XLSX.utils.book_append_sheet(wb, ws, name);
      return ws;
    };
    
    // ============================================
    // SHEET 1: STATEMENT OF FINANCIAL POSITION
    // ============================================
    const bsData = [
      [coName.toUpperCase()],
      [isEN ? 'STATEMENT OF FINANCIAL POSITION' : 'PENYATA KEDUDUKAN KEWANGAN'],
      [(isEN ? 'AS AT ' : 'PADA ') + fyeDisplay.toUpperCase()],
      [],
      ['', currentYear, priorFSYear],
      ['', 'RM', 'RM'],
      [],
      [isEN ? 'ASSETS' : 'ASET'],
      [isEN ? 'Non-Current Assets' : 'Aset Bukan Semasa'],
      [(isEN ? '  Property, plant and equipment' : '  Hartanah, loji dan peralatan'), fmtNum(res.bs.ppe), fmtNum(res.bs.py_ppe)],
      ['', fmtNum(res.bs.totNCA), fmtNum(res.bs.py_totNCA)],
      [],
      [isEN ? 'Current Assets' : 'Aset Semasa'],
      [(isEN ? '  Inventories' : '  Inventori'), fmtNum(res.bs.inv), fmtNum(res.bs.py_inv)],
      [(isEN ? '  Trade receivables' : '  Penghutang perdagangan'), fmtNum(res.bs.tr), fmtNum(res.bs.py_tr)],
      [(isEN ? '  Other receivables' : '  Penghutang lain'), fmtNum(res.bs.or), fmtNum(res.bs.py_or)],
      [(isEN ? '  Cash and bank balances' : '  Tunai dan baki bank'), fmtNum(res.bs.cash), fmtNum(res.bs.py_cash)],
      ['', fmtNum(res.bs.totCA), fmtNum(res.bs.py_totCA)],
      [],
      [isEN ? 'TOTAL ASSETS' : 'JUMLAH ASET', fmtNum(res.bs.totA), fmtNum(res.bs.py_totA)],
      [],
      [],
      [isEN ? 'EQUITY AND LIABILITIES' : 'EKUITI DAN LIABILITI'],
      [isEN ? 'Equity' : 'Ekuiti'],
      [(isEN ? '  Share capital / Capital' : '  Modal saham / Modal'), fmtNum(res.bs.cap), fmtNum(res.bs.py_cap)],
      [(isEN ? '  Retained profits' : '  Keuntungan tertahan'), fmtNum(res.bs.ret), fmtNum(res.bs.py_ret)],
      [(isEN ? '  Current year profit/(loss)' : '  Untung/(Rugi) tahun semasa'), fmtNum(res.bs.cyp), fmtNum(res.bs.py_cyp)],
      [isEN ? 'Total Equity' : 'Jumlah Ekuiti', fmtNum(res.bs.totE), fmtNum(res.bs.py_totE)],
      [],
      [isEN ? 'Non-Current Liabilities' : 'Liabiliti Bukan Semasa'],
      [(isEN ? '  Borrowings' : '  Pinjaman'), fmtNum(res.bs.ltBorr), fmtNum(res.bs.py_ltBorr)],
      ['', fmtNum(res.bs.totNCL), fmtNum(res.bs.py_totNCL)],
      [],
      [isEN ? 'Current Liabilities' : 'Liabiliti Semasa'],
      [(isEN ? '  Trade payables' : '  Pemiutang perdagangan'), fmtNum(res.bs.tp), fmtNum(res.bs.py_tp)],
      [(isEN ? '  Other payables' : '  Pemiutang lain'), fmtNum(res.bs.op), fmtNum(res.bs.py_op)],
      [(isEN ? '  Short-term borrowings' : '  Pinjaman jangka pendek'), fmtNum(res.bs.stBorr), fmtNum(res.bs.py_stBorr)],
      [(isEN ? '  Tax payable' : '  Cukai kena bayar'), fmtNum(res.bs.taxPay), fmtNum(res.bs.py_taxPay)],
      ['', fmtNum(res.bs.totCL), fmtNum(res.bs.py_totCL)],
      [],
      [isEN ? 'Total Liabilities' : 'Jumlah Liabiliti', fmtNum(res.bs.totL), fmtNum(res.bs.py_totL)],
      [],
      [isEN ? 'TOTAL EQUITY AND LIABILITIES' : 'JUMLAH EKUITI DAN LIABILITI', fmtNum(res.bs.totE + res.bs.totL), fmtNum((res.bs.py_totE || 0) + (res.bs.py_totL || 0))],
      [],
      [isEN ? 'The accompanying notes form an integral part of these financial statements.' : 'Nota-nota yang disertakan merupakan sebahagian daripada penyata kewangan ini.'],
    ];
    createSheet(bsData, isEN ? 'Balance Sheet' : 'Kunci Kira-kira');
    
    // ============================================
    // SHEET 2: STATEMENT OF PROFIT OR LOSS
    // ============================================
    const isData = [
      [coName.toUpperCase()],
      [isEN ? 'STATEMENT OF PROFIT OR LOSS AND OTHER COMPREHENSIVE INCOME' : 'PENYATA UNTUNG RUGI DAN PENDAPATAN KOMPREHENSIF LAIN'],
      [(isEN ? 'FOR THE FINANCIAL YEAR ENDED ' : 'BAGI TAHUN KEWANGAN BERAKHIR ') + fyeDisplay.toUpperCase()],
      [],
      ['', currentYear, priorFSYear],
      ['', 'RM', 'RM'],
      [],
      [isEN ? 'Revenue' : 'Hasil', fmtNum(res.is.rev), fmtNum(res.is.py_rev)],
      [isEN ? 'Cost of sales' : 'Kos jualan', fmtNum(-Math.abs(res.is.cos)), fmtNum(-Math.abs(res.is.py_cos))],
      [isEN ? 'Gross profit' : 'Untung kasar', fmtNum(res.is.gp), fmtNum(res.is.py_gp)],
      [],
      [isEN ? 'Other income' : 'Pendapatan lain', fmtNum(res.is.oi), fmtNum(res.is.py_oi)],
      [isEN ? 'Administrative expenses' : 'Perbelanjaan pentadbiran', fmtNum(-Math.abs(res.is.adm)), fmtNum(-Math.abs(res.is.py_adm))],
      [isEN ? 'Operating profit' : 'Untung operasi', fmtNum(res.is.op), fmtNum(res.is.py_op)],
      [],
      [isEN ? 'Finance costs' : 'Kos kewangan', fmtNum(-Math.abs(res.is.fin)), fmtNum(-Math.abs(res.is.py_fin || 0))],
      [isEN ? 'Profit before taxation' : 'Untung sebelum cukai', fmtNum(res.is.pbt), fmtNum(res.is.py_pbt)],
      [],
      [isEN ? 'Taxation' : 'Cukai', fmtNum(-Math.abs(res.is.tax)), fmtNum(-Math.abs(res.is.py_tax || 0))],
      [isEN ? 'Profit for the year' : 'Untung bagi tahun', fmtNum(res.is.np), fmtNum(res.is.py_np)],
      [],
      [isEN ? 'Other comprehensive income' : 'Pendapatan komprehensif lain', '-', '-'],
      [isEN ? 'Total comprehensive income for the year' : 'Jumlah pendapatan komprehensif bagi tahun', fmtNum(res.is.np), fmtNum(res.is.py_np)],
      [],
      [isEN ? 'The accompanying notes form an integral part of these financial statements.' : 'Nota-nota yang disertakan merupakan sebahagian daripada penyata kewangan ini.'],
    ];
    createSheet(isData, isEN ? 'Income Statement' : 'Penyata Pendapatan');
    
    // ============================================
    // SHEET 3: STATEMENT OF CHANGES IN EQUITY
    // ============================================
    const soceData = [
      [coName.toUpperCase()],
      [isEN ? 'STATEMENT OF CHANGES IN EQUITY' : 'PENYATA PERUBAHAN EKUITI'],
      [(isEN ? 'FOR THE FINANCIAL YEAR ENDED ' : 'BAGI TAHUN KEWANGAN BERAKHIR ') + fyeDisplay.toUpperCase()],
      [],
      ['', isEN ? 'Share Capital' : 'Modal Saham', isEN ? 'Retained Earnings' : 'Pendapatan Tertahan', isEN ? 'Total' : 'Jumlah'],
      ['', 'RM', 'RM', 'RM'],
      [],
      [(isEN ? 'Balance at 1 January ' : 'Baki pada 1 Januari ') + priorFSYear, fmtNum(res.bs.py_cap), fmtNum((res.bs.py_ret || 0) - (res.is.py_np || 0)), fmtNum((res.bs.py_totE || 0) - (res.is.py_np || 0))],
      [(isEN ? '  Profit for the year' : '  Untung bagi tahun'), '-', fmtNum(res.is.py_np), fmtNum(res.is.py_np)],
      [(isEN ? 'Balance at 31 December ' : 'Baki pada 31 Disember ') + priorFSYear, fmtNum(res.bs.py_cap), fmtNum(res.bs.py_ret), fmtNum(res.bs.py_totE)],
      [],
      [(isEN ? 'Balance at 1 January ' : 'Baki pada 1 Januari ') + currentYear, fmtNum(res.bs.py_cap), fmtNum(res.bs.py_ret + (res.bs.py_cyp || 0)), fmtNum(res.bs.py_totE)],
      [(isEN ? '  Profit for the year' : '  Untung bagi tahun'), '-', fmtNum(res.is.np), fmtNum(res.is.np)],
      [(isEN ? 'Balance at 31 December ' : 'Baki pada 31 Disember ') + currentYear, fmtNum(res.bs.cap), fmtNum(res.bs.ret + res.bs.cyp), fmtNum(res.bs.totE)],
      [],
      [isEN ? 'The accompanying notes form an integral part of these financial statements.' : 'Nota-nota yang disertakan merupakan sebahagian daripada penyata kewangan ini.'],
    ];
    const soceWs = XLSX.utils.aoa_to_sheet(soceData);
    soceWs['!cols'] = [{ wch: 35 }, { wch: 18 }, { wch: 18 }, { wch: 18 }];
    XLSX.utils.book_append_sheet(wb, soceWs, isEN ? 'Changes in Equity' : 'Perubahan Ekuiti');
    
    // ============================================
    // SHEET 4: STATEMENT OF CASH FLOWS
    // ============================================
    const cfData = [
      [coName.toUpperCase()],
      [isEN ? 'STATEMENT OF CASH FLOWS' : 'PENYATA ALIRAN TUNAI'],
      [(isEN ? 'FOR THE FINANCIAL YEAR ENDED ' : 'BAGI TAHUN KEWANGAN BERAKHIR ') + fyeDisplay.toUpperCase()],
      [],
      ['', currentYear, priorFSYear],
      ['', 'RM', 'RM'],
      [],
      [isEN ? 'CASH FLOWS FROM OPERATING ACTIVITIES' : 'ALIRAN TUNAI DARIPADA AKTIVITI OPERASI'],
      [(isEN ? '  Profit before taxation' : '  Untung sebelum cukai'), fmtNum(res.cf.pbt), fmtNum(res.is.py_pbt || 0)],
      [(isEN ? '  Adjustments for:' : '  Pelarasan untuk:')],
      [(isEN ? '    Depreciation' : '    Susut nilai'), fmtNum(res.cf.adjustments.depreciation), '-'],
      [(isEN ? '    Interest expense' : '    Perbelanjaan faedah'), fmtNum(res.cf.adjustments.interestExpense), '-'],
      [(isEN ? '    Interest income' : '    Pendapatan faedah'), fmtNum(-res.cf.adjustments.interestIncome), '-'],
      [(isEN ? '  Operating profit before working capital changes' : '  Untung operasi sebelum perubahan modal kerja'), fmtNum(res.cf.pbt + res.cf.totalAdjustments), '-'],
      [(isEN ? '  Changes in inventories' : '  Perubahan dalam inventori'), fmtNum(-res.cf.workingCapitalChanges.inventory), '-'],
      [(isEN ? '  Changes in receivables' : '  Perubahan dalam penghutang'), fmtNum(-(res.cf.workingCapitalChanges.tradeReceivables + res.cf.workingCapitalChanges.otherReceivables)), '-'],
      [(isEN ? '  Changes in payables' : '  Perubahan dalam pemiutang'), fmtNum(res.cf.workingCapitalChanges.tradePayables + res.cf.workingCapitalChanges.otherPayables), '-'],
      [(isEN ? '  Cash generated from operations' : '  Tunai dijana daripada operasi'), fmtNum(res.cf.cashFromOperations), '-'],
      [(isEN ? '  Tax paid' : '  Cukai dibayar'), fmtNum(-Math.abs(res.cf.taxPaid)), '-'],
      [(isEN ? '  Interest paid' : '  Faedah dibayar'), fmtNum(-Math.abs(res.cf.interestPaid)), '-'],
      [isEN ? 'Net cash from operating activities' : 'Tunai bersih daripada aktiviti operasi', fmtNum(res.cf.netOperating), '-'],
      [],
      [isEN ? 'CASH FLOWS FROM INVESTING ACTIVITIES' : 'ALIRAN TUNAI DARIPADA AKTIVITI PELABURAN'],
      [(isEN ? '  Purchase of PPE' : '  Pembelian PPE'), fmtNum(-Math.abs(res.cf.ppePurchases)), '-'],
      [(isEN ? '  Interest received' : '  Faedah diterima'), fmtNum(res.cf.interestReceived), '-'],
      [isEN ? 'Net cash from investing activities' : 'Tunai bersih daripada aktiviti pelaburan', fmtNum(res.cf.netInvesting), '-'],
      [],
      [isEN ? 'CASH FLOWS FROM FINANCING ACTIVITIES' : 'ALIRAN TUNAI DARIPADA AKTIVITI PEMBIAYAAN'],
      [(isEN ? '  Loan proceeds' : '  Penerimaan pinjaman'), fmtNum(res.cf.loanProceeds), '-'],
      [(isEN ? '  Loan repayments' : '  Bayaran balik pinjaman'), fmtNum(-Math.abs(res.cf.loanRepayments)), '-'],
      [(isEN ? '  Capital injection' : '  Suntikan modal'), fmtNum(res.cf.capitalInjection), '-'],
      [(isEN ? '  Dividends/Drawings' : '  Dividen/Pengeluaran'), fmtNum(-Math.abs(res.cf.dividendsPaid + res.cf.drawingsWithdrawals)), '-'],
      [isEN ? 'Net cash from financing activities' : 'Tunai bersih daripada aktiviti pembiayaan', fmtNum(res.cf.netFinancing), '-'],
      [],
      [isEN ? 'NET CHANGE IN CASH' : 'PERUBAHAN BERSIH DALAM TUNAI', fmtNum(res.cf.netChangeInCash), '-'],
      [(isEN ? 'Cash at beginning of year' : 'Tunai pada awal tahun'), fmtNum(res.cf.openingCash), fmtNum(res.bs.py_cash || 0)],
      [isEN ? 'CASH AT END OF YEAR' : 'TUNAI PADA AKHIR TAHUN', fmtNum(res.cf.closingCash), fmtNum(res.cf.openingCash)],
      [],
      [isEN ? 'The accompanying notes form an integral part of these financial statements.' : 'Nota-nota yang disertakan merupakan sebahagian daripada penyata kewangan ini.'],
    ];
    createSheet(cfData, isEN ? 'Cash Flow' : 'Aliran Tunai');
    
    // ============================================
    // SHEET 5: NOTES TO FINANCIAL STATEMENTS
    // ============================================
    const notesData = [
      [coName.toUpperCase()],
      [isEN ? 'NOTES TO THE FINANCIAL STATEMENTS' : 'NOTA-NOTA KEPADA PENYATA KEWANGAN'],
      [(isEN ? 'FOR THE FINANCIAL YEAR ENDED ' : 'BAGI TAHUN KEWANGAN BERAKHIR ') + fyeDisplay.toUpperCase()],
      [],
      [isEN ? '1. GENERAL INFORMATION' : '1. MAKLUMAT AM'],
      [(isEN ? 'The Company is incorporated and domiciled in Malaysia.' : 'Syarikat diperbadankan dan bermastautin di Malaysia.')],
      [(isEN ? 'Principal activities: General trading and services.' : 'Aktiviti utama: Perdagangan am dan perkhidmatan.')],
      [],
      [isEN ? '2. BASIS OF PREPARATION' : '2. ASAS PENYEDIAAN'],
      [(isEN ? 'These financial statements have been prepared in accordance with ' + stdName + '.' : 'Penyata kewangan ini telah disediakan mengikut ' + stdName + '.')],
      [],
      [isEN ? '3. SIGNIFICANT ACCOUNTING POLICIES' : '3. DASAR PERAKAUNAN PENTING'],
      [isEN ? '(a) Property, plant and equipment' : '(a) Hartanah, loji dan peralatan'],
      [(isEN ? '    Depreciation rates:' : '    Kadar susut nilai:')],
      [(isEN ? '    - Buildings: 2%' : '    - Bangunan: 2%')],
      [(isEN ? '    - Motor vehicles: 20%' : '    - Kenderaan bermotor: 20%')],
      [(isEN ? '    - Office equipment: 10%' : '    - Peralatan pejabat: 10%')],
      [(isEN ? '    - Computer equipment: 33.33%' : '    - Peralatan komputer: 33.33%')],
      [(isEN ? '    - Furniture & fittings: 10%' : '    - Perabot & kelengkapan: 10%')],
      [],
      [isEN ? '(b) Inventories' : '(b) Inventori'],
      [(isEN ? '    Stated at lower of cost and net realisable value using FIFO method.' : '    Dinyatakan pada kos atau nilai boleh realis bersih yang lebih rendah menggunakan kaedah FIFO.')],
      [],
      [isEN ? '4. PROPERTY, PLANT AND EQUIPMENT' : '4. HARTANAH, LOJI DAN PERALATAN'],
      ['', isEN ? 'Cost' : 'Kos', isEN ? 'Acc. Dep.' : 'Susut Nilai Terkumpul', isEN ? 'NBV' : 'NBV'],
      ['', 'RM', 'RM', 'RM'],
      [isEN ? 'Total' : 'Jumlah', fmtNum(res.bs.ppe + (subledgerTotals?.ppe?.accDepCF || 0)), fmtNum(subledgerTotals?.ppe?.accDepCF || 0), fmtNum(res.bs.ppe)],
      [],
      [isEN ? '5. TRADE AND OTHER RECEIVABLES' : '5. PENGHUTANG PERDAGANGAN DAN LAIN-LAIN'],
      [(isEN ? 'Trade receivables' : 'Penghutang perdagangan'), fmtNum(res.bs.tr)],
      [(isEN ? 'Other receivables' : 'Penghutang lain'), fmtNum(res.bs.or)],
      ['Total', fmtNum(res.bs.tr + res.bs.or)],
      [],
      [isEN ? '6. CASH AND BANK BALANCES' : '6. TUNAI DAN BAKI BANK'],
      [(isEN ? 'Cash and bank balances' : 'Tunai dan baki bank'), fmtNum(res.bs.cash)],
      [],
      [isEN ? '7. SHARE CAPITAL / CAPITAL' : '7. MODAL SAHAM / MODAL'],
      [(isEN ? 'Issued and fully paid' : 'Diterbitkan dan berbayar penuh'), fmtNum(res.bs.cap)],
      [],
      [isEN ? '8. TRADE AND OTHER PAYABLES' : '8. PEMIUTANG PERDAGANGAN DAN LAIN-LAIN'],
      [(isEN ? 'Trade payables' : 'Pemiutang perdagangan'), fmtNum(res.bs.tp)],
      [(isEN ? 'Other payables' : 'Pemiutang lain'), fmtNum(res.bs.op)],
      ['Total', fmtNum(res.bs.tp + res.bs.op)],
      [],
      [isEN ? '9. REVENUE' : '9. HASIL'],
      [(isEN ? 'Sale of goods and services' : 'Jualan barangan dan perkhidmatan'), fmtNum(res.is.rev)],
      [],
      [isEN ? '10. TAXATION' : '10. CUKAI'],
      [(isEN ? 'Current tax expense' : 'Perbelanjaan cukai semasa'), fmtNum(res.is.tax)],
    ];
    const notesWs = XLSX.utils.aoa_to_sheet(notesData);
    notesWs['!cols'] = [{ wch: 50 }, { wch: 15 }, { wch: 15 }, { wch: 15 }];
    XLSX.utils.book_append_sheet(wb, notesWs, isEN ? 'Notes' : 'Nota');
    
    // Download the workbook
    const fileName = (companyName || 'Financial_Statements').replace(/[^a-zA-Z0-9]/g, '_') + '_FS_' + currentYear + '_' + lang + '.xlsx';
    downloadXlsx(wb, fileName);
    setShowExportModal(false);
    setLogs(prev => [...prev, { t: 'ok', m: `✓ Excel file ${fileName} downloaded` }]);
  };
  

  // Generate PDF - opens in new window for printing
  const generatePDF = (lang) => {
    console.log('generatePDF called, lang:', lang, 'res:', res);
    
    if (!res) {
      alert('Please generate financial statements first!\n\nGo to Review tab and click "Generate FS" button.');
      setShowExportModal(false);
      return;
    }
    
    const html = generateFullFS(lang);
    console.log('generateFullFS returned:', html ? 'HTML content (' + html.length + ' chars)' : 'null');
    
    if (!html) {
      alert('Failed to generate financial statements. Please try again.');
      setShowExportModal(false);
      return;
    }
    
    // Show preview modal with print/download options
    setPreviewContent(html);
    setPreviewType('pdf');
    setShowExportModal(false);
    setLogs(prev => [...prev, { t: 'ok', m: '✓ PDF preview ready. Click "Print to PDF" or use Ctrl+P.' }]);
  };
  
  // Export as HTML
  const exportFullFS = (lang) => {
    // Use new model-based Full FS system
    downloadFullFS('html', lang);
    setShowExportModal(false);
    setLogs(prev => [...prev, { t: 'ok', m: `✓ Full FS (HTML) downloaded - ${lang}` }]);
  };

  const exp = () => {
    setShowExportModal(true);
  };

  // ============================================
  // SUBLEDGER EXPORT FUNCTIONS
  // ============================================
  
  // Export to CSV
  const exportToCSV = (data, headers, filename) => {
    const csvContent = [
      headers.join(','),
      ...data.map(row => row.map(cell => {
        const str = String(cell ?? '');
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      }).join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    downloadBlob(blob, `${filename}.csv`);
    setLogs(prev => [...prev, { t: 'ok', m: `✓ Exported ${filename}.csv` }]);
  };

  // Export to Excel (fixed version using downloadXlsx helper)
  const exportToExcel = (data, headers, filename, sheetName = 'Sheet1') => {
    const wsData = [headers, ...data];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    
    // Auto-size columns
    const colWidths = headers.map((h, i) => {
      const maxLen = Math.max(
        h.length,
        ...data.map(row => String(row[i] ?? '').length)
      );
      return { wch: Math.min(maxLen + 2, 40) };
    });
    ws['!cols'] = colWidths;
    
    // Create workbook
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName.substring(0, 31));
    
    // Use reliable download method
    if (downloadXlsx(wb, `${filename}.xlsx`)) {
      setLogs(prev => [...prev, { t: 'ok', m: `✓ Exported ${filename}.xlsx` }]);
    } else {
      setLogs(prev => [...prev, { t: 'error', m: `✗ Failed to export ${filename}.xlsx` }]);
    }
  };

  // Generic export function that handles both formats
  const exportData = (data, headers, filename, sheetName, format = 'xlsx') => {
    if (format === 'csv') {
      exportToCSV(data, headers, filename);
    } else {
      exportToExcel(data, headers, filename, sheetName);
    }
  };

  // Export PPE Register
  const exportPPERegister = (format = 'xlsx') => {
    const headers = ['GL Code', 'Asset ID', 'Description', 'Category', 'Acquisition Date', 'Cost (RM)', 'Useful Life (Yrs)', 'Dep Rate (%)', 'Acc Dep B/F (RM)', 'Current Dep (RM)', 'Acc Dep C/F (RM)', 'NBV (RM)'];
    const data = ppeRegister.map((asset, i) => {
      const categoryInfo = PPE_CATEGORIES[asset.category] || PPE_CATEGORIES['OFFICE_EQUIPMENT'];
      const cost = parseFloat(asset.cost) || 0;
      const accDepBF = parseFloat(asset.accDepBF) || 0;
      const currentDep = Math.min(cost * (categoryInfo.rate / 100), cost - accDepBF);
      const accDepCF = accDepBF + currentDep;
      const nbv = cost - accDepCF;
      return [
        '1000',
        `PPE-${String(i + 1).padStart(3, '0')}`,
        asset.description,
        categoryInfo.label,
        asset.acquisitionDate,
        cost,
        categoryInfo.years,
        categoryInfo.rate,
        accDepBF,
        currentDep,
        accDepCF,
        nbv
      ];
    });
    
    // Add totals row
    const totals = data.reduce((acc, row) => {
      acc.cost += parseFloat(row[5]) || 0;
      acc.accDepBF += parseFloat(row[8]) || 0;
      acc.currentDep += parseFloat(row[9]) || 0;
      acc.accDepCF += parseFloat(row[10]) || 0;
      acc.nbv += parseFloat(row[11]) || 0;
      return acc;
    }, { cost: 0, accDepBF: 0, currentDep: 0, accDepCF: 0, nbv: 0 });
    
    data.push(['', '', 'TOTAL', '', '', totals.cost, '', '', totals.accDepBF, totals.currentDep, totals.accDepCF, totals.nbv]);
    
    exportData(data, headers, `PPE_Register_${companyName.replace(/\s+/g, '_')}_${currentYear}`, 'PPE Register', format);
  };

  // Export Inventory Ledger
  const exportInventoryLedger = (format = 'xlsx') => {
    const headers = ['GL Code', 'Item Code', 'Description', 'Category', 'Quantity', 'Unit Cost (RM)', 'Total Value (RM)', 'Location'];
    const data = inventoryLedger.map((item, i) => [
      '1500',
      item.code || `INV-${String(i + 1).padStart(3, '0')}`,
      item.description,
      item.category || 'General',
      parseFloat(item.qty) || 0,
      parseFloat(item.unitCost) || 0,
      parseFloat(item.totalValue) || 0,
      item.location || '-'
    ]);
    
    const totalValue = data.reduce((sum, row) => sum + (parseFloat(row[6]) || 0), 0);
    data.push(['', '', 'TOTAL', '', '', '', totalValue, '']);
    
    exportData(data, headers, `Inventory_Ledger_${companyName.replace(/\s+/g, '_')}_${currentYear}`, 'Inventory', format);
  };

  // Export Trade Receivables
  const exportTradeReceivables = (format = 'xlsx') => {
    const headers = ['GL Code', 'Invoice No', 'Customer Name', 'Invoice Date', 'Due Date', 'Amount (RM)', 'Status', 'Aging (Days)'];
    const today = new Date();
    const data = tradeReceivables.map((inv, i) => {
      const dueDate = new Date(inv.dueDate);
      const aging = Math.floor((today - dueDate) / (1000 * 60 * 60 * 24));
      return [
        '1600',
        inv.invoiceNo || `INV-${String(i + 1).padStart(4, '0')}`,
        inv.customerName,
        inv.invoiceDate,
        inv.dueDate,
        parseFloat(inv.amount) || 0,
        inv.status || 'Outstanding',
        aging > 0 ? aging : 0
      ];
    });
    
    const totalAmount = data.reduce((sum, row) => sum + (parseFloat(row[5]) || 0), 0);
    data.push(['', '', 'TOTAL', '', '', totalAmount, '', '']);
    
    exportData(data, headers, `Trade_Receivables_${companyName.replace(/\s+/g, '_')}_${currentYear}`, 'AR', format);
  };

  // Export Trade Payables
  const exportTradePayables = (format = 'xlsx') => {
    const headers = ['GL Code', 'Invoice No', 'Supplier Name', 'Invoice Date', 'Due Date', 'Amount (RM)', 'Status', 'Aging (Days)'];
    const today = new Date();
    const data = tradePayables.map((inv, i) => {
      const dueDate = new Date(inv.dueDate);
      const aging = Math.floor((today - dueDate) / (1000 * 60 * 60 * 24));
      return [
        '2600',
        inv.invoiceNo || `BILL-${String(i + 1).padStart(4, '0')}`,
        inv.supplierName,
        inv.invoiceDate,
        inv.dueDate,
        parseFloat(inv.amount) || 0,
        inv.status || 'Outstanding',
        aging > 0 ? aging : 0
      ];
    });
    
    const totalAmount = data.reduce((sum, row) => sum + (parseFloat(row[5]) || 0), 0);
    data.push(['', '', 'TOTAL', '', '', totalAmount, '', '']);
    
    exportData(data, headers, `Trade_Payables_${companyName.replace(/\s+/g, '_')}_${currentYear}`, 'AP', format);
  };

  // Export Other Debtors
  const exportOtherDebtors = (format = 'xlsx') => {
    const headers = ['GL Code', 'Reference', 'Description', 'Type', 'Amount (RM)'];
    const data = otherDebtors.map((item, i) => [
      '1700',
      item.ref || `OD-${String(i + 1).padStart(3, '0')}`,
      item.description,
      item.type || 'Deposit',
      parseFloat(item.amount) || 0
    ]);
    
    const totalAmount = data.reduce((sum, row) => sum + (parseFloat(row[4]) || 0), 0);
    data.push(['', '', 'TOTAL', '', totalAmount]);
    
    exportData(data, headers, `Other_Debtors_${companyName.replace(/\s+/g, '_')}_${currentYear}`, 'Other Debtors', format);
  };

  // Export Other Creditors
  const exportOtherCreditors = (format = 'xlsx') => {
    const headers = ['GL Code', 'Reference', 'Description', 'Type', 'Amount (RM)'];
    const data = otherCreditors.map((item, i) => [
      '2700',
      item.ref || `OC-${String(i + 1).padStart(3, '0')}`,
      item.description,
      item.type || 'Accrual',
      parseFloat(item.amount) || 0
    ]);
    
    const totalAmount = data.reduce((sum, row) => sum + (parseFloat(row[4]) || 0), 0);
    data.push(['', '', 'TOTAL', '', totalAmount]);
    
    exportData(data, headers, `Other_Creditors_${companyName.replace(/\s+/g, '_')}_${currentYear}`, 'Other Creditors', format);
  };

  // Export Cash & Bank Ledger
  const exportCashBankLedger = (format = 'xlsx') => {
    const headers = ['GL Code', 'Bank Name', 'Account Number', 'Opening Balance (RM)', 'Closing Balance (RM)'];
    const data = cashBankLedger.map((bank, i) => [
      '1900',
      bank.bankName,
      bank.accountNo || '-',
      parseFloat(bank.openingBalance) || 0,
      parseFloat(bank.closingBalance) || 0
    ]);
    
    const totalOpening = data.reduce((sum, row) => sum + (parseFloat(row[3]) || 0), 0);
    const totalClosing = data.reduce((sum, row) => sum + (parseFloat(row[4]) || 0), 0);
    data.push(['', 'TOTAL', '', totalOpening, totalClosing]);
    
    exportData(data, headers, `Cash_Bank_Ledger_${companyName.replace(/\s+/g, '_')}_${currentYear}`, 'Cash & Bank', format);
  };

  // Export All Subledgers to single Excel file with multiple sheets
  const exportAllSubledgersExcel = () => {
    const wb = XLSX.utils.book_new();
    
    // PPE Register
    const ppeHeaders = ['GL Code', 'Asset ID', 'Description', 'Category', 'Acquisition Date', 'Cost (RM)', 'Useful Life', 'Dep Rate (%)', 'Acc Dep B/F', 'Current Dep', 'Acc Dep C/F', 'NBV'];
    const ppeData = ppeRegister.map((asset, i) => {
      const categoryInfo = PPE_CATEGORIES[asset.category] || PPE_CATEGORIES['OFFICE_EQUIPMENT'];
      const cost = parseFloat(asset.cost) || 0;
      const accDepBF = parseFloat(asset.accDepBF) || 0;
      const currentDep = Math.min(cost * (categoryInfo.rate / 100), cost - accDepBF);
      return ['1000', `PPE-${String(i + 1).padStart(3, '0')}`, asset.description, categoryInfo.label, asset.acquisitionDate, cost, categoryInfo.years, categoryInfo.rate, accDepBF, currentDep, accDepBF + currentDep, cost - accDepBF - currentDep];
    });
    const ppeWs = XLSX.utils.aoa_to_sheet([ppeHeaders, ...ppeData]);
    XLSX.utils.book_append_sheet(wb, ppeWs, 'PPE Register');
    
    // Inventory
    const invHeaders = ['GL Code', 'Item Code', 'Description', 'Category', 'Quantity', 'Unit Cost', 'Total Value', 'Location'];
    const invData = inventoryLedger.map((item, i) => ['1500', item.code || `INV-${String(i + 1).padStart(3, '0')}`, item.description, item.category || 'General', parseFloat(item.qty) || 0, parseFloat(item.unitCost) || 0, parseFloat(item.totalValue) || 0, item.location || '-']);
    const invWs = XLSX.utils.aoa_to_sheet([invHeaders, ...invData]);
    XLSX.utils.book_append_sheet(wb, invWs, 'Inventory');
    
    // Trade Receivables
    const arHeaders = ['GL Code', 'Invoice No', 'Customer', 'Invoice Date', 'Due Date', 'Amount', 'Status', 'Aging'];
    const today = new Date();
    const arData = tradeReceivables.map((inv, i) => {
      const aging = Math.max(0, Math.floor((today - new Date(inv.dueDate)) / (1000 * 60 * 60 * 24)));
      return ['1600', inv.invoiceNo || `INV-${String(i + 1).padStart(4, '0')}`, inv.customerName, inv.invoiceDate, inv.dueDate, parseFloat(inv.amount) || 0, inv.status || 'Outstanding', aging];
    });
    const arWs = XLSX.utils.aoa_to_sheet([arHeaders, ...arData]);
    XLSX.utils.book_append_sheet(wb, arWs, 'Trade Receivables');
    
    // Trade Payables
    const apHeaders = ['GL Code', 'Invoice No', 'Supplier', 'Invoice Date', 'Due Date', 'Amount', 'Status', 'Aging'];
    const apData = tradePayables.map((inv, i) => {
      const aging = Math.max(0, Math.floor((today - new Date(inv.dueDate)) / (1000 * 60 * 60 * 24)));
      return ['2600', inv.invoiceNo || `BILL-${String(i + 1).padStart(4, '0')}`, inv.supplierName, inv.invoiceDate, inv.dueDate, parseFloat(inv.amount) || 0, inv.status || 'Outstanding', aging];
    });
    const apWs = XLSX.utils.aoa_to_sheet([apHeaders, ...apData]);
    XLSX.utils.book_append_sheet(wb, apWs, 'Trade Payables');
    
    // Other Debtors
    const odHeaders = ['GL Code', 'Reference', 'Description', 'Type', 'Amount'];
    const odData = otherDebtors.map((item, i) => ['1700', item.ref || `OD-${String(i + 1).padStart(3, '0')}`, item.description, item.type || 'Deposit', parseFloat(item.amount) || 0]);
    const odWs = XLSX.utils.aoa_to_sheet([odHeaders, ...odData]);
    XLSX.utils.book_append_sheet(wb, odWs, 'Other Debtors');
    
    // Other Creditors
    const ocHeaders = ['GL Code', 'Reference', 'Description', 'Type', 'Amount'];
    const ocData = otherCreditors.map((item, i) => ['2700', item.ref || `OC-${String(i + 1).padStart(3, '0')}`, item.description, item.type || 'Accrual', parseFloat(item.amount) || 0]);
    const ocWs = XLSX.utils.aoa_to_sheet([ocHeaders, ...ocData]);
    XLSX.utils.book_append_sheet(wb, ocWs, 'Other Creditors');
    
    // Cash & Bank
    const cbHeaders = ['GL Code', 'Bank Name', 'Account Number', 'Opening Balance', 'Closing Balance'];
    const cbData = cashBankLedger.map(bank => ['1900', bank.bankName, bank.accountNo || '-', parseFloat(bank.openingBalance) || 0, parseFloat(bank.closingBalance) || 0]);
    const cbWs = XLSX.utils.aoa_to_sheet([cbHeaders, ...cbData]);
    XLSX.utils.book_append_sheet(wb, cbWs, 'Cash & Bank');
    
    // Use reliable download method
    const filename = `Subledgers_${(companyName || 'Company').replace(/[^a-zA-Z0-9]/g, '_')}_${currentYear}.xlsx`;
    if (downloadXlsx(wb, filename)) {
      setLogs(prev => [...prev, { t: 'ok', m: '✓ All subledgers exported to Excel (7 sheets)' }]);
    } else {
      setLogs(prev => [...prev, { t: 'error', m: '✗ Failed to export subledgers to Excel' }]);
    }
  };

  // Export All Subledgers (CSV - multiple files)
  const exportAllSubledgersCSV = () => {
    exportPPERegister('csv');
    exportInventoryLedger('csv');
    exportTradeReceivables('csv');
    exportTradePayables('csv');
    exportOtherDebtors('csv');
    exportOtherCreditors('csv');
    exportCashBankLedger('csv');
  };

  // Export Trial Balance with GL Codes
  const exportTrialBalance = (format = 'xlsx') => {
    if (!res) {
      setLogs(prev => [...prev, { t: 'error', m: '✗ Generate FS first before exporting Trial Balance' }]);
      return;
    }
    
    const headers = ['GL Code', 'Account Name', 'Debit (RM)', 'Credit (RM)'];
    const data = res.tb.map(r => {
      // Find GL code from FS_STRUCTURE or COA
      let glCode = '9999';
      const accUpper = r.acc.toUpperCase();
      
      // Search in all FS_STRUCTURE sections
      for (const section of Object.values(FS_STRUCTURE.income)) {
        const found = section.find(item => item.id === accUpper);
        if (found?.glCode) { glCode = found.glCode; break; }
      }
      for (const section of Object.values(FS_STRUCTURE.balance)) {
        const found = section.find(item => item.id === accUpper);
        if (found?.glCode) { glCode = found.glCode; break; }
      }
      const foundOther = FS_STRUCTURE.other.find(item => item.id === accUpper);
      if (foundOther?.glCode) glCode = foundOther.glCode;
      
      // Check if it's a bank account
      if (r.acc.startsWith('bank_') || r.acc === 'bank') glCode = '1900';
      
      return [
        glCode,
        CHART_OF_ACCOUNTS[glCode]?.name || r.acc,
        r.dr > 0 ? r.dr : '',
        r.cr > 0 ? r.cr : ''
      ];
    });
    
    // Calculate totals
    const totalDr = res.tb.reduce((sum, r) => sum + (r.dr || 0), 0);
    const totalCr = res.tb.reduce((sum, r) => sum + (r.cr || 0), 0);
    data.push(['', 'TOTAL', totalDr, totalCr]);
    
    exportData(data, headers, `Trial_Balance_${companyName.replace(/\s+/g, '_')}_${currentYear}`, 'Trial Balance', format);
  };

  // Export Chart of Accounts
  const exportChartOfAccounts = (format = 'xlsx') => {
    const headers = ['GL Code', 'Account Name', 'Type', 'FS Line Item', 'Group'];
    const data = Object.entries(CHART_OF_ACCOUNTS)
      .filter(([code, acc]) => !acc.subAccount)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([code, acc]) => [
        code,
        acc.name,
        acc.type,
        acc.fsId || '-',
        acc.group || '-'
      ]);
    
    exportData(data, headers, `Chart_of_Accounts_${companyName.replace(/\s+/g, '_')}`, 'COA', format);
  };

  // Save entire session to file
  const saveSession = () => {
    const sessionData = {
      version: '1.2', // Updated for snapshots and adjustment log
      savedAt: new Date().toISOString(),
      // Company info
      companyName,
      companyRegNo,
      companyType,
      accountingStandard,
      financialYearEnd,
      currentYear,
      priorFSYear,
      // Prior year data (save the items, not the computed values)
      priorISItems,
      priorBSItems,
      // Banks and transactions
      banks,
      bankStatements,
      txs,
      cashTxs,
      ob,
      // Subledger data
      ppeRegister,
      inventoryLedger,
      tradeReceivables,
      tradePayables,
      otherDebtors,
      otherCreditors,
      cashBankLedger,
      shortTermBorrowings,
      longTermBorrowings,
      // Capital Allowance Schedule
      caScheduleItems,
      // Tax settings
      taxSettings,
      // Snapshots and adjustments
      fsSnapshots,
      adjustmentLog,
      // Results (if generated)
      res
    };
    
    const jsonStr = JSON.stringify(sessionData, null, 2);
    
    // Try download first
    try {
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const fileName = (companyName || 'fs-session').replace(/[^a-zA-Z0-9]/g, '_') + '_FY' + currentYear + '_session.json';
      downloadBlob(blob, fileName);
      setLogs(prev => [...prev, { t: 'ok', m: 'Session saved: ' + fileName }]);
    } catch (err) {
      // If download fails, show in preview modal
      setPreviewContent(jsonStr);
      setPreviewType('json');
    }
  };

  // Load session from file
  const loadSessionFile = useRef(null);
  const loadSession = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target.result);
        
        // Restore company info
        if (data.companyName) setCompanyName(data.companyName);
        if (data.companyRegNo) setCompanyRegNo(data.companyRegNo);
        if (data.companyType) setCompanyType(data.companyType);
        if (data.accountingStandard) setAccountingStandard(data.accountingStandard);
        if (data.financialYearEnd) setFinancialYearEnd(data.financialYearEnd);
        if (data.currentYear) setCurrentYear(data.currentYear);
        if (data.priorFSYear) setPriorFSYear(data.priorFSYear);
        
        // Restore prior year data
        if (data.priorISItems) setPriorISItems(data.priorISItems);
        if (data.priorBSItems) setPriorBSItems(data.priorBSItems);
        
        // Restore banks and transactions
        if (data.banks) setBanks(data.banks);
        if (data.bankStatements) setBankStatements(data.bankStatements);
        if (data.txs) setTxs(data.txs);
        if (data.cashTxs) setCashTxs(data.cashTxs);
        if (data.ob) setOb(data.ob);
        
        // Restore subledger data
        if (data.ppeRegister) setPpeRegister(data.ppeRegister);
        if (data.inventoryLedger) setInventoryLedger(data.inventoryLedger);
        if (data.tradeReceivables) setTradeReceivables(data.tradeReceivables);
        if (data.tradePayables) setTradePayables(data.tradePayables);
        if (data.otherDebtors) setOtherDebtors(data.otherDebtors);
        if (data.otherCreditors) setOtherCreditors(data.otherCreditors);
        if (data.cashBankLedger) setCashBankLedger(data.cashBankLedger);
        if (data.shortTermBorrowings) setShortTermBorrowings(data.shortTermBorrowings);
        if (data.longTermBorrowings) setLongTermBorrowings(data.longTermBorrowings);
        
        // Restore Capital Allowance Schedule
        if (data.caScheduleItems) setCaScheduleItems(data.caScheduleItems);
        
        // Restore snapshots and adjustments (v1.2+)
        if (data.fsSnapshots) setFsSnapshots(data.fsSnapshots);
        if (data.adjustmentLog) setAdjustmentLog(data.adjustmentLog);
        
        // Restore tax settings (merge with defaults to handle old sessions without addBackExpenses/taxRebates)
        if (data.taxSettings) {
          setTaxSettings(prev => ({
            ...prev,
            ...data.taxSettings,
            addBackExpenses: {
              ...prev.addBackExpenses,
              ...(data.taxSettings.addBackExpenses || {})
            },
            taxRebates: {
              ...prev.taxRebates,
              ...(data.taxSettings.taxRebates || {})
            }
          }));
        }
        
        // Restore results
        if (data.res) setRes(data.res);
        
        setLogs(prev => [...prev, { t: 'ok', m: `Session loaded: ${file.name} (saved ${data.savedAt ? new Date(data.savedAt).toLocaleString() : 'unknown'})` }]);
        
        // Navigate to appropriate tab
        if (data.res) {
          setTab('journal');
        } else if (data.txs && data.txs.length > 0) {
          setTab('review');
        } else if (data.companyType) {
          setTab('priorfs');
        }
        
      } catch (err) {
        setLogs(prev => [...prev, { t: 'error', m: `Error loading session: ${err.message}` }]);
        alert('Error loading session file. Please check the file format.');
      }
    };
    reader.readAsText(file);
    e.target.value = ''; // Reset file input
  };

  const clearAll = () => { 
    setTxs([]); setCashTxs([]); setBanks([]); setBankStatements({}); setLogs([]); setRes(null); setOb({}); 
    setPriorFSApplied(false); // Reset prior FS applied flag
    // Reset Prior FS Items to defaults using generators (maintains consistency with FS_STRUCTURE)
    setPriorISItems(generateInitialPriorIS());
    setPriorBSItems(generateInitialPriorBS());
    setCompanyType('');
    setCompanyName('');
    setCompanyRegNo('');
    setAccountingStandard('');
    // Reset all subledgers
    setPpeRegister([]);
    setInventoryLedger([]);
    setTradeReceivables([]);
    setTradePayables([]);
    setOtherDebtors([]);
    setOtherCreditors([]);
    setCashBankLedger([]);
    setShortTermBorrowings([]);
    setLongTermBorrowings([]);
    // Reset snapshots and adjustments
    setFsSnapshots([]);
    setAdjustmentLog([]);
    setTab('setup');
  };

  // Get upload status summary
  const getUploadSummary = () => {
    let total = 0, uploaded = 0;
    banks.forEach(bank => {
      MONTHS.forEach(month => {
        total++;
        if (bankStatements[bank.id]?.[month]?.uploaded) uploaded++;
      });
    });
    return { total, uploaded, percent: total > 0 ? Math.round((uploaded / total) * 100) : 0 };
  };

  const uploadSummary = getUploadSummary();

  const inputStyle = { padding: '8px 10px', background: 'rgba(17,24,39,0.6)', border: '1px solid rgba(75,85,99,0.3)', borderRadius: 6, color: '#e5e7eb', fontSize: 13, width: '100%' };
  const numInputStyle = { ...inputStyle, textAlign: 'right', fontFamily: 'monospace' };
  const tabStyle = (id) => ({
    padding: '12px 10px', background: tab === id ? 'rgba(99,102,241,0.15)' : 'transparent',
    borderBottom: tab === id ? '2px solid #818cf8' : '2px solid transparent',
    color: tab === id ? '#a5b4fc' : '#6b7280', fontSize: 11, fontWeight: 600, cursor: 'pointer', border: 'none', whiteSpace: 'nowrap'
  });
  const sectionTitle = { fontSize: 11, fontWeight: 700, color: '#9ca3af', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 };
  
  // Navigation buttons
  const backBtnStyle = { padding: '8px 16px', background: 'rgba(75,85,99,0.3)', border: '1px solid rgba(75,85,99,0.4)', borderRadius: 6, color: '#9ca3af', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 };
  const nextBtnStyle = { padding: '8px 16px', background: 'linear-gradient(135deg, #6366f1, #4f46e5)', border: 'none', borderRadius: 6, color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 };
  const navTabs = ['setup', 'priorfs', 'banks', 'upload', 'review', 'classify', 'cashvoucher', 'subledger', 'balances', 'journal', 'trial', 'income', 'balance', 'cashflow', 'tax', 'snapshots', 'dashboard'];
  const goBack = () => { const idx = navTabs.indexOf(tab); if (idx > 0) setTab(navTabs[idx - 1]); };
  const goNext = () => { const idx = navTabs.indexOf(tab); if (idx < navTabs.length - 1) setTab(navTabs[idx + 1]); };

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(145deg, #111827 0%, #1f2937 100%)', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', color: '#e5e7eb' }}>
      
      {/* Hidden file input for loading sessions */}
      <input type="file" ref={loadSessionFile} onChange={loadSession} accept=".json" style={{ display: 'none' }} />
      
      {/* Export Modal */}
      {showExportModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: 'linear-gradient(145deg, #1f2937, #111827)', borderRadius: 16, border: '1px solid rgba(75,85,99,0.3)', padding: 24, maxWidth: 520, width: '90%', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>📄 Export Financial Statements</h3>
              <button onClick={() => setShowExportModal(false)} style={{ background: 'none', border: 'none', color: '#9ca3af', fontSize: 20, cursor: 'pointer' }}>×</button>
            </div>
            
            <p style={{ fontSize: 11, color: '#9ca3af', marginBottom: 14 }}>
              Generate {config?.standard || 'MPERS'}-compliant financial statements. Choose format and language:
            </p>
            
            {/* PDF Export */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#f87171', marginBottom: 8 }}>📕 PDF Document (.pdf) - Recommended</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <button 
                  type="button"
                  onClick={() => generatePDF('EN')}
                  style={{ 
                    padding: 12, 
                    background: 'rgba(239,68,68,0.15)', 
                    border: '2px solid rgba(239,68,68,0.4)', 
                    borderRadius: 10, 
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ fontSize: 18, marginBottom: 2 }}>🇬🇧</div>
                  <div style={{ fontWeight: 700, color: '#fca5a5', fontSize: 11 }}>English (.pdf)</div>
                </button>
                
                <button 
                  type="button"
                  onClick={() => generatePDF('BM')}
                  style={{ 
                    padding: 12, 
                    background: 'rgba(239,68,68,0.15)', 
                    border: '2px solid rgba(239,68,68,0.4)', 
                    borderRadius: 10, 
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ fontSize: 18, marginBottom: 2 }}>🇲🇾</div>
                  <div style={{ fontWeight: 700, color: '#fca5a5', fontSize: 11 }}>Bahasa Malaysia (.pdf)</div>
                </button>
              </div>
            </div>
            
            {/* Word Document Export - Professional HTML-based */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#a5b4fc', marginBottom: 8 }}>📝 Word Document (.doc) - Professional Format</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <button 
                  type="button"
                  onClick={() => { 
                    console.log('Word EN clicked'); 
                    if (!res) {
                      console.error('No financial statements generated');
                      setLogs(prev => [...prev, { t: 'err', m: '✗ Please generate financial statements first' }]);
                      return;
                    }
                    try {
                      console.log('Starting Word generation...');
                      setLogs(prev => [...prev, { t: 'info', m: 'Generating Word document...' }]);
                      const html = generateProfessionalWordDoc('EN');
                      if (!html) {
                        console.error('HTML is null');
                        setLogs(prev => [...prev, { t: 'err', m: '✗ Failed to generate document' }]);
                        return;
                      }
                      const blob = new Blob([html], { type: 'application/msword' });
                      downloadBlob(blob, `${(companyName||'Company').replace(/[^a-zA-Z0-9]/g,'_')}_FS_${currentYear}_EN.doc`);
                      setLogs(prev => [...prev, { t: 'ok', m: '✓ Word document downloaded (EN)' }]);
                    } catch (err) {
                      console.error('Word export error:', err);
                      setLogs(prev => [...prev, { t: 'err', m: `✗ Word error: ${err.message}` }]);
                    }
                    setShowExportModal(false); 
                  }}
                  style={{ 
                    padding: 12, 
                    background: 'rgba(59,130,246,0.15)', 
                    border: '2px solid rgba(59,130,246,0.4)', 
                    borderRadius: 10, 
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ fontSize: 18, marginBottom: 2 }}>🇬🇧</div>
                  <div style={{ fontWeight: 600, color: '#93c5fd', fontSize: 10 }}>English (.doc)</div>
                </button>
                
                <button 
                  type="button"
                  onClick={() => { 
                    console.log('Word BM clicked'); 
                    if (!res) {
                      console.error('No financial statements generated');
                      setLogs(prev => [...prev, { t: 'err', m: '✗ Please generate financial statements first' }]);
                      return;
                    }
                    try {
                      console.log('Starting Word generation...');
                      setLogs(prev => [...prev, { t: 'info', m: 'Generating Word document...' }]);
                      const html = generateProfessionalWordDoc('BM');
                      if (!html) {
                        console.error('HTML is null');
                        setLogs(prev => [...prev, { t: 'err', m: '✗ Failed to generate document' }]);
                        return;
                      }
                      const blob = new Blob([html], { type: 'application/msword' });
                      downloadBlob(blob, `${(companyName||'Company').replace(/[^a-zA-Z0-9]/g,'_')}_FS_${currentYear}_BM.doc`);
                      setLogs(prev => [...prev, { t: 'ok', m: '✓ Word document downloaded (BM)' }]);
                    } catch (err) {
                      console.error('Word export error:', err);
                      setLogs(prev => [...prev, { t: 'err', m: `✗ Word error: ${err.message}` }]);
                    }
                    setShowExportModal(false); 
                  }}
                  style={{ 
                    padding: 12, 
                    background: 'rgba(59,130,246,0.15)', 
                    border: '2px solid rgba(59,130,246,0.4)', 
                    borderRadius: 10, 
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ fontSize: 18, marginBottom: 2 }}>🇲🇾</div>
                  <div style={{ fontWeight: 600, color: '#93c5fd', fontSize: 10 }}>Bahasa Malaysia (.doc)</div>
                </button>
              </div>
              <div style={{ fontSize: 8, color: '#9ca3af', marginTop: 4, textAlign: 'center' }}>
                ✓ Professional layout • ✓ Borders on amount columns only • ✓ Page breaks between sections
              </div>
            </div>
            
            {/* Excel Export - NEW */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#4ade80', marginBottom: 8 }}>📊 Excel Spreadsheet (.xlsx) - RECOMMENDED</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <button 
                  onClick={() => generateExcelFS('EN')}
                  style={{ 
                    padding: 12, 
                    background: 'rgba(74,222,128,0.15)', 
                    border: '2px solid rgba(74,222,128,0.5)', 
                    borderRadius: 10, 
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ fontSize: 18, marginBottom: 2 }}>🇬🇧</div>
                  <div style={{ fontWeight: 700, color: '#4ade80', fontSize: 11 }}>English (.xlsx)</div>
                </button>
                
                <button 
                  onClick={() => generateExcelFS('BM')}
                  style={{ 
                    padding: 12, 
                    background: 'rgba(74,222,128,0.15)', 
                    border: '2px solid rgba(74,222,128,0.5)', 
                    borderRadius: 10, 
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ fontSize: 18, marginBottom: 2 }}>🇲🇾</div>
                  <div style={{ fontWeight: 700, color: '#4ade80', fontSize: 11 }}>Bahasa Malaysia (.xlsx)</div>
                </button>
              </div>
              <div style={{ fontSize: 9, color: '#86efac', marginTop: 6, textAlign: 'center' }}>
                ✓ Best for editing • ✓ Proper formatting • ✓ Works in Excel/Google Sheets
              </div>
            </div>
            
            {/* HTML Export */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#34d399', marginBottom: 8 }}>🌐 HTML (Browser View)</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <button 
                  onClick={() => exportFullFS('EN')}
                  style={{ 
                    padding: 10, 
                    background: 'rgba(52,211,153,0.1)', 
                    border: '1px solid rgba(52,211,153,0.3)', 
                    borderRadius: 10, 
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ fontWeight: 600, color: '#34d399', fontSize: 10 }}>🇬🇧 English (.html)</div>
                </button>
                
                <button 
                  onClick={() => exportFullFS('BM')}
                  style={{ 
                    padding: 10, 
                    background: 'rgba(52,211,153,0.1)', 
                    border: '1px solid rgba(52,211,153,0.3)', 
                    borderRadius: 10, 
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ fontWeight: 600, color: '#34d399', fontSize: 10 }}>🇲🇾 Bahasa Malaysia (.html)</div>
                </button>
              </div>
            </div>
            
            {/* V8: Management Pack Export */}
            <div style={{ marginBottom: 14, background: 'rgba(139,92,246,0.1)', borderRadius: 10, padding: 12, border: '1px solid rgba(139,92,246,0.3)' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#c084fc', marginBottom: 8 }}>📊 Management Pack (V8 New!)</div>
              <div style={{ fontSize: 9, color: '#a5b4fc', marginBottom: 8 }}>
                Dashboard • KPIs • P&L • Ratios • AR/AP Ageing • Insights & Recommendations
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 8 }}>
                <button 
                  type="button"
                  onClick={() => {
                    console.log('MgmtPack PDF EN clicked');
                    if (!res) { alert('Please generate financial statements first.'); return; }
                    try {
                      const model = buildManagementPackModel({ lang: 'EN' });
                      if (!model) { alert('Error building Management Pack.'); return; }
                      const html = renderManagementPackHtml(model);
                      setPreviewContent(html);
                      setPreviewType('pdf');
                      setShowExportModal(false);
                      setLogs(prev => [...prev, { t: 'ok', m: '✓ Management Pack PDF ready (EN). Click "Print to PDF".' }]);
                    } catch (err) { console.error(err); alert('Error: ' + err.message); }
                  }}
                  style={{ padding: 10, background: 'rgba(139,92,246,0.2)', border: '2px solid rgba(139,92,246,0.5)', borderRadius: 8, cursor: 'pointer' }}
                >
                  <div style={{ fontWeight: 700, color: '#c084fc', fontSize: 10 }}>🇬🇧 PDF English</div>
                </button>
                <button 
                  type="button"
                  onClick={() => {
                    console.log('MgmtPack PDF BM clicked');
                    if (!res) { alert('Please generate financial statements first.'); return; }
                    try {
                      const model = buildManagementPackModel({ lang: 'BM' });
                      if (!model) { alert('Error building Management Pack.'); return; }
                      const html = renderManagementPackHtml(model);
                      setPreviewContent(html);
                      setPreviewType('pdf');
                      setShowExportModal(false);
                      setLogs(prev => [...prev, { t: 'ok', m: '✓ Management Pack PDF ready (BM). Click "Print to PDF".' }]);
                    } catch (err) { console.error(err); alert('Error: ' + err.message); }
                  }}
                  style={{ padding: 10, background: 'rgba(139,92,246,0.2)', border: '2px solid rgba(139,92,246,0.5)', borderRadius: 8, cursor: 'pointer' }}
                >
                  <div style={{ fontWeight: 700, color: '#c084fc', fontSize: 10 }}>🇲🇾 PDF Bahasa Malaysia</div>
                </button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 8 }}>
                <button 
                  type="button"
                  onClick={() => {
                    console.log('MgmtPack PPT EN clicked');
                    if (!res) { alert('Please generate financial statements first.'); return; }
                    try {
                      const model = buildManagementPackModel({ lang: 'EN' });
                      if (!model) { alert('Error building Management Pack.'); return; }
                      
                      const { meta, is, bs, ratios, arAgeing, apAgeing } = model;
                      const { fmtNum, fmtPct, fmtK } = model.helpers;
                      
                      // Generate PowerPoint-compatible HTML (same approach as Word)
                      const pptHtml = `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:p="urn:schemas-microsoft-com:office:powerpoint">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
<xml>
  <o:DocumentProperties>
    <o:Author>FS Automation V8</o:Author>
    <o:Title>${meta.companyName} - Management Report</o:Title>
  </o:DocumentProperties>
</xml>
<style>
  body { font-family: Arial, sans-serif; margin: 40px; }
  .slide { page-break-after: always; min-height: 500px; padding: 30px; border: 1px solid #ccc; margin-bottom: 20px; }
  .slide:last-child { page-break-after: avoid; }
  h1 { color: #1e3a8a; font-size: 28pt; text-align: center; margin-top: 150px; }
  h2 { color: #3b82f6; font-size: 20pt; text-align: center; }
  h3 { color: #1e3a8a; font-size: 18pt; border-bottom: 2px solid #3b82f6; padding-bottom: 5px; }
  .subtitle { color: #64748b; font-size: 14pt; text-align: center; }
  table { border-collapse: collapse; width: 80%; margin: 20px auto; }
  th, td { border: 1px solid #e5e7eb; padding: 10px 15px; text-align: left; }
  th { background: #f1f5f9; color: #1e3a8a; }
  .right { text-align: right; }
  .highlight { background: #dbeafe; }
</style>
</head>
<body>
<!-- Slide 1: Title -->
<div class="slide">
  <h1>${meta.companyName}</h1>
  <h2>Management Report</h2>
  <p class="subtitle">Financial Year ${meta.year}</p>
  <p class="subtitle">Generated: ${meta.generated}</p>
</div>

<!-- Slide 2: KPIs -->
<div class="slide">
  <h3>Key Performance Indicators</h3>
  <table>
    <tr><th>Metric</th><th class="right">Value</th></tr>
    <tr><td>Revenue</td><td class="right">RM ${fmtK(is.rev)}</td></tr>
    <tr class="highlight"><td>Gross Profit</td><td class="right">RM ${fmtK(is.gp)} (${fmtPct(ratios.gpMargin)})</td></tr>
    <tr><td>Net Profit</td><td class="right">RM ${fmtK(is.np)} (${fmtPct(ratios.npMargin)})</td></tr>
    <tr class="highlight"><td>Cash Balance</td><td class="right">RM ${fmtK(bs.cash)}</td></tr>
    <tr><td>Current Ratio</td><td class="right">${ratios.currentRatio.toFixed(2)}</td></tr>
    <tr class="highlight"><td>Debt to Equity</td><td class="right">${ratios.debtToEquity.toFixed(2)}</td></tr>
  </table>
</div>

<!-- Slide 3: P&L -->
<div class="slide">
  <h3>Profit & Loss Summary</h3>
  <table>
    <tr><th>Item</th><th class="right">Amount (RM)</th><th class="right">%</th></tr>
    <tr><td>Revenue</td><td class="right">${fmtNum(is.rev)}</td><td class="right">100%</td></tr>
    <tr><td>Cost of Sales</td><td class="right">(${fmtNum(is.cos)})</td><td class="right">${fmtPct(is.rev > 0 ? is.cos/is.rev*100 : 0)}</td></tr>
    <tr class="highlight"><td><strong>Gross Profit</strong></td><td class="right"><strong>${fmtNum(is.gp)}</strong></td><td class="right"><strong>${fmtPct(ratios.gpMargin)}</strong></td></tr>
    <tr><td>Operating Expenses</td><td class="right">(${fmtNum(is.adm)})</td><td class="right">${fmtPct(is.rev > 0 ? is.adm/is.rev*100 : 0)}</td></tr>
    <tr class="highlight"><td><strong>Net Profit</strong></td><td class="right"><strong>${fmtNum(is.np)}</strong></td><td class="right"><strong>${fmtPct(ratios.npMargin)}</strong></td></tr>
  </table>
</div>

<!-- Slide 4: Financial Ratios -->
<div class="slide">
  <h3>Financial Ratios</h3>
  <table>
    <tr><th>Ratio</th><th class="right">Value</th><th>Status</th></tr>
    <tr><td>Current Ratio</td><td class="right">${ratios.currentRatio.toFixed(2)}</td><td>${ratios.currentRatio >= 1 ? '✓ Good' : '⚠ Low'}</td></tr>
    <tr><td>Quick Ratio</td><td class="right">${ratios.quickRatio.toFixed(2)}</td><td>${ratios.quickRatio >= 1 ? '✓ Good' : '⚠ Low'}</td></tr>
    <tr><td>Debt to Equity</td><td class="right">${ratios.debtToEquity.toFixed(2)}</td><td>${ratios.debtToEquity <= 1 ? '✓ Good' : '⚠ High'}</td></tr>
    <tr><td>Return on Equity</td><td class="right">${fmtPct(ratios.roe)}</td><td>${ratios.roe >= 10 ? '✓ Good' : '⚠ Low'}</td></tr>
    <tr><td>Working Capital</td><td class="right">RM ${fmtNum(ratios.workingCapital)}</td><td>${ratios.workingCapital >= 0 ? '✓ Positive' : '⚠ Negative'}</td></tr>
  </table>
</div>

<!-- Slide 5: AR/AP Ageing -->
<div class="slide">
  <h3>Receivables & Payables Ageing</h3>
  <table>
    <tr><th>Ageing</th><th class="right">Receivables (RM)</th><th class="right">Payables (RM)</th></tr>
    <tr><td>Current</td><td class="right">${fmtNum(arAgeing.current)}</td><td class="right">${fmtNum(apAgeing.current)}</td></tr>
    <tr><td>1-30 days</td><td class="right">${fmtNum(arAgeing.d30)}</td><td class="right">${fmtNum(apAgeing.d30)}</td></tr>
    <tr><td>31-60 days</td><td class="right">${fmtNum(arAgeing.d60)}</td><td class="right">${fmtNum(apAgeing.d60)}</td></tr>
    <tr><td>61-90 days</td><td class="right">${fmtNum(arAgeing.d90)}</td><td class="right">${fmtNum(apAgeing.d90)}</td></tr>
    <tr class="highlight"><td><strong>> 90 days</strong></td><td class="right"><strong>${fmtNum(arAgeing.over90)}</strong></td><td class="right"><strong>${fmtNum(apAgeing.over90)}</strong></td></tr>
    <tr><td><strong>Total</strong></td><td class="right"><strong>${fmtNum(arAgeing.total)}</strong></td><td class="right"><strong>${fmtNum(apAgeing.total)}</strong></td></tr>
  </table>
</div>
</body>
</html>`;
                      
                      const blob = new Blob([pptHtml], { type: 'application/vnd.ms-powerpoint;charset=utf-8' });
                      downloadBlob(blob, `${(meta.companyName || 'Company').replace(/[^a-zA-Z0-9]/g, '_')}_MgmtPack_${meta.year}_EN.ppt`);
                      setLogs(prev => [...prev, { t: 'ok', m: '✓ Management Pack PPT downloaded (EN)' }]);
                      setShowExportModal(false);
                    } catch (err) { 
                      console.error('PPT error:', err); 
                      alert('Error generating PowerPoint: ' + err.message); 
                    }
                  }}
                  style={{ padding: 10, background: 'rgba(249,115,22,0.15)', border: '2px solid rgba(249,115,22,0.4)', borderRadius: 8, cursor: 'pointer' }}
                >
                  <div style={{ fontWeight: 700, color: '#fb923c', fontSize: 10 }}>🇬🇧 PowerPoint EN</div>
                </button>
                <button 
                  type="button"
                  onClick={() => {
                    console.log('MgmtPack PPT BM clicked');
                    if (!res) { alert('Please generate financial statements first.'); return; }
                    try {
                      const model = buildManagementPackModel({ lang: 'BM' });
                      if (!model) { alert('Error building Management Pack.'); return; }
                      
                      const { meta, is, bs, ratios, arAgeing, apAgeing } = model;
                      const { fmtNum, fmtPct, fmtK } = model.helpers;
                      
                      // Generate PowerPoint-compatible HTML (same approach as Word)
                      const pptHtml = `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:p="urn:schemas-microsoft-com:office:powerpoint">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
<xml>
  <o:DocumentProperties>
    <o:Author>FS Automation V8</o:Author>
    <o:Title>${meta.companyName} - Laporan Pengurusan</o:Title>
  </o:DocumentProperties>
</xml>
<style>
  body { font-family: Arial, sans-serif; margin: 40px; }
  .slide { page-break-after: always; min-height: 500px; padding: 30px; border: 1px solid #ccc; margin-bottom: 20px; }
  .slide:last-child { page-break-after: avoid; }
  h1 { color: #1e3a8a; font-size: 28pt; text-align: center; margin-top: 150px; }
  h2 { color: #3b82f6; font-size: 20pt; text-align: center; }
  h3 { color: #1e3a8a; font-size: 18pt; border-bottom: 2px solid #3b82f6; padding-bottom: 5px; }
  .subtitle { color: #64748b; font-size: 14pt; text-align: center; }
  table { border-collapse: collapse; width: 80%; margin: 20px auto; }
  th, td { border: 1px solid #e5e7eb; padding: 10px 15px; text-align: left; }
  th { background: #f1f5f9; color: #1e3a8a; }
  .right { text-align: right; }
  .highlight { background: #dbeafe; }
</style>
</head>
<body>
<!-- Slide 1: Title -->
<div class="slide">
  <h1>${meta.companyName}</h1>
  <h2>Laporan Pengurusan</h2>
  <p class="subtitle">Tahun Kewangan ${meta.year}</p>
  <p class="subtitle">Dijana: ${meta.generated}</p>
</div>

<!-- Slide 2: KPIs -->
<div class="slide">
  <h3>Petunjuk Prestasi Utama</h3>
  <table>
    <tr><th>Metrik</th><th class="right">Nilai</th></tr>
    <tr><td>Hasil</td><td class="right">RM ${fmtK(is.rev)}</td></tr>
    <tr class="highlight"><td>Untung Kasar</td><td class="right">RM ${fmtK(is.gp)} (${fmtPct(ratios.gpMargin)})</td></tr>
    <tr><td>Untung Bersih</td><td class="right">RM ${fmtK(is.np)} (${fmtPct(ratios.npMargin)})</td></tr>
    <tr class="highlight"><td>Baki Tunai</td><td class="right">RM ${fmtK(bs.cash)}</td></tr>
    <tr><td>Nisbah Semasa</td><td class="right">${ratios.currentRatio.toFixed(2)}</td></tr>
    <tr class="highlight"><td>Hutang kepada Ekuiti</td><td class="right">${ratios.debtToEquity.toFixed(2)}</td></tr>
  </table>
</div>

<!-- Slide 3: P&L -->
<div class="slide">
  <h3>Ringkasan Untung Rugi</h3>
  <table>
    <tr><th>Perkara</th><th class="right">Jumlah (RM)</th><th class="right">%</th></tr>
    <tr><td>Hasil</td><td class="right">${fmtNum(is.rev)}</td><td class="right">100%</td></tr>
    <tr><td>Kos Jualan</td><td class="right">(${fmtNum(is.cos)})</td><td class="right">${fmtPct(is.rev > 0 ? is.cos/is.rev*100 : 0)}</td></tr>
    <tr class="highlight"><td><strong>Untung Kasar</strong></td><td class="right"><strong>${fmtNum(is.gp)}</strong></td><td class="right"><strong>${fmtPct(ratios.gpMargin)}</strong></td></tr>
    <tr><td>Perbelanjaan Operasi</td><td class="right">(${fmtNum(is.adm)})</td><td class="right">${fmtPct(is.rev > 0 ? is.adm/is.rev*100 : 0)}</td></tr>
    <tr class="highlight"><td><strong>Untung Bersih</strong></td><td class="right"><strong>${fmtNum(is.np)}</strong></td><td class="right"><strong>${fmtPct(ratios.npMargin)}</strong></td></tr>
  </table>
</div>

<!-- Slide 4: Financial Ratios -->
<div class="slide">
  <h3>Nisbah Kewangan</h3>
  <table>
    <tr><th>Nisbah</th><th class="right">Nilai</th><th>Status</th></tr>
    <tr><td>Nisbah Semasa</td><td class="right">${ratios.currentRatio.toFixed(2)}</td><td>${ratios.currentRatio >= 1 ? '✓ Baik' : '⚠ Rendah'}</td></tr>
    <tr><td>Nisbah Cepat</td><td class="right">${ratios.quickRatio.toFixed(2)}</td><td>${ratios.quickRatio >= 1 ? '✓ Baik' : '⚠ Rendah'}</td></tr>
    <tr><td>Hutang kepada Ekuiti</td><td class="right">${ratios.debtToEquity.toFixed(2)}</td><td>${ratios.debtToEquity <= 1 ? '✓ Baik' : '⚠ Tinggi'}</td></tr>
    <tr><td>Pulangan atas Ekuiti</td><td class="right">${fmtPct(ratios.roe)}</td><td>${ratios.roe >= 10 ? '✓ Baik' : '⚠ Rendah'}</td></tr>
    <tr><td>Modal Kerja</td><td class="right">RM ${fmtNum(ratios.workingCapital)}</td><td>${ratios.workingCapital >= 0 ? '✓ Positif' : '⚠ Negatif'}</td></tr>
  </table>
</div>

<!-- Slide 5: AR/AP Ageing -->
<div class="slide">
  <h3>Pengumuran Penghutang & Pemiutang</h3>
  <table>
    <tr><th>Umur</th><th class="right">Penghutang (RM)</th><th class="right">Pemiutang (RM)</th></tr>
    <tr><td>Semasa</td><td class="right">${fmtNum(arAgeing.current)}</td><td class="right">${fmtNum(apAgeing.current)}</td></tr>
    <tr><td>1-30 hari</td><td class="right">${fmtNum(arAgeing.d30)}</td><td class="right">${fmtNum(apAgeing.d30)}</td></tr>
    <tr><td>31-60 hari</td><td class="right">${fmtNum(arAgeing.d60)}</td><td class="right">${fmtNum(apAgeing.d60)}</td></tr>
    <tr><td>61-90 hari</td><td class="right">${fmtNum(arAgeing.d90)}</td><td class="right">${fmtNum(apAgeing.d90)}</td></tr>
    <tr class="highlight"><td><strong>> 90 hari</strong></td><td class="right"><strong>${fmtNum(arAgeing.over90)}</strong></td><td class="right"><strong>${fmtNum(apAgeing.over90)}</strong></td></tr>
    <tr><td><strong>Jumlah</strong></td><td class="right"><strong>${fmtNum(arAgeing.total)}</strong></td><td class="right"><strong>${fmtNum(apAgeing.total)}</strong></td></tr>
  </table>
</div>
</body>
</html>`;
                      
                      const blob = new Blob([pptHtml], { type: 'application/vnd.ms-powerpoint;charset=utf-8' });
                      downloadBlob(blob, `${(meta.companyName || 'Company').replace(/[^a-zA-Z0-9]/g, '_')}_MgmtPack_${meta.year}_BM.ppt`);
                      setLogs(prev => [...prev, { t: 'ok', m: '✓ Management Pack PPT downloaded (BM)' }]);
                      setShowExportModal(false);
                    } catch (err) { 
                      console.error('PPT error:', err); 
                      alert('Error generating PowerPoint: ' + err.message); 
                    }
                  }}
                  style={{ padding: 10, background: 'rgba(249,115,22,0.15)', border: '2px solid rgba(249,115,22,0.4)', borderRadius: 8, cursor: 'pointer' }}
                >
                  <div style={{ fontWeight: 700, color: '#fb923c', fontSize: 10 }}>🇲🇾 PowerPoint BM</div>
                </button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <button 
                  type="button"
                  onClick={() => {
                    console.log('MgmtPack HTML EN clicked');
                    if (!res) { alert('Please generate financial statements first.'); return; }
                    try {
                      const model = buildManagementPackModel({ lang: 'EN' });
                      if (!model) { alert('Error building Management Pack.'); return; }
                      const html = renderManagementPackHtml(model);
                      const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
                      downloadBlob(blob, `${(companyName||'Company').replace(/[^a-zA-Z0-9]/g,'_')}_MgmtPack_${currentYear}_EN.html`);
                      setLogs(prev => [...prev, { t: 'ok', m: '✓ Management Pack downloaded (EN)' }]);
                    } catch (err) { console.error(err); alert('Error: ' + err.message); }
                    setShowExportModal(false);
                  }}
                  style={{ padding: 6, background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.2)', borderRadius: 6, cursor: 'pointer' }}
                >
                  <div style={{ fontWeight: 500, color: '#a78bfa', fontSize: 8 }}>HTML English</div>
                </button>
                <button 
                  type="button"
                  onClick={() => {
                    console.log('MgmtPack HTML BM clicked');
                    if (!res) { alert('Please generate financial statements first.'); return; }
                    try {
                      const model = buildManagementPackModel({ lang: 'BM' });
                      if (!model) { alert('Error building Management Pack.'); return; }
                      const html = renderManagementPackHtml(model);
                      const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
                      downloadBlob(blob, `${(companyName||'Company').replace(/[^a-zA-Z0-9]/g,'_')}_MgmtPack_${currentYear}_BM.html`);
                      setLogs(prev => [...prev, { t: 'ok', m: '✓ Management Pack downloaded (BM)' }]);
                    } catch (err) { console.error(err); alert('Error: ' + err.message); }
                    setShowExportModal(false);
                  }}
                  style={{ padding: 6, background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.2)', borderRadius: 6, cursor: 'pointer' }}
                >
                  <div style={{ fontWeight: 500, color: '#a78bfa', fontSize: 8 }}>HTML Bahasa Malaysia</div>
                </button>
              </div>
            </div>
            
            <div style={{ padding: 8, background: 'rgba(99,102,241,0.1)', borderRadius: 8 }}>
              <div style={{ fontSize: 9, color: '#a5b4fc' }}>
                <strong>📋 Full FS Includes:</strong> Cover Page • Balance Sheet • Income Statement • Notes
              </div>
              <div style={{ fontSize: 8, color: '#6b7280', marginTop: 4 }}>
                FS Automation {APP_VERSION} • Lines only on amount columns
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Preview Modal - shown when download doesn't work */}
      {previewContent && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.95)', display: 'flex', flexDirection: 'column', zIndex: 100 }}>
          <div style={{ padding: 16, background: '#1f2937', borderBottom: '1px solid rgba(75,85,99,0.3)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
                {previewType === 'pdf' ? '📕 Financial Statements' : previewType === 'html' ? '📄 HTML Preview' : '💾 Session Data'}
              </h3>
              <p style={{ margin: '4px 0 0 0', fontSize: 11, color: '#9ca3af' }}>
                {previewType === 'pdf' 
                  ? 'Click "Print to PDF" or press Ctrl+P, then select "Save as PDF" as printer.'
                  : previewType === 'html' 
                  ? 'Preview of generated content.'
                  : 'Copy and save as .json file to restore later.'}
              </p>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {(previewType === 'pdf' || previewType === 'html') && (
                <>
                  <button 
                    onClick={() => {
                      // In Claude artifact sandbox, direct print is blocked
                      // Just show instructions
                      alert('To save as PDF:\n\n1. Press Ctrl+P (Windows) or Cmd+P (Mac) NOW\n2. In the print dialog, select "Save as PDF" as printer\n3. Click Save\n\nAlternatively, use "Download HTML" button, open the file in your browser, then print.');
                    }}
                    style={{ padding: '8px 16px', background: 'linear-gradient(135deg, #ef4444, #dc2626)', border: 'none', borderRadius: 6, color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                  >🖨️ Print to PDF (Ctrl+P)</button>
                  <button 
                    onClick={() => {
                      // Download as HTML file using helper
                      const filename = `${(companyName || 'FS').replace(/[^a-zA-Z0-9]/g, '_')}_${currentYear}.html`;
                      const blob = new Blob([previewContent], { type: 'text/html;charset=utf-8' });
                      downloadBlob(blob, filename);
                      setLogs(prev => [...prev, { t: 'ok', m: `✓ Downloaded ${filename}` }]);
                    }}
                    style={{ padding: '8px 16px', background: 'linear-gradient(135deg, #059669, #10b981)', border: 'none', borderRadius: 6, color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                  >📥 Download HTML</button>
                </>
              )}
              <button 
                onClick={() => {
                  try {
                    navigator.clipboard.writeText(previewContent);
                    alert('Copied to clipboard!\n\nTo save as PDF:\n1. Paste into text editor\n2. Save as .html file\n3. Open in browser\n4. Ctrl+P → Save as PDF');
                  } catch (e) {
                    alert('Copy failed. Please select all text manually.');
                  }
                }}
                style={{ padding: '8px 16px', background: 'linear-gradient(135deg, #6366f1, #4f46e5)', border: 'none', borderRadius: 6, color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
              >📋 Copy HTML</button>
              <button 
                onClick={() => { setPreviewContent(null); setPreviewType(null); }}
                style={{ padding: '8px 16px', background: 'rgba(239,68,68,0.2)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 6, color: '#fca5a5', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
              >✕ Close</button>
            </div>
          </div>
          
          {(previewType === 'html' || previewType === 'pdf') ? (
            <div style={{ flex: 1, overflow: 'hidden', background: '#fff' }}>
              <iframe 
                id="fs-preview-iframe"
                srcDoc={previewContent} 
                style={{ width: '100%', height: '100%', border: 'none' }}
                title="Financial Statements Preview"
              />
            </div>
          ) : (
            <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
              <pre style={{ 
                background: 'rgba(17,24,39,0.8)', 
                padding: 16, 
                borderRadius: 8, 
                fontSize: 10, 
                color: '#a5b4fc',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all',
                maxHeight: '100%',
                overflow: 'auto'
              }}>
                {previewContent}
              </pre>
            </div>
          )}
        </div>
      )}
      
      {/* Header */}
      <header style={{ background: 'rgba(17,24,39,0.95)', borderBottom: '1px solid rgba(75,85,99,0.3)', padding: '12px 20px', position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 800, color: '#fff' }}>FS</div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700 }}>{companyName || 'Financial Statements Automation'}</div>
              <div style={{ fontSize: 10, color: '#9ca3af' }}>
                {companyName && fyeDisplay ? `FYE ${fyeDisplay} • ` : ''}{config ? `${config.name} • ${config.standard}` : 'Select company type to begin'}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            {companyType && companyName && (
              <span style={{ fontSize: 10, background: 'rgba(52,211,153,0.15)', color: '#34d399', padding: '4px 10px', borderRadius: 4 }}>
                FY{currentYear}
              </span>
            )}
            {/* Load Session */}
            <button 
              onClick={() => loadSessionFile.current?.click()} 
              style={{ padding: '6px 12px', background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.3)', borderRadius: 6, color: '#c4b5fd', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
              title="Load a previously saved session"
            >📂 Load</button>
            {/* Save Session */}
            {(companyName || txs.length > 0) && (
              <button 
                onClick={saveSession} 
                style={{ padding: '6px 12px', background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.3)', borderRadius: 6, color: '#93c5fd', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
                title="Save current session to file"
              >💾 Save</button>
            )}
            <button onClick={loadSample} style={{ padding: '6px 12px', background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 6, color: '#a5b4fc', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>Sample</button>
            {txs.length > 0 && <button onClick={clearAll} style={{ padding: '6px 12px', background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 6, color: '#fca5a5', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>Clear</button>}
            {res && <button onClick={exp} style={{ padding: '6px 12px', background: 'linear-gradient(135deg, #10b981, #059669)', border: 'none', borderRadius: 6, color: '#fff', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>Export</button>}
          </div>
        </div>
      </header>

      {/* Tabs */}
      <nav style={{ background: 'rgba(31,41,55,0.5)', borderBottom: '1px solid rgba(75,85,99,0.2)', padding: '0 20px', overflowX: 'auto' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex' }}>
          <button style={tabStyle('setup')} onClick={() => setTab('setup')}>⚙️ Setup</button>
          <button style={{ ...tabStyle('priorfs'), opacity: companyType ? 1 : 0.4 }} onClick={() => companyType && setTab('priorfs')}>📅 Prior FS</button>
          <button style={{ ...tabStyle('banks'), opacity: companyType ? 1 : 0.4 }} onClick={() => companyType && setTab('banks')}>🏦 Banks</button>
          <button style={{ ...tabStyle('upload'), opacity: companyType ? 1 : 0.4 }} onClick={() => companyType && setTab('upload')}>📤 Upload</button>
          <button style={{ ...tabStyle('review'), opacity: companyType ? 1 : 0.4 }} onClick={() => companyType && setTab('review')}>📋 Review ({txs.length})</button>
          <button style={{ ...tabStyle('classify'), opacity: txs.length > 0 ? 1 : 0.4 }} onClick={() => txs.length > 0 && setTab('classify')}>🏷️ Classify</button>
          <button style={{ ...tabStyle('cashvoucher'), opacity: companyType ? 1 : 0.4 }} onClick={() => companyType && setTab('cashvoucher')}>💵 Cash ({cashTxs.length})</button>
          <button style={{ ...tabStyle('subledger'), opacity: companyType ? 1 : 0.4 }} onClick={() => companyType && setTab('subledger')}>📒 Subledger</button>
          <button style={{ ...tabStyle('balances'), opacity: companyType ? 1 : 0.4 }} onClick={() => companyType && setTab('balances')}>💰 Opening</button>
          <button style={{ ...tabStyle('journal'), opacity: res ? 1 : 0.4 }} onClick={() => res && setTab('journal')}>📒 JE</button>
          <button style={{ ...tabStyle('trial'), opacity: res ? 1 : 0.4 }} onClick={() => res && setTab('trial')}>⚖️ TB</button>
          <button style={{ ...tabStyle('income'), opacity: res ? 1 : 0.4 }} onClick={() => res && setTab('income')}>📈 P&L</button>
          <button style={{ ...tabStyle('balance'), opacity: res ? 1 : 0.4 }} onClick={() => res && setTab('balance')}>📊 BS</button>
          <button style={{ ...tabStyle('cashflow'), opacity: res ? 1 : 0.4 }} onClick={() => res && setTab('cashflow')}>💸 CF</button>
          <button style={{ ...tabStyle('tax'), opacity: res ? 1 : 0.4 }} onClick={() => res && setTab('tax')}>💵 Tax</button>
          <button style={{ ...tabStyle('snapshots'), opacity: companyType ? 1 : 0.4 }} onClick={() => companyType && setTab('snapshots')}>📦 Snaps ({fsSnapshots.length})</button>
          <button style={{ ...tabStyle('dashboard'), opacity: res ? 1 : 0.4 }} onClick={() => res && setTab('dashboard')}>📊 Dashboard</button>
        </div>
      </nav>

      {/* Main */}
      <main style={{ maxWidth: 1200, margin: '0 auto', padding: '20px' }}>
        
        {/* Setup Tab - Company Type Selection */}
        {tab === 'setup' && (
          <div style={{ maxWidth: 700, margin: '0 auto' }}>
            <div style={{ background: 'rgba(31,41,55,0.6)', borderRadius: 12, border: '1px solid rgba(75,85,99,0.3)', overflow: 'hidden' }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(75,85,99,0.2)', background: 'linear-gradient(135deg, rgba(99,102,241,0.1), rgba(139,92,246,0.1))' }}>
                <div style={{ fontWeight: 700, fontSize: 16 }}>⚙️ Company Setup</div>
                <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>Enter your company details and select the applicable accounting standard</div>
              </div>
              <div style={{ padding: 20 }}>
                {/* Company Details */}
                <div style={{ marginBottom: 24 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12, color: '#a5b4fc' }}>Company Details:</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div>
                      <label style={{ fontSize: 10, color: '#9ca3af', display: 'block', marginBottom: 4 }}>Company Name *</label>
                      <input 
                        value={companyName} 
                        onChange={e => setCompanyName(e.target.value)} 
                        placeholder="e.g. ABC Trading Sdn Bhd"
                        style={{ ...inputStyle, width: '100%', padding: '10px 12px' }} 
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: 10, color: '#9ca3af', display: 'block', marginBottom: 4 }}>Registration No.</label>
                      <input 
                        value={companyRegNo} 
                        onChange={e => setCompanyRegNo(e.target.value)} 
                        placeholder="e.g. 202301012345 (12345-X)"
                        style={{ ...inputStyle, width: '100%', padding: '10px 12px' }} 
                      />
                    </div>
                  </div>
                </div>
                
                {/* Financial Year */}
                <div style={{ marginBottom: 24 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12, color: '#a5b4fc' }}>Financial Year:</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                    <div>
                      <label style={{ fontSize: 10, color: '#9ca3af', display: 'block', marginBottom: 4 }}>Year End Month</label>
                      <select 
                        value={financialYearEnd} 
                        onChange={e => setFinancialYearEnd(e.target.value)}
                        style={{ ...inputStyle, width: '100%', padding: '10px 12px', cursor: 'pointer' }}
                      >
                        <option value="1">January</option>
                        <option value="2">February</option>
                        <option value="3">March</option>
                        <option value="4">April</option>
                        <option value="5">May</option>
                        <option value="6">June</option>
                        <option value="7">July</option>
                        <option value="8">August</option>
                        <option value="9">September</option>
                        <option value="10">October</option>
                        <option value="11">November</option>
                        <option value="12">December</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize: 10, color: '#9ca3af', display: 'block', marginBottom: 4 }}>Current FY Year</label>
                      <input 
                        type="number" 
                        value={currentYear} 
                        onChange={e => {
                          setCurrentYear(parseInt(e.target.value) || new Date().getFullYear());
                          setPriorFSYear((parseInt(e.target.value) || new Date().getFullYear()) - 1);
                        }} 
                        style={{ ...inputStyle, width: '100%', padding: '10px 12px' }} 
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: 10, color: '#9ca3af', display: 'block', marginBottom: 4 }}>Prior FY Year</label>
                      <input 
                        type="number" 
                        value={priorFSYear} 
                        onChange={e => setPriorFSYear(parseInt(e.target.value) || new Date().getFullYear() - 1)} 
                        style={{ ...inputStyle, width: '100%', padding: '10px 12px' }} 
                      />
                    </div>
                  </div>
                  {companyName && financialYearEnd && (
                    <div style={{ marginTop: 12, padding: 10, background: 'rgba(52,211,153,0.1)', borderRadius: 6, fontSize: 11, color: '#34d399' }}>
                      📅 Financial Year End: <strong>{fyeDisplay}</strong> (FY{currentYear})
                    </div>
                  )}
                </div>
                
                {/* Company Type Selection */}
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 16, color: '#a5b4fc' }}>Select Company Type:</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {Object.entries(COMPANY_TYPES).map(([key, value]) => (
                    <div 
                      key={key}
                      onClick={() => {
                        setCompanyType(key);
                        setAccountingStandard(getDefaultStandard(key));
                      }}
                      style={{ 
                        padding: 16, 
                        background: companyType === key ? 'rgba(99,102,241,0.2)' : 'rgba(17,24,39,0.4)', 
                        border: companyType === key ? '2px solid #6366f1' : '1px solid rgba(75,85,99,0.3)', 
                        borderRadius: 10, 
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4, color: companyType === key ? '#a5b4fc' : '#e5e7eb' }}>{value.name}</div>
                          <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 6 }}>Default: {value.fullStandard}</div>
                          <div style={{ display: 'flex', gap: 12 }}>
                            <span style={{ fontSize: 10, background: 'rgba(52,211,153,0.2)', color: '#34d399', padding: '2px 8px', borderRadius: 4 }}>{value.standard}</span>
                            <span style={{ fontSize: 10, background: 'rgba(251,191,36,0.2)', color: '#fbbf24', padding: '2px 8px', borderRadius: 4 }}>{value.taxInfo}</span>
                          </div>
                        </div>
                        {companyType === key && (
                          <div style={{ width: 24, height: 24, background: '#6366f1', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 14 }}>✓</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                
                {/* Accounting Standard Selection */}
                {companyType && (
                  <div style={{ marginTop: 24 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12, color: '#a5b4fc' }}>Select Accounting Standard:</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                      {Object.entries(ACCOUNTING_STANDARDS).map(([key, std]) => (
                        <div 
                          key={key}
                          onClick={() => setAccountingStandard(key)}
                          style={{ 
                            padding: 12, 
                            background: accountingStandard === key ? 'rgba(52,211,153,0.2)' : 'rgba(17,24,39,0.4)', 
                            border: accountingStandard === key ? '2px solid #34d399' : '1px solid rgba(75,85,99,0.3)', 
                            borderRadius: 8, 
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            textAlign: 'center'
                          }}
                        >
                          <div style={{ fontWeight: 700, fontSize: 12, color: accountingStandard === key ? '#34d399' : '#e5e7eb' }}>{std.name}</div>
                          <div style={{ fontSize: 9, color: '#6b7280', marginTop: 4 }}>{std.desc}</div>
                        </div>
                      ))}
                    </div>
                    <div style={{ marginTop: 12, padding: 10, background: 'rgba(99,102,241,0.1)', borderRadius: 6 }}>
                      <div style={{ fontSize: 10, color: '#a5b4fc' }}>
                        <strong>Selected:</strong> {ACCOUNTING_STANDARDS[accountingStandard]?.fullName || 'None'}
                      </div>
                      <div style={{ fontSize: 9, color: '#6b7280', marginTop: 4 }}>
                        {accountingStandard === 'MFRS' && 'Full IFRS-equivalent. Required for public listed companies.'}
                        {accountingStandard === 'MPERS' && 'Simplified IFRS for SMEs. Suitable for most Sdn Bhd companies.'}
                        {accountingStandard === 'MPERS-Micro' && 'Most simplified. For micro entities with revenue < RM3m.'}
                      </div>
                    </div>
                  </div>
                )}
                
                {companyType && companyName && (
                  <button onClick={() => setTab('priorfs')} style={{ ...nextBtnStyle, width: '100%', marginTop: 20, padding: '14px', fontSize: 14, justifyContent: 'center' }}>
                    Continue to Prior Year FS →
                  </button>
                )}
                
                {companyType && !companyName && (
                  <div style={{ marginTop: 16, padding: 10, background: 'rgba(251,191,36,0.1)', borderRadius: 6, fontSize: 11, color: '#fbbf24', textAlign: 'center' }}>
                    ⚠️ Please enter your company name to continue
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Banks Tab */}
        {tab === 'banks' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div style={{ background: 'rgba(31,41,55,0.6)', borderRadius: 10, border: '1px solid rgba(75,85,99,0.3)', overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(75,85,99,0.2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <button onClick={goBack} style={backBtnStyle}>← Prior FS</button>
                  <span style={{ fontWeight: 700, fontSize: 14 }}>🏦 Bank Accounts</span>
                </div>
                <button onClick={goNext} style={nextBtnStyle}>Next: Upload →</button>
              </div>
              <div style={{ padding: 16 }}>
                <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                  <input placeholder="Bank Name (e.g. Maybank)" value={newBank.name} onChange={e => setNewBank(p => ({ ...p, name: e.target.value }))} style={{ ...inputStyle, flex: 1 }} />
                  <input placeholder="Account No" value={newBank.accNo} onChange={e => setNewBank(p => ({ ...p, accNo: e.target.value }))} style={{ ...inputStyle, width: 120 }} />
                  <button onClick={addBank} style={{ padding: '8px 16px', background: 'linear-gradient(135deg, #6366f1, #4f46e5)', border: 'none', borderRadius: 6, color: '#fff', fontWeight: 700, cursor: 'pointer' }}>+</button>
                </div>
                
                {banks.length === 0 ? (
                  <div style={{ padding: 24, textAlign: 'center', color: '#6b7280' }}>
                    <div style={{ fontSize: 32, marginBottom: 8 }}>🏦</div>
                    <div style={{ fontSize: 13 }}>Add your bank accounts first</div>
                    <div style={{ fontSize: 11, marginTop: 4 }}>Each bank will have 12 months of statements</div>
                  </div>
                ) : (
                  <div>
                    {banks.map((bank, i) => {
                      const stmts = bankStatements[bank.id] || {};
                      const uploadedCount = MONTHS.filter(m => stmts[m]?.uploaded).length;
                      return (
                        <div key={bank.id} style={{ padding: 12, background: i % 2 ? 'transparent' : 'rgba(17,24,39,0.3)', borderRadius: 6, marginBottom: 8 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                            <div>
                              <div style={{ fontWeight: 600 }}>{bank.name}</div>
                              <div style={{ fontSize: 11, color: '#6b7280' }}>{bank.accNo}</div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{ fontSize: 11, color: uploadedCount === 12 ? '#34d399' : '#fbbf24' }}>{uploadedCount}/12 months</span>
                              <div style={{ width: 60, height: 6, background: 'rgba(75,85,99,0.3)', borderRadius: 3 }}>
                                <div style={{ width: `${(uploadedCount/12)*100}%`, height: '100%', background: uploadedCount === 12 ? '#34d399' : '#6366f1', borderRadius: 3 }} />
                              </div>
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                            {MONTHS.map(m => (
                              <div key={m} style={{ 
                                padding: '2px 6px', borderRadius: 4, fontSize: 9, fontWeight: 600,
                                background: stmts[m]?.uploaded ? 'rgba(52,211,153,0.2)' : 'rgba(75,85,99,0.2)',
                                color: stmts[m]?.uploaded ? '#34d399' : '#6b7280'
                              }}>{m}</div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div style={{ background: 'rgba(31,41,55,0.6)', borderRadius: 10, border: '1px solid rgba(75,85,99,0.3)', overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(75,85,99,0.2)', fontWeight: 700, fontSize: 14 }}>📊 Upload Progress</div>
              <div style={{ padding: 16 }}>
                {banks.length === 0 ? (
                  <div style={{ padding: 24, textAlign: 'center', color: '#6b7280', fontSize: 13 }}>Add bank accounts to start</div>
                ) : (
                  <>
                    <div style={{ textAlign: 'center', marginBottom: 20 }}>
                      <div style={{ fontSize: 48, fontWeight: 700, color: uploadSummary.percent === 100 ? '#34d399' : '#a5b4fc' }}>{uploadSummary.percent}%</div>
                      <div style={{ fontSize: 12, color: '#6b7280' }}>{uploadSummary.uploaded} of {uploadSummary.total} statements uploaded</div>
                    </div>
                    
                    <div style={{ marginBottom: 16 }}>
                      <div style={{ height: 8, background: 'rgba(75,85,99,0.3)', borderRadius: 4 }}>
                        <div style={{ width: `${uploadSummary.percent}%`, height: '100%', background: 'linear-gradient(90deg, #6366f1, #8b5cf6)', borderRadius: 4, transition: 'width 0.3s' }} />
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      <div style={{ padding: 12, background: 'rgba(17,24,39,0.4)', borderRadius: 6, textAlign: 'center' }}>
                        <div style={{ fontSize: 24, fontWeight: 700, color: '#a5b4fc' }}>{banks.length}</div>
                        <div style={{ fontSize: 11, color: '#6b7280' }}>Bank Accounts</div>
                      </div>
                      <div style={{ padding: 12, background: 'rgba(17,24,39,0.4)', borderRadius: 6, textAlign: 'center' }}>
                        <div style={{ fontSize: 24, fontWeight: 700, color: '#34d399' }}>{txs.length}</div>
                        <div style={{ fontSize: 11, color: '#6b7280' }}>Transactions</div>
                      </div>
                    </div>

                    {banks.length > 0 && (
                      <button onClick={() => setTab('upload')} style={{ width: '100%', marginTop: 16, padding: '12px', background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                        Upload Bank Statements →
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Upload Tab */}
        {tab === 'upload' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div style={{ background: 'rgba(31,41,55,0.6)', borderRadius: 10, border: '1px solid rgba(75,85,99,0.3)', overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(75,85,99,0.2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <button onClick={goBack} style={backBtnStyle}>← Back</button>
                  <span style={{ fontWeight: 700, fontSize: 14 }}>📤 Upload Bank Statement</span>
                </div>
                <button onClick={goNext} style={nextBtnStyle}>Next →</button>
              </div>
              <div style={{ padding: 16 }}>
                {banks.length === 0 ? (
                  <div style={{ padding: 24, textAlign: 'center', color: '#6b7280' }}>
                    <div style={{ fontSize: 13 }}>Please add bank accounts first</div>
                    <button onClick={() => setTab('banks')} style={{ marginTop: 12, padding: '8px 16px', background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 6, color: '#a5b4fc', fontSize: 12, cursor: 'pointer' }}>Go to Banks Tab</button>
                  </div>
                ) : (
                  <>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
                      <div>
                        <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 4 }}>Select Bank</div>
                        <select value={selectedBank} onChange={e => setSelectedBank(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
                          <option value="">-- Select Bank --</option>
                          {banks.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                        </select>
                      </div>
                      <div>
                        <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 4 }}>Select Month</div>
                        <select value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
                          {MONTHS.map(m => <option key={m} value={m}>{m} {currentYear}</option>)}
                        </select>
                      </div>
                    </div>

                    {/* Show current selection status */}
                    {selectedBank && (() => {
                      const stmt = bankStatements[selectedBank]?.[selectedMonth];
                      const bank = banks.find(b => b.id === selectedBank);
                      if (stmt?.uploaded) {
                        return (
                          <div style={{ background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.3)', borderRadius: 8, padding: 12, marginBottom: 12 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <div>
                                <div style={{ fontSize: 12, fontWeight: 600, color: '#34d399' }}>✓ {bank?.name} - {selectedMonth}</div>
                                <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 2 }}>{stmt.file} • {stmt.txCount} transactions</div>
                              </div>
                              <button 
                                onClick={() => removeStatementTxs(selectedBank, selectedMonth)}
                                style={{ 
                                  padding: '6px 12px', background: 'rgba(239,68,68,0.2)', 
                                  border: '1px solid rgba(239,68,68,0.3)', borderRadius: 6,
                                  color: '#f87171', fontSize: 11, fontWeight: 600, cursor: 'pointer'
                                }}
                              >
                                🗑️ Remove & Re-upload
                              </button>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    })()}

                    <div style={{ border: '2px dashed rgba(99,102,241,0.4)', borderRadius: 8, padding: 20, textAlign: 'center', cursor: selectedBank ? 'pointer' : 'not-allowed', marginBottom: 12, opacity: selectedBank ? 1 : 0.5 }} onClick={() => selectedBank && fileRef.current?.click()}>
                      <input ref={fileRef} type="file" accept=".csv,.txt,.tsv,.pdf,.xlsx,.xls" multiple onChange={handleFileUpload} style={{ display: 'none' }} />
                      <div style={{ fontSize: 28, marginBottom: 8 }}>📄</div>
                      <div style={{ fontWeight: 600, fontSize: 12 }}>{busy ? 'Processing...' : 'Click to upload CSV, Excel, TXT or PDF'}</div>
                      <div style={{ fontSize: 10, color: '#6b7280', marginTop: 4 }}>Supports .csv, .xlsx, .xls, .txt, .pdf</div>
                    </div>

                    {/* PDF Text Paste Area */}
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 6, color: '#fbbf24' }}>📋 For PDF files - paste extracted text:</div>
                      <textarea value={pdfText} onChange={e => setPdfText(e.target.value)} placeholder="If your bank only provides PDF statements, open the PDF, select all text (Ctrl+A), copy (Ctrl+C), and paste here..." style={{ width: '100%', height: 80, background: 'rgba(17,24,39,0.6)', border: '1px solid rgba(75,85,99,0.3)', borderRadius: 6, padding: 8, color: '#e5e7eb', fontSize: 11, resize: 'vertical' }} />
                      <button onClick={parsePastedText} disabled={!pdfText.trim() || !selectedBank} style={{ marginTop: 6, padding: '6px 14px', background: (pdfText.trim() && selectedBank) ? 'linear-gradient(135deg, #f59e0b, #d97706)' : 'rgba(75,85,99,0.3)', border: 'none', borderRadius: 6, color: '#fff', fontSize: 11, fontWeight: 600, cursor: (pdfText.trim() && selectedBank) ? 'pointer' : 'not-allowed' }}>Parse PDF Text</button>
                    </div>

                    {logs.length > 0 && (
                      <div style={{ background: 'rgba(17,24,39,0.5)', borderRadius: 6, padding: 10, maxHeight: 120, overflowY: 'auto' }}>
                        {logs.slice(-10).map((l, i) => (
                          <div key={i} style={{ fontSize: 10, padding: '2px 0', color: l.t === 'ok' ? '#34d399' : l.t === 'err' ? '#f87171' : l.t === 'warn' ? '#fbbf24' : '#9ca3af' }}>{l.m}</div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            <div style={{ background: 'rgba(31,41,55,0.6)', borderRadius: 10, border: '1px solid rgba(75,85,99,0.3)', overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(75,85,99,0.2)', fontWeight: 700, fontSize: 14 }}>📅 Upload Matrix</div>
              <div style={{ padding: 16, overflowX: 'auto' }}>
                {banks.length === 0 ? (
                  <div style={{ padding: 24, textAlign: 'center', color: '#6b7280', fontSize: 13 }}>No banks configured</div>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
                    <thead>
                      <tr>
                        <th style={{ padding: 6, textAlign: 'left', borderBottom: '1px solid rgba(75,85,99,0.3)' }}>Bank</th>
                        {MONTHS.map(m => <th key={m} style={{ padding: 4, textAlign: 'center', borderBottom: '1px solid rgba(75,85,99,0.3)', fontSize: 9 }}>{m}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {banks.map(bank => (
                        <tr key={bank.id}>
                          <td style={{ padding: 6, fontWeight: 600 }}>{bank.name}</td>
                          {MONTHS.map(m => {
                            const stmt = bankStatements[bank.id]?.[m];
                            return (
                              <td key={m} style={{ padding: 4, textAlign: 'center' }}>
                                <div 
                                  style={{ 
                                    width: 24, height: 24, borderRadius: 4, margin: '0 auto',
                                    background: stmt?.uploaded ? 'rgba(52,211,153,0.3)' : 'rgba(75,85,99,0.2)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    color: stmt?.uploaded ? '#34d399' : '#6b7280', fontSize: 9,
                                    cursor: 'pointer', position: 'relative'
                                  }} 
                                  onClick={() => { setSelectedBank(bank.id); setSelectedMonth(m); }} 
                                  title={stmt?.uploaded ? `${stmt.file} (${stmt.txCount} txns) - Click to select` : 'Click to select'}
                                >
                                  {stmt?.uploaded ? stmt.txCount : ''}
                                </div>
                                {stmt?.uploaded && (
                                  <button 
                                    onClick={(e) => { e.stopPropagation(); removeStatementTxs(bank.id, m); }}
                                    style={{ 
                                      fontSize: 8, padding: '1px 4px', marginTop: 2,
                                      background: 'rgba(239,68,68,0.2)', border: 'none', borderRadius: 3,
                                      color: '#f87171', cursor: 'pointer'
                                    }}
                                    title="Remove transactions for this month"
                                  >
                                    ×
                                  </button>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                
                {txs.length > 0 && (
                  <button onClick={() => setTab('review')} style={{ width: '100%', marginTop: 16, padding: '10px', background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)', border: 'none', borderRadius: 8, color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                    Next: Review Transactions →
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Prior Year FS Tab */}
        {tab === 'priorfs' && (
          <>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <button onClick={goBack} style={backBtnStyle}>← Setup</button>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ fontSize: 11, color: '#9ca3af' }}>Prior Year:</span>
                <input type="number" value={priorFSYear} onChange={e => setPriorFSYear(parseInt(e.target.value))} style={{ ...inputStyle, width: 70, padding: '4px 8px', fontSize: 12 }} />
                <button onClick={goNext} style={nextBtnStyle}>Next: Bank Setup →</button>
              </div>
            </div>
            
            {/* Mode Toggle & Upload */}
            <div style={{ background: 'rgba(31,41,55,0.6)', borderRadius: 10, border: '1px solid rgba(75,85,99,0.3)', marginBottom: 16, padding: 16 }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12 }}>
                <span style={{ fontSize: 12, fontWeight: 600 }}>Input Mode:</span>
                <button 
                  onClick={() => setPriorFSMode('manual')}
                  style={{ padding: '6px 16px', background: priorFSMode === 'manual' ? 'rgba(99,102,241,0.3)' : 'transparent', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 6, color: priorFSMode === 'manual' ? '#a5b4fc' : '#6b7280', fontSize: 11, cursor: 'pointer' }}
                >
                  Manual Entry
                </button>
                <button 
                  onClick={() => setPriorFSMode('upload')}
                  style={{ padding: '6px 16px', background: priorFSMode === 'upload' ? 'rgba(99,102,241,0.3)' : 'transparent', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 6, color: priorFSMode === 'upload' ? '#a5b4fc' : '#6b7280', fontSize: 11, cursor: 'pointer' }}
                >
                  Upload Prior FS
                </button>
              </div>
              
              {priorFSMode === 'upload' && (
                <div>
                  {/* File Upload Row */}
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12 }}>
                    <input 
                      type="file" 
                      accept=".csv,.txt,.xlsx,.xls,.pdf"
                      onChange={handlePriorFSUpload}
                      style={{ fontSize: 11 }}
                    />
                    {priorFSRawData.length > 0 && (
                      <>
                        <span style={{ fontSize: 11, color: '#34d399' }}>✓ {priorFSRawData.length} items found</span>
                        <button onClick={autoMapPriorFS} style={{ padding: '6px 12px', background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)', border: 'none', borderRadius: 6, color: '#fff', fontSize: 11, cursor: 'pointer' }}>
                          Auto-Map
                        </button>
                      </>
                    )}
                  </div>
                  
                  {/* PDF Text Paste Area */}
                  <div style={{ marginBottom: 12, padding: 12, background: 'rgba(251,191,36,0.05)', border: '1px solid rgba(251,191,36,0.2)', borderRadius: 8 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 8, color: '#fbbf24' }}>
                      📄 For PDF files - paste extracted text here:
                    </div>
                    <textarea 
                      value={priorFSPastedText} 
                      onChange={e => setPriorFSPastedText(e.target.value)} 
                      placeholder="Open the PDF in any viewer, select all text (Ctrl+A), copy (Ctrl+C), and paste here. The system will extract financial statement line items automatically."
                      style={{ 
                        width: '100%', 
                        height: 100, 
                        background: 'rgba(17,24,39,0.6)', 
                        border: '1px solid rgba(75,85,99,0.3)', 
                        borderRadius: 6, 
                        padding: 10, 
                        color: '#e5e7eb', 
                        fontSize: 11, 
                        resize: 'vertical',
                        fontFamily: 'monospace'
                      }} 
                    />
                    <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                      <button 
                        onClick={() => parsePriorFSText(priorFSPastedText)} 
                        disabled={!priorFSPastedText.trim()}
                        style={{ 
                          padding: '6px 14px', 
                          background: priorFSPastedText.trim() ? 'linear-gradient(135deg, #f59e0b, #d97706)' : 'rgba(75,85,99,0.3)', 
                          border: 'none', 
                          borderRadius: 6, 
                          color: '#fff', 
                          fontSize: 11, 
                          fontWeight: 600, 
                          cursor: priorFSPastedText.trim() ? 'pointer' : 'not-allowed' 
                        }}
                      >
                        Parse PDF Text
                      </button>
                      {priorFSPastedText && (
                        <button 
                          onClick={() => setPriorFSPastedText('')}
                          style={{ 
                            padding: '6px 14px', 
                            background: 'rgba(239,68,68,0.2)', 
                            border: '1px solid rgba(239,68,68,0.3)', 
                            borderRadius: 6, 
                            color: '#f87171', 
                            fontSize: 11, 
                            cursor: 'pointer' 
                          }}
                        >
                          Clear
                        </button>
                      )}
                    </div>
                  </div>
                  
                  {/* Tip for Excel with multiple sheets */}
                  <div style={{ fontSize: 10, color: '#9ca3af', marginBottom: 8 }}>
                    💡 <strong>Tips:</strong> Excel files with multiple sheets will be read from all tabs. PDF files can be uploaded or paste text directly above.
                  </div>
                </div>
              )}
              
              {priorFSMode === 'upload' && priorFSRawData.length > 0 && (
                <div style={{ marginTop: 12, maxHeight: 200, overflowY: 'auto', background: 'rgba(17,24,39,0.4)', borderRadius: 6, padding: 10 }}>
                  <div style={{ fontSize: 10, color: '#9ca3af', marginBottom: 6 }}>
                    Parsed Items ({priorFSRawData.length} total)
                    {priorFSRawData[0]?.sheet && (
                      <span style={{ marginLeft: 8, color: '#a5b4fc' }}>
                        from sheets: {[...new Set(priorFSRawData.map(d => d.sheet))].join(', ')}
                      </span>
                    )}:
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {priorFSRawData.slice(0, 30).map((item, i) => (
                      <span 
                        key={i} 
                        style={{ 
                          fontSize: 9, 
                          background: item.sheet ? 'rgba(139,92,246,0.2)' : 'rgba(99,102,241,0.2)', 
                          color: '#a5b4fc', 
                          padding: '3px 8px', 
                          borderRadius: 4,
                          border: item.value < 0 ? '1px solid rgba(239,68,68,0.3)' : '1px solid transparent'
                        }}
                        title={item.sheet ? `Sheet: ${item.sheet}` : ''}
                      >
                        {item.label.substring(0, 25)}{item.label.length > 25 ? '...' : ''}: 
                        <span style={{ color: item.value >= 0 ? '#34d399' : '#f87171', marginLeft: 4 }}>
                          {item.value < 0 ? `(${fmt(Math.abs(item.value))})` : fmt(item.value)}
                        </span>
                      </span>
                    ))}
                    {priorFSRawData.length > 30 && (
                      <span style={{ fontSize: 9, color: '#6b7280', padding: '3px 8px' }}>
                        +{priorFSRawData.length - 30} more items
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              {/* Prior Year P&L */}
              <div style={{ background: 'rgba(31,41,55,0.6)', borderRadius: 10, border: '1px solid rgba(75,85,99,0.3)', overflow: 'hidden' }}>
                <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(75,85,99,0.2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 700, fontSize: 14 }}>📈 Prior Year Income Statement</span>
                </div>
                <div style={{ padding: 16, maxHeight: 400, overflowY: 'auto' }}>
                  {/* Revenue Section */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <span style={sectionTitle}>Revenue</span>
                    <button onClick={() => addPriorISItem('revenue')} style={{ padding: '2px 8px', background: 'rgba(52,211,153,0.2)', border: 'none', borderRadius: 4, color: '#34d399', fontSize: 9, cursor: 'pointer' }}>+ Add</button>
                  </div>
                  {priorISItems.filter(i => i.section === 'revenue' || i.type === 'revenue').map(item => (
                    <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                      <input 
                        value={item.label} 
                        onChange={e => updatePriorISItem(item.id, 'label', e.target.value)}
                        style={{ ...inputStyle, flex: 1, fontSize: 11, padding: '4px 8px' }} 
                      />
                      <input 
                        type="number" 
                        placeholder="0" 
                        value={item.value} 
                        onChange={e => updatePriorISItem(item.id, 'value', e.target.value)}
                        style={{ ...numInputStyle, width: 100, fontSize: 11, padding: '4px 8px' }} 
                      />
                      {item.custom && <button onClick={() => removePriorISItem(item.id)} style={{ padding: '2px 6px', background: 'rgba(239,68,68,0.2)', border: 'none', borderRadius: 4, color: '#f87171', fontSize: 10, cursor: 'pointer' }}>×</button>}
                      {item.mapped && <span style={{ fontSize: 8, color: '#34d399' }}>✓</span>}
                    </div>
                  ))}
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontWeight: 600, fontSize: 11, borderTop: '1px solid rgba(75,85,99,0.2)', marginTop: 4 }}>
                    <span>Total Revenue</span><span style={{ fontFamily: 'monospace', color: '#34d399' }}>{fmt(priorCalc.revenue)}</span>
                  </div>
                  
                  {/* Cost of Sales */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, marginBottom: 6 }}>
                    <span style={sectionTitle}>Cost of Sales</span>
                    <button onClick={() => addPriorISItem('cogs')} style={{ padding: '2px 8px', background: 'rgba(251,191,36,0.2)', border: 'none', borderRadius: 4, color: '#fbbf24', fontSize: 9, cursor: 'pointer' }}>+ Add</button>
                  </div>
                  {priorISItems.filter(i => i.section === 'cost_of_sales' || i.type === 'cogs').map(item => (
                    <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                      <input value={item.label} onChange={e => updatePriorISItem(item.id, 'label', e.target.value)} style={{ ...inputStyle, flex: 1, fontSize: 11, padding: '4px 8px' }} />
                      <input type="number" placeholder="0" value={item.value} onChange={e => updatePriorISItem(item.id, 'value', e.target.value)} style={{ ...numInputStyle, width: 100, fontSize: 11, padding: '4px 8px' }} />
                      {item.custom && <button onClick={() => removePriorISItem(item.id)} style={{ padding: '2px 6px', background: 'rgba(239,68,68,0.2)', border: 'none', borderRadius: 4, color: '#f87171', fontSize: 10, cursor: 'pointer' }}>×</button>}
                    </div>
                  ))}
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px', background: 'rgba(52,211,153,0.1)', borderRadius: 6, fontWeight: 700, fontSize: 12, marginTop: 4 }}>
                    <span>Gross Profit</span><span style={{ fontFamily: 'monospace', color: priorCalc.gp >= 0 ? '#34d399' : '#f87171' }}>{fmt(priorCalc.gp)}</span>
                  </div>
                  
                  {/* Operating Expenses */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, marginBottom: 6 }}>
                    <span style={sectionTitle}>Operating Expenses</span>
                    <button onClick={() => addPriorISItem('expense')} style={{ padding: '2px 8px', background: 'rgba(239,68,68,0.2)', border: 'none', borderRadius: 4, color: '#f87171', fontSize: 9, cursor: 'pointer' }}>+ Add</button>
                  </div>
                  {priorISItems.filter(i => i.section === 'operating_expenses' || i.type === 'expense').map(item => (
                    <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                      <input value={item.label} onChange={e => updatePriorISItem(item.id, 'label', e.target.value)} style={{ ...inputStyle, flex: 1, fontSize: 11, padding: '4px 8px' }} />
                      <input type="number" placeholder="0" value={item.value} onChange={e => updatePriorISItem(item.id, 'value', e.target.value)} style={{ ...numInputStyle, width: 100, fontSize: 11, padding: '4px 8px' }} />
                      {item.custom && <button onClick={() => removePriorISItem(item.id)} style={{ padding: '2px 6px', background: 'rgba(239,68,68,0.2)', border: 'none', borderRadius: 4, color: '#f87171', fontSize: 10, cursor: 'pointer' }}>×</button>}
                    </div>
                  ))}
                  
                  {/* Other Income */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, marginBottom: 6 }}>
                    <span style={sectionTitle}>Other Income</span>
                    <button onClick={() => addPriorISItem('other_income')} style={{ padding: '2px 8px', background: 'rgba(52,211,153,0.2)', border: 'none', borderRadius: 4, color: '#34d399', fontSize: 9, cursor: 'pointer' }}>+ Add</button>
                  </div>
                  {priorISItems.filter(i => i.section === 'other_income' || i.type === 'other_income').map(item => (
                    <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                      <input value={item.label} onChange={e => updatePriorISItem(item.id, 'label', e.target.value)} style={{ ...inputStyle, flex: 1, fontSize: 11, padding: '4px 8px' }} />
                      <input type="number" placeholder="0" value={item.value} onChange={e => updatePriorISItem(item.id, 'value', e.target.value)} style={{ ...numInputStyle, width: 100, fontSize: 11, padding: '4px 8px' }} />
                      {item.custom && <button onClick={() => removePriorISItem(item.id)} style={{ padding: '2px 6px', background: 'rgba(239,68,68,0.2)', border: 'none', borderRadius: 4, color: '#f87171', fontSize: 10, cursor: 'pointer' }}>×</button>}
                    </div>
                  ))}
                  
                  {/* Other Expenses */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, marginBottom: 6 }}>
                    <span style={sectionTitle}>Other Expenses</span>
                    <button onClick={() => addPriorISItem('other_expense')} style={{ padding: '2px 8px', background: 'rgba(251,191,36,0.2)', border: 'none', borderRadius: 4, color: '#fbbf24', fontSize: 9, cursor: 'pointer' }}>+ Add</button>
                  </div>
                  {priorISItems.filter(i => i.section === 'other_expenses' || i.type === 'other_expense').map(item => (
                    <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                      <input value={item.label} onChange={e => updatePriorISItem(item.id, 'label', e.target.value)} style={{ ...inputStyle, flex: 1, fontSize: 11, padding: '4px 8px' }} />
                      <input type="number" placeholder="0" value={item.value} onChange={e => updatePriorISItem(item.id, 'value', e.target.value)} style={{ ...numInputStyle, width: 100, fontSize: 11, padding: '4px 8px' }} />
                      {item.custom && <button onClick={() => removePriorISItem(item.id)} style={{ padding: '2px 6px', background: 'rgba(239,68,68,0.2)', border: 'none', borderRadius: 4, color: '#f87171', fontSize: 10, cursor: 'pointer' }}>×</button>}
                    </div>
                  ))}
                  
                  {/* Finance Costs */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, marginBottom: 6 }}>
                    <span style={sectionTitle}>Finance Costs</span>
                    <button onClick={() => addPriorISItem('finance')} style={{ padding: '2px 8px', background: 'rgba(239,68,68,0.2)', border: 'none', borderRadius: 4, color: '#f87171', fontSize: 9, cursor: 'pointer' }}>+ Add</button>
                  </div>
                  {priorISItems.filter(i => i.section === 'finance_costs' || i.type === 'finance').map(item => (
                    <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                      <input value={item.label} onChange={e => updatePriorISItem(item.id, 'label', e.target.value)} style={{ ...inputStyle, flex: 1, fontSize: 11, padding: '4px 8px' }} />
                      <input type="number" placeholder="0" value={item.value} onChange={e => updatePriorISItem(item.id, 'value', e.target.value)} style={{ ...numInputStyle, width: 100, fontSize: 11, padding: '4px 8px' }} />
                      {item.custom && <button onClick={() => removePriorISItem(item.id)} style={{ padding: '2px 6px', background: 'rgba(239,68,68,0.2)', border: 'none', borderRadius: 4, color: '#f87171', fontSize: 10, cursor: 'pointer' }}>×</button>}
                    </div>
                  ))}
                  
                  {/* Tax */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, marginBottom: 6 }}>
                    <span style={sectionTitle}>Taxation</span>
                  </div>
                  {priorISItems.filter(i => i.section === 'tax' || i.type === 'tax').map(item => (
                    <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                      <input value={item.label} onChange={e => updatePriorISItem(item.id, 'label', e.target.value)} style={{ ...inputStyle, flex: 1, fontSize: 11, padding: '4px 8px' }} />
                      <input type="number" placeholder="0" value={item.value} onChange={e => updatePriorISItem(item.id, 'value', e.target.value)} style={{ ...numInputStyle, width: 100, fontSize: 11, padding: '4px 8px' }} />
                    </div>
                  ))}
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px', background: 'linear-gradient(135deg, rgba(52,211,153,0.2), rgba(99,102,241,0.2))', borderRadius: 6, marginTop: 12 }}>
                    <span style={{ fontWeight: 700 }}>Net Profit / (Loss)</span>
                    <span style={{ fontFamily: 'monospace', fontWeight: 700, color: priorCalc.np >= 0 ? '#34d399' : '#f87171' }}>{fmt(priorCalc.np)}</span>
                  </div>
                </div>
              </div>

              {/* Prior Year BS */}
              <div style={{ background: 'rgba(31,41,55,0.6)', borderRadius: 10, border: '1px solid rgba(75,85,99,0.3)', overflow: 'hidden' }}>
                <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(75,85,99,0.2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 700, fontSize: 14 }}>📊 Prior Year Balance Sheet</span>
                  {/* Balance indicator */}
                  <div style={{ padding: '4px 10px', borderRadius: 6, fontSize: 10, fontWeight: 600, background: priorCalc.balanced ? 'rgba(52,211,153,0.15)' : 'rgba(239,68,68,0.15)', color: priorCalc.balanced ? '#34d399' : '#f87171' }}>
                    {priorCalc.balanced ? '✓ Balanced' : `Diff: ${fmt(priorCalc.diff)}`}
                  </div>
                </div>
                <div style={{ padding: 16, maxHeight: 400, overflowY: 'auto' }}>
                  {/* Non-Current Assets */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <span style={sectionTitle}>Non-Current Assets</span>
                    <button onClick={() => addPriorBSItem('nca')} style={{ padding: '2px 8px', background: 'rgba(99,102,241,0.2)', border: 'none', borderRadius: 4, color: '#a5b4fc', fontSize: 9, cursor: 'pointer' }}>+ Add</button>
                  </div>
                  {priorBSItems.filter(i => i.type === 'nca').map(item => (
                    <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                      <input value={item.label} onChange={e => updatePriorBSItem(item.id, 'label', e.target.value)} style={{ ...inputStyle, flex: 1, fontSize: 11, padding: '4px 8px' }} />
                      <input type="number" placeholder="0" value={item.value} onChange={e => updatePriorBSItem(item.id, 'value', e.target.value)} style={{ ...numInputStyle, width: 90, fontSize: 11, padding: '4px 8px' }} />
                      {item.custom && <button onClick={() => removePriorBSItem(item.id)} style={{ padding: '2px 6px', background: 'rgba(239,68,68,0.2)', border: 'none', borderRadius: 4, color: '#f87171', fontSize: 10, cursor: 'pointer' }}>×</button>}
                    </div>
                  ))}
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 10, color: '#9ca3af' }}>
                    <span>Total NCA</span><span style={{ fontFamily: 'monospace' }}>{fmt(priorCalc.nca)}</span>
                  </div>
                  
                  {/* Current Assets */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, marginBottom: 6 }}>
                    <span style={sectionTitle}>Current Assets</span>
                    <button onClick={() => addPriorBSItem('ca')} style={{ padding: '2px 8px', background: 'rgba(52,211,153,0.2)', border: 'none', borderRadius: 4, color: '#34d399', fontSize: 9, cursor: 'pointer' }}>+ Add</button>
                  </div>
                  {priorBSItems.filter(i => i.type === 'ca').map(item => (
                    <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                      <input value={item.label} onChange={e => updatePriorBSItem(item.id, 'label', e.target.value)} style={{ ...inputStyle, flex: 1, fontSize: 11, padding: '4px 8px' }} />
                      <input type="number" placeholder="0" value={item.value} onChange={e => updatePriorBSItem(item.id, 'value', e.target.value)} style={{ ...numInputStyle, width: 90, fontSize: 11, padding: '4px 8px' }} />
                      {item.custom && <button onClick={() => removePriorBSItem(item.id)} style={{ padding: '2px 6px', background: 'rgba(239,68,68,0.2)', border: 'none', borderRadius: 4, color: '#f87171', fontSize: 10, cursor: 'pointer' }}>×</button>}
                    </div>
                  ))}
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 10, color: '#9ca3af' }}>
                    <span>Total CA</span><span style={{ fontFamily: 'monospace' }}>{fmt(priorCalc.ca)}</span>
                  </div>
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px', background: 'rgba(99,102,241,0.1)', borderRadius: 6, fontWeight: 600, fontSize: 11, marginTop: 8 }}>
                    <span>TOTAL ASSETS</span><span style={{ fontFamily: 'monospace' }}>{fmt(priorCalc.totA)}</span>
                  </div>
                  
                  {/* Non-Current Liabilities */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, marginBottom: 6 }}>
                    <span style={sectionTitle}>Non-Current Liabilities</span>
                    <button onClick={() => addPriorBSItem('ncl')} style={{ padding: '2px 8px', background: 'rgba(251,191,36,0.2)', border: 'none', borderRadius: 4, color: '#fbbf24', fontSize: 9, cursor: 'pointer' }}>+ Add</button>
                  </div>
                  {priorBSItems.filter(i => i.type === 'ncl').map(item => (
                    <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                      <input value={item.label} onChange={e => updatePriorBSItem(item.id, 'label', e.target.value)} style={{ ...inputStyle, flex: 1, fontSize: 11, padding: '4px 8px' }} />
                      <input type="number" placeholder="0" value={item.value} onChange={e => updatePriorBSItem(item.id, 'value', e.target.value)} style={{ ...numInputStyle, width: 90, fontSize: 11, padding: '4px 8px' }} />
                      {item.custom && <button onClick={() => removePriorBSItem(item.id)} style={{ padding: '2px 6px', background: 'rgba(239,68,68,0.2)', border: 'none', borderRadius: 4, color: '#f87171', fontSize: 10, cursor: 'pointer' }}>×</button>}
                    </div>
                  ))}
                  
                  {/* Current Liabilities */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, marginBottom: 6 }}>
                    <span style={sectionTitle}>Current Liabilities</span>
                    <button onClick={() => addPriorBSItem('cl')} style={{ padding: '2px 8px', background: 'rgba(239,68,68,0.2)', border: 'none', borderRadius: 4, color: '#f87171', fontSize: 9, cursor: 'pointer' }}>+ Add</button>
                  </div>
                  {priorBSItems.filter(i => i.type === 'cl').map(item => (
                    <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                      <input value={item.label} onChange={e => updatePriorBSItem(item.id, 'label', e.target.value)} style={{ ...inputStyle, flex: 1, fontSize: 11, padding: '4px 8px' }} />
                      <input type="number" placeholder="0" value={item.value} onChange={e => updatePriorBSItem(item.id, 'value', e.target.value)} style={{ ...numInputStyle, width: 90, fontSize: 11, padding: '4px 8px' }} />
                      {item.custom && <button onClick={() => removePriorBSItem(item.id)} style={{ padding: '2px 6px', background: 'rgba(239,68,68,0.2)', border: 'none', borderRadius: 4, color: '#f87171', fontSize: 10, cursor: 'pointer' }}>×</button>}
                    </div>
                  ))}
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 10, color: '#9ca3af' }}>
                    <span>Total Liabilities</span><span style={{ fontFamily: 'monospace' }}>{fmt(priorCalc.totL)}</span>
                  </div>
                  
                  {/* Equity */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, marginBottom: 6 }}>
                    <span style={sectionTitle}>Equity</span>
                    <button onClick={() => addPriorBSItem('equity')} style={{ padding: '2px 8px', background: 'rgba(139,92,246,0.2)', border: 'none', borderRadius: 4, color: '#a78bfa', fontSize: 9, cursor: 'pointer' }}>+ Add</button>
                  </div>
                  {priorBSItems.filter(i => i.type === 'equity').map(item => (
                    <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                      <input value={item.label} onChange={e => updatePriorBSItem(item.id, 'label', e.target.value)} style={{ ...inputStyle, flex: 1, fontSize: 11, padding: '4px 8px' }} />
                      <input type="number" placeholder="0" value={item.value} onChange={e => updatePriorBSItem(item.id, 'value', e.target.value)} style={{ ...numInputStyle, width: 90, fontSize: 11, padding: '4px 8px' }} />
                      {item.custom && <button onClick={() => removePriorBSItem(item.id)} style={{ padding: '2px 6px', background: 'rgba(239,68,68,0.2)', border: 'none', borderRadius: 4, color: '#f87171', fontSize: 10, cursor: 'pointer' }}>×</button>}
                    </div>
                  ))}
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 10, color: '#9ca3af' }}>
                    <span>Total Equity</span><span style={{ fontFamily: 'monospace' }}>{fmt(priorCalc.totE)}</span>
                  </div>
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px', background: 'rgba(239,68,68,0.1)', borderRadius: 6, fontWeight: 600, fontSize: 11, marginTop: 8 }}>
                    <span>TOTAL L + E</span><span style={{ fontFamily: 'monospace' }}>{fmt(priorCalc.totLE)}</span>
                  </div>

                  <div style={{ padding: 10, background: priorCalc.balanced ? 'rgba(52,211,153,0.1)' : 'rgba(251,191,36,0.1)', borderRadius: 6, marginTop: 12, fontSize: 11 }}>
                    <div style={{ fontWeight: 700, color: priorCalc.balanced ? '#34d399' : '#fbbf24', marginBottom: 4 }}>
                      {priorCalc.balanced ? '✓ Balance Sheet is Balanced' : '⚠ Not Balanced - Check entries'}
                    </div>
                    <div>Difference: {fmt(Math.abs(priorCalc.totA - priorCalc.totLE))}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          {/* Fixed Apply Button at Bottom - Always Visible */}
          <div style={{ 
            marginTop: 16,
            padding: '16px 0'
          }}>
            {!priorFSApplied ? (
              <button 
                onClick={() => {
                  applyPriorFS();
                  setPriorFSApplied(true);
                }} 
                disabled={priorCalc.totA === 0 && priorCalc.totLE === 0} 
                style={{ 
                  width: '100%', 
                  padding: '14px 20px', 
                  background: (priorCalc.totA > 0 || priorCalc.totLE > 0) ? 'linear-gradient(135deg, #10b981, #059669)' : 'rgba(75,85,99,0.3)', 
                  border: 'none', 
                  borderRadius: 8, 
                  color: '#fff', 
                  fontSize: 14, 
                  fontWeight: 700, 
                  cursor: (priorCalc.totA > 0 || priorCalc.totLE > 0) ? 'pointer' : 'not-allowed',
                  boxShadow: (priorCalc.totA > 0 || priorCalc.totLE > 0) ? '0 4px 12px rgba(16,185,129,0.3)' : 'none'
                }}
              >
                ✓ Apply Prior Year Balances to Opening Balances
              </button>
            ) : (
              <div style={{ 
                padding: '14px 20px', 
                background: 'rgba(52,211,153,0.15)', 
                border: '2px solid rgba(52,211,153,0.4)', 
                borderRadius: 8,
                textAlign: 'center'
              }}>
                <div style={{ color: '#34d399', fontWeight: 700, fontSize: 14 }}>✓ Prior Year Balances Applied Successfully</div>
                <div style={{ color: '#9ca3af', fontSize: 12, marginTop: 4 }}>Opening balances have been updated. Click "Banks →" above to continue.</div>
              </div>
            )}
          </div>
        </>
        )}

        {/* Review Tab */}
        {tab === 'review' && (
          <div>
            {/* Bank Statement Summary */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 16 }}>
              {(() => {
                // Calculate totals per bank
                const bankSummary = {};
                txs.forEach(tx => {
                  const bank = tx.bankAccount || 'Unknown';
                  if (!bankSummary[bank]) {
                    bankSummary[bank] = { count: 0, credits: 0, debits: 0, net: 0 };
                  }
                  bankSummary[bank].count++;
                  if (tx.amount >= 0) {
                    bankSummary[bank].credits += tx.amount;
                  } else {
                    bankSummary[bank].debits += Math.abs(tx.amount);
                  }
                  bankSummary[bank].net += tx.amount;
                });
                
                return Object.entries(bankSummary).map(([bank, data]) => (
                  <div key={bank} style={{ background: 'rgba(31,41,55,0.6)', borderRadius: 10, border: '1px solid rgba(75,85,99,0.3)', padding: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <span style={{ fontWeight: 700, fontSize: 12 }}>🏦 {bank}</span>
                      <span style={{ background: 'rgba(99,102,241,0.2)', color: '#a5b4fc', padding: '2px 8px', borderRadius: 10, fontSize: 10 }}>{data.count} txns</span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 10 }}>
                      <div style={{ background: 'rgba(52,211,153,0.1)', padding: '6px 8px', borderRadius: 6 }}>
                        <div style={{ color: '#9ca3af', fontSize: 9 }}>Total Credits</div>
                        <div style={{ fontFamily: 'monospace', fontWeight: 600, color: '#34d399' }}>{fmt(data.credits)}</div>
                      </div>
                      <div style={{ background: 'rgba(239,68,68,0.1)', padding: '6px 8px', borderRadius: 6 }}>
                        <div style={{ color: '#9ca3af', fontSize: 9 }}>Total Debits</div>
                        <div style={{ fontFamily: 'monospace', fontWeight: 600, color: '#f87171' }}>{fmt(data.debits)}</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, padding: '6px 8px', background: 'rgba(99,102,241,0.1)', borderRadius: 6 }}>
                      <span style={{ fontSize: 10, fontWeight: 600 }}>Net Movement</span>
                      <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 11, color: data.net >= 0 ? '#34d399' : '#f87171' }}>{fmt(data.net)}</span>
                    </div>
                  </div>
                ));
              })()}
              
              {/* Grand Total */}
              {txs.length > 0 && (
                <div style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.2), rgba(139,92,246,0.2))', borderRadius: 10, border: '1px solid rgba(99,102,241,0.3)', padding: 12 }}>
                  <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 8 }}>📊 All Banks Total</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 10 }}>
                    <div>
                      <div style={{ color: '#9ca3af', fontSize: 9 }}>Total Credits</div>
                      <div style={{ fontFamily: 'monospace', fontWeight: 600, color: '#34d399' }}>{fmt(txs.filter(t => t.amount >= 0).reduce((s, t) => s + t.amount, 0))}</div>
                    </div>
                    <div>
                      <div style={{ color: '#9ca3af', fontSize: 9 }}>Total Debits</div>
                      <div style={{ fontFamily: 'monospace', fontWeight: 600, color: '#f87171' }}>{fmt(Math.abs(txs.filter(t => t.amount < 0).reduce((s, t) => s + t.amount, 0)))}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, padding: '8px', background: 'rgba(17,24,39,0.4)', borderRadius: 6 }}>
                    <span style={{ fontWeight: 700 }}>Net Movement</span>
                    <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 12, color: txs.reduce((s, t) => s + t.amount, 0) >= 0 ? '#34d399' : '#f87171' }}>
                      {fmt(txs.reduce((s, t) => s + t.amount, 0))}
                    </span>
                  </div>
                </div>
              )}
            </div>
            
            {/* Monthly Breakdown Table */}
            {txs.length > 0 && (
              <div style={{ background: 'rgba(31,41,55,0.6)', borderRadius: 10, border: '1px solid rgba(75,85,99,0.3)', marginBottom: 16, overflow: 'hidden' }}>
                <div style={{ padding: '10px 16px', borderBottom: '1px solid rgba(75,85,99,0.2)', fontWeight: 700, fontSize: 12 }}>📅 Monthly Breakdown by Bank</div>
                <div style={{ padding: 12, overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
                    <thead>
                      <tr style={{ background: 'rgba(99,102,241,0.1)' }}>
                        <th style={{ padding: 6, textAlign: 'left', fontWeight: 600 }}>Bank</th>
                        {MONTHS.filter(m => txs.some(tx => tx.month === m)).map(m => (
                          <th key={m} style={{ padding: 6, textAlign: 'right', fontWeight: 600 }}>{m}</th>
                        ))}
                        <th style={{ padding: 6, textAlign: 'right', fontWeight: 700, background: 'rgba(139,92,246,0.1)' }}>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        const bankNames = [...new Set(txs.map(tx => tx.bankAccount || 'Unknown'))];
                        const activeMonths = MONTHS.filter(m => txs.some(tx => tx.month === m));
                        
                        return bankNames.map((bank, bi) => {
                          const bankTxs = txs.filter(tx => (tx.bankAccount || 'Unknown') === bank);
                          const bankTotal = bankTxs.reduce((s, t) => s + t.amount, 0);
                          
                          return (
                            <tr key={bank} style={{ background: bi % 2 ? 'transparent' : 'rgba(17,24,39,0.3)' }}>
                              <td style={{ padding: 6, fontWeight: 600 }}>{bank}</td>
                              {activeMonths.map(m => {
                                const monthTxs = bankTxs.filter(tx => tx.month === m);
                                const monthNet = monthTxs.reduce((s, t) => s + t.amount, 0);
                                const monthCount = monthTxs.length;
                                return (
                                  <td key={m} style={{ padding: 6, textAlign: 'right' }}>
                                    {monthCount > 0 ? (
                                      <div>
                                        <div style={{ fontFamily: 'monospace', color: monthNet >= 0 ? '#34d399' : '#f87171' }}>{fmt(monthNet)}</div>
                                        <div style={{ fontSize: 8, color: '#6b7280' }}>{monthCount} txns</div>
                                      </div>
                                    ) : '-'}
                                  </td>
                                );
                              })}
                              <td style={{ padding: 6, textAlign: 'right', fontWeight: 700, fontFamily: 'monospace', background: 'rgba(139,92,246,0.1)', color: bankTotal >= 0 ? '#34d399' : '#f87171' }}>
                                {fmt(bankTotal)}
                              </td>
                            </tr>
                          );
                        });
                      })()}
                      <tr style={{ background: 'rgba(99,102,241,0.15)', fontWeight: 700 }}>
                        <td style={{ padding: 6 }}>TOTAL</td>
                        {MONTHS.filter(m => txs.some(tx => tx.month === m)).map(m => {
                          const monthTxs = txs.filter(tx => tx.month === m);
                          const monthTotal = monthTxs.reduce((s, t) => s + t.amount, 0);
                          return (
                            <td key={m} style={{ padding: 6, textAlign: 'right', fontFamily: 'monospace', color: monthTotal >= 0 ? '#34d399' : '#f87171' }}>
                              {fmt(monthTotal)}
                            </td>
                          );
                        })}
                        <td style={{ padding: 6, textAlign: 'right', fontFamily: 'monospace', background: 'rgba(139,92,246,0.2)', color: txs.reduce((s, t) => s + t.amount, 0) >= 0 ? '#34d399' : '#f87171' }}>
                          {fmt(txs.reduce((s, t) => s + t.amount, 0))}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            
            {/* Transactions List */}
            <div style={{ background: 'rgba(31,41,55,0.6)', borderRadius: 10, border: '1px solid rgba(75,85,99,0.3)', overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(75,85,99,0.2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <button onClick={goBack} style={backBtnStyle}>← Upload</button>
                  <span style={{ fontWeight: 700, fontSize: 14 }}>Review Transactions ({txs.length})</span>
                </div>
                <button onClick={goNext} style={nextBtnStyle}>Next: Classify →</button>
              </div>
              <div style={{ padding: 12, maxHeight: 350, overflowY: 'auto' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '70px 60px 1fr 60px 80px 50px 50px 20px', gap: 4, padding: '6px 8px', background: 'rgba(99,102,241,0.1)', borderRadius: 4, fontSize: 9, fontWeight: 600, color: '#9ca3af', marginBottom: 4 }}>
                  <span>Date</span><span>Bank</span><span>Description</span><span>Ref</span><span style={{ textAlign: 'right' }}>Amount</span><span>Month</span><span>Class</span><span></span>
                </div>
                {txs.map((tx, i) => {
                  const cls = FSEngine.classify(tx.description);
                  return (
                    <div key={i} style={{ display: 'grid', gridTemplateColumns: '70px 60px 1fr 60px 80px 50px 50px 20px', gap: 4, padding: '4px 8px', background: i % 2 ? 'transparent' : 'rgba(17,24,39,0.3)', borderRadius: 4, alignItems: 'center', fontSize: 10 }}>
                      <input type="date" value={tx.date} onChange={e => updateTx(i, 'date', e.target.value)} style={{ ...inputStyle, padding: '2px 4px', fontSize: 9 }} />
                      <span style={{ fontSize: 9, color: '#9ca3af' }}>{tx.bankAccount?.substring(0, 6)}</span>
                      <input value={tx.description} onChange={e => updateTx(i, 'description', e.target.value)} style={{ ...inputStyle, padding: '2px 4px', fontSize: 9 }} />
                      <span style={{ fontSize: 9, color: '#6b7280' }}>{tx.reference?.substring(0, 8)}</span>
                      <input type="number" value={tx.amount} onChange={e => updateTx(i, 'amount', e.target.value)} style={{ ...numInputStyle, padding: '2px 4px', fontSize: 9, color: tx.amount >= 0 ? '#34d399' : '#f87171' }} />
                      <span style={{ fontSize: 9, color: '#6b7280' }}>{tx.month}</span>
                      <span style={{ background: cls.code === 'SUSPENSE' ? 'rgba(251,191,36,0.2)' : 'rgba(139,92,246,0.2)', color: cls.code === 'SUSPENSE' ? '#fbbf24' : '#c4b5fd', padding: '1px 3px', borderRadius: 2, fontSize: 7, textAlign: 'center' }}>{cls.code.substring(0, 5)}</span>
                      <button onClick={() => rmTx(i)} style={{ width: 16, height: 16, background: 'rgba(239,68,68,0.2)', border: 'none', borderRadius: 2, color: '#f87171', cursor: 'pointer', fontSize: 9 }}>×</button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Classification Review Tab */}
        {tab === 'classify' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <button onClick={goBack} style={backBtnStyle}>← Review</button>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ fontSize: 11, color: '#9ca3af' }}>Review auto-classifications and correct if needed</span>
                <button onClick={goNext} style={nextBtnStyle}>Next: Subledger →</button>
              </div>
            </div>
            
            {/* Classification Summary */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 16 }}>
              {(() => {
                const summary = {};
                txs.forEach(tx => {
                  const cls = tx.classification || FSEngine.classify(tx.description).code;
                  if (!summary[cls]) summary[cls] = { count: 0, total: 0 };
                  summary[cls].count++;
                  summary[cls].total += tx.amount;
                });
                
                const colors = {
                  SALES: '#34d399', PURCHASE: '#f87171', SALARY: '#fbbf24', RENT: '#a78bfa',
                  UTILITIES: '#60a5fa', BANK_CHARGES: '#f472b6', TRANSFER: '#94a3b8', SUSPENSE: '#fbbf24',
                  LOAN: '#c084fc', FIXED_ASSET: '#2dd4bf', INTEREST_INC: '#4ade80', INTEREST_EXP: '#fb7185',
                  // Payment classifications
                  PAY_SUPPLIER: '#f97316', PAY_CREDITOR: '#fb923c', LOAN_REPAY_ST: '#a855f7', LOAN_REPAY_LT: '#8b5cf6',
                  TAX_PAYMENT: '#ef4444', GST_SST: '#f43f5e',
                  // Receipt classifications  
                  RECEIPT_DEBTOR: '#22c55e', DEPOSIT_RECEIVED: '#14b8a6', LOAN_DRAWDOWN: '#06b6d4',
                  DUITNOW_OUT: '#64748b', DRAWINGS: '#ec4899', CAPITAL: '#10b981'
                };
                
                return Object.entries(summary).sort((a, b) => b[1].count - a[1].count).map(([cls, data]) => (
                  <div 
                    key={cls} 
                    onClick={() => setClassifyFilter(classifyFilter === cls ? 'ALL' : cls)}
                    style={{ 
                      background: classifyFilter === cls ? 'rgba(99,102,241,0.3)' : 'rgba(31,41,55,0.6)', 
                      borderRadius: 8, 
                      border: classifyFilter === cls ? '2px solid rgba(99,102,241,0.6)' : '1px solid rgba(75,85,99,0.3)', 
                      padding: 10,
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: colors[cls] || '#9ca3af' }}>{cls}</span>
                      <span style={{ background: 'rgba(99,102,241,0.2)', color: '#a5b4fc', padding: '1px 6px', borderRadius: 8, fontSize: 9 }}>{data.count}</span>
                    </div>
                    <div style={{ fontFamily: 'monospace', fontSize: 11, fontWeight: 600, color: data.total >= 0 ? '#34d399' : '#f87171' }}>
                      {fmt(data.total)}
                    </div>
                  </div>
                ));
              })()}
            </div>
            
            {/* Classification Editor */}
            <div style={{ background: 'rgba(31,41,55,0.6)', borderRadius: 10, border: '1px solid rgba(75,85,99,0.3)', overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(75,85,99,0.2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                <span style={{ fontWeight: 700, fontSize: 14 }}>🏷️ Transaction Classifications</span>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  {/* Search Input */}
                  <input 
                    type="text"
                    placeholder="🔍 Search description..."
                    value={classifySearch}
                    onChange={e => setClassifySearch(e.target.value)}
                    style={{ 
                      padding: '5px 10px', 
                      background: 'rgba(17,24,39,0.6)', 
                      border: '1px solid rgba(75,85,99,0.4)', 
                      borderRadius: 6, 
                      color: '#e5e7eb', 
                      fontSize: 10,
                      width: 150
                    }}
                  />
                  {/* Filter Dropdown */}
                  <select
                    value={classifyFilter}
                    onChange={e => setClassifyFilter(e.target.value)}
                    style={{ 
                      padding: '5px 10px', 
                      background: 'rgba(99,102,241,0.15)', 
                      border: '1px solid rgba(99,102,241,0.3)', 
                      borderRadius: 6, 
                      color: '#a5b4fc', 
                      fontSize: 10,
                      cursor: 'pointer'
                    }}
                  >
                    <option value="ALL">All Classifications</option>
                    <option value="SUSPENSE">⚠ Unclassified Only</option>
                    <optgroup label="📈 Revenue">
                      {FS_STRUCTURE.income.revenue.map(item => (
                        <option key={item.id} value={item.id}>{item.label}</option>
                      ))}
                    </optgroup>
                    <optgroup label="📦 Cost of Sales">
                      {FS_STRUCTURE.income.cost_of_sales.map(item => (
                        <option key={item.id} value={item.id}>{item.label}</option>
                      ))}
                    </optgroup>
                    <optgroup label="💼 Operating Expenses">
                      {FS_STRUCTURE.income.operating_expenses.map(item => (
                        <option key={item.id} value={item.id}>{item.label}</option>
                      ))}
                    </optgroup>
                    <optgroup label="💰 Other Income">
                      {FS_STRUCTURE.income.other_income.map(item => (
                        <option key={item.id} value={item.id}>{item.label}</option>
                      ))}
                    </optgroup>
                    <optgroup label="📉 Other Expenses">
                      {FS_STRUCTURE.income.other_expenses.map(item => (
                        <option key={item.id} value={item.id}>{item.label}</option>
                      ))}
                    </optgroup>
                    <optgroup label="🏦 Finance Costs">
                      {FS_STRUCTURE.income.finance_costs.map(item => (
                        <option key={item.id} value={item.id}>{item.label}</option>
                      ))}
                    </optgroup>
                    <optgroup label="📊 Balance Sheet">
                      <option value="FIXED_ASSET">Fixed Asset Purchase</option>
                      <option value="LOAN">Loan/Borrowing (Legacy)</option>
                      <option value="CAPITAL">Capital Injection</option>
                      <option value="DRAWINGS">Drawings</option>
                      <option value="GST_SST">GST/SST</option>
                    </optgroup>
                    <optgroup label="💳 Payments (Reduce Liabilities)">
                      <option value="PAY_SUPPLIER">Payment to Supplier (↓ AP)</option>
                      <option value="PAY_CREDITOR">Payment to Creditor (↓ Other Pay)</option>
                      <option value="LOAN_REPAY_ST">Loan Repayment - ST (↓ ST Borr)</option>
                      <option value="LOAN_REPAY_LT">Loan Repayment - LT (↓ LT Borr)</option>
                      <option value="TAX_PAYMENT">Tax Payment (↓ Tax Pay)</option>
                    </optgroup>
                    <optgroup label="💰 Receipts (Reduce Assets/Increase Liab)">
                      <option value="RECEIPT_DEBTOR">Receipt from Debtor (↓ AR)</option>
                      <option value="DEPOSIT_RECEIVED">Deposit Received (↑ Other Pay)</option>
                      <option value="LOAN_DRAWDOWN">Loan Drawdown (↑ Borrowings)</option>
                    </optgroup>
                    <optgroup label="🔄 Other">
                      <option value="TRANSFER">Transfer (Internal)</option>
                      <option value="DUITNOW_OUT">DuitNow</option>
                    </optgroup>
                  </select>
                  {/* Clear Filter Button */}
                  {(classifyFilter !== 'ALL' || classifySearch) && (
                    <button
                      onClick={() => { setClassifyFilter('ALL'); setClassifySearch(''); }}
                      style={{ 
                        padding: '5px 10px', 
                        background: 'rgba(239,68,68,0.15)', 
                        border: '1px solid rgba(239,68,68,0.3)', 
                        borderRadius: 6, 
                        color: '#fca5a5', 
                        fontSize: 10,
                        cursor: 'pointer'
                      }}
                    >✕ Clear</button>
                  )}
                  <span style={{ fontSize: 10, color: '#fbbf24', background: 'rgba(251,191,36,0.1)', padding: '4px 8px', borderRadius: 4 }}>
                    ⚠ {txs.filter(tx => (tx.classification || FSEngine.classify(tx.description).code) === 'SUSPENSE').length} unclassified
                  </span>
                </div>
              </div>
              
              {/* Bulk Action Bar */}
              <div style={{ padding: '10px 16px', borderBottom: '1px solid rgba(75,85,99,0.2)', background: 'rgba(99,102,241,0.05)', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input 
                    type="checkbox"
                    checked={(() => {
                      const filteredIndices = txs.map((tx, i) => ({ tx, i })).filter(({ tx }) => {
                        const currentCls = tx.classification || FSEngine.classify(tx.description).code;
                        const matchesFilter = classifyFilter === 'ALL' || currentCls === classifyFilter;
                        const matchesSearch = !classifySearch || tx.description.toLowerCase().includes(classifySearch.toLowerCase());
                        return matchesFilter && matchesSearch;
                      }).map(({ i }) => i);
                      return filteredIndices.length > 0 && filteredIndices.every(i => selectedTxIndices.has(i));
                    })()}
                    onChange={(e) => {
                      const filteredIndices = txs.map((tx, i) => ({ tx, i })).filter(({ tx }) => {
                        const currentCls = tx.classification || FSEngine.classify(tx.description).code;
                        const matchesFilter = classifyFilter === 'ALL' || currentCls === classifyFilter;
                        const matchesSearch = !classifySearch || tx.description.toLowerCase().includes(classifySearch.toLowerCase());
                        return matchesFilter && matchesSearch;
                      }).map(({ i }) => i);
                      
                      if (e.target.checked) {
                        setSelectedTxIndices(new Set([...selectedTxIndices, ...filteredIndices]));
                      } else {
                        const newSet = new Set(selectedTxIndices);
                        filteredIndices.forEach(i => newSet.delete(i));
                        setSelectedTxIndices(newSet);
                      }
                    }}
                    style={{ width: 16, height: 16, cursor: 'pointer' }}
                  />
                  <span style={{ fontSize: 11, color: '#a5b4fc', fontWeight: 600 }}>
                    {selectedTxIndices.size > 0 ? `${selectedTxIndices.size} selected` : 'Select All'}
                  </span>
                </div>
                
                {selectedTxIndices.size > 0 && (
                  <>
                    <div style={{ height: 20, width: 1, background: 'rgba(75,85,99,0.5)' }} />
                    <span style={{ fontSize: 10, color: '#9ca3af' }}>Bulk classify to:</span>
                    <select
                      value={bulkClassification}
                      onChange={e => setBulkClassification(e.target.value)}
                      style={{ 
                        padding: '5px 10px', 
                        background: 'rgba(52,211,153,0.15)', 
                        border: '1px solid rgba(52,211,153,0.3)', 
                        borderRadius: 6, 
                        color: '#34d399', 
                        fontSize: 10,
                        cursor: 'pointer',
                        minWidth: 150
                      }}
                    >
                      <option value="">-- Select Classification --</option>
                      <optgroup label="📈 Revenue">
                        {FS_STRUCTURE.income.revenue.map(item => (
                          <option key={item.id} value={item.id}>{item.label}</option>
                        ))}
                      </optgroup>
                      <optgroup label="📦 Cost of Sales">
                        {FS_STRUCTURE.income.cost_of_sales.map(item => (
                          <option key={item.id} value={item.id}>{item.label}</option>
                        ))}
                      </optgroup>
                      <optgroup label="💰 Other Income">
                        {FS_STRUCTURE.income.other_income.map(item => (
                          <option key={item.id} value={item.id}>{item.label}</option>
                        ))}
                      </optgroup>
                      <optgroup label="💼 Operating Expenses">
                        {FS_STRUCTURE.income.operating_expenses.map(item => (
                          <option key={item.id} value={item.id}>{item.label}</option>
                        ))}
                      </optgroup>
                      <optgroup label="📉 Other Expenses">
                        {FS_STRUCTURE.income.other_expenses.map(item => (
                          <option key={item.id} value={item.id}>{item.label}</option>
                        ))}
                      </optgroup>
                      <optgroup label="🏦 Finance Costs">
                        {FS_STRUCTURE.income.finance_costs.map(item => (
                          <option key={item.id} value={item.id}>{item.label}</option>
                        ))}
                      </optgroup>
                      <optgroup label="📊 Balance Sheet">
                        <option value="FIXED_ASSET">Fixed Asset Purchase</option>
                        <option value="LOAN">Loan/Borrowing (Legacy)</option>
                        <option value="CAPITAL">Capital Injection</option>
                        <option value="DRAWINGS">Drawings</option>
                      </optgroup>
                      <optgroup label="💳 Payments (↓ Liabilities)">
                        <option value="PAY_SUPPLIER">Payment to Supplier (↓ AP)</option>
                        <option value="PAY_CREDITOR">Payment to Creditor (↓ Other Pay)</option>
                        <option value="LOAN_REPAY_ST">Loan Repayment - ST</option>
                        <option value="LOAN_REPAY_LT">Loan Repayment - LT</option>
                        <option value="TAX_PAYMENT">Tax Payment</option>
                        <option value="GST_SST">GST/SST Payment</option>
                      </optgroup>
                      <optgroup label="💰 Receipts">
                        <option value="RECEIPT_DEBTOR">Receipt from Debtor (↓ AR)</option>
                        <option value="DEPOSIT_RECEIVED">Deposit Received</option>
                        <option value="LOAN_DRAWDOWN">Loan Drawdown</option>
                      </optgroup>
                      <optgroup label="🔄 Others">
                        <option value="TRANSFER">Transfer (Internal)</option>
                        <option value="DUITNOW_OUT">DuitNow</option>
                        <option value="SUSPENSE">Suspense</option>
                      </optgroup>
                    </select>
                    <button
                      onClick={() => {
                        if (!bulkClassification) return;
                        setTxs(prev => prev.map((tx, i) => 
                          selectedTxIndices.has(i) ? { ...tx, classification: bulkClassification } : tx
                        ));
                        setSelectedTxIndices(new Set());
                        setBulkClassification('');
                      }}
                      disabled={!bulkClassification}
                      style={{ 
                        padding: '6px 14px', 
                        background: bulkClassification ? 'linear-gradient(135deg, #10b981, #059669)' : 'rgba(75,85,99,0.3)', 
                        border: 'none', 
                        borderRadius: 6, 
                        color: '#fff', 
                        fontSize: 10,
                        fontWeight: 600,
                        cursor: bulkClassification ? 'pointer' : 'not-allowed'
                      }}
                    >
                      ✓ Apply to {selectedTxIndices.size} items
                    </button>
                    <button
                      onClick={() => {
                        setTxs(prev => prev.filter((_, i) => !selectedTxIndices.has(i)));
                        setSelectedTxIndices(new Set());
                      }}
                      style={{ 
                        padding: '6px 14px', 
                        background: 'rgba(239,68,68,0.2)', 
                        border: '1px solid rgba(239,68,68,0.3)', 
                        borderRadius: 6, 
                        color: '#f87171', 
                        fontSize: 10,
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                    >
                      🗑️ Delete Selected
                    </button>
                    <button
                      onClick={() => setSelectedTxIndices(new Set())}
                      style={{ 
                        padding: '6px 10px', 
                        background: 'transparent', 
                        border: '1px solid rgba(75,85,99,0.3)', 
                        borderRadius: 6, 
                        color: '#9ca3af', 
                        fontSize: 10,
                        cursor: 'pointer'
                      }}
                    >
                      Clear Selection
                    </button>
                  </>
                )}
              </div>
              
              <div style={{ padding: 12, maxHeight: 400, overflowY: 'auto' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '30px 70px 1fr 100px 120px 30px', gap: 4, padding: '6px 8px', background: 'rgba(99,102,241,0.1)', borderRadius: 4, fontSize: 9, fontWeight: 600, color: '#9ca3af', marginBottom: 4 }}>
                  <span></span><span>Date</span><span>Description</span><span style={{ textAlign: 'right' }}>Amount</span><span>Classification</span><span></span>
                </div>
                {(() => {
                  // Apply filters
                  const filteredTxs = txs.map((tx, i) => ({ ...tx, originalIndex: i })).filter(tx => {
                    const currentCls = tx.classification || FSEngine.classify(tx.description).code;
                    const matchesFilter = classifyFilter === 'ALL' || currentCls === classifyFilter;
                    const matchesSearch = !classifySearch || tx.description.toLowerCase().includes(classifySearch.toLowerCase());
                    return matchesFilter && matchesSearch;
                  });
                  
                  if (filteredTxs.length === 0) {
                    return (
                      <div style={{ padding: 20, textAlign: 'center', color: '#9ca3af', fontSize: 12 }}>
                        No transactions match the current filter.
                      </div>
                    );
                  }
                  
                  return filteredTxs.map((tx, displayIndex) => {
                    const i = tx.originalIndex;
                    const autoCls = FSEngine.classify(tx.description);
                    const currentCls = tx.classification || autoCls.code;
                    const isSelected = selectedTxIndices.has(i);
                    
                    return (
                      <div key={i} style={{ display: 'grid', gridTemplateColumns: '30px 70px 1fr 100px 120px 30px', gap: 4, padding: '6px 8px', background: isSelected ? 'rgba(99,102,241,0.2)' : (displayIndex % 2 ? 'transparent' : 'rgba(17,24,39,0.3)'), borderRadius: 4, alignItems: 'center', fontSize: 10, borderLeft: currentCls === 'SUSPENSE' ? '3px solid #fbbf24' : (isSelected ? '3px solid #6366f1' : '3px solid transparent') }}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => {
                            const newSet = new Set(selectedTxIndices);
                            if (e.target.checked) {
                              newSet.add(i);
                            } else {
                              newSet.delete(i);
                            }
                            setSelectedTxIndices(newSet);
                          }}
                          style={{ width: 14, height: 14, cursor: 'pointer' }}
                        />
                        <span style={{ color: '#9ca3af' }}>{tx.date}</span>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={tx.description}>{tx.description}</span>
                        <input 
                          type="number" 
                          value={tx.amount} 
                          onChange={e => updateTx(i, 'amount', e.target.value)}
                          style={{ 
                            ...numInputStyle, 
                            padding: '3px 6px', 
                            fontSize: 10, 
                            textAlign: 'right',
                            color: tx.amount >= 0 ? '#34d399' : '#f87171',
                            background: 'rgba(17,24,39,0.5)'
                          }} 
                        />
                        <select 
                          value={currentCls}
                          onChange={e => updateTx(i, 'classification', e.target.value)}
                          style={{ 
                            background: currentCls === 'SUSPENSE' ? 'rgba(251,191,36,0.2)' : 'rgba(99,102,241,0.1)', 
                            border: '1px solid rgba(75,85,99,0.3)', borderRadius: 4, padding: '3px 6px', 
                            color: currentCls === 'SUSPENSE' ? '#fbbf24' : '#e5e7eb', fontSize: 9, cursor: 'pointer'
                          }}
                        >
                          <optgroup label="📈 Revenue & Income">
                            <option value="SALES">SALES (Revenue)</option>
                            <option value="INTEREST_INC">INTEREST INCOME</option>
                            <option value="DIVIDEND_INC">DIVIDEND INCOME</option>
                            <option value="RENTAL_INC">RENTAL INCOME</option>
                            <option value="OTHER_INCOME">OTHER INCOME</option>
                          </optgroup>
                          <optgroup label="📦 Cost of Sales">
                            <option value="PURCHASE">PURCHASE (COGS)</option>
                            <option value="FREIGHT_IN">FREIGHT IN</option>
                          </optgroup>
                          <optgroup label="👥 Staff Costs">
                            <option value="SALARY">SALARY & WAGES</option>
                            <option value="EPF">EPF/KWSP</option>
                            <option value="SOCSO">SOCSO/EIS</option>
                            <option value="HRDF">HRDF</option>
                          </optgroup>
                          <optgroup label="🏢 Premises">
                            <option value="RENT">RENT & LEASE</option>
                            <option value="UTILITIES">UTILITIES (TNB/Water)</option>
                            <option value="TELEPHONE">TELEPHONE & INTERNET</option>
                          </optgroup>
                          <optgroup label="📣 Marketing & Sales">
                            <option value="ADVERTISING">ADVERTISING & MARKETING</option>
                            <option value="ENTERTAINMENT">ENTERTAINMENT</option>
                            <option value="TRAVEL">TRAVEL & TRANSPORT</option>
                          </optgroup>
                          <optgroup label="💼 Professional">
                            <option value="PROFESSIONAL_FEE">PROFESSIONAL FEES</option>
                            <option value="LICENSE_FEE">LICENSE & SUBSCRIPTION</option>
                            <option value="INSURANCE">INSURANCE</option>
                          </optgroup>
                          <optgroup label="🗄️ Office & General">
                            <option value="OFFICE_SUPPLIES">OFFICE SUPPLIES</option>
                            <option value="REPAIR_MAINTENANCE">REPAIR & MAINTENANCE</option>
                            <option value="CLEANING">CLEANING</option>
                            <option value="DEPRECIATION">DEPRECIATION</option>
                            <option value="BAD_DEBT">BAD DEBT</option>
                            <option value="OTHER_EXPENSE">OTHER EXPENSE</option>
                          </optgroup>
                          <optgroup label="💰 Finance">
                            <option value="BANK_CHARGES">BANK CHARGES</option>
                            <option value="INTEREST_EXP">INTEREST EXPENSE</option>
                          </optgroup>
                          <optgroup label="📊 Balance Sheet">
                            <option value="FIXED_ASSET">FIXED ASSET</option>
                            <option value="LOAN">LOAN (Legacy)</option>
                            <option value="CAPITAL">CAPITAL/DIRECTOR LOAN</option>
                            <option value="DRAWINGS">DRAWINGS</option>
                          </optgroup>
                          <optgroup label="💳 Payments (↓ Liabilities)">
                            <option value="PAY_SUPPLIER">PAY SUPPLIER (↓ AP)</option>
                            <option value="PAY_CREDITOR">PAY CREDITOR (↓ Other Pay)</option>
                            <option value="LOAN_REPAY_ST">LOAN REPAY - ST</option>
                            <option value="LOAN_REPAY_LT">LOAN REPAY - LT</option>
                            <option value="TAX_PAYMENT">TAX PAYMENT</option>
                            <option value="GST_SST">GST/SST PAYMENT</option>
                          </optgroup>
                          <optgroup label="💰 Receipts">
                            <option value="RECEIPT_DEBTOR">RECEIPT FROM DEBTOR (↓ AR)</option>
                            <option value="DEPOSIT_RECEIVED">DEPOSIT RECEIVED</option>
                            <option value="LOAN_DRAWDOWN">LOAN DRAWDOWN</option>
                          </optgroup>
                          <optgroup label="🔄 Others">
                            <option value="TRANSFER">TRANSFER (Internal)</option>
                            <option value="DUITNOW_OUT">DUITNOW</option>
                            <option value="SUSPENSE">⚠ SUSPENSE (Unclassified)</option>
                          </optgroup>
                        </select>
                        <button 
                          onClick={() => setTxs(prev => prev.filter((_, j) => j !== i))}
                          style={{ width: 20, height: 20, background: 'rgba(239,68,68,0.2)', border: 'none', borderRadius: 3, color: '#f87171', cursor: 'pointer', fontSize: 10 }}
                          title="Delete transaction"
                        >×</button>
                      </div>
                    );
                  });
                })()}
              </div>
              {/* Filter status bar */}
              {(classifyFilter !== 'ALL' || classifySearch) && (
                <div style={{ padding: '8px 16px', borderTop: '1px solid rgba(75,85,99,0.2)', background: 'rgba(99,102,241,0.1)', fontSize: 10, color: '#a5b4fc' }}>
                  Showing {txs.filter(tx => {
                    const currentCls = tx.classification || FSEngine.classify(tx.description).code;
                    const matchesFilter = classifyFilter === 'ALL' || currentCls === classifyFilter;
                    const matchesSearch = !classifySearch || tx.description.toLowerCase().includes(classifySearch.toLowerCase());
                    return matchesFilter && matchesSearch;
                  }).length} of {txs.length} transactions
                  {classifyFilter !== 'ALL' && <span> • Filter: <strong>{classifyFilter}</strong></span>}
                  {classifySearch && <span> • Search: <strong>"{classifySearch}"</strong></span>}
                </div>
              )}
            </div>
            
            {/* Tip */}
            <div style={{ marginTop: 16, padding: 12, background: 'rgba(99,102,241,0.1)', borderRadius: 8, border: '1px solid rgba(99,102,241,0.2)' }}>
              <div style={{ fontSize: 11, color: '#a5b4fc' }}>
                💡 <strong>Tip:</strong> Click on a category card above to filter by that classification. Use the search box to find specific transactions.
                Review transactions marked as SUSPENSE (yellow) and assign the correct classification. 
                You can also <strong>edit amounts</strong> if the sign is wrong (positive = credit/inflow, negative = debit/outflow).
              </div>
            </div>
          </div>
        )}


        {/* Cash Voucher Tab */}
        {tab === 'cashvoucher' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <button onClick={goBack} style={backBtnStyle}>← Classify</button>
              <button onClick={goNext} style={nextBtnStyle}>Subledger →</button>
            </div>
            
            {/* Summary Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
              <div style={{ background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.3)', borderRadius: 8, padding: 12, textAlign: 'center' }}>
                <div style={{ fontSize: 10, color: '#34d399', marginBottom: 4 }}>Cash In</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#34d399' }}>{fmt(cashTxs.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0))}</div>
              </div>
              <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: 12, textAlign: 'center' }}>
                <div style={{ fontSize: 10, color: '#f87171', marginBottom: 4 }}>Cash Out</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#f87171' }}>{fmt(Math.abs(cashTxs.filter(t => t.amount < 0).reduce((s, t) => s + t.amount, 0)))}</div>
              </div>
              <div style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 8, padding: 12, textAlign: 'center' }}>
                <div style={{ fontSize: 10, color: '#a5b4fc', marginBottom: 4 }}>Net Cash</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#a5b4fc' }}>{fmt(cashTxs.reduce((s, t) => s + t.amount, 0))}</div>
              </div>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 16 }}>
              {/* Add Cash Voucher Form */}
              <div style={{ background: 'rgba(31,41,55,0.6)', borderRadius: 12, border: '1px solid rgba(75,85,99,0.3)', overflow: 'hidden' }}>
                <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(75,85,99,0.2)', background: 'linear-gradient(135deg, rgba(251,191,36,0.1), rgba(245,158,11,0.1))' }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>➕ Add Cash Voucher</div>
                </div>
                <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div>
                    <label style={{ fontSize: 10, color: '#9ca3af', display: 'block', marginBottom: 4 }}>Date</label>
                    <input type="date" value={cvForm.date} onChange={e => setCvForm(p => ({...p, date: e.target.value}))} style={{ width: '100%', padding: '8px', background: 'rgba(17,24,39,0.6)', border: '1px solid rgba(75,85,99,0.3)', borderRadius: 6, color: '#e5e7eb', fontSize: 12, boxSizing: 'border-box' }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 10, color: '#9ca3af', display: 'block', marginBottom: 4 }}>Type</label>
                    <select value={cvForm.type} onChange={e => setCvForm(p => ({...p, type: e.target.value}))} style={{ width: '100%', padding: '8px', background: 'rgba(17,24,39,0.6)', border: '1px solid rgba(75,85,99,0.3)', borderRadius: 6, color: '#e5e7eb', fontSize: 12 }}>
                      <option value="in">💰 Cash Received</option>
                      <option value="out">💸 Cash Paid</option>
                      <option value="bank_to_cash">🏦→💵 Bank to Cash</option>
                      <option value="cash_to_bank">💵→🏦 Cash to Bank</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: 10, color: '#9ca3af', display: 'block', marginBottom: 4 }}>Description</label>
                    <input type="text" value={cvForm.description} onChange={e => setCvForm(p => ({...p, description: e.target.value}))} placeholder="e.g. Office supplies" style={{ width: '100%', padding: '8px', background: 'rgba(17,24,39,0.6)', border: '1px solid rgba(75,85,99,0.3)', borderRadius: 6, color: '#e5e7eb', fontSize: 12, boxSizing: 'border-box' }} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <div>
                      <label style={{ fontSize: 10, color: '#9ca3af', display: 'block', marginBottom: 4 }}>Reference</label>
                      <input type="text" value={cvForm.reference} onChange={e => setCvForm(p => ({...p, reference: e.target.value}))} style={{ width: '100%', padding: '8px', background: 'rgba(17,24,39,0.6)', border: '1px solid rgba(75,85,99,0.3)', borderRadius: 6, color: '#e5e7eb', fontSize: 12, boxSizing: 'border-box' }} />
                    </div>
                    <div>
                      <label style={{ fontSize: 10, color: '#9ca3af', display: 'block', marginBottom: 4 }}>Amount (RM)</label>
                      <input type="number" value={cvForm.amount} onChange={e => setCvForm(p => ({...p, amount: e.target.value}))} placeholder="0.00" step="0.01" style={{ width: '100%', padding: '8px', background: 'rgba(17,24,39,0.6)', border: '1px solid rgba(75,85,99,0.3)', borderRadius: 6, color: '#e5e7eb', fontSize: 12, textAlign: 'right', boxSizing: 'border-box' }} />
                    </div>
                  </div>
                  {!cvForm.type.includes('bank') && (
                    <div>
                      <label style={{ fontSize: 10, color: '#9ca3af', display: 'block', marginBottom: 4 }}>Classification</label>
                      <select value={cvForm.classification} onChange={e => setCvForm(p => ({...p, classification: e.target.value}))} style={{ width: '100%', padding: '8px', background: 'rgba(17,24,39,0.6)', border: '1px solid rgba(75,85,99,0.3)', borderRadius: 6, color: '#e5e7eb', fontSize: 11 }}>
                        <option value="">-- Select --</option>
                        <option value="SALES">Sales Revenue</option>
                        <option value="OTHER_INCOME">Other Income</option>
                        <option value="PURCHASE">Purchases / COGS</option>
                        <option value="OFFICE_SUPPLIES">Office Supplies</option>
                        <option value="TRAVEL">Travel</option>
                        <option value="ENTERTAINMENT">Entertainment</option>
                        <option value="UTILITIES">Utilities</option>
                        <option value="MISCELLANEOUS">Misc Expense</option>
                        <option value="DRAWINGS">Drawings</option>
                        <option value="SUSPENSE">Suspense</option>
                      </select>
                    </div>
                  )}
                  
                  {/* Suggested Double Entry Preview */}
                  {(() => {
                    const je = suggestJEForCashVoucher();
                    if (!je) return null;
                    return (
                      <div style={{ marginTop: 8, padding: 8, background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 6 }}>
                        <div style={{ fontSize: 9, color: '#a5b4fc', fontWeight: 600, marginBottom: 6 }}>📋 Suggested Double Entry:</div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 4, fontSize: 10 }}>
                          <span>Dr: {je.drAcc}</span>
                          <span style={{ fontFamily: 'monospace', color: '#34d399' }}>{fmt(je.amt)}</span>
                          <span style={{ paddingLeft: 12 }}>Cr: {je.crAcc}</span>
                          <span style={{ fontFamily: 'monospace', color: '#f87171' }}>{fmt(je.amt)}</span>
                        </div>
                      </div>
                    );
                  })()}
                  
                  <button onClick={addCashVoucher} style={{ width: '100%', padding: '10px', background: 'linear-gradient(135deg, #fbbf24, #f59e0b)', border: 'none', borderRadius: 6, color: '#1f2937', fontSize: 12, fontWeight: 700, cursor: 'pointer', marginTop: 8 }}>
                    + Add Cash Voucher
                  </button>
                </div>
              </div>
              
              {/* Cash Vouchers List */}
              <div style={{ background: 'rgba(31,41,55,0.6)', borderRadius: 12, border: '1px solid rgba(75,85,99,0.3)', overflow: 'hidden' }}>
                <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(75,85,99,0.2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span style={{ fontWeight: 700, fontSize: 14 }}>💵 Cash Vouchers</span>
                    <span style={{ marginLeft: 8, background: 'rgba(251,191,36,0.2)', color: '#fbbf24', padding: '2px 8px', borderRadius: 8, fontSize: 10 }}>{cashTxs.length}</span>
                  </div>
                </div>
                <div style={{ maxHeight: 400, overflowY: 'auto' }}>
                  {cashTxs.length > 0 ? (
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                      <thead>
                        <tr style={{ background: 'rgba(99,102,241,0.1)' }}>
                          <th style={{ padding: 8, textAlign: 'left', borderBottom: '1px solid rgba(75,85,99,0.3)' }}>Date</th>
                          <th style={{ padding: 8, textAlign: 'left', borderBottom: '1px solid rgba(75,85,99,0.3)' }}>Ref</th>
                          <th style={{ padding: 8, textAlign: 'left', borderBottom: '1px solid rgba(75,85,99,0.3)' }}>Description</th>
                          <th style={{ padding: 8, textAlign: 'left', borderBottom: '1px solid rgba(75,85,99,0.3)' }}>Class</th>
                          <th style={{ padding: 8, textAlign: 'right', borderBottom: '1px solid rgba(75,85,99,0.3)' }}>In</th>
                          <th style={{ padding: 8, textAlign: 'right', borderBottom: '1px solid rgba(75,85,99,0.3)' }}>Out</th>
                          <th style={{ padding: 8, borderBottom: '1px solid rgba(75,85,99,0.3)' }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {cashTxs.map((tx, i) => (
                          <tr key={i} style={{ borderBottom: '1px solid rgba(75,85,99,0.2)' }}>
                            <td style={{ padding: 8 }}>{tx.date}</td>
                            <td style={{ padding: 8, color: '#a5b4fc' }}>{tx.reference}</td>
                            <td style={{ padding: 8 }}>{tx.description}</td>
                            <td style={{ padding: 8 }}>
                              <select value={tx.classification || ''} onChange={e => setCashTxs(prev => prev.map((t, j) => j === i ? {...t, classification: e.target.value} : t))} style={{ padding: '4px', background: 'rgba(17,24,39,0.6)', border: '1px solid rgba(75,85,99,0.3)', borderRadius: 4, color: '#e5e7eb', fontSize: 10 }}>
                                <option value="">--</option>
                                <option value="SALES">Sales</option>
                                <option value="OTHER_INCOME">Other Income</option>
                                <option value="PURCHASE">Purchases</option>
                                <option value="OFFICE_SUPPLIES">Office Supplies</option>
                                <option value="TRAVEL">Travel</option>
                                <option value="UTILITIES">Utilities</option>
                                <option value="MISCELLANEOUS">Misc Expense</option>
                                <option value="DRAWINGS">Drawings</option>
                                <option value="CASH_TRANSFER">Transfer</option>
                                <option value="SUSPENSE">Suspense</option>
                              </select>
                            </td>
                            <td style={{ padding: 8, textAlign: 'right', color: '#34d399', fontFamily: 'monospace' }}>{tx.amount > 0 ? fmt(tx.amount) : '-'}</td>
                            <td style={{ padding: 8, textAlign: 'right', color: '#f87171', fontFamily: 'monospace' }}>{tx.amount < 0 ? fmt(Math.abs(tx.amount)) : '-'}</td>
                            <td style={{ padding: 8 }}>
                              <button onClick={() => setCashTxs(prev => prev.filter((_, j) => j !== i))} style={{ padding: '2px 6px', background: 'rgba(239,68,68,0.15)', border: 'none', borderRadius: 4, color: '#fca5a5', fontSize: 10, cursor: 'pointer' }}>×</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr style={{ background: 'rgba(99,102,241,0.1)', fontWeight: 600 }}>
                          <td colSpan={4} style={{ padding: 8 }}>TOTAL</td>
                          <td style={{ padding: 8, textAlign: 'right', color: '#34d399' }}>{fmt(cashTxs.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0))}</td>
                          <td style={{ padding: 8, textAlign: 'right', color: '#f87171' }}>{fmt(Math.abs(cashTxs.filter(t => t.amount < 0).reduce((s, t) => s + t.amount, 0)))}</td>
                          <td></td>
                        </tr>
                      </tfoot>
                    </table>
                  ) : (
                    <div style={{ padding: 40, textAlign: 'center', color: '#6b7280' }}>
                      <div style={{ fontSize: 32, marginBottom: 8 }}>💵</div>
                      <div style={{ fontSize: 12 }}>No cash vouchers yet</div>
                      <div style={{ fontSize: 10 }}>Add petty cash transactions</div>
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            {/* Info Box */}
            <div style={{ marginTop: 16, padding: 12, background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.3)', borderRadius: 8, fontSize: 11, color: '#fbbf24' }}>
              <strong>💡 Cash Vouchers</strong> are for petty cash transactions that don't go through the bank.
            </div>
          </div>
        )}


        {/* Subledger Tab */}
        {tab === 'subledger' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <button onClick={goBack} style={backBtnStyle}>← Cash</button>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button onClick={exportAllSubledgersExcel} style={{ padding: '6px 12px', background: 'linear-gradient(135deg, #059669, #10b981)', border: 'none', borderRadius: 6, color: '#fff', fontSize: 11, cursor: 'pointer', fontWeight: 600 }}>
                  📥 Export All (Excel)
                </button>
                <button onClick={exportAllSubledgersCSV} style={{ padding: '6px 12px', background: 'rgba(5,150,105,0.3)', border: '1px solid rgba(16,185,129,0.5)', borderRadius: 6, color: '#34d399', fontSize: 11, cursor: 'pointer', fontWeight: 600 }}>
                  📥 Export All (CSV)
                </button>
                <button onClick={() => exportChartOfAccounts('xlsx')} style={{ padding: '6px 12px', background: 'linear-gradient(135deg, #0891b2, #06b6d4)', border: 'none', borderRadius: 6, color: '#fff', fontSize: 11, cursor: 'pointer', fontWeight: 600 }}>
                  📋 Export COA
                </button>
                <button onClick={goNext} style={nextBtnStyle}>Next: Opening Balances →</button>
              </div>
            </div>
            
            {/* Subledger Summary Cards - with individual export buttons */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 10, marginBottom: 16 }}>
              <div style={{ background: 'rgba(99,102,241,0.1)', borderRadius: 10, border: '1px solid rgba(99,102,241,0.3)', padding: 10, position: 'relative' }}>
                <div style={{ position: 'absolute', top: 6, right: 6, display: 'flex', gap: 2 }}>
                  <button onClick={() => exportPPERegister('xlsx')} title="Export Excel" style={{ padding: '2px 4px', background: 'rgba(99,102,241,0.4)', border: 'none', borderRadius: 3, color: '#a5b4fc', fontSize: 8, cursor: 'pointer' }}>XLS</button>
                  <button onClick={() => exportPPERegister('csv')} title="Export CSV" style={{ padding: '2px 4px', background: 'rgba(99,102,241,0.2)', border: 'none', borderRadius: 3, color: '#a5b4fc', fontSize: 8, cursor: 'pointer' }}>CSV</button>
                </div>
                <div style={{ fontSize: 9, color: '#9ca3af' }}>PPE (NBV) - GL 1000</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#a5b4fc', fontFamily: 'monospace' }}>{fmt(subledgerTotals.ppe.nbv).replace('MYR ', '')}</div>
                <div style={{ fontSize: 8, color: '#6b7280' }}>{ppeRegister.length} assets</div>
              </div>
              <div style={{ background: 'rgba(52,211,153,0.1)', borderRadius: 10, border: '1px solid rgba(52,211,153,0.3)', padding: 10, position: 'relative' }}>
                <div style={{ position: 'absolute', top: 6, right: 6, display: 'flex', gap: 2 }}>
                  <button onClick={() => exportInventoryLedger('xlsx')} title="Export Excel" style={{ padding: '2px 4px', background: 'rgba(52,211,153,0.4)', border: 'none', borderRadius: 3, color: '#34d399', fontSize: 8, cursor: 'pointer' }}>XLS</button>
                  <button onClick={() => exportInventoryLedger('csv')} title="Export CSV" style={{ padding: '2px 4px', background: 'rgba(52,211,153,0.2)', border: 'none', borderRadius: 3, color: '#34d399', fontSize: 8, cursor: 'pointer' }}>CSV</button>
                </div>
                <div style={{ fontSize: 9, color: '#9ca3af' }}>Inventory - GL 1500</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#34d399', fontFamily: 'monospace' }}>{fmt(subledgerTotals.inventory).replace('MYR ', '')}</div>
                <div style={{ fontSize: 8, color: '#6b7280' }}>{inventoryLedger.length} items</div>
              </div>
              <div style={{ background: 'rgba(251,191,36,0.1)', borderRadius: 10, border: '1px solid rgba(251,191,36,0.3)', padding: 10, position: 'relative' }}>
                <div style={{ position: 'absolute', top: 6, right: 6, display: 'flex', gap: 2 }}>
                  <button onClick={() => exportTradeReceivables('xlsx')} title="Export Excel" style={{ padding: '2px 4px', background: 'rgba(251,191,36,0.4)', border: 'none', borderRadius: 3, color: '#fbbf24', fontSize: 8, cursor: 'pointer' }}>XLS</button>
                  <button onClick={() => exportTradeReceivables('csv')} title="Export CSV" style={{ padding: '2px 4px', background: 'rgba(251,191,36,0.2)', border: 'none', borderRadius: 3, color: '#fbbf24', fontSize: 8, cursor: 'pointer' }}>CSV</button>
                </div>
                <div style={{ fontSize: 9, color: '#9ca3af' }}>Trade Receivables - GL 1600</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#fbbf24', fontFamily: 'monospace' }}>{fmt(subledgerTotals.receivables).replace('MYR ', '')}</div>
                <div style={{ fontSize: 8, color: '#6b7280' }}>{tradeReceivables.length} customers</div>
              </div>
              <div style={{ background: 'rgba(139,92,246,0.1)', borderRadius: 10, border: '1px solid rgba(139,92,246,0.3)', padding: 10, position: 'relative' }}>
                <div style={{ position: 'absolute', top: 6, right: 6, display: 'flex', gap: 2 }}>
                  <button onClick={() => exportOtherDebtors('xlsx')} title="Export Excel" style={{ padding: '2px 4px', background: 'rgba(139,92,246,0.4)', border: 'none', borderRadius: 3, color: '#c084fc', fontSize: 8, cursor: 'pointer' }}>XLS</button>
                  <button onClick={() => exportOtherDebtors('csv')} title="Export CSV" style={{ padding: '2px 4px', background: 'rgba(139,92,246,0.2)', border: 'none', borderRadius: 3, color: '#c084fc', fontSize: 8, cursor: 'pointer' }}>CSV</button>
                </div>
                <div style={{ fontSize: 9, color: '#9ca3af' }}>Other Debtors - GL 1700</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#c084fc', fontFamily: 'monospace' }}>{fmt(subledgerTotals.otherDebtors).replace('MYR ', '')}</div>
                <div style={{ fontSize: 8, color: '#6b7280' }}>{otherDebtors.length} items</div>
              </div>
              <div style={{ background: 'rgba(239,68,68,0.1)', borderRadius: 10, border: '1px solid rgba(239,68,68,0.3)', padding: 10, position: 'relative' }}>
                <div style={{ position: 'absolute', top: 6, right: 6, display: 'flex', gap: 2 }}>
                  <button onClick={() => exportTradePayables('xlsx')} title="Export Excel" style={{ padding: '2px 4px', background: 'rgba(239,68,68,0.4)', border: 'none', borderRadius: 3, color: '#f87171', fontSize: 8, cursor: 'pointer' }}>XLS</button>
                  <button onClick={() => exportTradePayables('csv')} title="Export CSV" style={{ padding: '2px 4px', background: 'rgba(239,68,68,0.2)', border: 'none', borderRadius: 3, color: '#f87171', fontSize: 8, cursor: 'pointer' }}>CSV</button>
                </div>
                <div style={{ fontSize: 9, color: '#9ca3af' }}>Trade Payables - GL 2600</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#f87171', fontFamily: 'monospace' }}>{fmt(subledgerTotals.payables).replace('MYR ', '')}</div>
                <div style={{ fontSize: 8, color: '#6b7280' }}>{tradePayables.length} suppliers</div>
              </div>
              <div style={{ background: 'rgba(244,114,182,0.1)', borderRadius: 10, border: '1px solid rgba(244,114,182,0.3)', padding: 10, position: 'relative' }}>
                <div style={{ position: 'absolute', top: 6, right: 6, display: 'flex', gap: 2 }}>
                  <button onClick={() => exportOtherCreditors('xlsx')} title="Export Excel" style={{ padding: '2px 4px', background: 'rgba(244,114,182,0.4)', border: 'none', borderRadius: 3, color: '#f472b6', fontSize: 8, cursor: 'pointer' }}>XLS</button>
                  <button onClick={() => exportOtherCreditors('csv')} title="Export CSV" style={{ padding: '2px 4px', background: 'rgba(244,114,182,0.2)', border: 'none', borderRadius: 3, color: '#f472b6', fontSize: 8, cursor: 'pointer' }}>CSV</button>
                </div>
                <div style={{ fontSize: 9, color: '#9ca3af' }}>Other Creditors - GL 2700</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#f472b6', fontFamily: 'monospace' }}>{fmt(subledgerTotals.otherCreditors).replace('MYR ', '')}</div>
                <div style={{ fontSize: 8, color: '#6b7280' }}>{otherCreditors.length} items</div>
              </div>
              <div style={{ background: 'rgba(59,130,246,0.1)', borderRadius: 10, border: '1px solid rgba(59,130,246,0.3)', padding: 10, position: 'relative' }}>
                <div style={{ position: 'absolute', top: 6, right: 6, display: 'flex', gap: 2 }}>
                  <button onClick={() => exportCashBankLedger('xlsx')} title="Export Excel" style={{ padding: '2px 4px', background: 'rgba(59,130,246,0.4)', border: 'none', borderRadius: 3, color: '#60a5fa', fontSize: 8, cursor: 'pointer' }}>XLS</button>
                  <button onClick={() => exportCashBankLedger('csv')} title="Export CSV" style={{ padding: '2px 4px', background: 'rgba(59,130,246,0.2)', border: 'none', borderRadius: 3, color: '#60a5fa', fontSize: 8, cursor: 'pointer' }}>CSV</button>
                </div>
                <div style={{ fontSize: 9, color: '#9ca3af' }}>Cash & Bank - GL 1900</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#60a5fa', fontFamily: 'monospace' }}>{fmt(subledgerTotals.cashBank).replace('MYR ', '')}</div>
                <div style={{ fontSize: 8, color: '#6b7280' }}>{cashBankLedger.length} accounts</div>
              </div>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              {/* PPE Register */}
              <div style={{ background: 'rgba(31,41,55,0.6)', borderRadius: 10, border: '1px solid rgba(75,85,99,0.3)', overflow: 'hidden', gridColumn: 'span 2' }}>
                <div style={{ padding: '10px 16px', borderBottom: '1px solid rgba(75,85,99,0.2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontWeight: 700, fontSize: 13 }}>🏭 PPE Register (Fixed Assets)</span>
                    <span style={{ fontSize: 9, color: '#9ca3af', background: 'rgba(99,102,241,0.1)', padding: '2px 8px', borderRadius: 4 }}>MFRS 116 Straight-Line Method</span>
                  </div>
                  <button onClick={addPPE} style={{ padding: '4px 10px', background: 'rgba(99,102,241,0.2)', border: 'none', borderRadius: 4, color: '#a5b4fc', fontSize: 10, cursor: 'pointer' }}>+ Add Asset</button>
                </div>
                <div style={{ padding: 12, overflowX: 'auto' }}>
                  {ppeRegister.length === 0 ? (
                    <div style={{ padding: 20, textAlign: 'center', color: '#6b7280', fontSize: 11 }}>No assets registered. Click "+ Add Asset" to add.</div>
                  ) : (
                    <>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 130px 70px 40px 60px 60px 60px 60px 20px', gap: 4, padding: '6px 8px', background: 'rgba(99,102,241,0.1)', borderRadius: 4, fontSize: 8, fontWeight: 600, color: '#9ca3af', marginBottom: 4, minWidth: 700 }}>
                        <span>Description</span>
                        <span>Category</span>
                        <span style={{ textAlign: 'right' }}>Cost</span>
                        <span style={{ textAlign: 'center' }}>Life</span>
                        <span style={{ textAlign: 'right' }}>Acc Dep B/F</span>
                        <span style={{ textAlign: 'right' }}>Current Dep</span>
                        <span style={{ textAlign: 'right' }}>Acc Dep C/F</span>
                        <span style={{ textAlign: 'right' }}>NBV</span>
                        <span></span>
                      </div>
                      {ppeRegister.map((item, i) => {
                        const dep = calculatePPEDepreciation(item);
                        const categoryInfo = PPE_CATEGORIES[item.category] || PPE_CATEGORIES['OFFICE_EQUIPMENT'];
                        return (
                          <div key={item.id} style={{ display: 'grid', gridTemplateColumns: '1fr 130px 70px 40px 60px 60px 60px 60px 20px', gap: 4, padding: '4px 8px', background: i % 2 ? 'transparent' : 'rgba(17,24,39,0.3)', borderRadius: 4, alignItems: 'center', fontSize: 9, minWidth: 700 }}>
                            <input value={item.description} onChange={e => updatePPE(item.id, 'description', e.target.value)} placeholder="Asset name" style={{ ...inputStyle, padding: '3px 6px', fontSize: 9 }} />
                            <select value={item.category} onChange={e => updatePPE(item.id, 'category', e.target.value)} style={{ ...inputStyle, padding: '3px 4px', fontSize: 8, cursor: 'pointer' }}>
                              {Object.entries(PPE_CATEGORIES).map(([key, cat]) => (
                                <option key={key} value={key}>{cat.label} ({cat.years > 0 ? `${cat.years}yr` : 'N/A'})</option>
                              ))}
                            </select>
                            <input type="number" value={item.cost} onChange={e => updatePPE(item.id, 'cost', e.target.value)} style={{ ...numInputStyle, padding: '3px 4px', fontSize: 9 }} />
                            <span style={{ textAlign: 'center', fontSize: 8, color: '#9ca3af' }}>{categoryInfo.years > 0 ? `${categoryInfo.years}yr` : '-'}</span>
                            <input type="number" value={item.accDepBF} onChange={e => updatePPE(item.id, 'accDepBF', e.target.value)} placeholder="0" style={{ ...numInputStyle, padding: '3px 4px', fontSize: 9 }} />
                            <span style={{ fontFamily: 'monospace', fontSize: 9, color: '#fbbf24', textAlign: 'right' }}>{dep.currentDep > 0 ? fmt(dep.currentDep).replace('MYR ', '') : '-'}</span>
                            <span style={{ fontFamily: 'monospace', fontSize: 9, color: '#f87171', textAlign: 'right' }}>{fmt(dep.accDepCF).replace('MYR ', '')}</span>
                            <span style={{ fontFamily: 'monospace', fontSize: 9, color: '#34d399', textAlign: 'right', fontWeight: 600 }}>{fmt(dep.nbv).replace('MYR ', '')}</span>
                            <button onClick={() => removePPE(item.id)} style={{ width: 16, height: 16, background: 'rgba(239,68,68,0.2)', border: 'none', borderRadius: 2, color: '#f87171', cursor: 'pointer', fontSize: 9 }}>×</button>
                          </div>
                        );
                      })}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 130px 70px 40px 60px 60px 60px 60px 20px', gap: 4, padding: '8px', background: 'rgba(99,102,241,0.15)', borderRadius: 4, marginTop: 8, fontSize: 9, fontWeight: 700, minWidth: 700 }}>
                        <span>TOTAL</span>
                        <span></span>
                        <span style={{ fontFamily: 'monospace', textAlign: 'right' }}>{fmt(subledgerTotals.ppe.cost).replace('MYR ', '')}</span>
                        <span></span>
                        <span style={{ fontFamily: 'monospace', textAlign: 'right' }}>{fmt(subledgerTotals.ppe.accDepBF).replace('MYR ', '')}</span>
                        <span style={{ fontFamily: 'monospace', color: '#fbbf24', textAlign: 'right' }}>{fmt(subledgerTotals.ppe.currentDep).replace('MYR ', '')}</span>
                        <span style={{ fontFamily: 'monospace', color: '#f87171', textAlign: 'right' }}>{fmt(subledgerTotals.ppe.accDepCF).replace('MYR ', '')}</span>
                        <span style={{ fontFamily: 'monospace', color: '#34d399', textAlign: 'right' }}>{fmt(subledgerTotals.ppe.nbv).replace('MYR ', '')}</span>
                        <span></span>
                      </div>
                      
                      {/* Depreciation Summary by Category */}
                      <div style={{ marginTop: 12, padding: 10, background: 'rgba(17,24,39,0.4)', borderRadius: 6 }}>
                        <div style={{ fontSize: 10, fontWeight: 600, marginBottom: 8, color: '#a5b4fc' }}>📊 Depreciation Summary by Category</div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8 }}>
                          {(() => {
                            const byCat = {};
                            ppeRegister.forEach(item => {
                              const cat = item.category || 'OFFICE_EQUIPMENT';
                              const dep = calculatePPEDepreciation(item);
                              if (!byCat[cat]) byCat[cat] = { cost: 0, currentDep: 0, nbv: 0, count: 0 };
                              byCat[cat].cost += parseFloat(item.cost) || 0;
                              byCat[cat].currentDep += dep.currentDep;
                              byCat[cat].nbv += dep.nbv;
                              byCat[cat].count++;
                            });
                            return Object.entries(byCat).map(([cat, data]) => (
                              <div key={cat} style={{ background: 'rgba(99,102,241,0.1)', padding: 8, borderRadius: 4 }}>
                                <div style={{ fontSize: 9, fontWeight: 600, color: '#e5e7eb' }}>{PPE_CATEGORIES[cat]?.label || cat}</div>
                                <div style={{ fontSize: 8, color: '#6b7280' }}>{data.count} asset(s) • {PPE_CATEGORIES[cat]?.years || 0}yr life</div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: 9 }}>
                                  <span style={{ color: '#9ca3af' }}>Dep:</span>
                                  <span style={{ fontFamily: 'monospace', color: '#fbbf24' }}>{fmt(data.currentDep).replace('MYR ', '')}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9 }}>
                                  <span style={{ color: '#9ca3af' }}>NBV:</span>
                                  <span style={{ fontFamily: 'monospace', color: '#34d399' }}>{fmt(data.nbv).replace('MYR ', '')}</span>
                                </div>
                              </div>
                            ));
                          })()}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
              
              {/* Inventory Ledger */}
              <div style={{ background: 'rgba(31,41,55,0.6)', borderRadius: 10, border: '1px solid rgba(75,85,99,0.3)', overflow: 'hidden' }}>
                <div style={{ padding: '10px 16px', borderBottom: '1px solid rgba(75,85,99,0.2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 700, fontSize: 13 }}>📦 Inventory Ledger</span>
                  <button onClick={addInventoryItem} style={{ padding: '4px 10px', background: 'rgba(52,211,153,0.2)', border: 'none', borderRadius: 4, color: '#34d399', fontSize: 10, cursor: 'pointer' }}>+ Add Item</button>
                </div>
                <div style={{ padding: 12, maxHeight: 280, overflowY: 'auto' }}>
                  {inventoryLedger.length === 0 ? (
                    <div style={{ padding: 20, textAlign: 'center', color: '#6b7280', fontSize: 11 }}>No inventory items. Click "+ Add Item" to add.</div>
                  ) : (
                    <>
                      <div style={{ display: 'grid', gridTemplateColumns: '60px 1fr 50px 60px 70px 20px', gap: 4, padding: '4px 6px', background: 'rgba(52,211,153,0.1)', borderRadius: 4, fontSize: 8, fontWeight: 600, color: '#9ca3af', marginBottom: 4 }}>
                        <span>Code</span><span>Description</span><span>Qty</span><span>Unit Cost</span><span>Total</span><span></span>
                      </div>
                      {inventoryLedger.map((item, i) => {
                        const total = (parseFloat(item.qty) || 0) * (parseFloat(item.unitCost) || 0);
                        return (
                          <div key={item.id} style={{ display: 'grid', gridTemplateColumns: '60px 1fr 50px 60px 70px 20px', gap: 4, padding: '4px 6px', background: i % 2 ? 'transparent' : 'rgba(17,24,39,0.3)', borderRadius: 4, alignItems: 'center', fontSize: 9 }}>
                            <input value={item.itemCode} onChange={e => updateInventoryItem(item.id, 'itemCode', e.target.value)} placeholder="SKU" style={{ ...inputStyle, padding: '3px 6px', fontSize: 9 }} />
                            <input value={item.description} onChange={e => updateInventoryItem(item.id, 'description', e.target.value)} placeholder="Item name" style={{ ...inputStyle, padding: '3px 6px', fontSize: 9 }} />
                            <input type="number" value={item.qty} onChange={e => updateInventoryItem(item.id, 'qty', e.target.value)} style={{ ...numInputStyle, padding: '3px 4px', fontSize: 9 }} />
                            <input type="number" value={item.unitCost} onChange={e => updateInventoryItem(item.id, 'unitCost', e.target.value)} style={{ ...numInputStyle, padding: '3px 4px', fontSize: 9 }} />
                            <span style={{ fontFamily: 'monospace', fontSize: 9, color: '#34d399' }}>{fmt(total).replace('MYR', '')}</span>
                            <button onClick={() => removeInventoryItem(item.id)} style={{ width: 16, height: 16, background: 'rgba(239,68,68,0.2)', border: 'none', borderRadius: 2, color: '#f87171', cursor: 'pointer', fontSize: 9 }}>×</button>
                          </div>
                        );
                      })}
                      <div style={{ display: 'grid', gridTemplateColumns: '60px 1fr 50px 60px 70px 20px', gap: 4, padding: '6px', background: 'rgba(52,211,153,0.15)', borderRadius: 4, marginTop: 6, fontSize: 9, fontWeight: 700 }}>
                        <span></span><span>TOTAL</span><span></span><span></span>
                        <span style={{ fontFamily: 'monospace', color: '#34d399' }}>{fmt(subledgerTotals.inventory).replace('MYR', '')}</span>
                        <span></span>
                      </div>
                    </>
                  )}
                </div>
              </div>
              
              {/* Trade Receivables */}
              <div style={{ background: 'rgba(31,41,55,0.6)', borderRadius: 10, border: '1px solid rgba(75,85,99,0.3)', overflow: 'hidden' }}>
                <div style={{ padding: '10px 16px', borderBottom: '1px solid rgba(75,85,99,0.2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 700, fontSize: 13 }}>👥 Trade Receivables (Debtors)</span>
                  <button onClick={addReceivable} style={{ padding: '4px 10px', background: 'rgba(251,191,36,0.2)', border: 'none', borderRadius: 4, color: '#fbbf24', fontSize: 10, cursor: 'pointer' }}>+ Add Customer</button>
                </div>
                <div style={{ padding: 12, maxHeight: 280, overflowY: 'auto' }}>
                  {tradeReceivables.length === 0 ? (
                    <div style={{ padding: 20, textAlign: 'center', color: '#6b7280', fontSize: 11 }}>No receivables. Click "+ Add Customer" to add.</div>
                  ) : (
                    <>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 60px 70px 60px 60px 20px', gap: 4, padding: '4px 6px', background: 'rgba(251,191,36,0.1)', borderRadius: 4, fontSize: 8, fontWeight: 600, color: '#9ca3af', marginBottom: 4 }}>
                        <span>Customer</span><span>Invoice</span><span>Amount</span><span>Paid</span><span>Balance</span><span></span>
                      </div>
                      {tradeReceivables.map((item, i) => {
                        const balance = (parseFloat(item.amount) || 0) - (parseFloat(item.paid) || 0);
                        return (
                          <div key={item.id} style={{ display: 'grid', gridTemplateColumns: '1fr 60px 70px 60px 60px 20px', gap: 4, padding: '4px 6px', background: i % 2 ? 'transparent' : 'rgba(17,24,39,0.3)', borderRadius: 4, alignItems: 'center', fontSize: 9 }}>
                            <input value={item.customerName} onChange={e => updateReceivable(item.id, 'customerName', e.target.value)} placeholder="Customer" style={{ ...inputStyle, padding: '3px 6px', fontSize: 9 }} />
                            <input value={item.invoiceNo} onChange={e => updateReceivable(item.id, 'invoiceNo', e.target.value)} placeholder="INV#" style={{ ...inputStyle, padding: '3px 6px', fontSize: 9 }} />
                            <input type="number" value={item.amount} onChange={e => updateReceivable(item.id, 'amount', e.target.value)} style={{ ...numInputStyle, padding: '3px 4px', fontSize: 9 }} />
                            <input type="number" value={item.paid} onChange={e => updateReceivable(item.id, 'paid', e.target.value)} style={{ ...numInputStyle, padding: '3px 4px', fontSize: 9 }} />
                            <span style={{ fontFamily: 'monospace', fontSize: 9, color: balance > 0 ? '#fbbf24' : '#34d399' }}>{fmt(balance).replace('MYR', '')}</span>
                            <button onClick={() => removeReceivable(item.id)} style={{ width: 16, height: 16, background: 'rgba(239,68,68,0.2)', border: 'none', borderRadius: 2, color: '#f87171', cursor: 'pointer', fontSize: 9 }}>×</button>
                          </div>
                        );
                      })}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 60px 70px 60px 60px 20px', gap: 4, padding: '6px', background: 'rgba(251,191,36,0.15)', borderRadius: 4, marginTop: 6, fontSize: 9, fontWeight: 700 }}>
                        <span>TOTAL</span><span></span>
                        <span style={{ fontFamily: 'monospace' }}>{fmt(tradeReceivables.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0)).replace('MYR', '')}</span>
                        <span style={{ fontFamily: 'monospace' }}>{fmt(tradeReceivables.reduce((s, i) => s + (parseFloat(i.paid) || 0), 0)).replace('MYR', '')}</span>
                        <span style={{ fontFamily: 'monospace', color: '#fbbf24' }}>{fmt(subledgerTotals.receivables).replace('MYR', '')}</span>
                        <span></span>
                      </div>
                    </>
                  )}
                </div>
              </div>
              
              {/* Trade Payables */}
              <div style={{ background: 'rgba(31,41,55,0.6)', borderRadius: 10, border: '1px solid rgba(75,85,99,0.3)', overflow: 'hidden' }}>
                <div style={{ padding: '10px 16px', borderBottom: '1px solid rgba(75,85,99,0.2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 700, fontSize: 13 }}>🏪 Trade Payables (Creditors)</span>
                  <button onClick={addPayable} style={{ padding: '4px 10px', background: 'rgba(239,68,68,0.2)', border: 'none', borderRadius: 4, color: '#f87171', fontSize: 10, cursor: 'pointer' }}>+ Add Supplier</button>
                </div>
                <div style={{ padding: 12, maxHeight: 280, overflowY: 'auto' }}>
                  {tradePayables.length === 0 ? (
                    <div style={{ padding: 20, textAlign: 'center', color: '#6b7280', fontSize: 11 }}>No payables. Click "+ Add Supplier" to add.</div>
                  ) : (
                    <>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 60px 70px 60px 60px 20px', gap: 4, padding: '4px 6px', background: 'rgba(239,68,68,0.1)', borderRadius: 4, fontSize: 8, fontWeight: 600, color: '#9ca3af', marginBottom: 4 }}>
                        <span>Supplier</span><span>Invoice</span><span>Amount</span><span>Paid</span><span>Balance</span><span></span>
                      </div>
                      {tradePayables.map((item, i) => {
                        const balance = (parseFloat(item.amount) || 0) - (parseFloat(item.paid) || 0);
                        return (
                          <div key={item.id} style={{ display: 'grid', gridTemplateColumns: '1fr 60px 70px 60px 60px 20px', gap: 4, padding: '4px 6px', background: i % 2 ? 'transparent' : 'rgba(17,24,39,0.3)', borderRadius: 4, alignItems: 'center', fontSize: 9 }}>
                            <input value={item.supplierName} onChange={e => updatePayable(item.id, 'supplierName', e.target.value)} placeholder="Supplier" style={{ ...inputStyle, padding: '3px 6px', fontSize: 9 }} />
                            <input value={item.invoiceNo} onChange={e => updatePayable(item.id, 'invoiceNo', e.target.value)} placeholder="INV#" style={{ ...inputStyle, padding: '3px 6px', fontSize: 9 }} />
                            <input type="number" value={item.amount} onChange={e => updatePayable(item.id, 'amount', e.target.value)} style={{ ...numInputStyle, padding: '3px 4px', fontSize: 9 }} />
                            <input type="number" value={item.paid} onChange={e => updatePayable(item.id, 'paid', e.target.value)} style={{ ...numInputStyle, padding: '3px 4px', fontSize: 9 }} />
                            <span style={{ fontFamily: 'monospace', fontSize: 9, color: balance > 0 ? '#f87171' : '#34d399' }}>{fmt(balance).replace('MYR', '')}</span>
                            <button onClick={() => removePayable(item.id)} style={{ width: 16, height: 16, background: 'rgba(239,68,68,0.2)', border: 'none', borderRadius: 2, color: '#f87171', cursor: 'pointer', fontSize: 9 }}>×</button>
                          </div>
                        );
                      })}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 60px 70px 60px 60px 20px', gap: 4, padding: '6px', background: 'rgba(239,68,68,0.15)', borderRadius: 4, marginTop: 6, fontSize: 9, fontWeight: 700 }}>
                        <span>TOTAL</span><span></span>
                        <span style={{ fontFamily: 'monospace' }}>{fmt(tradePayables.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0)).replace('MYR', '')}</span>
                        <span style={{ fontFamily: 'monospace' }}>{fmt(tradePayables.reduce((s, i) => s + (parseFloat(i.paid) || 0), 0)).replace('MYR', '')}</span>
                        <span style={{ fontFamily: 'monospace', color: '#f87171' }}>{fmt(subledgerTotals.payables).replace('MYR', '')}</span>
                        <span></span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
            
            {/* Second row: Other Debtors, Other Creditors, Cash & Bank */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginTop: 16 }}>
              {/* Other Debtors */}
              <div style={{ background: 'rgba(31,41,55,0.6)', borderRadius: 10, border: '1px solid rgba(75,85,99,0.3)', overflow: 'hidden' }}>
                <div style={{ padding: '10px 16px', borderBottom: '1px solid rgba(75,85,99,0.2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 700, fontSize: 13 }}>📋 Other Debtors</span>
                  <button onClick={addOtherDebtor} style={{ padding: '4px 10px', background: 'rgba(139,92,246,0.2)', border: 'none', borderRadius: 4, color: '#c084fc', fontSize: 10, cursor: 'pointer' }}>+ Add</button>
                </div>
                <div style={{ padding: 12, maxHeight: 250, overflowY: 'auto' }}>
                  {otherDebtors.length === 0 ? (
                    <div style={{ padding: 20, textAlign: 'center', color: '#6b7280', fontSize: 11 }}>No items. Click "+ Add" to add deposits, prepayments, etc.</div>
                  ) : (
                    <>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 70px 20px', gap: 4, padding: '4px 6px', background: 'rgba(139,92,246,0.1)', borderRadius: 4, fontSize: 8, fontWeight: 600, color: '#9ca3af', marginBottom: 4 }}>
                        <span>Description</span><span>Type</span><span style={{ textAlign: 'right' }}>Amount</span><span></span>
                      </div>
                      {otherDebtors.map((item, i) => (
                        <div key={item.id} style={{ display: 'grid', gridTemplateColumns: '1fr 80px 70px 20px', gap: 4, padding: '4px 6px', background: i % 2 ? 'transparent' : 'rgba(17,24,39,0.3)', borderRadius: 4, alignItems: 'center', fontSize: 9 }}>
                          <input value={item.description} onChange={e => updateOtherDebtor(item.id, 'description', e.target.value)} placeholder="Description" style={{ ...inputStyle, padding: '3px 6px', fontSize: 9 }} />
                          <select value={item.type} onChange={e => updateOtherDebtor(item.id, 'type', e.target.value)} style={{ ...inputStyle, padding: '3px 4px', fontSize: 8, cursor: 'pointer' }}>
                            <option value="DEPOSIT">Deposit</option>
                            <option value="PREPAID">Prepaid</option>
                            <option value="ADVANCE">Advance</option>
                            <option value="OTHER">Other</option>
                          </select>
                          <input type="number" value={item.amount} onChange={e => updateOtherDebtor(item.id, 'amount', e.target.value)} style={{ ...numInputStyle, padding: '3px 4px', fontSize: 9 }} />
                          <button onClick={() => removeOtherDebtor(item.id)} style={{ width: 16, height: 16, background: 'rgba(239,68,68,0.2)', border: 'none', borderRadius: 2, color: '#f87171', cursor: 'pointer', fontSize: 9 }}>×</button>
                        </div>
                      ))}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 70px 20px', gap: 4, padding: '6px', background: 'rgba(139,92,246,0.15)', borderRadius: 4, marginTop: 6, fontSize: 9, fontWeight: 700 }}>
                        <span>TOTAL</span><span></span>
                        <span style={{ fontFamily: 'monospace', color: '#c084fc', textAlign: 'right' }}>{fmt(subledgerTotals.otherDebtors).replace('MYR', '')}</span>
                        <span></span>
                      </div>
                    </>
                  )}
                </div>
              </div>
              
              {/* Other Creditors */}
              <div style={{ background: 'rgba(31,41,55,0.6)', borderRadius: 10, border: '1px solid rgba(75,85,99,0.3)', overflow: 'hidden' }}>
                <div style={{ padding: '10px 16px', borderBottom: '1px solid rgba(75,85,99,0.2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 700, fontSize: 13 }}>📑 Other Creditors</span>
                  <button onClick={addOtherCreditor} style={{ padding: '4px 10px', background: 'rgba(244,114,182,0.2)', border: 'none', borderRadius: 4, color: '#f472b6', fontSize: 10, cursor: 'pointer' }}>+ Add</button>
                </div>
                <div style={{ padding: 12, maxHeight: 250, overflowY: 'auto' }}>
                  {otherCreditors.length === 0 ? (
                    <div style={{ padding: 20, textAlign: 'center', color: '#6b7280', fontSize: 11 }}>No items. Click "+ Add" to add accruals, deposits received, etc.</div>
                  ) : (
                    <>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 70px 20px', gap: 4, padding: '4px 6px', background: 'rgba(244,114,182,0.1)', borderRadius: 4, fontSize: 8, fontWeight: 600, color: '#9ca3af', marginBottom: 4 }}>
                        <span>Description</span><span>Type</span><span style={{ textAlign: 'right' }}>Amount</span><span></span>
                      </div>
                      {otherCreditors.map((item, i) => (
                        <div key={item.id} style={{ display: 'grid', gridTemplateColumns: '1fr 80px 70px 20px', gap: 4, padding: '4px 6px', background: i % 2 ? 'transparent' : 'rgba(17,24,39,0.3)', borderRadius: 4, alignItems: 'center', fontSize: 9 }}>
                          <input value={item.description} onChange={e => updateOtherCreditor(item.id, 'description', e.target.value)} placeholder="Description" style={{ ...inputStyle, padding: '3px 6px', fontSize: 9 }} />
                          <select value={item.type} onChange={e => updateOtherCreditor(item.id, 'type', e.target.value)} style={{ ...inputStyle, padding: '3px 4px', fontSize: 8, cursor: 'pointer' }}>
                            <option value="ACCRUAL">Accrual</option>
                            <option value="DEPOSIT_RECEIVED">Deposit Received</option>
                            <option value="ADVANCE_RECEIVED">Advance Received</option>
                            <option value="OTHER">Other</option>
                          </select>
                          <input type="number" value={item.amount} onChange={e => updateOtherCreditor(item.id, 'amount', e.target.value)} style={{ ...numInputStyle, padding: '3px 4px', fontSize: 9 }} />
                          <button onClick={() => removeOtherCreditor(item.id)} style={{ width: 16, height: 16, background: 'rgba(239,68,68,0.2)', border: 'none', borderRadius: 2, color: '#f87171', cursor: 'pointer', fontSize: 9 }}>×</button>
                        </div>
                      ))}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 70px 20px', gap: 4, padding: '6px', background: 'rgba(244,114,182,0.15)', borderRadius: 4, marginTop: 6, fontSize: 9, fontWeight: 700 }}>
                        <span>TOTAL</span><span></span>
                        <span style={{ fontFamily: 'monospace', color: '#f472b6', textAlign: 'right' }}>{fmt(subledgerTotals.otherCreditors).replace('MYR', '')}</span>
                        <span></span>
                      </div>
                    </>
                  )}
                </div>
              </div>
              
              {/* Cash & Bank */}
              <div style={{ background: 'rgba(31,41,55,0.6)', borderRadius: 10, border: '1px solid rgba(75,85,99,0.3)', overflow: 'hidden' }}>
                <div style={{ padding: '10px 16px', borderBottom: '1px solid rgba(75,85,99,0.2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 700, fontSize: 13 }}>🏦 Cash & Bank</span>
                  <button onClick={addCashBankAccount} style={{ padding: '4px 10px', background: 'rgba(59,130,246,0.2)', border: 'none', borderRadius: 4, color: '#60a5fa', fontSize: 10, cursor: 'pointer' }}>+ Add Account</button>
                </div>
                <div style={{ padding: 12, maxHeight: 250, overflowY: 'auto' }}>
                  {cashBankLedger.length === 0 ? (
                    <div style={{ padding: 20, textAlign: 'center', color: '#6b7280', fontSize: 11 }}>No accounts. Click "+ Add Account" to add bank accounts.</div>
                  ) : (
                    <>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 70px 70px 20px', gap: 4, padding: '4px 6px', background: 'rgba(59,130,246,0.1)', borderRadius: 4, fontSize: 8, fontWeight: 600, color: '#9ca3af', marginBottom: 4 }}>
                        <span>Account Name</span><span style={{ textAlign: 'right' }}>Opening</span><span style={{ textAlign: 'right' }}>Closing</span><span></span>
                      </div>
                      {cashBankLedger.map((item, i) => (
                        <div key={item.id} style={{ display: 'grid', gridTemplateColumns: '1fr 70px 70px 20px', gap: 4, padding: '4px 6px', background: i % 2 ? 'transparent' : 'rgba(17,24,39,0.3)', borderRadius: 4, alignItems: 'center', fontSize: 9 }}>
                          <input value={item.accountName} onChange={e => updateCashBankAccount(item.id, 'accountName', e.target.value)} placeholder="Account name" style={{ ...inputStyle, padding: '3px 6px', fontSize: 9 }} />
                          <input type="number" value={item.openingBalance} onChange={e => updateCashBankAccount(item.id, 'openingBalance', e.target.value)} style={{ ...numInputStyle, padding: '3px 4px', fontSize: 9 }} />
                          <input type="number" value={item.closingBalance} onChange={e => updateCashBankAccount(item.id, 'closingBalance', e.target.value)} style={{ ...numInputStyle, padding: '3px 4px', fontSize: 9 }} />
                          <button onClick={() => removeCashBankAccount(item.id)} style={{ width: 16, height: 16, background: 'rgba(239,68,68,0.2)', border: 'none', borderRadius: 2, color: '#f87171', cursor: 'pointer', fontSize: 9 }}>×</button>
                        </div>
                      ))}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 70px 70px 20px', gap: 4, padding: '6px', background: 'rgba(59,130,246,0.15)', borderRadius: 4, marginTop: 6, fontSize: 9, fontWeight: 700 }}>
                        <span>TOTAL</span>
                        <span style={{ fontFamily: 'monospace', color: '#9ca3af', textAlign: 'right' }}>{fmt(cashBankLedger.reduce((s, i) => s + (parseFloat(i.openingBalance) || 0), 0)).replace('MYR', '')}</span>
                        <span style={{ fontFamily: 'monospace', color: '#60a5fa', textAlign: 'right' }}>{fmt(subledgerTotals.cashBank).replace('MYR', '')}</span>
                        <span></span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
            
            {/* Third row: Borrowings */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 16 }}>
              {/* Short-Term Borrowings */}
              <div style={{ background: 'rgba(31,41,55,0.6)', borderRadius: 10, border: '1px solid rgba(75,85,99,0.3)', overflow: 'hidden' }}>
                <div style={{ padding: '10px 16px', borderBottom: '1px solid rgba(75,85,99,0.2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 700, fontSize: 13 }}>💳 Short-Term Borrowings</span>
                  <button onClick={addShortTermBorrowing} style={{ padding: '4px 10px', background: 'rgba(251,146,60,0.2)', border: 'none', borderRadius: 4, color: '#fb923c', fontSize: 10, cursor: 'pointer' }}>+ Add Loan</button>
                </div>
                <div style={{ padding: 12, maxHeight: 280, overflowY: 'auto' }}>
                  {shortTermBorrowings.length === 0 ? (
                    <div style={{ padding: 20, textAlign: 'center', color: '#6b7280', fontSize: 11 }}>No short-term borrowings. Click "+ Add Loan" to add overdraft, short-term loans, etc.</div>
                  ) : (
                    <>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 65px 65px 65px 20px', gap: 4, padding: '4px 6px', background: 'rgba(251,146,60,0.1)', borderRadius: 4, fontSize: 8, fontWeight: 600, color: '#9ca3af', marginBottom: 4 }}>
                        <span>Lender</span><span>Type</span><span style={{ textAlign: 'right' }}>Opening</span><span style={{ textAlign: 'right' }}>Drawdown</span><span style={{ textAlign: 'right' }}>Repaid</span><span></span>
                      </div>
                      {shortTermBorrowings.map((item, i) => (
                        <div key={item.id} style={{ display: 'grid', gridTemplateColumns: '1fr 80px 65px 65px 65px 20px', gap: 4, padding: '4px 6px', background: i % 2 ? 'transparent' : 'rgba(17,24,39,0.3)', borderRadius: 4, alignItems: 'center', fontSize: 9 }}>
                          <input value={item.lender} onChange={e => updateShortTermBorrowing(item.id, 'lender', e.target.value)} placeholder="Lender name" style={{ ...inputStyle, padding: '3px 6px', fontSize: 9 }} />
                          <select value={item.loanType} onChange={e => updateShortTermBorrowing(item.id, 'loanType', e.target.value)} style={{ ...inputStyle, padding: '3px 4px', fontSize: 8, cursor: 'pointer' }}>
                            <option value="BANK_OVERDRAFT">Overdraft</option>
                            <option value="SHORT_TERM_LOAN">ST Loan</option>
                            <option value="HP_CURRENT">HP (Current)</option>
                            <option value="TRADE_FINANCING">Trade Finance</option>
                            <option value="OTHER">Other</option>
                          </select>
                          <input type="number" value={item.openingBalance} onChange={e => updateShortTermBorrowing(item.id, 'openingBalance', e.target.value)} placeholder="0" style={{ ...numInputStyle, padding: '3px 4px', fontSize: 9 }} />
                          <input type="number" value={item.drawdown} onChange={e => updateShortTermBorrowing(item.id, 'drawdown', e.target.value)} placeholder="0" style={{ ...numInputStyle, padding: '3px 4px', fontSize: 9, background: 'rgba(74,222,128,0.1)' }} />
                          <input type="number" value={item.repayment} onChange={e => updateShortTermBorrowing(item.id, 'repayment', e.target.value)} placeholder="0" style={{ ...numInputStyle, padding: '3px 4px', fontSize: 9, background: 'rgba(248,113,113,0.1)' }} />
                          <button onClick={() => removeShortTermBorrowing(item.id)} style={{ width: 16, height: 16, background: 'rgba(239,68,68,0.2)', border: 'none', borderRadius: 2, color: '#f87171', cursor: 'pointer', fontSize: 9 }}>×</button>
                        </div>
                      ))}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 65px 65px 65px 20px', gap: 4, padding: '6px', background: 'rgba(251,146,60,0.15)', borderRadius: 4, marginTop: 6, fontSize: 9, fontWeight: 700 }}>
                        <span>TOTAL</span><span></span>
                        <span style={{ fontFamily: 'monospace', color: '#9ca3af', textAlign: 'right' }}>{fmt(subledgerTotals.stBorrOpening || 0).replace('MYR', '')}</span>
                        <span style={{ fontFamily: 'monospace', color: '#4ade80', textAlign: 'right' }}>{fmt(shortTermBorrowings.reduce((s, i) => s + (parseFloat(i.drawdown) || 0), 0)).replace('MYR', '')}</span>
                        <span style={{ fontFamily: 'monospace', color: '#f87171', textAlign: 'right' }}>{fmt(shortTermBorrowings.reduce((s, i) => s + (parseFloat(i.repayment) || 0), 0)).replace('MYR', '')}</span>
                        <span></span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 6px', background: 'rgba(251,146,60,0.25)', borderRadius: 4, marginTop: 4, fontSize: 10, fontWeight: 700 }}>
                        <span>Closing Balance:</span>
                        <span style={{ fontFamily: 'monospace', color: '#fb923c' }}>{fmt(subledgerTotals.shortTermBorrowings || 0)}</span>
                      </div>
                    </>
                  )}
                </div>
              </div>
              
              {/* Long-Term Borrowings */}
              <div style={{ background: 'rgba(31,41,55,0.6)', borderRadius: 10, border: '1px solid rgba(75,85,99,0.3)', overflow: 'hidden' }}>
                <div style={{ padding: '10px 16px', borderBottom: '1px solid rgba(75,85,99,0.2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 700, fontSize: 13 }}>🏛️ Long-Term Borrowings</span>
                  <button onClick={addLongTermBorrowing} style={{ padding: '4px 10px', background: 'rgba(168,85,247,0.2)', border: 'none', borderRadius: 4, color: '#a855f7', fontSize: 10, cursor: 'pointer' }}>+ Add Loan</button>
                </div>
                <div style={{ padding: 12, maxHeight: 280, overflowY: 'auto' }}>
                  {longTermBorrowings.length === 0 ? (
                    <div style={{ padding: 20, textAlign: 'center', color: '#6b7280', fontSize: 11 }}>No long-term borrowings. Click "+ Add Loan" to add term loans, HP, mortgages, etc.</div>
                  ) : (
                    <>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 65px 65px 65px 20px', gap: 4, padding: '4px 6px', background: 'rgba(168,85,247,0.1)', borderRadius: 4, fontSize: 8, fontWeight: 600, color: '#9ca3af', marginBottom: 4 }}>
                        <span>Lender</span><span>Type</span><span style={{ textAlign: 'right' }}>Opening</span><span style={{ textAlign: 'right' }}>Drawdown</span><span style={{ textAlign: 'right' }}>Repaid</span><span></span>
                      </div>
                      {longTermBorrowings.map((item, i) => (
                        <div key={item.id} style={{ display: 'grid', gridTemplateColumns: '1fr 80px 65px 65px 65px 20px', gap: 4, padding: '4px 6px', background: i % 2 ? 'transparent' : 'rgba(17,24,39,0.3)', borderRadius: 4, alignItems: 'center', fontSize: 9 }}>
                          <input value={item.lender} onChange={e => updateLongTermBorrowing(item.id, 'lender', e.target.value)} placeholder="Lender name" style={{ ...inputStyle, padding: '3px 6px', fontSize: 9 }} />
                          <select value={item.loanType} onChange={e => updateLongTermBorrowing(item.id, 'loanType', e.target.value)} style={{ ...inputStyle, padding: '3px 4px', fontSize: 8, cursor: 'pointer' }}>
                            <option value="TERM_LOAN">Term Loan</option>
                            <option value="HIRE_PURCHASE">Hire Purchase</option>
                            <option value="MORTGAGE">Mortgage</option>
                            <option value="DIRECTORS_LOAN">Directors Loan</option>
                            <option value="RELATED_PARTY_LOAN">Related Party</option>
                            <option value="OTHER">Other</option>
                          </select>
                          <input type="number" value={item.openingBalance} onChange={e => updateLongTermBorrowing(item.id, 'openingBalance', e.target.value)} placeholder="0" style={{ ...numInputStyle, padding: '3px 4px', fontSize: 9 }} />
                          <input type="number" value={item.drawdown} onChange={e => updateLongTermBorrowing(item.id, 'drawdown', e.target.value)} placeholder="0" style={{ ...numInputStyle, padding: '3px 4px', fontSize: 9, background: 'rgba(74,222,128,0.1)' }} />
                          <input type="number" value={item.repayment} onChange={e => updateLongTermBorrowing(item.id, 'repayment', e.target.value)} placeholder="0" style={{ ...numInputStyle, padding: '3px 4px', fontSize: 9, background: 'rgba(248,113,113,0.1)' }} />
                          <button onClick={() => removeLongTermBorrowing(item.id)} style={{ width: 16, height: 16, background: 'rgba(239,68,68,0.2)', border: 'none', borderRadius: 2, color: '#f87171', cursor: 'pointer', fontSize: 9 }}>×</button>
                        </div>
                      ))}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 65px 65px 65px 20px', gap: 4, padding: '6px', background: 'rgba(168,85,247,0.15)', borderRadius: 4, marginTop: 6, fontSize: 9, fontWeight: 700 }}>
                        <span>TOTAL</span><span></span>
                        <span style={{ fontFamily: 'monospace', color: '#9ca3af', textAlign: 'right' }}>{fmt(subledgerTotals.ltBorrOpening || 0).replace('MYR', '')}</span>
                        <span style={{ fontFamily: 'monospace', color: '#4ade80', textAlign: 'right' }}>{fmt(longTermBorrowings.reduce((s, i) => s + (parseFloat(i.drawdown) || 0), 0)).replace('MYR', '')}</span>
                        <span style={{ fontFamily: 'monospace', color: '#f87171', textAlign: 'right' }}>{fmt(longTermBorrowings.reduce((s, i) => s + (parseFloat(i.repayment) || 0), 0)).replace('MYR', '')}</span>
                        <span></span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 6px', background: 'rgba(168,85,247,0.25)', borderRadius: 4, marginTop: 4, fontSize: 10, fontWeight: 700 }}>
                        <span>Closing Balance:</span>
                        <span style={{ fontFamily: 'monospace', color: '#a855f7' }}>{fmt(subledgerTotals.longTermBorrowings || 0)}</span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
            
            {/* Reconciliation Summary */}
            <div style={{ marginTop: 16, padding: 16, background: 'rgba(31,41,55,0.6)', borderRadius: 10, border: '1px solid rgba(75,85,99,0.3)' }}>
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 12 }}>📊 Subledger to GL Reconciliation</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
                <div>
                  <div style={{ fontSize: 10, color: '#9ca3af', marginBottom: 4 }}>PPE (NBV)</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                    <span>Subledger:</span>
                    <span style={{ fontFamily: 'monospace', color: '#a5b4fc' }}>{fmt(subledgerTotals.ppe.nbv)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                    <span>GL (Opening):</span>
                    <span style={{ fontFamily: 'monospace', color: '#9ca3af' }}>{fmt((parseFloat(ob.fixed_asset) || 0) - Math.abs(parseFloat(ob.accumulated_depreciation) || 0))}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 700, marginTop: 4, paddingTop: 4, borderTop: '1px solid rgba(75,85,99,0.3)' }}>
                    <span>Diff:</span>
                    {(() => {
                      const glNBV = (parseFloat(ob.fixed_asset) || 0) - Math.abs(parseFloat(ob.accumulated_depreciation) || 0);
                      const diff = subledgerTotals.ppe.nbv - glNBV;
                      return (
                        <span style={{ fontFamily: 'monospace', color: Math.abs(diff) < 1 ? '#34d399' : '#fbbf24' }}>
                          {fmt(diff)}
                        </span>
                      );
                    })()}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: '#9ca3af', marginBottom: 4 }}>Inventory</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                    <span>Subledger:</span>
                    <span style={{ fontFamily: 'monospace', color: '#34d399' }}>{fmt(subledgerTotals.inventory)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                    <span>GL (Opening):</span>
                    <span style={{ fontFamily: 'monospace', color: '#9ca3af' }}>{fmt(parseFloat(ob.inventory) || 0)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 700, marginTop: 4, paddingTop: 4, borderTop: '1px solid rgba(75,85,99,0.3)' }}>
                    <span>Diff:</span>
                    <span style={{ fontFamily: 'monospace', color: Math.abs(subledgerTotals.inventory - (parseFloat(ob.inventory) || 0)) < 1 ? '#34d399' : '#fbbf24' }}>
                      {fmt(subledgerTotals.inventory - (parseFloat(ob.inventory) || 0))}
                    </span>
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: '#9ca3af', marginBottom: 4 }}>Trade Receivables</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                    <span>Subledger:</span>
                    <span style={{ fontFamily: 'monospace', color: '#fbbf24' }}>{fmt(subledgerTotals.receivables)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                    <span>GL (Opening):</span>
                    <span style={{ fontFamily: 'monospace', color: '#9ca3af' }}>{fmt(parseFloat(ob.trade_receivables) || 0)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 700, marginTop: 4, paddingTop: 4, borderTop: '1px solid rgba(75,85,99,0.3)' }}>
                    <span>Diff:</span>
                    <span style={{ fontFamily: 'monospace', color: Math.abs(subledgerTotals.receivables - (parseFloat(ob.trade_receivables) || 0)) < 1 ? '#34d399' : '#fbbf24' }}>
                      {fmt(subledgerTotals.receivables - (parseFloat(ob.trade_receivables) || 0))}
                    </span>
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: '#9ca3af', marginBottom: 4 }}>Trade Payables</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                    <span>Subledger:</span>
                    <span style={{ fontFamily: 'monospace', color: '#f87171' }}>{fmt(subledgerTotals.payables)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                    <span>GL (Opening):</span>
                    <span style={{ fontFamily: 'monospace', color: '#9ca3af' }}>{fmt(Math.abs(parseFloat(ob.trade_payables) || 0))}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 700, marginTop: 4, paddingTop: 4, borderTop: '1px solid rgba(75,85,99,0.3)' }}>
                    <span>Diff:</span>
                    <span style={{ fontFamily: 'monospace', color: Math.abs(subledgerTotals.payables - Math.abs(parseFloat(ob.trade_payables) || 0)) < 1 ? '#34d399' : '#fbbf24' }}>
                      {fmt(subledgerTotals.payables - Math.abs(parseFloat(ob.trade_payables) || 0))}
                    </span>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Borrowings Reconciliation Row */}
            <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
              <div>
                <div style={{ fontSize: 10, color: '#9ca3af', marginBottom: 4 }}>Short-Term Borrowings</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                  <span>Subledger (Closing):</span>
                  <span style={{ fontFamily: 'monospace', color: '#fb923c' }}>{fmt(subledgerTotals.shortTermBorrowings || 0)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                  <span>Opening Balance:</span>
                  <span style={{ fontFamily: 'monospace', color: '#9ca3af' }}>{fmt(subledgerTotals.stBorrOpening || 0)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 700, marginTop: 4, paddingTop: 4, borderTop: '1px solid rgba(75,85,99,0.3)' }}>
                  <span>Net Movement:</span>
                  {(() => {
                    const movement = (subledgerTotals.shortTermBorrowings || 0) - (subledgerTotals.stBorrOpening || 0);
                    return (
                      <span style={{ fontFamily: 'monospace', color: Math.abs(movement) < 1 ? '#34d399' : '#fbbf24' }}>
                        {fmt(movement)}
                      </span>
                    );
                  })()}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: '#9ca3af', marginBottom: 4 }}>Long-Term Borrowings</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                  <span>Subledger (Closing):</span>
                  <span style={{ fontFamily: 'monospace', color: '#a855f7' }}>{fmt(subledgerTotals.longTermBorrowings || 0)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                  <span>Opening Balance:</span>
                  <span style={{ fontFamily: 'monospace', color: '#9ca3af' }}>{fmt(subledgerTotals.ltBorrOpening || 0)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 700, marginTop: 4, paddingTop: 4, borderTop: '1px solid rgba(75,85,99,0.3)' }}>
                  <span>Net Movement:</span>
                  {(() => {
                    const movement = (subledgerTotals.longTermBorrowings || 0) - (subledgerTotals.ltBorrOpening || 0);
                    return (
                      <span style={{ fontFamily: 'monospace', color: Math.abs(movement) < 1 ? '#34d399' : '#fbbf24' }}>
                        {fmt(movement)}
                      </span>
                    );
                  })()}
                </div>
              </div>
            </div>
            
            {/* Tip */}
            <div style={{ marginTop: 16, padding: 12, background: 'rgba(99,102,241,0.1)', borderRadius: 8, border: '1px solid rgba(99,102,241,0.2)' }}>
              <div style={{ fontSize: 11, color: '#a5b4fc' }}>
                💡 <strong>Subledger Reconciliation</strong>: Compares subledger totals (CY closing) with GL opening balances (PY closing). 
                The difference represents <strong>movement during the year</strong>. 
                Green = no movement or matched, Yellow = movement exists (verify against transactions).
                For PPE, difference includes depreciation impact.
              </div>
            </div>
          </div>
        )}

        {/* Balances Tab */}
        {tab === 'balances' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <button onClick={goBack} style={backBtnStyle}>← Subledger</button>
              <span style={{ fontSize: 12, color: '#9ca3af' }}>Set opening balances, then generate FS</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div style={{ background: 'rgba(31,41,55,0.6)', borderRadius: 10, border: '1px solid rgba(75,85,99,0.3)', overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(75,85,99,0.2)', fontWeight: 700, fontSize: 14 }}>Opening Balances</div>
              <div style={{ padding: 16 }}>
                <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                  <input placeholder="Account" value={newOb.acc} onChange={e => setNewOb(p => ({ ...p, acc: e.target.value }))} style={{ ...inputStyle, flex: 1 }} />
                  <input type="number" placeholder="Amount" value={newOb.amt} onChange={e => setNewOb(p => ({ ...p, amt: e.target.value }))} style={{ ...inputStyle, width: 100 }} />
                  <button onClick={addOb} style={{ padding: '6px 12px', background: 'linear-gradient(135deg, #6366f1, #4f46e5)', border: 'none', borderRadius: 6, color: '#fff', fontWeight: 700, cursor: 'pointer' }}>+</button>
                </div>
                {Object.keys(ob).length === 0 ? (
                  <div style={{ padding: 16, textAlign: 'center', color: '#6b7280', fontSize: 12 }}>No balances. Use "Prior FS" tab.</div>
                ) : (
                  <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                    {Object.entries(ob).map(([a, v], i) => (
                      <div key={a} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 8px', background: i % 2 ? 'transparent' : 'rgba(17,24,39,0.3)', borderRadius: 4, fontSize: 11 }}>
                        <span style={{ textTransform: 'capitalize' }}>{a.replace(/_/g, ' ')}</span>
                        <span style={{ fontFamily: 'monospace', fontWeight: 600, color: v >= 0 ? '#34d399' : '#f87171' }}>{fmt(v)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div style={{ background: 'rgba(31,41,55,0.6)', borderRadius: 10, border: '1px solid rgba(75,85,99,0.3)', overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(75,85,99,0.2)', fontWeight: 700, fontSize: 14 }}>Generate</div>
              <div style={{ padding: 16 }}>
                {[['Banks', banks.length], ['Transactions', txs.length], ['Opening Balances', Object.keys(ob).length], ['Suspense', txs.filter(t => FSEngine.classify(t.description).code === 'SUSPENSE').length]].map(([l, v], i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(75,85,99,0.15)', fontSize: 12 }}>
                    <span>{l}</span><span style={{ fontWeight: 600 }}>{v}</span>
                  </div>
                ))}
                <button onClick={run} disabled={!txs.length || busy} style={{ width: '100%', marginTop: 16, padding: '12px', background: txs.length ? 'linear-gradient(135deg, #8b5cf6, #7c3aed)' : 'rgba(75,85,99,0.3)', border: 'none', borderRadius: 8, color: '#fff', fontSize: 14, fontWeight: 700, cursor: txs.length ? 'pointer' : 'not-allowed' }}>
                  {busy ? '⚙️ Processing...' : '🚀 Generate FS'}
                </button>
              </div>
            </div>
          </div>
          </div>
        )}

        {/* Journal Tab */}
        {tab === 'journal' && res && (
          <div style={{ background: 'rgba(31,41,55,0.6)', borderRadius: 10, border: '1px solid rgba(75,85,99,0.3)', overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(75,85,99,0.2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <button onClick={goBack} style={backBtnStyle}>← Back</button>
                <span style={{ fontWeight: 700, fontSize: 14 }}>Journal Entries</span>
                <span style={{ background: 'rgba(52,211,153,0.2)', color: '#34d399', padding: '2px 8px', borderRadius: 8, fontSize: 10, fontWeight: 600 }}>{res.jes.length}</span>
                <span style={{ fontSize: 9, color: '#6b7280' }}>
                  (Bank: {res.jes.filter(j => j.source !== 'Cash').length} | Cash: {res.jes.filter(j => j.source === 'Cash').length})
                </span>
              </div>
              <button onClick={goNext} style={nextBtnStyle}>Trial Balance →</button>
            </div>
            <div style={{ padding: 12, maxHeight: 450, overflowY: 'auto' }}>
              {res.jes.map((je, i) => (
                <div key={i} style={{ marginBottom: 8, background: 'rgba(17,24,39,0.4)', borderRadius: 6, border: je.source === 'Cash' ? '1px solid rgba(251,191,36,0.3)' : '1px solid rgba(75,85,99,0.2)', overflow: 'hidden' }}>
                  <div style={{ padding: '6px 10px', borderBottom: '1px solid rgba(75,85,99,0.15)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ background: 'rgba(99,102,241,0.2)', color: '#a5b4fc', padding: '1px 5px', borderRadius: 3, fontSize: 8, fontFamily: 'monospace' }}>JE-{String(i + 1).padStart(3, '0')}</span>
                      {je.ref && <span style={{ background: 'rgba(251,191,36,0.2)', color: '#fbbf24', padding: '1px 5px', borderRadius: 3, fontSize: 8 }}>{je.ref}</span>}
                      <span style={{ color: '#9ca3af', fontSize: 9 }}>{je.date}</span>
                      <span style={{ background: je.source === 'Cash' ? 'rgba(251,191,36,0.2)' : 'rgba(99,102,241,0.1)', color: je.source === 'Cash' ? '#fbbf24' : '#6b7280', padding: '1px 4px', borderRadius: 3, fontSize: 8 }}>{je.source === 'Cash' ? '💵 Cash' : `🏦 ${je.bank}`}</span>
                      <span>{je.desc.substring(0, 35)}</span>
                    </div>
                    <span style={{ background: 'rgba(139,92,246,0.2)', color: '#c4b5fd', padding: '1px 6px', borderRadius: 3, fontSize: 8, fontWeight: 600 }}>{je.cls}</span>
                  </div>
                  <div style={{ padding: '4px 10px' }}>
                    {je.entries.map((e, j) => (
                      <div key={j} style={{ display: 'grid', gridTemplateColumns: '130px 1fr 1fr', padding: '2px 0', fontSize: 10 }}>
                        <span style={{ paddingLeft: e.dr > 0 ? 0 : 12, textTransform: 'capitalize' }}>{e.acc.replace(/_/g, ' ')}</span>
                        <span style={{ textAlign: 'right', fontFamily: 'monospace', color: e.dr > 0 ? '#e5e7eb' : '#6b7280' }}>{e.dr > 0 ? fmt(e.dr) : '-'}</span>
                        <span style={{ textAlign: 'right', fontFamily: 'monospace', color: e.cr > 0 ? '#e5e7eb' : '#6b7280' }}>{e.cr > 0 ? fmt(e.cr) : '-'}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Trial Balance Tab */}
        {tab === 'trial' && res && (
          <div style={{ background: 'rgba(31,41,55,0.6)', borderRadius: 10, border: '1px solid rgba(75,85,99,0.3)', overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(75,85,99,0.2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <button onClick={goBack} style={backBtnStyle}>← Back</button>
                <span style={{ fontWeight: 700, fontSize: 14 }}>Trial Balance</span>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => exportTrialBalance('xlsx')} style={{ padding: '6px 12px', background: 'linear-gradient(135deg, #7c3aed, #8b5cf6)', border: 'none', borderRadius: 6, color: '#fff', fontSize: 11, cursor: 'pointer', fontWeight: 600 }}>
                  📊 Export TB (Excel)
                </button>
                <button onClick={() => exportTrialBalance('csv')} style={{ padding: '6px 12px', background: 'rgba(124,58,237,0.3)', border: '1px solid rgba(139,92,246,0.5)', borderRadius: 6, color: '#c4b5fd', fontSize: 11, cursor: 'pointer', fontWeight: 600 }}>
                  📊 Export TB (CSV)
                </button>
                <button onClick={goNext} style={nextBtnStyle}>Income Statement →</button>
              </div>
            </div>
            <div style={{ padding: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '140px repeat(5, 1fr)', padding: '6px 10px', background: 'rgba(99,102,241,0.1)', borderRadius: 4, fontSize: 9, fontWeight: 600, color: '#9ca3af', marginBottom: 4 }}>
                <span>Account</span><span style={{ textAlign: 'right' }}>Opening</span><span style={{ textAlign: 'right' }}>Debit</span><span style={{ textAlign: 'right' }}>Credit</span><span style={{ textAlign: 'right' }}>Closing</span><span style={{ textAlign: 'right' }}>Dr/Cr</span>
              </div>
              {res.tb.map((r, i) => (
                <div key={r.acc} style={{ display: 'grid', gridTemplateColumns: '140px repeat(5, 1fr)', padding: '5px 10px', background: i % 2 ? 'transparent' : 'rgba(17,24,39,0.3)', borderRadius: 4, fontSize: 10 }}>
                  <span style={{ textTransform: 'capitalize' }}>{r.acc.replace(/_/g, ' ')}</span>
                  <span style={{ textAlign: 'right', fontFamily: 'monospace', color: '#9ca3af' }}>{fmt(r.op)}</span>
                  <span style={{ textAlign: 'right', fontFamily: 'monospace' }}>{fmt(r.dr)}</span>
                  <span style={{ textAlign: 'right', fontFamily: 'monospace' }}>{fmt(r.cr)}</span>
                  <span style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 600, color: r.cl >= 0 ? '#34d399' : '#f87171' }}>{fmt(Math.abs(r.cl))}</span>
                  <span style={{ textAlign: 'right', fontSize: 8, fontWeight: 600, color: r.cl >= 0 ? '#a5b4fc' : '#f9a8d4' }}>{r.cl >= 0 ? 'DR' : 'CR'}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Income Statement Tab */}
        {tab === 'income' && res && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <button onClick={goBack} style={backBtnStyle}>← Trial Balance</button>
              <button onClick={goNext} style={nextBtnStyle}>Balance Sheet →</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 16 }}>
            <div style={{ background: 'rgba(31,41,55,0.6)', borderRadius: 10, border: '1px solid rgba(75,85,99,0.3)', overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(75,85,99,0.2)', background: 'linear-gradient(135deg, rgba(52,211,153,0.1), rgba(99,102,241,0.1))' }}>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{companyName || 'Company Name'}</div>
              <div style={{ fontWeight: 600, fontSize: 12, color: '#a5b4fc', marginTop: 2 }}>Statement of Profit or Loss</div>
              <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 4 }}>For the financial year ended {fyeDisplay} • {config?.standard}</div>
            </div>
            <div style={{ padding: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 110px 110px', padding: '8px 12px', background: 'rgba(99,102,241,0.1)', borderRadius: 6, marginBottom: 8 }}>
                <span style={{ fontSize: 10, fontWeight: 600 }}></span>
                <span style={{ fontSize: 10, fontWeight: 600, textAlign: 'right' }}>{currentYear}</span>
                <span style={{ fontSize: 10, fontWeight: 600, textAlign: 'right', color: '#9ca3af' }}>{priorFSYear}</span>
              </div>
              
              {/* Dynamic IS based on priorISItems structure */}
              {(() => {
                const rows = [];
                const details = res.is.details || {};
                
                // Helper to check if row should be shown (has CY or PY value)
                const hasValue = (cy, py) => (cy !== 0 && cy !== null) || (py !== 0 && py !== null);
                
                // Revenue section - only show items with values
                const revenueItems = priorISItems.filter(i => i.section === 'revenue' || i.type === 'revenue');
                let hasRevenueDetails = false;
                revenueItems.forEach((item) => {
                  const pyVal = parseFloat(item.value) || 0;
                  const cyVal = details[item.id] || 0;
                  if (hasValue(cyVal, pyVal)) {
                    rows.push({ l: item.label, cy: cyVal, py: pyVal });
                    hasRevenueDetails = true;
                  }
                });
                // Show total only if there are details or aggregate has value
                if (hasRevenueDetails || hasValue(res.is.rev, priorCalc.revenue)) {
                  if (!hasRevenueDetails && hasValue(res.is.rev, priorCalc.revenue)) {
                    rows.push({ l: 'Revenue', cy: res.is.rev, py: priorCalc.revenue });
                  } else if (hasRevenueDetails) {
                    rows.push({ l: 'Total Revenue', cy: res.is.rev, py: priorCalc.revenue, b: true });
                  }
                }
                
                // Cost of Sales - only show items with values
                const cosItems = priorISItems.filter(i => i.section === 'cost_of_sales' || i.type === 'cogs');
                let hasCosDetails = false;
                cosItems.forEach((item) => {
                  const pyVal = parseFloat(item.value) || 0;
                  const cyVal = details[item.id] || 0;
                  if (hasValue(cyVal, pyVal)) {
                    rows.push({ l: item.label, cy: -cyVal, py: -pyVal });
                    hasCosDetails = true;
                  }
                });
                if (hasCosDetails || hasValue(res.is.cos, priorCalc.cos)) {
                  if (!hasCosDetails && hasValue(res.is.cos, priorCalc.cos)) {
                    rows.push({ l: 'Cost of Sales', cy: -res.is.cos, py: -priorCalc.cos });
                  } else if (hasCosDetails) {
                    rows.push({ l: 'Total Cost of Sales', cy: -res.is.cos, py: -priorCalc.cos, b: true });
                  }
                }
                
                // Gross Profit - always show if revenue or COS exists
                if (hasValue(res.is.rev, priorCalc.revenue) || hasValue(res.is.cos, priorCalc.cos)) {
                  rows.push({ l: 'Gross Profit', cy: res.is.gp, py: priorCalc.gp, b: true, h: true });
                }
                
                // Operating Expenses section - only show items with values
                const expenseItems = priorISItems.filter(i => i.section === 'operating_expenses' || i.type === 'expense');
                let hasExpDetails = false;
                let totalPyExp = 0;
                const expRows = [];
                expenseItems.forEach(item => {
                  const pyVal = parseFloat(item.value) || 0;
                  totalPyExp += pyVal;
                  const cyVal = details[item.id] || 0;
                  if (hasValue(cyVal, pyVal)) {
                    const isDep = item.id === 'DEPRECIATION';
                    expRows.push({ 
                      l: `  - ${item.label}`, 
                      cy: isDep ? -(res.is.dep || cyVal) : -cyVal, 
                      py: -pyVal, 
                      indent: true, 
                      dep: isDep 
                    });
                    hasExpDetails = true;
                  }
                });
                if (hasExpDetails || hasValue(res.is.adm, totalPyExp)) {
                  rows.push({ l: 'Operating Expenses:', cy: null, py: null, sub: true });
                  rows.push(...expRows);
                  rows.push({ l: 'Total Operating Expenses', cy: -res.is.adm, py: -totalPyExp, b: true });
                }
                
                // Operating Profit - show if there are any revenue/expenses
                if (hasValue(res.is.op, priorCalc.op)) {
                  rows.push({ l: 'Operating Profit', cy: res.is.op, py: priorCalc.op || 0, b: true, h: true });
                }
                
                // Other Income - only show items with values
                const oiItems = priorISItems.filter(i => i.section === 'other_income' || i.type === 'other_income');
                let hasOiDetails = false;
                oiItems.forEach(item => {
                  const pyVal = parseFloat(item.value) || 0;
                  const cyVal = details[item.id] || 0;
                  if (hasValue(cyVal, pyVal)) {
                    rows.push({ l: item.label, cy: cyVal, py: pyVal });
                    hasOiDetails = true;
                  }
                });
                if (hasOiDetails) {
                  rows.push({ l: 'Total Other Income', cy: res.is.oi, py: priorCalc.oi, b: true });
                } else if (hasValue(res.is.oi, priorCalc.oi)) {
                  rows.push({ l: 'Other Income', cy: res.is.oi, py: priorCalc.oi });
                }
                
                // Other Expenses - only show items with values
                const oeItems = priorISItems.filter(i => i.section === 'other_expenses' || i.type === 'other_expense');
                let hasOeDetails = false;
                oeItems.forEach(item => {
                  const pyVal = parseFloat(item.value) || 0;
                  const cyVal = details[item.id] || 0;
                  if (hasValue(cyVal, pyVal)) {
                    rows.push({ l: item.label, cy: -cyVal, py: -pyVal });
                    hasOeDetails = true;
                  }
                });
                if (hasOeDetails) {
                  rows.push({ l: 'Total Other Expenses', cy: -res.is.oe, py: -priorCalc.oe, b: true });
                } else if (hasValue(res.is.oe, priorCalc.oe)) {
                  rows.push({ l: 'Other Expenses', cy: -res.is.oe, py: -priorCalc.oe });
                }
                
                // Finance Costs - only show items with values
                const finItems = priorISItems.filter(i => i.section === 'finance_costs' || i.type === 'finance');
                let hasFinDetails = false;
                finItems.forEach(item => {
                  const pyVal = parseFloat(item.value) || 0;
                  const cyVal = details[item.id] || 0;
                  if (hasValue(cyVal, pyVal)) {
                    rows.push({ l: item.label, cy: -cyVal, py: -pyVal });
                    hasFinDetails = true;
                  }
                });
                if (hasFinDetails) {
                  rows.push({ l: 'Total Finance Costs', cy: -res.is.fin, py: -priorCalc.fin, b: true });
                } else if (hasValue(res.is.fin, priorCalc.fin)) {
                  rows.push({ l: 'Finance Costs', cy: -res.is.fin, py: -priorCalc.fin });
                }
                
                // Profit Before Tax - always show
                rows.push({ l: 'Profit Before Tax', cy: res.is.pbt, py: priorCalc.pbt || 0, b: true, h: true });
                
                // Tax - only show if there's tax
                if (hasValue(res.is.tax, priorCalc.tax)) {
                  rows.push({ l: `Tax (${config?.taxInfo || '24%'})`, cy: -res.is.tax, py: -priorCalc.tax });
                }
                
                // Net Profit - always show
                rows.push({ l: 'Net Profit/(Loss)', cy: res.is.np, py: priorCalc.np || 0, b: true, p: true });
                
                return rows.map((x, i) => (
                  x.sub ? (
                    <div key={i} style={{ padding: '6px 12px', fontSize: 10, fontWeight: 600, color: '#9ca3af' }}>{x.l}</div>
                  ) : (
                    <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 110px 110px', padding: x.h || x.p ? '8px 12px' : '5px 12px', background: x.p ? 'linear-gradient(135deg, rgba(52,211,153,0.2), rgba(99,102,241,0.2))' : x.h ? 'rgba(99,102,241,0.08)' : 'transparent', borderRadius: x.h || x.p ? 6 : 0, marginTop: x.h || x.p ? 4 : 0 }}>
                      <span style={{ fontWeight: x.b ? 700 : 500, fontSize: x.p ? 12 : 11, color: x.indent ? '#9ca3af' : (x.dep ? '#fbbf24' : '#e5e7eb') }}>{x.l}</span>
                      <span style={{ fontWeight: x.b ? 700 : 500, fontFamily: 'monospace', fontSize: x.p ? 12 : (x.indent ? 10 : 11), textAlign: 'right', color: x.cy === null ? 'transparent' : (x.cy >= 0 ? (x.p ? '#34d399' : (x.dep ? '#fbbf24' : '#e5e7eb')) : '#f87171') }}>
                        {x.cy === null ? '-' : (x.cy < 0 ? `(${fmt(Math.abs(x.cy))})` : fmt(x.cy))}
                      </span>
                      <span style={{ fontFamily: 'monospace', fontSize: 10, textAlign: 'right', color: x.dep ? '#fbbf24' : '#9ca3af' }}>
                        {x.py !== undefined && x.py !== null ? (x.py < 0 ? `(${fmt(Math.abs(x.py))})` : fmt(x.py)) : '-'}
                      </span>
                    </div>
                  )
                ));
              })()}
              
              {/* Subledger Note */}
              {(res.is.dep || 0) > 0 && (
                <div style={{ marginTop: 12, padding: 8, background: 'rgba(251,191,36,0.1)', borderRadius: 6, fontSize: 9, color: '#fbbf24' }}>
                  📝 Current year depreciation of {fmt(res.is.dep)} sourced from PPE Register (Subledger)
                </div>
              )}
            </div>
          </div>
          
          {/* Issues & Suggestions Panel for P&L */}
          <div style={{ background: 'rgba(31,41,55,0.6)', borderRadius: 10, border: '1px solid rgba(75,85,99,0.3)', overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(75,85,99,0.2)', background: 'rgba(251,191,36,0.1)' }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: '#fbbf24' }}>🔍 Issues & Suggestions</div>
            </div>
            <div style={{ padding: 12, maxHeight: 500, overflowY: 'auto' }}>
              {(() => {
                const issues = [];
                const suggestions = [];
                
                // Check for suspense items
                if (res.susp && res.susp.length > 0) {
                  issues.push({
                    type: 'error',
                    title: `${res.susp.length} Unclassified Transaction(s)`,
                    desc: 'Some transactions are in Suspense and not included in the financial statements.',
                    fix: 'Go to the Classify tab and assign appropriate classifications to all suspense items.'
                  });
                }
                
                // Check gross profit margin
                if (res.is.rev > 0) {
                  const gpMargin = (res.is.gp / res.is.rev) * 100;
                  if (gpMargin < 10) {
                    suggestions.push({
                      type: 'warning',
                      title: `Low Gross Profit Margin (${gpMargin.toFixed(1)}%)`,
                      desc: 'Gross profit margin is below 10%, which may indicate pricing or cost issues.',
                      fix: 'Review pricing strategy and supplier costs. Consider if all COGS items are correctly classified.'
                    });
                  } else if (gpMargin > 80) {
                    suggestions.push({
                      type: 'info',
                      title: `High Gross Profit Margin (${gpMargin.toFixed(1)}%)`,
                      desc: 'Very high margin - typical for services but unusual for trading.',
                      fix: 'Verify that all direct costs are captured in Cost of Sales. Service businesses typically show high margins.'
                    });
                  }
                }
                
                // Check if there's revenue but no expenses
                if (res.is.rev > 0 && res.is.adm === 0) {
                  suggestions.push({
                    type: 'warning',
                    title: 'No Operating Expenses Recorded',
                    desc: 'Revenue exists but no operating expenses. This is unusual for most businesses.',
                    fix: 'Check if expense transactions are correctly classified. Most businesses have staff costs, utilities, etc.'
                  });
                }
                
                // Check for negative profit before tax
                if (res.is.pbt < 0) {
                  suggestions.push({
                    type: 'info',
                    title: `Loss Before Tax: ${fmt(Math.abs(res.is.pbt))}`,
                    desc: 'The business is reporting a loss for this period.',
                    fix: 'This may be normal for startups or seasonal businesses. Review if all revenue is captured and expenses are reasonable.'
                  });
                }
                
                // Check expense to revenue ratio
                if (res.is.rev > 0) {
                  const expRatio = (res.is.adm / res.is.rev) * 100;
                  if (expRatio > 50) {
                    suggestions.push({
                      type: 'info',
                      title: `High Operating Expenses (${expRatio.toFixed(1)}% of Revenue)`,
                      desc: 'Operating expenses exceed 50% of revenue.',
                      fix: 'Review expense classifications. Some items classified as expenses might be COGS or capital expenditure.'
                    });
                  }
                }
                
                // No issues
                if (issues.length === 0 && suggestions.length === 0) {
                  return (
                    <div style={{ padding: 20, textAlign: 'center' }}>
                      <div style={{ fontSize: 32, marginBottom: 8 }}>✅</div>
                      <div style={{ fontSize: 12, color: '#34d399', fontWeight: 600 }}>All Clear!</div>
                      <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 4 }}>No issues detected with income statement</div>
                    </div>
                  );
                }
                
                return [...issues, ...suggestions].map((item, i) => (
                  <div key={i} style={{ 
                    padding: 12, 
                    marginBottom: 8, 
                    background: item.type === 'error' ? 'rgba(239,68,68,0.1)' : item.type === 'warning' ? 'rgba(251,191,36,0.1)' : 'rgba(99,102,241,0.1)',
                    border: `1px solid ${item.type === 'error' ? 'rgba(239,68,68,0.3)' : item.type === 'warning' ? 'rgba(251,191,36,0.3)' : 'rgba(99,102,241,0.3)'}`,
                    borderRadius: 8
                  }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: item.type === 'error' ? '#f87171' : item.type === 'warning' ? '#fbbf24' : '#a5b4fc', marginBottom: 4 }}>
                      {item.type === 'error' ? '❌' : item.type === 'warning' ? '⚠️' : 'ℹ️'} {item.title}
                    </div>
                    <div style={{ fontSize: 10, color: '#d1d5db', marginBottom: 6 }}>{item.desc}</div>
                    <div style={{ fontSize: 9, color: '#9ca3af', padding: 8, background: 'rgba(0,0,0,0.2)', borderRadius: 4 }}>
                      💡 <strong>Suggestion:</strong> {item.fix}
                    </div>
                  </div>
                ));
              })()}
            </div>
          </div>
          </div>
          </div>
        )}

        {/* Balance Sheet Tab */}
        {tab === 'balance' && res && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <button onClick={goBack} style={backBtnStyle}>← Income Statement</button>
              <button onClick={goNext} style={nextBtnStyle}>Cash Flow →</button>
            </div>
            
            {/* Balance Sheet Header */}
            <div style={{ background: 'rgba(31,41,55,0.6)', borderRadius: 10, border: '1px solid rgba(75,85,99,0.3)', padding: '12px 16px', marginBottom: 16, textAlign: 'center' }}>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{companyName || 'Company Name'}</div>
              <div style={{ fontWeight: 600, fontSize: 12, color: '#a5b4fc', marginTop: 2 }}>Statement of Financial Position</div>
              <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 4 }}>As at {fyeDisplay} • {config?.standard}</div>
              {/* Balance Check Indicator */}
              {(() => {
                const totA = res.bs.totA || 0;
                const totLE = (res.bs.totL || 0) + (res.bs.totE || 0);
                const diff = totA - totLE;
                const isBalanced = Math.abs(diff) < 1;
                return (
                  <div style={{ marginTop: 8, padding: '6px 12px', borderRadius: 6, display: 'inline-block', background: isBalanced ? 'rgba(52,211,153,0.15)' : 'rgba(239,68,68,0.15)', border: isBalanced ? '1px solid rgba(52,211,153,0.3)' : '1px solid rgba(239,68,68,0.3)' }}>
                    <span style={{ fontSize: 10, fontWeight: 600, color: isBalanced ? '#34d399' : '#f87171' }}>
                      {isBalanced ? '✓ Balanced' : `⚠ Difference: ${fmt(diff)}`}
                    </span>
                  </div>
                );
              })()}
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div style={{ background: 'rgba(31,41,55,0.6)', borderRadius: 10, border: '1px solid rgba(75,85,99,0.3)', overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(75,85,99,0.2)', background: 'linear-gradient(135deg, rgba(99,102,241,0.1), rgba(139,92,246,0.1))', fontWeight: 700, fontSize: 14 }}>Assets</div>
              <div style={{ padding: 16 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px 90px', marginBottom: 8, fontSize: 10, fontWeight: 600, color: '#9ca3af' }}>
                  <span></span><span style={{ textAlign: 'right' }}>{currentYear}</span><span style={{ textAlign: 'right' }}>{priorFSYear}</span>
                </div>
                
                {/* Non-Current Assets - Dynamic based on priorBSItems */}
                {(() => {
                  const ncaItems = priorBSItems.filter(i => i.type === 'nca');
                  const hasAnyNCA = ncaItems.some(i => {
                    const pyVal = parseFloat(i.value) || 0;
                    let cyVal = 0;
                    if (i.id === 'PPE') cyVal = res.bs.ppe;
                    else if (i.id === 'INTANGIBLES') cyVal = res.bs.intangibles || 0;
                    else if (i.id === 'INVESTMENTS') cyVal = res.bs.investments || 0;
                    return cyVal !== 0 || pyVal !== 0;
                  });
                  
                  if (!hasAnyNCA && res.bs.totNCA === 0) return null;
                  
                  return (
                    <>
                      <div style={sectionTitle}>Non-Current Assets</div>
                      {ncaItems.map((item, idx) => {
                        const pyVal = parseFloat(item.value) || 0;
                        let cyVal = 0;
                        if (item.id === 'PPE') {
                          // Show PPE with subledger breakdown if available
                          if (subledgerTotals.ppe.cost > 0 || subledgerTotals.ppe.accDepCF > 0) {
                            return (
                              <div key={item.id}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px 90px', padding: '5px 10px', fontSize: 11 }}>
                                  <span>{item.label}</span>
                                  <span style={{ textAlign: 'right', fontFamily: 'monospace' }}></span>
                                  <span style={{ textAlign: 'right', fontFamily: 'monospace', color: '#9ca3af' }}>{pyVal > 0 ? fmt(pyVal) : '-'}</span>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px 90px', padding: '3px 10px 3px 20px', fontSize: 10, color: '#9ca3af' }}>
                                  <span>Cost</span>
                                  <span style={{ textAlign: 'right', fontFamily: 'monospace' }}>{fmt(subledgerTotals.ppe.cost)}</span>
                                  <span style={{ textAlign: 'right', fontFamily: 'monospace' }}></span>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px 90px', padding: '3px 10px 3px 20px', fontSize: 10, color: '#f87171' }}>
                                  <span>Less: Acc Depreciation</span>
                                  <span style={{ textAlign: 'right', fontFamily: 'monospace' }}>({fmt(subledgerTotals.ppe.accDepCF)})</span>
                                  <span style={{ textAlign: 'right', fontFamily: 'monospace' }}></span>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px 90px', padding: '5px 10px', fontSize: 11, fontWeight: 600 }}>
                                  <span>Net Book Value</span>
                                  <span style={{ textAlign: 'right', fontFamily: 'monospace', color: '#a5b4fc' }}>{fmt(subledgerTotals.ppe.nbv)}</span>
                                  <span style={{ textAlign: 'right', fontFamily: 'monospace' }}></span>
                                </div>
                              </div>
                            );
                          }
                          cyVal = res.bs.ppe;
                        } else if (item.id === 'INTANGIBLES') {
                          cyVal = res.bs.intangibles || 0;
                        } else if (item.id === 'INVESTMENTS') {
                          cyVal = res.bs.investments || 0;
                        }
                        // Suppress rows without data
                        if (cyVal === 0 && pyVal === 0) return null;
                        return (
                          <div key={item.id} style={{ display: 'grid', gridTemplateColumns: '1fr 90px 90px', padding: '5px 10px', fontSize: 11 }}>
                            <span>{item.label}</span>
                            <span style={{ textAlign: 'right', fontFamily: 'monospace' }}>{cyVal !== 0 ? fmt(cyVal) : '-'}</span>
                            <span style={{ textAlign: 'right', fontFamily: 'monospace', color: '#9ca3af' }}>{pyVal !== 0 ? fmt(pyVal) : '-'}</span>
                          </div>
                        );
                      })}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px 90px', padding: '4px 10px', fontSize: 10, color: '#9ca3af', marginTop: 4 }}>
                        <span>Total Non-Current Assets</span>
                        <span style={{ textAlign: 'right', fontFamily: 'monospace' }}>{fmt(res.bs.totNCA)}</span>
                        <span style={{ textAlign: 'right', fontFamily: 'monospace' }}>{res.bs.py_totNCA ? fmt(res.bs.py_totNCA) : '-'}</span>
                      </div>
                    </>
                  );
                })()}
                
                {/* Current Assets - Dynamic */}
                <div style={{ ...sectionTitle, marginTop: 10 }}>Current Assets</div>
                {(() => {
                  const caItems = priorBSItems.filter(i => i.type === 'ca');
                  return caItems.map(item => {
                    const pyVal = parseFloat(item.value) || 0;
                    let cyVal = 0;
                    if (item.id === 'INVENTORY') cyVal = res.bs.inv;
                    else if (item.id === 'TRADE_RECEIVABLES') cyVal = res.bs.tr;
                    else if (item.id === 'OTHER_RECEIVABLES') cyVal = res.bs.or || 0;
                    else if (item.id === 'TAX_PREPAID') cyVal = res.bs.taxPrepaid || 0;
                    else if (item.id === 'CASH_BANK') cyVal = res.bs.cash;
                    // Suppress rows without data (except Cash which should always show)
                    if (cyVal === 0 && pyVal === 0 && item.id !== 'CASH_BANK') return null;
                    return (
                      <div key={item.id} style={{ display: 'grid', gridTemplateColumns: '1fr 90px 90px', padding: '5px 10px', fontSize: 11 }}>
                        <span>{item.label}</span>
                        <span style={{ textAlign: 'right', fontFamily: 'monospace' }}>{fmt(cyVal)}</span>
                        <span style={{ textAlign: 'right', fontFamily: 'monospace', color: '#9ca3af' }}>{pyVal !== 0 ? fmt(pyVal) : '-'}</span>
                      </div>
                    );
                  });
                })()}
                {/* Show Tax Prepaid if exists (computed, not in priorBSItems) */}
                {(res.bs.taxPrepaid || 0) > 0 && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px 90px', padding: '5px 10px', fontSize: 11 }}>
                    <span>Tax Prepaid</span>
                    <span style={{ textAlign: 'right', fontFamily: 'monospace' }}>{fmt(res.bs.taxPrepaid)}</span>
                    <span style={{ textAlign: 'right', fontFamily: 'monospace', color: '#9ca3af' }}>-</span>
                  </div>
                )}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px 90px', padding: '4px 10px', fontSize: 10, color: '#9ca3af', marginTop: 4 }}>
                  <span>Total Current Assets</span>
                  <span style={{ textAlign: 'right', fontFamily: 'monospace' }}>{fmt(res.bs.totCA)}</span>
                  <span style={{ textAlign: 'right', fontFamily: 'monospace' }}>{res.bs.py_totCA ? fmt(res.bs.py_totCA) : '-'}</span>
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px 90px', padding: '10px', background: 'linear-gradient(135deg, rgba(99,102,241,0.2), rgba(139,92,246,0.2))', borderRadius: 6, marginTop: 10, fontWeight: 700, fontSize: 12 }}>
                  <span>TOTAL ASSETS</span>
                  <span style={{ textAlign: 'right', fontFamily: 'monospace' }}>{fmt(res.bs.totA)}</span>
                  <span style={{ textAlign: 'right', fontFamily: 'monospace', color: '#9ca3af' }}>{res.bs.py_totA ? fmt(res.bs.py_totA) : '-'}</span>
                </div>
              </div>
            </div>
            <div style={{ background: 'rgba(31,41,55,0.6)', borderRadius: 10, border: '1px solid rgba(75,85,99,0.3)', overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(75,85,99,0.2)', background: 'linear-gradient(135deg, rgba(239,68,68,0.1), rgba(251,191,36,0.1))', fontWeight: 700, fontSize: 14 }}>Liabilities & Equity</div>
              <div style={{ padding: 16 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px 90px', marginBottom: 8, fontSize: 10, fontWeight: 600, color: '#9ca3af' }}>
                  <span></span><span style={{ textAlign: 'right' }}>{currentYear}</span><span style={{ textAlign: 'right' }}>{priorFSYear}</span>
                </div>
                
                {/* Non-Current Liabilities - Dynamic */}
                {(() => {
                  const nclItems = priorBSItems.filter(i => i.type === 'ncl');
                  const hasAnyNCL = nclItems.some(i => {
                    const pyVal = parseFloat(i.value) || 0;
                    let cyVal = 0;
                    if (i.id === 'LONG_TERM_LOAN') cyVal = res.bs.ltBorr || 0;
                    else if (i.id === 'DEFERRED_TAX') cyVal = res.bs.defTax || 0;
                    return cyVal !== 0 || pyVal !== 0;
                  });
                  
                  if (!hasAnyNCL) return null;
                  
                  return (
                    <>
                      <div style={sectionTitle}>Non-Current Liabilities</div>
                      {nclItems.map(item => {
                        const pyVal = parseFloat(item.value) || 0;
                        let cyVal = 0;
                        if (item.id === 'LONG_TERM_LOAN') cyVal = res.bs.ltBorr || 0;
                        else if (item.id === 'DEFERRED_TAX') cyVal = res.bs.defTax || 0;
                        if (cyVal === 0 && pyVal === 0) return null;
                        return (
                          <div key={item.id} style={{ display: 'grid', gridTemplateColumns: '1fr 90px 90px', padding: '5px 10px', fontSize: 11 }}>
                            <span>{item.label}</span>
                            <span style={{ textAlign: 'right', fontFamily: 'monospace' }}>{cyVal !== 0 ? fmt(cyVal) : '-'}</span>
                            <span style={{ textAlign: 'right', fontFamily: 'monospace', color: '#9ca3af' }}>{pyVal !== 0 ? fmt(pyVal) : '-'}</span>
                          </div>
                        );
                      })}
                    </>
                  );
                })()}
                
                {/* Current Liabilities - Dynamic */}
                <div style={sectionTitle}>Current Liabilities</div>
                {(() => {
                  const clItems = priorBSItems.filter(i => i.type === 'cl');
                  return clItems.map(item => {
                    const pyVal = parseFloat(item.value) || 0;
                    let cyVal = 0;
                    if (item.id === 'SHORT_TERM_LOAN') cyVal = res.bs.stBorr || res.bs.borr || 0;
                    else if (item.id === 'TRADE_PAYABLES') cyVal = res.bs.tp;
                    else if (item.id === 'OTHER_PAYABLES') cyVal = res.bs.op || 0;
                    else if (item.id === 'TAX_PAYABLE') cyVal = res.bs.taxPay || 0;
                    else if (item.id === 'GST_SST_PAYABLE') cyVal = res.bs.gstSst || 0;
                    // Suppress rows without data
                    if (cyVal === 0 && pyVal === 0) return null;
                    return (
                      <div key={item.id} style={{ display: 'grid', gridTemplateColumns: '1fr 90px 90px', padding: '5px 10px', fontSize: 11 }}>
                        <span>{item.label}</span>
                        <span style={{ textAlign: 'right', fontFamily: 'monospace' }}>{fmt(cyVal)}</span>
                        <span style={{ textAlign: 'right', fontFamily: 'monospace', color: '#9ca3af' }}>{pyVal !== 0 ? fmt(pyVal) : '-'}</span>
                      </div>
                    );
                  });
                })()}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px 90px', padding: '4px 10px', fontSize: 10, color: '#9ca3af', marginTop: 4 }}>
                  <span>Total Liabilities</span>
                  <span style={{ textAlign: 'right', fontFamily: 'monospace' }}>{fmt(res.bs.totL)}</span>
                  <span style={{ textAlign: 'right', fontFamily: 'monospace' }}>{res.bs.py_totL ? fmt(res.bs.py_totL) : '-'}</span>
                </div>
                
                {/* Equity - Dynamic */}
                <div style={{ ...sectionTitle, marginTop: 10 }}>Equity</div>
                {(() => {
                  const eqItems = priorBSItems.filter(i => i.type === 'equity');
                  return eqItems.map(item => {
                    const pyVal = parseFloat(item.value) || 0;
                    let cyVal = 0;
                    if (item.id === 'SHARE_CAPITAL') cyVal = res.bs.cap;
                    else if (item.id === 'RETAINED_PROFITS') cyVal = res.bs.ret;
                    // Suppress rows without data (except Share Capital)
                    if (cyVal === 0 && pyVal === 0 && item.id !== 'SHARE_CAPITAL') return null;
                    return (
                      <div key={item.id} style={{ display: 'grid', gridTemplateColumns: '1fr 90px 90px', padding: '5px 10px', fontSize: 11 }}>
                        <span>{item.label}</span>
                        <span style={{ textAlign: 'right', fontFamily: 'monospace' }}>{fmt(cyVal)}</span>
                        <span style={{ textAlign: 'right', fontFamily: 'monospace', color: '#9ca3af' }}>{pyVal !== 0 ? fmt(pyVal) : '-'}</span>
                      </div>
                    );
                  });
                })()}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px 90px', padding: '5px 10px', fontSize: 11 }}>
                  <span>Current Year Profit</span>
                  <span style={{ textAlign: 'right', fontFamily: 'monospace', color: res.bs.cyp >= 0 ? '#34d399' : '#f87171' }}>{fmt(res.bs.cyp)}</span>
                  <span style={{ textAlign: 'right', fontFamily: 'monospace', color: '#9ca3af' }}>-</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px 90px', padding: '4px 10px', fontSize: 10, color: '#9ca3af', marginTop: 4 }}>
                  <span>Total Equity</span>
                  <span style={{ textAlign: 'right', fontFamily: 'monospace' }}>{fmt(res.bs.totE)}</span>
                  <span style={{ textAlign: 'right', fontFamily: 'monospace' }}>{res.bs.py_totE ? fmt(res.bs.py_totE) : '-'}</span>
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px 90px', padding: '10px', background: 'linear-gradient(135deg, rgba(239,68,68,0.2), rgba(251,191,36,0.2))', borderRadius: 6, marginTop: 10, fontWeight: 700, fontSize: 12 }}>
                  <span>TOTAL L + E</span>
                  <span style={{ textAlign: 'right', fontFamily: 'monospace' }}>{fmt(res.bs.totL + res.bs.totE)}</span>
                  <span style={{ textAlign: 'right', fontFamily: 'monospace', color: '#9ca3af' }}>{(res.bs.py_totL !== undefined && res.bs.py_totE !== undefined) ? fmt(res.bs.py_totL + res.bs.py_totE) : '-'}</span>
                </div>
                {/* Difference indicator - single row for both CY and PY */}
                {(() => {
                  const cyDiff = (res.bs.totA || 0) - ((res.bs.totL || 0) + (res.bs.totE || 0));
                  const pyDiff = res.bs.py_totA ? (res.bs.py_totA - (res.bs.py_totL || 0) - (res.bs.py_totE || 0)) : 0;
                  const hasCyDiff = Math.abs(cyDiff) >= 1;
                  const hasPyDiff = res.bs.py_totA && Math.abs(pyDiff) >= 1;
                  
                  if (!hasCyDiff && !hasPyDiff) return null;
                  
                  return (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px 90px', padding: '8px 10px', marginTop: 8, background: 'rgba(239,68,68,0.1)', borderRadius: 6, border: '1px solid rgba(239,68,68,0.3)' }}>
                      <span style={{ fontSize: 10, color: '#f87171', fontWeight: 600 }}>Difference (A - L&E)</span>
                      <span style={{ textAlign: 'right', fontFamily: 'monospace', color: hasCyDiff ? '#f87171' : '#34d399', fontWeight: 700 }}>
                        {hasCyDiff ? fmt(cyDiff) : '✓'}
                      </span>
                      <span style={{ textAlign: 'right', fontFamily: 'monospace', color: hasPyDiff ? '#fbbf24' : '#34d399', fontWeight: 700 }}>
                        {res.bs.py_totA ? (hasPyDiff ? fmt(pyDiff) : '✓') : '-'}
                      </span>
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
          
          {/* Issues & Suggestions Panel for BS */}
          <div style={{ gridColumn: '1 / -1', marginTop: 16 }}>
            <div style={{ background: 'rgba(31,41,55,0.6)', borderRadius: 10, border: '1px solid rgba(75,85,99,0.3)', overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(75,85,99,0.2)', background: 'rgba(251,191,36,0.1)' }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: '#fbbf24' }}>🔍 Balance Sheet Issues & Suggestions</div>
              </div>
              <div style={{ padding: 12, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
                {(() => {
                  const items = [];
                  
                  // Check CY BS balance
                  const cyDiff = (res.bs.totA || 0) - ((res.bs.totL || 0) + (res.bs.totE || 0));
                  if (Math.abs(cyDiff) >= 1) {
                    // Find where the difference might be
                    const breakdown = [];
                    breakdown.push(`Assets: NCA ${fmt(res.bs.totNCA)} + CA ${fmt(res.bs.totCA)} = ${fmt(res.bs.totA)}`);
                    breakdown.push(`Liabilities: NCL ${fmt(res.bs.totNCL || 0)} + CL ${fmt(res.bs.totCL)} = ${fmt(res.bs.totL)}`);
                    breakdown.push(`Equity: Capital ${fmt(res.bs.cap)} + Retained ${fmt(res.bs.ret)} + CY Profit ${fmt(res.bs.cyp)} = ${fmt(res.bs.totE)}`);
                    
                    items.push({
                      type: 'error',
                      title: 'CY Balance Sheet Does Not Balance',
                      desc: `Assets (${fmt(res.bs.totA)}) ≠ L+E (${fmt(res.bs.totL + res.bs.totE)}). Difference: ${fmt(cyDiff)}`,
                      fix: breakdown.join(' | ')
                    });
                  }
                  
                  // Check PY BS balance
                  if (res.bs.py_totA && res.bs.py_totA > 0) {
                    const pyDiff = (res.bs.py_totA || 0) - ((res.bs.py_totL || 0) + (res.bs.py_totE || 0));
                    if (Math.abs(pyDiff) >= 1) {
                      const pyBreakdown = [];
                      pyBreakdown.push(`PY Assets: NCA ${fmt(res.bs.py_totNCA || 0)} + CA ${fmt(res.bs.py_totCA || 0)} = ${fmt(res.bs.py_totA)}`);
                      pyBreakdown.push(`PY Liabilities: NCL ${fmt(res.bs.py_totNCL || 0)} + CL ${fmt(res.bs.py_totCL || 0)} = ${fmt(res.bs.py_totL)}`);
                      pyBreakdown.push(`PY Equity: Capital ${fmt(res.bs.py_cap || 0)} + Retained ${fmt(res.bs.py_ret || 0)} = ${fmt(res.bs.py_totE)}`);
                      
                      items.push({
                        type: 'warning',
                        title: 'PY Balance Sheet Does Not Balance',
                        desc: `PY Assets (${fmt(res.bs.py_totA)}) ≠ PY L+E (${fmt((res.bs.py_totL || 0) + (res.bs.py_totE || 0))}). Difference: ${fmt(pyDiff)}`,
                        fix: pyBreakdown.join(' | ')
                      });
                    }
                  }
                  
                  // Check negative cash
                  if (res.bs.cash < 0) {
                    items.push({
                      type: 'warning',
                      title: 'Negative Cash Balance',
                      desc: `Cash shows ${fmt(res.bs.cash)}. Banks typically don't allow negative balances.`,
                      fix: 'This may indicate an overdraft (should be classified as liability) or missing deposits. Review bank reconciliation.'
                    });
                  }
                  
                  // Check negative inventory
                  if (res.bs.inv < 0) {
                    items.push({
                      type: 'error',
                      title: 'Negative Inventory',
                      desc: `Inventory is ${fmt(res.bs.inv)}. This is not possible in reality.`,
                      fix: 'Review inventory movements. You may have recorded more sales than available stock, or opening balance is wrong.'
                    });
                  }
                  
                  // Check if liabilities exceed assets
                  if (res.bs.totA > 0 && res.bs.totL > res.bs.totA) {
                    items.push({
                      type: 'warning',
                      title: 'Negative Net Assets',
                      desc: 'Total liabilities exceed total assets, indicating negative equity.',
                      fix: 'This may indicate the business is insolvent. Verify if this is correct or if assets/liabilities are misclassified.'
                    });
                  }
                  
                  // Check for missing prior year
                  if (!res.bs.py_totA || res.bs.py_totA === 0) {
                    items.push({
                      type: 'info',
                      title: 'No Prior Year Comparatives',
                      desc: 'Prior year Balance Sheet values are not entered.',
                      fix: 'Enter prior year figures in the Prior FS tab for meaningful year-on-year comparison.'
                    });
                  }
                  
                  // Check current ratio
                  if (res.bs.totCL > 0) {
                    const currentRatio = res.bs.totCA / res.bs.totCL;
                    if (currentRatio < 1) {
                      items.push({
                        type: 'warning',
                        title: `Low Current Ratio (${currentRatio.toFixed(2)})`,
                        desc: 'Current assets are less than current liabilities, indicating potential liquidity issues.',
                        fix: 'The business may have difficulty meeting short-term obligations. Review cash flow and consider restructuring debt.'
                      });
                    }
                  }
                  
                  // No issues
                  if (items.length === 0) {
                    return (
                      <div style={{ padding: 20, textAlign: 'center', gridColumn: '1 / -1' }}>
                        <div style={{ fontSize: 32, marginBottom: 8 }}>✅</div>
                        <div style={{ fontSize: 12, color: '#34d399', fontWeight: 600 }}>All Clear!</div>
                        <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 4 }}>Balance Sheet is balanced and no issues detected</div>
                      </div>
                    );
                  }
                  
                  return items.map((item, i) => (
                    <div key={i} style={{ 
                      padding: 12, 
                      background: item.type === 'error' ? 'rgba(239,68,68,0.1)' : item.type === 'warning' ? 'rgba(251,191,36,0.1)' : 'rgba(99,102,241,0.1)',
                      border: `1px solid ${item.type === 'error' ? 'rgba(239,68,68,0.3)' : item.type === 'warning' ? 'rgba(251,191,36,0.3)' : 'rgba(99,102,241,0.3)'}`,
                      borderRadius: 8
                    }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: item.type === 'error' ? '#f87171' : item.type === 'warning' ? '#fbbf24' : '#a5b4fc', marginBottom: 4 }}>
                        {item.type === 'error' ? '❌' : item.type === 'warning' ? '⚠️' : 'ℹ️'} {item.title}
                      </div>
                      <div style={{ fontSize: 10, color: '#d1d5db', marginBottom: 6 }}>{item.desc}</div>
                      <div style={{ fontSize: 9, color: '#9ca3af', padding: 8, background: 'rgba(0,0,0,0.2)', borderRadius: 4 }}>
                        💡 <strong>Suggestion:</strong> {item.fix}
                      </div>
                    </div>
                  ));
                })()}
              </div>
            </div>
          </div>
          </div>
        )}

        {/* Cash Flow Statement Tab */}
        {tab === 'cashflow' && res && res.cf && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <button onClick={goBack} style={backBtnStyle}>← Balance Sheet</button>
              <button onClick={goNext} style={nextBtnStyle}>Tax Computation →</button>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 350px', gap: 16 }}>
              {/* Cash Flow Statement */}
              <div style={{ background: 'rgba(31,41,55,0.6)', borderRadius: 10, border: '1px solid rgba(75,85,99,0.3)', overflow: 'hidden' }}>
                <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(75,85,99,0.2)', background: 'linear-gradient(135deg, rgba(52,211,153,0.1), rgba(34,197,94,0.1))' }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{companyName || 'Company Name'}</div>
                  <div style={{ fontWeight: 600, fontSize: 12, color: '#34d399', marginTop: 2 }}>Statement of Cash Flows</div>
                  <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 4 }}>For the financial year ended {fyeDisplay} • Indirect Method (IAS 7 / IFRS 18)</div>
                  <div style={{ fontSize: 9, color: '#6b7280', marginTop: 2, fontStyle: 'italic' }}>
                    ⓘ Derived from Balance Sheet movements. May require adjustment for disposals/non-cash items.
                  </div>
                </div>
                
                <div style={{ padding: 16 }}>
                  {/* Operating Activities */}
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#34d399', marginBottom: 8, padding: '6px 10px', background: 'rgba(52,211,153,0.1)', borderRadius: 6 }}>
                      💼 Cash Flows from Operating Activities
                    </div>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px', padding: '6px 10px', fontSize: 11 }}>
                      <span>Profit before taxation</span>
                      <span style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 600 }}>{fmt(res.cf.pbt)}</span>
                    </div>
                    
                    <div style={{ fontSize: 10, color: '#9ca3af', padding: '4px 10px', marginTop: 6 }}>Adjustments for:</div>
                    {[
                      { label: 'Depreciation', value: res.cf.adjustments.depreciation },
                      { label: 'Interest expense', value: res.cf.adjustments.interestExpense },
                      { label: 'Interest income', value: res.cf.adjustments.interestIncome },
                    ].filter(x => x.value !== 0).map((item, i) => (
                      <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 100px', padding: '4px 10px 4px 20px', fontSize: 10, color: '#d1d5db' }}>
                        <span>{item.label}</span>
                        <span style={{ textAlign: 'right', fontFamily: 'monospace' }}>{item.value >= 0 ? fmt(item.value) : `(${fmt(Math.abs(item.value))})`}</span>
                      </div>
                    ))}
                    
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px', padding: '6px 10px', fontSize: 11, background: 'rgba(75,85,99,0.2)', borderRadius: 4, marginTop: 4 }}>
                      <span style={{ fontWeight: 600 }}>Operating profit before working capital changes</span>
                      <span style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 600 }}>{fmt(res.cf.pbt + res.cf.totalAdjustments)}</span>
                    </div>
                    
                    <div style={{ fontSize: 10, color: '#9ca3af', padding: '4px 10px', marginTop: 8 }}>Changes in working capital:</div>
                    {[
                      { label: '(Increase)/Decrease in inventories', value: res.cf.workingCapitalChanges.inventory },
                      { label: '(Increase)/Decrease in trade receivables', value: res.cf.workingCapitalChanges.tradeReceivables },
                      { label: '(Increase)/Decrease in other receivables', value: res.cf.workingCapitalChanges.otherReceivables },
                      { label: 'Increase/(Decrease) in trade payables', value: res.cf.workingCapitalChanges.tradePayables },
                      { label: 'Increase/(Decrease) in other payables', value: res.cf.workingCapitalChanges.otherPayables },
                    ].filter(x => x.value !== 0).map((item, i) => (
                      <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 100px', padding: '4px 10px 4px 20px', fontSize: 10, color: '#d1d5db' }}>
                        <span>{item.label}</span>
                        <span style={{ textAlign: 'right', fontFamily: 'monospace', color: item.value >= 0 ? '#34d399' : '#f87171' }}>
                          {item.value >= 0 ? fmt(item.value) : `(${fmt(Math.abs(item.value))})`}
                        </span>
                      </div>
                    ))}
                    
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px', padding: '6px 10px', fontSize: 11, background: 'rgba(52,211,153,0.15)', borderRadius: 4, marginTop: 4 }}>
                      <span style={{ fontWeight: 600 }}>Cash generated from operations</span>
                      <span style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 600 }}>{fmt(res.cf.cashFromOperations)}</span>
                    </div>
                    
                    {(res.cf.taxPaid !== 0 || res.cf.interestPaid !== 0) && (
                      <>
                        {res.cf.taxPaid !== 0 && (
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px', padding: '4px 10px', fontSize: 10, color: '#d1d5db' }}>
                            <span>Tax paid</span>
                            <span style={{ textAlign: 'right', fontFamily: 'monospace', color: '#f87171' }}>({fmt(Math.abs(res.cf.taxPaid))})</span>
                          </div>
                        )}
                        {res.cf.interestPaid !== 0 && (
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px', padding: '4px 10px', fontSize: 10, color: '#d1d5db' }}>
                            <span>Interest paid</span>
                            <span style={{ textAlign: 'right', fontFamily: 'monospace', color: '#f87171' }}>({fmt(Math.abs(res.cf.interestPaid))})</span>
                          </div>
                        )}
                      </>
                    )}
                    
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px', padding: '8px 10px', fontSize: 12, background: 'rgba(52,211,153,0.2)', borderRadius: 6, marginTop: 6, fontWeight: 700 }}>
                      <span>Net cash from operating activities</span>
                      <span style={{ textAlign: 'right', fontFamily: 'monospace', color: res.cf.netOperating >= 0 ? '#34d399' : '#f87171' }}>
                        {res.cf.netOperating >= 0 ? fmt(res.cf.netOperating) : `(${fmt(Math.abs(res.cf.netOperating))})`}
                      </span>
                    </div>
                  </div>
                  
                  {/* Investing Activities */}
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#a5b4fc', marginBottom: 8, padding: '6px 10px', background: 'rgba(99,102,241,0.1)', borderRadius: 6 }}>
                      🏭 Cash Flows from Investing Activities
                    </div>
                    
                    {[
                      { label: 'Purchase of property, plant & equipment', value: res.cf.ppePurchases },
                      { label: 'Proceeds from disposal of PPE', value: res.cf.ppeDisposals },
                      { label: 'Purchase of investments', value: res.cf.investmentPurchases },
                      { label: 'Proceeds from disposal of investments', value: res.cf.investmentDisposals },
                      { label: 'Interest received', value: res.cf.interestReceived },
                    ].filter(x => x.value !== 0).map((item, i) => (
                      <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 100px', padding: '4px 10px', fontSize: 10, color: '#d1d5db' }}>
                        <span>{item.label}</span>
                        <span style={{ textAlign: 'right', fontFamily: 'monospace', color: item.value >= 0 ? '#34d399' : '#f87171' }}>
                          {item.value >= 0 ? fmt(item.value) : `(${fmt(Math.abs(item.value))})`}
                        </span>
                      </div>
                    ))}
                    
                    {res.cf.netInvesting === 0 && (
                      <div style={{ padding: '4px 10px', fontSize: 10, color: '#6b7280', fontStyle: 'italic' }}>No investing activities</div>
                    )}
                    
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px', padding: '8px 10px', fontSize: 12, background: 'rgba(99,102,241,0.2)', borderRadius: 6, marginTop: 6, fontWeight: 700 }}>
                      <span>Net cash from investing activities</span>
                      <span style={{ textAlign: 'right', fontFamily: 'monospace', color: res.cf.netInvesting >= 0 ? '#34d399' : '#f87171' }}>
                        {res.cf.netInvesting >= 0 ? fmt(res.cf.netInvesting) : `(${fmt(Math.abs(res.cf.netInvesting))})`}
                      </span>
                    </div>
                  </div>
                  
                  {/* Financing Activities */}
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#fbbf24', marginBottom: 8, padding: '6px 10px', background: 'rgba(251,191,36,0.1)', borderRadius: 6 }}>
                      💰 Cash Flows from Financing Activities
                    </div>
                    
                    {[
                      { label: 'Proceeds from borrowings', value: res.cf.loanProceeds },
                      { label: 'Repayment of borrowings', value: res.cf.loanRepayments },
                      { label: 'Capital injection / Share issuance', value: res.cf.capitalInjection },
                      { label: 'Dividends paid', value: res.cf.dividendsPaid },
                      { label: 'Drawings / Withdrawals', value: res.cf.drawingsWithdrawals },
                    ].filter(x => x.value !== 0).map((item, i) => (
                      <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 100px', padding: '4px 10px', fontSize: 10, color: '#d1d5db' }}>
                        <span>{item.label}</span>
                        <span style={{ textAlign: 'right', fontFamily: 'monospace', color: item.value >= 0 ? '#34d399' : '#f87171' }}>
                          {item.value >= 0 ? fmt(item.value) : `(${fmt(Math.abs(item.value))})`}
                        </span>
                      </div>
                    ))}
                    
                    {res.cf.netFinancing === 0 && (
                      <div style={{ padding: '4px 10px', fontSize: 10, color: '#6b7280', fontStyle: 'italic' }}>No financing activities</div>
                    )}
                    
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px', padding: '8px 10px', fontSize: 12, background: 'rgba(251,191,36,0.2)', borderRadius: 6, marginTop: 6, fontWeight: 700 }}>
                      <span>Net cash from financing activities</span>
                      <span style={{ textAlign: 'right', fontFamily: 'monospace', color: res.cf.netFinancing >= 0 ? '#34d399' : '#f87171' }}>
                        {res.cf.netFinancing >= 0 ? fmt(res.cf.netFinancing) : `(${fmt(Math.abs(res.cf.netFinancing))})`}
                      </span>
                    </div>
                  </div>
                  
                  {/* Summary */}
                  <div style={{ borderTop: '2px solid rgba(75,85,99,0.3)', paddingTop: 12 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px', padding: '6px 10px', fontSize: 11, fontWeight: 600 }}>
                      <span>Net increase/(decrease) in cash</span>
                      <span style={{ textAlign: 'right', fontFamily: 'monospace', color: res.cf.netChangeInCash >= 0 ? '#34d399' : '#f87171' }}>
                        {res.cf.netChangeInCash >= 0 ? fmt(res.cf.netChangeInCash) : `(${fmt(Math.abs(res.cf.netChangeInCash))})`}
                      </span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px', padding: '6px 10px', fontSize: 11 }}>
                      <span>Cash at beginning of year</span>
                      <span style={{ textAlign: 'right', fontFamily: 'monospace' }}>{fmt(res.cf.openingCash)}</span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px', padding: '10px', fontSize: 13, background: 'linear-gradient(135deg, rgba(52,211,153,0.2), rgba(99,102,241,0.2))', borderRadius: 6, marginTop: 4, fontWeight: 700 }}>
                      <span>Cash at end of year (per CF)</span>
                      <span style={{ textAlign: 'right', fontFamily: 'monospace', color: '#34d399' }}>{fmt(res.cf.closingCash)}</span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px', padding: '6px 10px', fontSize: 11, marginTop: 4 }}>
                      <span style={{ color: '#9ca3af' }}>Cash per Balance Sheet</span>
                      <span style={{ textAlign: 'right', fontFamily: 'monospace', color: '#9ca3af' }}>{fmt(res.cf.cashPerBS)}</span>
                    </div>
                    {Math.abs(res.cf.difference) >= 1 && (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px', padding: '6px 10px', fontSize: 11, background: 'rgba(239,68,68,0.1)', borderRadius: 4, marginTop: 4, border: '1px solid rgba(239,68,68,0.3)' }}>
                        <span style={{ color: '#f87171', fontWeight: 600 }}>⚠ Difference</span>
                        <span style={{ textAlign: 'right', fontFamily: 'monospace', color: '#f87171', fontWeight: 600 }}>{fmt(res.cf.difference)}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              
              {/* Issues & Suggestions Panel */}
              <div style={{ background: 'rgba(31,41,55,0.6)', borderRadius: 10, border: '1px solid rgba(75,85,99,0.3)', overflow: 'hidden' }}>
                <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(75,85,99,0.2)', background: 'rgba(251,191,36,0.1)' }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: '#fbbf24' }}>🔍 Issues & Suggestions</div>
                </div>
                <div style={{ padding: 12, maxHeight: 500, overflowY: 'auto' }}>
                  {(() => {
                    const issues = [];
                    const suggestions = [];
                    
                    // Check cash reconciliation
                    if (Math.abs(res.cf.difference) >= 1) {
                      issues.push({
                        type: 'error',
                        title: 'Cash Flow vs Balance Sheet Difference',
                        desc: `Calculated closing cash (${fmt(res.cf.closingCash)}) differs from BS cash (${fmt(res.cf.cashPerBS)}) by ${fmt(Math.abs(res.cf.difference))}`,
                        fix: 'Common causes: (1) Subledger values override TB for AR/AP/Inventory but transactions flow to cash differently, (2) Missing transactions like tax payments, dividends, or drawings, (3) Timing differences. The indirect method derives cash from BS changes - ensure all BS items are consistent.'
                      });
                    }
                    
                    // Check if opening cash is zero
                    if (res.cf.openingCash === 0 && res.bs.py_cash === 0) {
                      suggestions.push({
                        type: 'warning',
                        title: 'No Opening Cash Balance',
                        desc: 'Opening cash is zero. This is normal for a new company but check if prior year BS was entered.',
                        fix: 'Enter prior year Balance Sheet in the Prior FS tab to enable proper cash flow calculation.'
                      });
                    }
                    
                    // Check negative operating cash flow
                    if (res.cf.netOperating < 0 && res.is.np > 0) {
                      suggestions.push({
                        type: 'info',
                        title: 'Negative Operating Cash Despite Profit',
                        desc: `Operating cash flow is negative (${fmt(res.cf.netOperating)}) despite net profit of ${fmt(res.is.np)}`,
                        fix: 'This commonly occurs due to working capital increases (growing receivables/inventory). Review if collections are delayed or stock is building up.'
                      });
                    }
                    
                    // Check large working capital movements
                    const wcTotal = Math.abs(res.cf.totalWCChanges);
                    if (wcTotal > Math.abs(res.cf.pbt) * 0.5 && wcTotal > 10000) {
                      suggestions.push({
                        type: 'info',
                        title: 'Significant Working Capital Movement',
                        desc: `Working capital changed by ${fmt(wcTotal)}, which is significant relative to profit.`,
                        fix: 'Large swings may indicate seasonality, growth, or collection issues. Verify receivables aging and inventory levels.'
                      });
                    }
                    
                    // No issues
                    if (issues.length === 0 && suggestions.length === 0) {
                      return (
                        <div style={{ padding: 20, textAlign: 'center' }}>
                          <div style={{ fontSize: 32, marginBottom: 8 }}>✅</div>
                          <div style={{ fontSize: 12, color: '#34d399', fontWeight: 600 }}>All Clear!</div>
                          <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 4 }}>No issues detected with cash flow statement</div>
                        </div>
                      );
                    }
                    
                    return [...issues, ...suggestions].map((item, i) => (
                      <div key={i} style={{ 
                        padding: 12, 
                        marginBottom: 8, 
                        background: item.type === 'error' ? 'rgba(239,68,68,0.1)' : item.type === 'warning' ? 'rgba(251,191,36,0.1)' : 'rgba(99,102,241,0.1)',
                        border: `1px solid ${item.type === 'error' ? 'rgba(239,68,68,0.3)' : item.type === 'warning' ? 'rgba(251,191,36,0.3)' : 'rgba(99,102,241,0.3)'}`,
                        borderRadius: 8
                      }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: item.type === 'error' ? '#f87171' : item.type === 'warning' ? '#fbbf24' : '#a5b4fc', marginBottom: 4 }}>
                          {item.type === 'error' ? '❌' : item.type === 'warning' ? '⚠️' : 'ℹ️'} {item.title}
                        </div>
                        <div style={{ fontSize: 10, color: '#d1d5db', marginBottom: 6 }}>{item.desc}</div>
                        <div style={{ fontSize: 9, color: '#9ca3af', padding: 8, background: 'rgba(0,0,0,0.2)', borderRadius: 4 }}>
                          💡 <strong>Suggestion:</strong> {item.fix}
                        </div>
                      </div>
                    ));
                  })()}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tax Computation Tab */}
        {tab === 'tax' && res && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <button onClick={goBack} style={backBtnStyle}>← Cash Flow</button>
              <button onClick={goNext} style={nextBtnStyle}>Snapshots →</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              {/* Tax Computation */}
              <div style={{ background: 'rgba(31,41,55,0.6)', borderRadius: 10, border: '1px solid rgba(75,85,99,0.3)', overflow: 'hidden' }}>
                <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(75,85,99,0.2)', background: 'linear-gradient(135deg, rgba(251,191,36,0.1), rgba(245,158,11,0.1))' }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{companyName || 'Company Name'}</div>
                  <div style={{ fontWeight: 600, fontSize: 12, color: '#fbbf24', marginTop: 2 }}>💵 Tax Computation</div>
                  <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 2 }}>Year of Assessment {currentYear} • {config?.taxInfo}</div>
                </div>
                <div style={{ padding: 16, maxHeight: 600, overflowY: 'auto' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', fontSize: 12, borderBottom: '1px solid rgba(75,85,99,0.2)' }}>
                    <span>Profit Before Tax</span>
                    <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{fmt(res.is.pbt)}</span>
                  </div>
                  
                  {/* ADD BACK: Non-Deductible Expenses Section */}
                  <div style={{ ...sectionTitle, marginTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: '#f87171' }}>➕ Add Back: Non-Deductible Expenses</span>
                    <span style={{ fontSize: 9, color: '#6b7280', fontWeight: 400 }}>Section 39 ITA 1967</span>
                  </div>
                  
                  <div style={{ background: 'rgba(248,113,113,0.05)', borderRadius: 8, border: '1px solid rgba(248,113,113,0.2)', padding: 8, marginBottom: 8 }}>
                    <div style={{ fontSize: 9, color: '#9ca3af', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span>💡</span> Expenses not wholly & exclusively for business must be added back to profit
                    </div>
                    
                    {NON_DEDUCTIBLE_EXPENSES_GUIDE.map((category, catIdx) => (
                      <div key={catIdx} style={{ marginBottom: 8 }}>
                        <div style={{ fontSize: 9, color: '#f87171', fontWeight: 600, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                          {category.category}
                        </div>
                        {category.items.map(item => (
                          <div key={item.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '3px 8px', fontSize: 10 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1 }}>
                              <span>{item.label}</span>
                              <div style={{ position: 'relative', display: 'inline-block' }}>
                                <span 
                                  style={{ 
                                    cursor: 'help', 
                                    fontSize: 10, 
                                    color: '#6b7280',
                                    background: 'rgba(107,114,128,0.2)',
                                    borderRadius: '50%',
                                    width: 14,
                                    height: 14,
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                  }}
                                  title={item.tooltip}
                                >?</span>
                              </div>
                            </div>
                            <input 
                              type="number" 
                              placeholder="0"
                              value={(taxSettings.addBackExpenses && taxSettings.addBackExpenses[item.key]) || ''} 
                              onChange={e => setTaxSettings(prev => ({ 
                                ...prev, 
                                addBackExpenses: { ...(prev.addBackExpenses || {}), [item.key]: e.target.value } 
                              }))} 
                              style={{ ...inputStyle, width: 90, padding: '3px 6px', fontSize: 10, fontFamily: 'monospace', textAlign: 'right' }} 
                            />
                          </div>
                        ))}
                      </div>
                    ))}
                    
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', fontSize: 11, background: 'rgba(248,113,113,0.1)', borderRadius: 6, marginTop: 8, fontWeight: 600 }}>
                      <span>Total Add Back</span>
                      <span style={{ fontFamily: 'monospace', color: '#f87171' }}>
                        {fmt(computeTotalAddBack())}
                      </span>
                    </div>
                  </div>
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', fontSize: 12, background: 'rgba(99,102,241,0.1)', borderRadius: 6, marginBottom: 8 }}>
                    <span style={{ fontWeight: 600 }}>Adjusted Profit</span>
                    <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{fmt(res.is.pbt + computeTotalAddBack())}</span>
                  </div>
                  
                  <div style={{ ...sectionTitle, marginTop: 12 }}>
                    {companyType === 'ENTERPRISE' ? '➖ Business Deductions & Personal Reliefs' : '➖ Tax Deductions & Allowances'}
                  </div>
                  
                  {/* Capital Allowance - shown for ALL company types */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', fontSize: 11, background: 'rgba(52,211,153,0.1)', borderRadius: 6, marginBottom: 8 }}>
                    <div>
                      <span style={{ fontWeight: 600 }}>Capital Allowance</span>
                      <div style={{ fontSize: 9, color: '#6b7280', marginTop: 2 }}>
                        From CA Schedule ({caScheduleItems.length} assets)
                        {!isCAReconciled() && <span style={{ color: '#f87171', marginLeft: 8 }}>⚠ Not reconciled with PPE</span>}
                      </div>
                    </div>
                    <span style={{ fontFamily: 'monospace', color: '#34d399', fontWeight: 600 }}>
                      ({fmt(computeTotalCapitalAllowance())})
                    </span>
                  </div>
                  
                  {companyType === 'ENTERPRISE' ? (
                    // Enterprise personal deductions (in addition to CA)
                    <>
                      <div style={{ fontSize: 10, color: '#9ca3af', marginBottom: 8, padding: '4px 8px', background: 'rgba(99,102,241,0.1)', borderRadius: 4 }}>
                        Personal reliefs reduce chargeable income for sole proprietors/partners
                      </div>
                      {[
                        { key: 'selfRelief', label: 'Self Relief', max: 9000 },
                        { key: 'spouseRelief', label: 'Spouse Relief', max: 4000 },
                        { key: 'childRelief', label: 'Child Relief', max: null },
                        { key: 'parentsMedical', label: 'Parents Medical', max: 8000 },
                        { key: 'epfContribution', label: 'EPF Contribution', max: 4000 },
                        { key: 'lifeInsurance', label: 'Life Insurance / Takaful', max: 3000 },
                        { key: 'educationFees', label: 'Education & Medical Insurance', max: 3000 },
                        { key: 'medicalExpenses', label: 'Medical Expenses', max: 10000 },
                        { key: 'lifestyleRelief', label: 'Lifestyle Relief', max: 2500 },
                        { key: 'socsoContribution', label: 'SOCSO Contribution', max: 350 },
                        { key: 'privateRetirement', label: 'Private Retirement Scheme', max: 3000 },
                        { key: 'sspnDeposit', label: 'SSPN Deposit', max: 8000 },
                      ].map(item => (
                        <div key={item.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 12px', fontSize: 11 }}>
                          <span>{item.label} {item.max && <span style={{ color: '#6b7280' }}>(max {fmt(item.max)})</span>}</span>
                          <input 
                            type="number" 
                            placeholder="0"
                            value={taxSettings.personalDeductions[item.key]} 
                            onChange={e => setTaxSettings(prev => ({ ...prev, personalDeductions: { ...prev.personalDeductions, [item.key]: e.target.value } }))} 
                            style={{ ...inputStyle, width: 100, padding: '4px 8px', fontSize: 11, fontFamily: 'monospace', textAlign: 'right' }} 
                          />
                        </div>
                      ))}
                    </>
                  ) : (
                    // Corporate deductions (Sdn Bhd / Berhad)
                    <>
                      {/* Other corporate deductions - manual input */}
                      {[
                        { key: 'reinvestmentAllowance', label: 'Reinvestment Allowance' },
                        { key: 'pioneerStatus', label: 'Pioneer Status Exemption' },
                        { key: 'investmentTaxAllowance', label: 'Investment Tax Allowance' },
                        { key: 'exportIncentive', label: 'Export Incentive' },
                        { key: 'rdDeduction', label: 'R&D Double Deduction' },
                        { key: 'lossCarryForward', label: 'Loss Carry Forward' },
                      ].map(item => (
                        <div key={item.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 12px', fontSize: 11 }}>
                          <span>{item.label}</span>
                          <input 
                            type="number" 
                            placeholder="0"
                            value={taxSettings.corporateDeductions[item.key]} 
                            onChange={e => setTaxSettings(prev => ({ ...prev, corporateDeductions: { ...prev.corporateDeductions, [item.key]: e.target.value } }))} 
                            style={{ ...inputStyle, width: 100, padding: '4px 8px', fontSize: 11, fontFamily: 'monospace', textAlign: 'right' }} 
                          />
                        </div>
                      ))}
                    </>
                  )}
                  
                  {(() => {
                    const taxDetail = calculateTaxDetailed(res.is.pbt);
                    
                    return (
                      <>
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', fontSize: 12, borderTop: '1px solid rgba(75,85,99,0.2)', marginTop: 8 }}>
                          <span>Total Deductions</span>
                          <span style={{ fontFamily: 'monospace', color: '#34d399' }}>
                            ({fmt(taxDetail.totalDeductions)})
                          </span>
                        </div>
                        
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px', background: 'rgba(251,191,36,0.1)', borderRadius: 6, marginTop: 8, fontSize: 12, fontWeight: 600 }}>
                          <span>Chargeable Income</span>
                          <span style={{ fontFamily: 'monospace' }}>
                            {fmt(taxDetail.taxableIncome)}
                          </span>
                        </div>
                        
                        {/* Tax Bracket Breakdown - show even if taxableIncome > 0 */}
                        {taxDetail.taxableIncome > 0 ? (
                          <div style={{ marginTop: 12, padding: 8, background: 'rgba(99,102,241,0.05)', borderRadius: 6, border: '1px solid rgba(99,102,241,0.2)' }}>
                            <div style={{ fontSize: 10, fontWeight: 600, color: '#a5b4fc', marginBottom: 8 }}>📊 Tax Calculation Breakdown</div>
                            {taxDetail.brackets.length > 0 ? taxDetail.brackets.map((bracket, i) => (
                              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 8px', fontSize: 10, borderBottom: i < taxDetail.brackets.length - 1 ? '1px solid rgba(75,85,99,0.2)' : 'none' }}>
                                <span>{bracket.range}</span>
                                <span style={{ color: '#9ca3af' }}>
                                  {fmt(bracket.amount)} × {bracket.rate}% = <span style={{ color: '#fbbf24', fontWeight: 600 }}>{fmt(bracket.tax)}</span>
                                </span>
                              </div>
                            )) : (
                              <div style={{ fontSize: 10, color: '#9ca3af', padding: 8 }}>No tax brackets calculated</div>
                            )}
                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 8px 4px', fontSize: 11, fontWeight: 600, borderTop: '1px solid rgba(75,85,99,0.3)', marginTop: 4 }}>
                              <span>Gross Tax</span>
                              <span style={{ fontFamily: 'monospace' }}>{fmt(taxDetail.grossTax)}</span>
                            </div>
                          </div>
                        ) : (
                          <div style={{ marginTop: 12, padding: 12, background: 'rgba(52,211,153,0.1)', borderRadius: 6, border: '1px solid rgba(52,211,153,0.2)', fontSize: 11, color: '#34d399' }}>
                            ✓ No tax payable - Chargeable income is zero or negative after deductions
                          </div>
                        )}
                        
                        {/* Zakat Rebate Section - mainly for Enterprise/Individual */}
                        {companyType === 'ENTERPRISE' && taxDetail.grossTax > 0 && (
                          <div style={{ marginTop: 12 }}>
                            <div style={{ ...sectionTitle, color: '#34d399' }}>🕌 Tax Rebates</div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', fontSize: 11, background: 'rgba(52,211,153,0.05)', borderRadius: 6 }}>
                              <div>
                                <span style={{ fontWeight: 600 }}>Zakat Paid</span>
                                <div style={{ fontSize: 9, color: '#6b7280', marginTop: 2 }}>Rebate limited to tax payable amount</div>
                              </div>
                              <input 
                                type="number" 
                                placeholder="0"
                                value={(taxSettings.taxRebates && taxSettings.taxRebates.zakat) || ''} 
                                onChange={e => setTaxSettings(prev => ({ 
                                  ...prev, 
                                  taxRebates: { ...(prev.taxRebates || {}), zakat: e.target.value } 
                                }))} 
                                style={{ ...inputStyle, width: 100, padding: '4px 8px', fontSize: 11, fontFamily: 'monospace', textAlign: 'right' }} 
                              />
                            </div>
                            {taxDetail.zakat > 0 && (
                              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 12px', fontSize: 11, color: '#34d399' }}>
                                <span>Less: Zakat Rebate</span>
                                <span style={{ fontFamily: 'monospace' }}>({fmt(taxDetail.zakat)})</span>
                              </div>
                            )}
                          </div>
                        )}
                        
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', background: 'linear-gradient(135deg, rgba(251,191,36,0.2), rgba(245,158,11,0.2))', borderRadius: 6, marginTop: 12, fontSize: 14, fontWeight: 700 }}>
                          <span>Tax Payable</span>
                          <span style={{ fontFamily: 'monospace', color: '#fbbf24' }}>{fmt(taxDetail.netTax)}</span>
                        </div>
                      </>
                    );
                  })()}
                  
                  {/* Update button to regenerate FS with new tax */}
                  {calculateTax(res.is.pbt) !== res.is.tax && (
                    <div style={{ marginTop: 12, padding: 12, background: 'rgba(251,191,36,0.1)', borderRadius: 8, border: '1px solid rgba(251,191,36,0.3)' }}>
                      <div style={{ fontSize: 11, color: '#fbbf24', marginBottom: 8 }}>
                        ⚠ Tax has changed from {fmt(res.is.tax)} to {fmt(calculateTax(res.is.pbt))}. 
                        Click below to update the financial statements.
                      </div>
                      <button 
                        onClick={run} 
                        style={{ 
                          width: '100%', 
                          padding: '10px 16px', 
                          background: 'linear-gradient(135deg, #fbbf24, #f59e0b)', 
                          border: 'none', 
                          borderRadius: 8, 
                          color: '#1f2937', 
                          fontWeight: 700, 
                          fontSize: 12, 
                          cursor: 'pointer' 
                        }}
                      >
                        🔄 Update Financial Statements
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Tax Rate Settings */}
              <div style={{ background: 'rgba(31,41,55,0.6)', borderRadius: 10, border: '1px solid rgba(75,85,99,0.3)', overflow: 'hidden' }}>
                <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(75,85,99,0.2)', background: 'linear-gradient(135deg, rgba(99,102,241,0.1), rgba(139,92,246,0.1))' }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>⚙️ Tax Rate Settings</div>
                  <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 2 }}>Adjust rates if different from default</div>
                </div>
                <div style={{ padding: 16 }}>
                  {companyType === 'SDN_BHD' && (
                    <>
                      <div style={sectionTitle}>SME Tax Rates</div>
                      <div style={{ marginBottom: 12 }}>
                        <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 4 }}>Tier 1 Limit (RM)</div>
                        <input 
                          type="number" 
                          value={taxSettings.sdnBhd.tier1Limit} 
                          onChange={e => setTaxSettings(prev => ({ ...prev, sdnBhd: { ...prev.sdnBhd, tier1Limit: parseInt(e.target.value) || 0 } }))} 
                          style={{ ...inputStyle, fontFamily: 'monospace' }} 
                        />
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <div>
                          <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 4 }}>Tier 1 Rate (%)</div>
                          <input 
                            type="number" 
                            value={taxSettings.sdnBhd.tier1Rate} 
                            onChange={e => setTaxSettings(prev => ({ ...prev, sdnBhd: { ...prev.sdnBhd, tier1Rate: parseFloat(e.target.value) || 0 } }))} 
                            style={{ ...inputStyle, fontFamily: 'monospace' }} 
                          />
                        </div>
                        <div>
                          <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 4 }}>Tier 2 Rate (%)</div>
                          <input 
                            type="number" 
                            value={taxSettings.sdnBhd.tier2Rate} 
                            onChange={e => setTaxSettings(prev => ({ ...prev, sdnBhd: { ...prev.sdnBhd, tier2Rate: parseFloat(e.target.value) || 0 } }))} 
                            style={{ ...inputStyle, fontFamily: 'monospace' }} 
                          />
                        </div>
                      </div>
                      <div style={{ padding: 12, background: 'rgba(99,102,241,0.1)', borderRadius: 8, marginTop: 12, fontSize: 11 }}>
                        <div style={{ fontWeight: 600, marginBottom: 4 }}>Current Tax Structure:</div>
                        <div>• First RM{taxSettings.sdnBhd.tier1Limit.toLocaleString()}: {taxSettings.sdnBhd.tier1Rate}%</div>
                        <div>• Above RM{taxSettings.sdnBhd.tier1Limit.toLocaleString()}: {taxSettings.sdnBhd.tier2Rate}%</div>
                      </div>
                    </>
                  )}
                  
                  {companyType === 'ENTERPRISE' && (
                    <>
                      <div style={sectionTitle}>Personal Tax Brackets (YA2024)</div>
                      <div style={{ maxHeight: 300, overflowY: 'auto' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px', gap: 4, marginBottom: 4, fontSize: 9, color: '#6b7280' }}>
                          <span>Bracket Amount (RM)</span><span>Rate</span>
                        </div>
                        {taxSettings.enterprise.brackets.map((bracket, i) => (
                          <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 80px', gap: 8, marginBottom: 6 }}>
                            <input 
                              type="number" 
                              value={bracket.limit === Infinity ? '' : bracket.limit}
                              placeholder="∞"
                              onChange={e => {
                                const newBrackets = [...taxSettings.enterprise.brackets];
                                newBrackets[i] = { ...newBrackets[i], limit: e.target.value === '' ? Infinity : parseInt(e.target.value) || 0 };
                                setTaxSettings(prev => ({ ...prev, enterprise: { brackets: newBrackets } }));
                              }} 
                              style={{ ...inputStyle, fontFamily: 'monospace', fontSize: 11, padding: '4px 8px' }} 
                              disabled={i === taxSettings.enterprise.brackets.length - 1}
                            />
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                              <input 
                                type="number" 
                                value={bracket.rate}
                                onChange={e => {
                                  const newBrackets = [...taxSettings.enterprise.brackets];
                                  newBrackets[i] = { ...newBrackets[i], rate: parseFloat(e.target.value) || 0 };
                                  setTaxSettings(prev => ({ ...prev, enterprise: { brackets: newBrackets } }));
                                }} 
                                style={{ ...inputStyle, fontFamily: 'monospace', fontSize: 11, width: 50, padding: '4px 8px' }} 
                              />
                              <span style={{ fontSize: 11, color: '#9ca3af' }}>%</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                  
                  {companyType === 'BERHAD' && (
                    <>
                      <div style={sectionTitle}>Corporate Tax Rate</div>
                      <div style={{ marginBottom: 12 }}>
                        <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 4 }}>Flat Tax Rate (%)</div>
                        <input 
                          type="number" 
                          value={taxSettings.berhad.rate} 
                          onChange={e => setTaxSettings(prev => ({ ...prev, berhad: { rate: parseFloat(e.target.value) || 0 } }))} 
                          style={{ ...inputStyle, fontFamily: 'monospace' }} 
                        />
                      </div>
                      <div style={{ padding: 12, background: 'rgba(99,102,241,0.1)', borderRadius: 8, fontSize: 11 }}>
                        <div style={{ fontWeight: 600 }}>All chargeable income taxed at {taxSettings.berhad.rate}%</div>
                      </div>
                    </>
                  )}
                  
                  {/* Effective Rate Summary */}
                  <div style={{ padding: 12, background: 'rgba(52,211,153,0.1)', borderRadius: 8, marginTop: 16 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 8 }}>Effective Tax Rate</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 20, fontWeight: 700 }}>
                      <span style={{ color: '#9ca3af' }}>ETR:</span>
                      <span style={{ color: '#34d399' }}>
                        {res.is.pbt > 0 ? ((calculateTax(res.is.pbt) / res.is.pbt) * 100).toFixed(2) : 0}%
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Capital Allowance Schedule - Full Width - Shown for ALL company types */}
            <div style={{ marginTop: 16, background: 'rgba(31,41,55,0.6)', borderRadius: 10, border: '1px solid rgba(75,85,99,0.3)', overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(75,85,99,0.2)', background: 'linear-gradient(135deg, rgba(52,211,153,0.1), rgba(16,185,129,0.1))', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>📋 Capital Allowance Schedule</div>
                  <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 2 }}>YA {currentYear} • IA claimed on assets acquired in {currentYear}, AA on all qualifying assets</div>
                  {companyType === 'ENTERPRISE' && (
                    <div style={{ fontSize: 9, color: '#fbbf24', marginTop: 2 }}>💡 Sole proprietors & partnerships can also claim CA on business assets</div>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  {/* Cost Reconciliation Check */}
                  <div style={{ 
                    padding: '6px 12px', 
                    borderRadius: 6, 
                    background: isCAReconciled() ? 'rgba(52,211,153,0.2)' : 'rgba(248,113,113,0.2)',
                    border: `1px solid ${isCAReconciled() ? 'rgba(52,211,153,0.5)' : 'rgba(248,113,113,0.5)'}`,
                    fontSize: 9
                  }}>
                    {isCAReconciled() ? (
                      <span style={{ color: '#34d399' }}>✓ Reconciled with PPE: RM {fmt(getTotalPPECost())}</span>
                    ) : (
                      <span style={{ color: '#f87171' }}>⚠ CA: {fmt(getTotalCAScheduleCost())} ≠ PPE: {fmt(getTotalPPECost())}</span>
                    )}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 10, color: '#9ca3af' }}>Total CA (YA {currentYear})</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: '#34d399', fontFamily: 'monospace' }}>RM {fmt(computeTotalCapitalAllowance())}</div>
                  </div>
                </div>
              </div>
                
                <div style={{ padding: 12 }}>
                  {/* Header Row */}
                  <div style={{ display: 'grid', gridTemplateColumns: '100px 180px 140px 90px 60px 60px 80px 30px', padding: '8px 10px', background: 'rgba(99,102,241,0.1)', borderRadius: 4, fontSize: 9, fontWeight: 600, color: '#9ca3af', marginBottom: 4, gap: 8 }}>
                    <span>Acquisition Date</span>
                    <span>Asset Description</span>
                    <span>Category</span>
                    <span style={{ textAlign: 'right' }}>Cost (RM)</span>
                    <span style={{ textAlign: 'center' }}>IA %</span>
                    <span style={{ textAlign: 'center' }}>AA %</span>
                    <span style={{ textAlign: 'right' }}>CA Amount</span>
                    <span></span>
                  </div>
                  
                  {/* Asset Rows */}
                  {caScheduleItems.map((item, i) => {
                    const calc = calculateItemCA(item);
                    const rates = DEFAULT_CA_RATES[item.category] || DEFAULT_CA_RATES['OFFICE_EQUIPMENT'];
                    
                    return (
                      <div key={item.id} style={{ display: 'grid', gridTemplateColumns: '100px 180px 140px 90px 60px 60px 80px 30px', padding: '6px 10px', background: i % 2 ? 'transparent' : 'rgba(17,24,39,0.3)', borderRadius: 4, fontSize: 10, alignItems: 'center', gap: 8 }}>
                        <input
                          type="date"
                          value={item.acquisitionDate}
                          onChange={(e) => updateCAScheduleItem(item.id, 'acquisitionDate', e.target.value)}
                          style={{ 
                            padding: '4px', 
                            background: 'rgba(17,24,39,0.5)', 
                            border: '1px solid rgba(75,85,99,0.3)', 
                            borderRadius: 4, 
                            color: '#e5e7eb', 
                            fontSize: 9
                          }}
                        />
                        <input
                          type="text"
                          value={item.description}
                          onChange={(e) => updateCAScheduleItem(item.id, 'description', e.target.value)}
                          placeholder="Asset description..."
                          style={{ 
                            padding: '4px 8px', 
                            background: 'rgba(17,24,39,0.5)', 
                            border: '1px solid rgba(75,85,99,0.3)', 
                            borderRadius: 4, 
                            color: '#e5e7eb', 
                            fontSize: 10
                          }}
                        />
                        <select
                          value={item.category}
                          onChange={(e) => updateCAScheduleItem(item.id, 'category', e.target.value)}
                          style={{ 
                            padding: '4px', 
                            background: 'rgba(17,24,39,0.5)', 
                            border: '1px solid rgba(75,85,99,0.3)', 
                            borderRadius: 4, 
                            color: '#e5e7eb', 
                            fontSize: 9
                          }}
                        >
                          {Object.entries(DEFAULT_CA_RATES).map(([key, val]) => (
                            <option key={key} value={key}>{val.label}</option>
                          ))}
                        </select>
                        <input
                          type="number"
                          value={item.cost || ''}
                          onChange={(e) => updateCAScheduleItem(item.id, 'cost', parseFloat(e.target.value) || 0)}
                          placeholder="0"
                          style={{ 
                            padding: '4px 8px', 
                            background: 'rgba(17,24,39,0.5)', 
                            border: '1px solid rgba(75,85,99,0.3)', 
                            borderRadius: 4, 
                            color: '#e5e7eb', 
                            fontSize: 10,
                            fontFamily: 'monospace',
                            textAlign: 'right'
                          }}
                        />
                        <span style={{ textAlign: 'center', fontFamily: 'monospace', color: calc.isCurrentYear ? '#34d399' : '#6b7280', fontSize: 9 }}>
                          {calc.isCurrentYear ? rates.ia : '-'}
                        </span>
                        <span style={{ textAlign: 'center', fontFamily: 'monospace', color: '#34d399', fontSize: 9 }}>
                          {rates.aa}
                        </span>
                        <span style={{ textAlign: 'right', fontFamily: 'monospace', color: '#34d399', fontWeight: 600 }}>
                          {fmt(calc.totalCA)}
                        </span>
                        <button
                          onClick={() => removeCAScheduleItem(item.id)}
                          style={{ 
                            padding: '2px 6px', 
                            background: 'rgba(248,113,113,0.2)', 
                            border: 'none', 
                            borderRadius: 4, 
                            color: '#f87171', 
                            fontSize: 12, 
                            cursor: 'pointer' 
                          }}
                        >
                          ×
                        </button>
                      </div>
                    );
                  })}
                  
                  {/* Add Row Button */}
                  <button
                    onClick={addCAScheduleItem}
                    style={{ 
                      width: '100%', 
                      padding: '8px', 
                      marginTop: 8,
                      background: 'rgba(52,211,153,0.1)', 
                      border: '1px dashed rgba(52,211,153,0.5)', 
                      borderRadius: 4, 
                      color: '#34d399', 
                      fontSize: 11, 
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8
                    }}
                  >
                    <span style={{ fontSize: 14 }}>+</span> Add Asset
                  </button>
                  
                  {/* Totals Row */}
                  {caScheduleItems.length > 0 && (
                    <div style={{ display: 'grid', gridTemplateColumns: '100px 180px 140px 90px 60px 60px 80px 30px', padding: '10px', background: 'rgba(52,211,153,0.1)', borderRadius: 4, fontSize: 11, fontWeight: 600, marginTop: 8, borderTop: '2px solid rgba(75,85,99,0.3)', gap: 8 }}>
                      <span style={{ gridColumn: 'span 3' }}>TOTAL ({caScheduleItems.length} assets)</span>
                      <span style={{ textAlign: 'right', fontFamily: 'monospace' }}>{fmt(getTotalCAScheduleCost())}</span>
                      <span></span>
                      <span></span>
                      <span style={{ textAlign: 'right', fontFamily: 'monospace', color: '#34d399' }}>{fmt(computeTotalCapitalAllowance())}</span>
                      <span></span>
                    </div>
                  )}
                  
                  {/* CA Breakdown */}
                  {caScheduleItems.length > 0 && (
                    <div style={{ marginTop: 12, padding: 12, background: 'rgba(17,24,39,0.3)', borderRadius: 8, fontSize: 10 }}>
                      <div style={{ fontWeight: 600, color: '#a5b4fc', marginBottom: 8 }}>📊 CA Breakdown for YA {currentYear}</div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                        <div style={{ padding: 10, background: 'rgba(52,211,153,0.1)', borderRadius: 6, borderLeft: '3px solid #34d399' }}>
                          <div style={{ fontSize: 9, color: '#9ca3af' }}>Initial Allowance (New Assets)</div>
                          <div style={{ fontSize: 14, fontWeight: 700, color: '#34d399', fontFamily: 'monospace' }}>
                            RM {fmt(caScheduleItems.reduce((sum, item) => sum + calculateItemCA(item).ia, 0))}
                          </div>
                          <div style={{ fontSize: 8, color: '#6b7280', marginTop: 2 }}>
                            {caScheduleItems.filter(item => calculateItemCA(item).isCurrentYear).length} assets acquired in {currentYear}
                          </div>
                        </div>
                        <div style={{ padding: 10, background: 'rgba(96,165,250,0.1)', borderRadius: 6, borderLeft: '3px solid #60a5fa' }}>
                          <div style={{ fontSize: 9, color: '#9ca3af' }}>Annual Allowance (All Assets)</div>
                          <div style={{ fontSize: 14, fontWeight: 700, color: '#60a5fa', fontFamily: 'monospace' }}>
                            RM {fmt(caScheduleItems.reduce((sum, item) => sum + calculateItemCA(item).aa, 0))}
                          </div>
                          <div style={{ fontSize: 8, color: '#6b7280', marginTop: 2 }}>
                            {caScheduleItems.length} qualifying assets
                          </div>
                        </div>
                        <div style={{ padding: 10, background: 'rgba(167,139,250,0.1)', borderRadius: 6, borderLeft: '3px solid #a78bfa' }}>
                          <div style={{ fontSize: 9, color: '#9ca3af' }}>Total CA Claimed</div>
                          <div style={{ fontSize: 14, fontWeight: 700, color: '#a78bfa', fontFamily: 'monospace' }}>
                            RM {fmt(computeTotalCapitalAllowance())}
                          </div>
                          <div style={{ fontSize: 8, color: '#6b7280', marginTop: 2 }}>
                            IA + AA for YA {currentYear}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {/* Info */}
                  <div style={{ marginTop: 12, padding: 12, background: 'rgba(99,102,241,0.1)', borderRadius: 8, fontSize: 10, color: '#9ca3af' }}>
                    <div style={{ fontWeight: 600, color: '#a5b4fc', marginBottom: 6 }}>ℹ️ Capital Allowance Rates (LHDN Schedule 3)</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, fontSize: 9 }}>
                      <div><span style={{ color: '#6b7280' }}>Plant & Machinery:</span> IA 20%, AA 14%</div>
                      <div><span style={{ color: '#6b7280' }}>Motor Vehicles:</span> IA 20%, AA 20%</div>
                      <div><span style={{ color: '#6b7280' }}>Computer/ICT:</span> IA 20%, AA 40%</div>
                      <div><span style={{ color: '#6b7280' }}>Office Equipment:</span> IA 20%, AA 10%</div>
                      <div><span style={{ color: '#6b7280' }}>Industrial Building:</span> IA 10%, AA 3%</div>
                      <div><span style={{ color: '#6b7280' }}>Environmental:</span> IA 40%, AA 20%</div>
                      <div><span style={{ color: '#6b7280' }}>Small Value (&lt;RM2k):</span> AA 100%</div>
                      <div><span style={{ color: '#6b7280' }}>Heavy Machinery:</span> IA 20%, AA 10%</div>
                    </div>
                    <div style={{ marginTop: 8, fontSize: 9, color: '#6b7280', borderTop: '1px solid rgba(75,85,99,0.2)', paddingTop: 8 }}>
                      <strong>Note:</strong> IA (Initial Allowance) is claimed in the year of acquisition only. AA (Annual Allowance) is claimed every year until the qualifying expenditure is fully absorbed. 
                      The total cost in CA Schedule should match PPE Subledger for reconciliation.
                    </div>
                  </div>
                </div>
              </div>
          </div>
        )}

        {/* ============================================ */}
        {/* SNAPSHOTS TAB */}
        {/* ============================================ */}
        {tab === 'snapshots' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <button onClick={goBack} style={backBtnStyle}>← Tax</button>
              <button onClick={goNext} style={nextBtnStyle}>Dashboard →</button>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              {/* Snapshots Section */}
              <div style={{ background: 'rgba(31,41,55,0.6)', borderRadius: 12, border: '1px solid rgba(75,85,99,0.3)', overflow: 'hidden' }}>
                <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(75,85,99,0.2)', background: 'linear-gradient(135deg, rgba(99,102,241,0.1), rgba(139,92,246,0.1))' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 16 }}>📦 FS Snapshots</div>
                      <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>Delivered financial statement packs</div>
                    </div>
                    {res && (
                      <button 
                        onClick={() => {
                          setSnapshotForm({
                            periodType: 'Monthly',
                            periodLabel: `${currentYear}-${String(new Date().getMonth() + 1).padStart(2, '0')}`,
                            note: '',
                            createdBy: 'Accountant'
                          });
                          setShowSnapshotModal(true);
                        }}
                        style={{ padding: '8px 16px', background: 'linear-gradient(135deg, #10b981, #059669)', border: 'none', borderRadius: 6, color: '#fff', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
                      >✅ Save Snapshot</button>
                    )}
                  </div>
                </div>
                <div style={{ padding: 16, maxHeight: 400, overflowY: 'auto' }}>
                  {fsSnapshots.length > 0 ? fsSnapshots.map((snap) => (
                    <div key={snap.id} style={{ background: 'rgba(17,24,39,0.4)', borderRadius: 8, border: '1px solid rgba(75,85,99,0.3)', marginBottom: 8, padding: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ background: snap.periodType === 'Yearly' ? 'rgba(251,191,36,0.2)' : 'rgba(99,102,241,0.2)', color: snap.periodType === 'Yearly' ? '#fbbf24' : '#a5b4fc', padding: '2px 6px', borderRadius: 4, fontSize: 9 }}>{snap.periodType}</span>
                          <span style={{ fontWeight: 700, fontSize: 13 }}>{snap.periodLabel}</span>
                          <span style={{ background: 'rgba(52,211,153,0.2)', color: '#34d399', padding: '2px 6px', borderRadius: 4, fontSize: 9 }}>v{snap.version}</span>
                        </div>
                        <span style={{ fontSize: 9, color: '#6b7280' }}>{new Date(snap.createdAt).toLocaleDateString()}</span>
                      </div>
                      {snap.note && <div style={{ fontSize: 10, color: '#9ca3af', marginBottom: 8, fontStyle: 'italic' }}>"{snap.note}"</div>}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ fontSize: 9, color: '#6b7280' }}>Txs: {(snap.snapshotMeta?.counts?.bankTxs || 0) + (snap.snapshotMeta?.counts?.cashTxs || 0)} | JEs: {snap.snapshotMeta?.counts?.jes || 0}</div>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button onClick={() => loadSnapshot(snap)} style={{ padding: '4px 8px', background: 'rgba(99,102,241,0.2)', border: 'none', borderRadius: 4, color: '#a5b4fc', fontSize: 9, cursor: 'pointer' }}>View</button>
                          <button onClick={() => deleteSnapshot(snap.id)} style={{ padding: '4px 8px', background: 'rgba(239,68,68,0.15)', border: 'none', borderRadius: 4, color: '#fca5a5', fontSize: 9, cursor: 'pointer' }}>Delete</button>
                        </div>
                      </div>
                    </div>
                  )) : (
                    <div style={{ textAlign: 'center', padding: 30, color: '#6b7280' }}>
                      <div style={{ fontSize: 32, marginBottom: 8 }}>📦</div>
                      <div style={{ fontSize: 12 }}>No snapshots yet</div>
                      <div style={{ fontSize: 10 }}>Generate FS and save a snapshot</div>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Adjustment Log Section */}
              <div style={{ background: 'rgba(31,41,55,0.6)', borderRadius: 12, border: '1px solid rgba(75,85,99,0.3)', overflow: 'hidden' }}>
                <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(75,85,99,0.2)', background: 'linear-gradient(135deg, rgba(251,191,36,0.1), rgba(245,158,11,0.1))', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 16 }}>🧾 Adjustment Log</div>
                    <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>Track changes between versions</div>
                  </div>
                  {adjustmentLog.length > 0 && (
                    <span style={{ background: 'rgba(251,191,36,0.2)', color: '#fbbf24', padding: '4px 10px', borderRadius: 8, fontSize: 11, fontWeight: 600 }}>
                      {adjustmentLog.length} entries
                    </span>
                  )}
                </div>
                <div style={{ padding: 16 }}>
                  {/* Add Adjustment Form */}
                  <div style={{ background: 'rgba(17,24,39,0.4)', borderRadius: 8, padding: 12, marginBottom: 12 }}>
                    <div style={{ fontSize: 10, color: '#9ca3af', marginBottom: 8 }}>➕ Add Manual Adjustment</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                      <input type="text" value={adjustmentForm.periodLabel} onChange={e => setAdjustmentForm(p => ({...p, periodLabel: e.target.value}))} placeholder="Period (e.g. 2025-01)" style={{ padding: '6px 8px', background: 'rgba(17,24,39,0.6)', border: '1px solid rgba(75,85,99,0.3)', borderRadius: 4, color: '#e5e7eb', fontSize: 11 }} />
                      <select value={adjustmentForm.type} onChange={e => setAdjustmentForm(p => ({...p, type: e.target.value}))} style={{ padding: '6px 8px', background: 'rgba(17,24,39,0.6)', border: '1px solid rgba(75,85,99,0.3)', borderRadius: 4, color: '#e5e7eb', fontSize: 11 }}>
                        <option value="Correction">Correction</option>
                        <option value="Reclass">Reclass</option>
                        <option value="Accrual">Accrual</option>
                        <option value="TaxAdj">Tax Adjustment</option>
                        <option value="Depreciation">Depreciation</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr auto', gap: 8 }}>
                      <input type="number" value={adjustmentForm.amount} onChange={e => setAdjustmentForm(p => ({...p, amount: e.target.value}))} placeholder="Amount" style={{ padding: '6px 8px', background: 'rgba(17,24,39,0.6)', border: '1px solid rgba(75,85,99,0.3)', borderRadius: 4, color: '#e5e7eb', fontSize: 11, textAlign: 'right' }} />
                      <input type="text" value={adjustmentForm.description} onChange={e => setAdjustmentForm(p => ({...p, description: e.target.value}))} placeholder="Description" style={{ padding: '6px 8px', background: 'rgba(17,24,39,0.6)', border: '1px solid rgba(75,85,99,0.3)', borderRadius: 4, color: '#e5e7eb', fontSize: 11 }} />
                      <button onClick={addAdjustment} style={{ padding: '6px 12px', background: 'linear-gradient(135deg, #fbbf24, #f59e0b)', border: 'none', borderRadius: 4, color: '#1f2937', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>+</button>
                    </div>
                  </div>
                  
                  {/* Adjustment List */}
                  <div style={{ maxHeight: 350, overflowY: 'auto' }}>
                    {adjustmentLog.length > 0 ? adjustmentLog.map((adj) => (
                      <div key={adj.id} style={{ 
                        padding: '10px 12px', 
                        borderBottom: '1px solid rgba(75,85,99,0.2)', 
                        fontSize: 10,
                        background: adj.isAuto ? 'rgba(99,102,241,0.05)' : 'transparent'
                      }}>
                        {/* Top row: Period, Category, Type, Auto badge */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 4 }}>
                          <span style={{ color: '#a5b4fc', fontWeight: 700, fontSize: 11 }}>{adj.periodLabel}</span>
                          {adj.category && (
                            <span style={{ 
                              background: adj.category.startsWith('IS') ? 'rgba(52,211,153,0.15)' : 
                                         adj.category.startsWith('BS') ? 'rgba(59,130,246,0.15)' : 'rgba(107,114,128,0.15)',
                              color: adj.category.startsWith('IS') ? '#34d399' : 
                                     adj.category.startsWith('BS') ? '#60a5fa' : '#9ca3af',
                              padding: '1px 5px', 
                              borderRadius: 3, 
                              fontSize: 8,
                              fontWeight: 600
                            }}>{adj.category}</span>
                          )}
                          <span style={{ 
                            background: adj.type === 'TaxAdj' ? 'rgba(251,191,36,0.2)' : 
                                       adj.type === 'Depreciation' ? 'rgba(139,92,246,0.2)' :
                                       adj.type === 'Reclass' ? 'rgba(236,72,153,0.2)' :
                                       adj.type === 'Other' ? 'rgba(107,114,128,0.2)' : 'rgba(99,102,241,0.2)', 
                            color: adj.type === 'TaxAdj' ? '#fbbf24' : 
                                   adj.type === 'Depreciation' ? '#c4b5fd' :
                                   adj.type === 'Reclass' ? '#f472b6' :
                                   adj.type === 'Other' ? '#9ca3af' : '#a5b4fc',
                            padding: '1px 5px', 
                            borderRadius: 3, 
                            fontSize: 8,
                            fontWeight: 600
                          }}>{adj.type}</span>
                          {adj.isAuto && (
                            <span style={{ background: 'rgba(52,211,153,0.2)', color: '#34d399', padding: '1px 5px', borderRadius: 3, fontSize: 8, fontWeight: 600 }}>AUTO</span>
                          )}
                          <span style={{ marginLeft: 'auto', color: '#6b7280', fontSize: 8 }}>{adj.date}</span>
                        </div>
                        
                        {/* Middle row: Field name (if available) */}
                        {adj.field && (
                          <div style={{ color: '#e5e7eb', fontWeight: 600, fontSize: 11, marginBottom: 2 }}>
                            {adj.field}
                            {adj.glCode && <span style={{ color: '#6b7280', fontWeight: 400, marginLeft: 4 }}>({adj.glCode})</span>}
                          </div>
                        )}
                        
                        {/* Bottom row: Values and amount change */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div style={{ color: '#9ca3af', fontSize: 10 }}>
                            {adj.oldValue !== undefined && adj.newValue !== undefined ? (
                              <span>
                                <span style={{ color: '#f87171' }}>{fmt(adj.oldValue)}</span>
                                <span style={{ margin: '0 4px' }}>→</span>
                                <span style={{ color: '#34d399' }}>{fmt(adj.newValue)}</span>
                              </span>
                            ) : (
                              adj.description
                            )}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            {adj.amount !== 0 && (
                              <span style={{ 
                                fontFamily: 'monospace', 
                                fontSize: 11,
                                padding: '2px 6px',
                                borderRadius: 4,
                                background: adj.amount > 0 ? 'rgba(52,211,153,0.15)' : 'rgba(248,113,113,0.15)',
                                color: adj.amount > 0 ? '#34d399' : '#f87171',
                                fontWeight: 700
                              }}>
                                {adj.amount > 0 ? '+' : ''}{fmt(adj.amount)}
                              </span>
                            )}
                            <button onClick={() => deleteAdjustment(adj.id)} style={{ padding: '2px 5px', background: 'rgba(239,68,68,0.15)', border: 'none', borderRadius: 3, color: '#fca5a5', fontSize: 9, cursor: 'pointer' }}>×</button>
                          </div>
                        </div>
                      </div>
                    )) : (
                      <div style={{ textAlign: 'center', padding: 20, color: '#6b7280', fontSize: 11 }}>No adjustments recorded</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* Snapshot Modal */}
        {showSnapshotModal && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
            <div style={{ background: '#1f2937', borderRadius: 12, padding: 20, maxWidth: 400, width: '90%' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>📦 Save Snapshot</h3>
                <button onClick={() => setShowSnapshotModal(false)} style={{ background: 'none', border: 'none', color: '#9ca3af', fontSize: 18, cursor: 'pointer' }}>×</button>
              </div>
              <div style={{ display: 'grid', gap: 12 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={{ fontSize: 10, color: '#9ca3af', display: 'block', marginBottom: 4 }}>Period Type</label>
                    <select value={snapshotForm.periodType} onChange={e => setSnapshotForm(p => ({...p, periodType: e.target.value}))} style={{ width: '100%', padding: '8px', background: 'rgba(17,24,39,0.6)', border: '1px solid rgba(75,85,99,0.3)', borderRadius: 6, color: '#e5e7eb', fontSize: 12 }}>
                      <option value="Monthly">Monthly</option>
                      <option value="Yearly">Yearly</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: 10, color: '#9ca3af', display: 'block', marginBottom: 4 }}>Period Label</label>
                    <input type="text" value={snapshotForm.periodLabel} onChange={e => setSnapshotForm(p => ({...p, periodLabel: e.target.value}))} placeholder="2025-01" style={{ width: '100%', padding: '8px', background: 'rgba(17,24,39,0.6)', border: '1px solid rgba(75,85,99,0.3)', borderRadius: 6, color: '#e5e7eb', fontSize: 12, boxSizing: 'border-box' }} />
                  </div>
                </div>
                <div>
                  <label style={{ fontSize: 10, color: '#9ca3af', display: 'block', marginBottom: 4 }}>Created By</label>
                  <input type="text" value={snapshotForm.createdBy} onChange={e => setSnapshotForm(p => ({...p, createdBy: e.target.value}))} style={{ width: '100%', padding: '8px', background: 'rgba(17,24,39,0.6)', border: '1px solid rgba(75,85,99,0.3)', borderRadius: 6, color: '#e5e7eb', fontSize: 12, boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ fontSize: 10, color: '#9ca3af', display: 'block', marginBottom: 4 }}>Note</label>
                  <textarea value={snapshotForm.note} onChange={e => setSnapshotForm(p => ({...p, note: e.target.value}))} rows={2} placeholder="Optional note..." style={{ width: '100%', padding: '8px', background: 'rgba(17,24,39,0.6)', border: '1px solid rgba(75,85,99,0.3)', borderRadius: 6, color: '#e5e7eb', fontSize: 12, resize: 'none', boxSizing: 'border-box' }} />
                </div>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button onClick={() => setShowSnapshotModal(false)} style={{ padding: '8px 16px', background: 'rgba(75,85,99,0.3)', border: 'none', borderRadius: 6, color: '#9ca3af', fontSize: 12, cursor: 'pointer' }}>Cancel</button>
                  <button onClick={createSnapshot} style={{ padding: '8px 16px', background: 'linear-gradient(135deg, #10b981, #059669)', border: 'none', borderRadius: 6, color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Save</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ============================================ */}
        {/* DASHBOARD TAB */}
        {/* ============================================ */}
        {tab === 'dashboard' && res && (() => {
          const dashboard = computeDashboardMetrics();
          if (!dashboard) return <div style={{ padding: 20, textAlign: 'center', color: '#9ca3af' }}>Generate financial statements first to view dashboard.</div>;
          
          const { kpis, ratios, comparatives, insights } = dashboard;
          
          // Format helpers
          const fmtPct = (v) => v !== null && !isNaN(v) ? v.toFixed(1) + '%' : '-';
          const fmtRatio = (v) => v !== null && !isNaN(v) ? v.toFixed(2) : '-';
          
          // Comparative Donut Chart Component (CY vs PY side by side)
          const ComparativeDonut = ({ cy, py, total, pyTotal, label, color, size = 70 }) => {
            const cyPct = total > 0 ? (cy / total) * 100 : 0;
            const pyPct = pyTotal > 0 ? (py / pyTotal) * 100 : 0;
            const circumference = 2 * Math.PI * 28;
            const cyOffset = circumference - (cyPct / 100) * circumference;
            const pyOffset = circumference - (pyPct / 100) * circumference;
            const growth = py > 0 ? ((cy - py) / py) * 100 : (cy > 0 ? 100 : 0);
            
            return (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  {/* CY Donut */}
                  <div style={{ position: 'relative' }}>
                    <svg width={size} height={size} viewBox="0 0 64 64">
                      <circle cx="32" cy="32" r="28" fill="none" stroke="rgba(75,85,99,0.3)" strokeWidth="6" />
                      <circle 
                        cx="32" cy="32" r="28" 
                        fill="none" 
                        stroke={color} 
                        strokeWidth="6"
                        strokeLinecap="round"
                        strokeDasharray={circumference}
                        strokeDashoffset={cyOffset}
                        transform="rotate(-90 32 32)"
                      />
                      <text x="32" y="32" textAnchor="middle" dominantBaseline="middle" fill="#e5e7eb" fontSize="10" fontWeight="700" fontFamily="monospace">
                        {cyPct.toFixed(0)}%
                      </text>
                    </svg>
                    <div style={{ position: 'absolute', bottom: -2, left: '50%', transform: 'translateX(-50%)', fontSize: 7, color: '#9ca3af', background: 'rgba(17,24,39,0.8)', padding: '1px 4px', borderRadius: 2 }}>CY</div>
                  </div>
                  {/* PY Donut */}
                  <div style={{ position: 'relative' }}>
                    <svg width={size * 0.85} height={size * 0.85} viewBox="0 0 64 64">
                      <circle cx="32" cy="32" r="28" fill="none" stroke="rgba(75,85,99,0.2)" strokeWidth="5" />
                      <circle 
                        cx="32" cy="32" r="28" 
                        fill="none" 
                        stroke={`${color}80`}
                        strokeWidth="5"
                        strokeLinecap="round"
                        strokeDasharray={circumference}
                        strokeDashoffset={pyOffset}
                        transform="rotate(-90 32 32)"
                      />
                      <text x="32" y="32" textAnchor="middle" dominantBaseline="middle" fill="#9ca3af" fontSize="9" fontWeight="600" fontFamily="monospace">
                        {pyPct.toFixed(0)}%
                      </text>
                    </svg>
                    <div style={{ position: 'absolute', bottom: -2, left: '50%', transform: 'translateX(-50%)', fontSize: 7, color: '#6b7280', background: 'rgba(17,24,39,0.8)', padding: '1px 4px', borderRadius: 2 }}>PY</div>
                  </div>
                </div>
                <div style={{ fontSize: 9, color: '#9ca3af', marginTop: 8, textAlign: 'center' }}>{label}</div>
                <div style={{ 
                  fontSize: 8, 
                  padding: '2px 6px', 
                  borderRadius: 3, 
                  marginTop: 2,
                  background: growth >= 0 ? 'rgba(52,211,153,0.2)' : 'rgba(248,113,113,0.2)',
                  color: growth >= 0 ? '#34d399' : '#f87171'
                }}>
                  {growth >= 0 ? '▲' : '▼'} {Math.abs(growth).toFixed(1)}%
                </div>
              </div>
            );
          };
          
          // Comparative Bar Chart for P&L items
          const ComparativeBar = ({ cy, py, label, color, maxVal }) => {
            const growth = py > 0 ? ((cy - py) / py) * 100 : (cy > 0 ? 100 : 0);
            const cyWidth = maxVal > 0 ? (Math.abs(cy) / maxVal) * 100 : 0;
            const pyWidth = maxVal > 0 ? (Math.abs(py) / maxVal) * 100 : 0;
            
            return (
              <div style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontSize: 10, color: '#e5e7eb', fontWeight: 500 }}>{label}</span>
                  <div style={{ 
                    fontSize: 9, 
                    padding: '2px 6px', 
                    borderRadius: 4, 
                    background: growth >= 0 ? 'rgba(52,211,153,0.2)' : 'rgba(248,113,113,0.2)',
                    color: growth >= 0 ? '#34d399' : '#f87171'
                  }}>
                    {growth >= 0 ? '▲' : '▼'} {Math.abs(growth).toFixed(1)}%
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {/* CY Bar */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 24, fontSize: 8, color: '#9ca3af' }}>CY</div>
                    <div style={{ flex: 1, height: 18, background: 'rgba(17,24,39,0.5)', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{ 
                        height: '100%', 
                        width: `${cyWidth}%`, 
                        background: `linear-gradient(90deg, ${color}, ${color}aa)`,
                        borderRadius: 4,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'flex-end',
                        paddingRight: 6
                      }}>
                        <span style={{ fontSize: 9, fontFamily: 'monospace', color: '#fff', fontWeight: 600, textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}>
                          {fmt(cy)}
                        </span>
                      </div>
                    </div>
                  </div>
                  {/* PY Bar */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 24, fontSize: 8, color: '#6b7280' }}>PY</div>
                    <div style={{ flex: 1, height: 14, background: 'rgba(17,24,39,0.5)', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ 
                        height: '100%', 
                        width: `${pyWidth}%`, 
                        background: `${color}50`,
                        borderRadius: 3,
                        border: `1px solid ${color}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'flex-end',
                        paddingRight: 6
                      }}>
                        <span style={{ fontSize: 8, fontFamily: 'monospace', color: '#9ca3af' }}>
                          {fmt(py)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          };
          
          // Ratio Gauge Component
          const RatioGauge = ({ title, value, min, max, target, unit = '' }) => {
            const pct = Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100));
            const targetPct = ((target - min) / (max - min)) * 100;
            const isGood = value >= target;
            
            return (
              <div style={{ background: 'rgba(31,41,55,0.6)', borderRadius: 8, padding: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontSize: 9, color: '#9ca3af', textTransform: 'uppercase' }}>{title}</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: isGood ? '#34d399' : '#fbbf24', fontFamily: 'monospace' }}>
                    {typeof value === 'number' ? value.toFixed(unit === '%' ? 1 : 2) : value}{unit}
                  </span>
                </div>
                <div style={{ height: 5, background: 'rgba(17,24,39,0.5)', borderRadius: 3, overflow: 'hidden', position: 'relative' }}>
                  <div style={{ 
                    height: '100%', 
                    width: `${pct}%`, 
                    background: isGood ? '#34d399' : '#fbbf24',
                    borderRadius: 3
                  }} />
                  <div style={{ 
                    position: 'absolute', 
                    left: `${targetPct}%`, 
                    top: -1, 
                    width: 2, 
                    height: 7, 
                    background: '#e5e7eb',
                    borderRadius: 1
                  }} />
                </div>
                <div style={{ fontSize: 7, color: '#6b7280', marginTop: 3 }}>Target: {target}{unit}</div>
              </div>
            );
          };
          
          // Calculate max values for bar charts
          const isMaxVal = Math.max(kpis.revenue, comparatives.pyRevenue, kpis.grossProfit, comparatives.pyGp, Math.abs(kpis.pat), Math.abs(comparatives.pyPat), 1);
          const bsMaxVal = Math.max(kpis.totalAssets, comparatives.pyTotalAssets, kpis.totalEquity, comparatives.pyTotalEquity, kpis.totalLiabilities, res.bs.py_totL || 0, 1);
          
          return (
            <div>
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <button onClick={goBack} style={backBtnStyle}>← Tax Computation</button>
                  <span style={{ fontWeight: 700, fontSize: 16 }}>📊 Financial Dashboard</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10 }}>
                    <span style={{ width: 12, height: 12, background: '#60a5fa', borderRadius: 2 }}></span>
                    <span style={{ color: '#9ca3af' }}>CY {currentYear}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10 }}>
                    <span style={{ width: 12, height: 12, background: 'rgba(96,165,250,0.3)', border: '1px solid #60a5fa', borderRadius: 2 }}></span>
                    <span style={{ color: '#6b7280' }}>PY {priorFSYear}</span>
                  </div>
                </div>
              </div>
              
              {/* Main Charts - Income Statement & Balance Sheet Side by Side */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                
                {/* Income Statement Comparative */}
                <div style={{ background: 'rgba(31,41,55,0.6)', borderRadius: 12, border: '1px solid rgba(75,85,99,0.3)', padding: 16 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#60a5fa', marginBottom: 16, textTransform: 'uppercase', letterSpacing: 0.5, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span>📈</span> Income Statement
                  </div>
                  <ComparativeBar cy={kpis.revenue} py={comparatives.pyRevenue} label="Revenue" color="#60a5fa" maxVal={isMaxVal} />
                  <ComparativeBar cy={kpis.grossProfit} py={comparatives.pyGp} label="Gross Profit" color="#34d399" maxVal={isMaxVal} />
                  <ComparativeBar cy={kpis.pat} py={comparatives.pyPat} label="Net Profit" color={kpis.pat >= 0 ? '#a78bfa' : '#f87171'} maxVal={isMaxVal} />
                </div>
                
                {/* Balance Sheet Comparative */}
                <div style={{ background: 'rgba(31,41,55,0.6)', borderRadius: 12, border: '1px solid rgba(75,85,99,0.3)', padding: 16 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#34d399', marginBottom: 16, textTransform: 'uppercase', letterSpacing: 0.5, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span>🏛️</span> Balance Sheet
                  </div>
                  <ComparativeBar cy={kpis.totalAssets} py={comparatives.pyTotalAssets} label="Total Assets" color="#60a5fa" maxVal={bsMaxVal} />
                  <ComparativeBar cy={kpis.totalEquity} py={comparatives.pyTotalEquity} label="Total Equity" color="#34d399" maxVal={bsMaxVal} />
                  <ComparativeBar cy={kpis.totalLiabilities} py={res.bs.py_totL || 0} label="Total Liabilities" color="#f87171" maxVal={bsMaxVal} />
                </div>
              </div>
              
              {/* Capital Structure Comparison (Donut Charts) */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 16, marginBottom: 16 }}>
                
                {/* Capital Structure - CY vs PY */}
                <div style={{ background: 'rgba(31,41,55,0.6)', borderRadius: 12, border: '1px solid rgba(75,85,99,0.3)', padding: 16 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    Capital Structure (% of Assets)
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-around' }}>
                    <ComparativeDonut 
                      cy={kpis.totalEquity} 
                      py={comparatives.pyTotalEquity}
                      total={kpis.totalAssets}
                      pyTotal={comparatives.pyTotalAssets}
                      label="Equity" 
                      color="#34d399" 
                    />
                    <ComparativeDonut 
                      cy={kpis.totalLiabilities} 
                      py={res.bs.py_totL || 0}
                      total={kpis.totalAssets}
                      pyTotal={comparatives.pyTotalAssets}
                      label="Liabilities" 
                      color="#f87171" 
                    />
                  </div>
                  <div style={{ marginTop: 12, padding: 8, background: 'rgba(17,24,39,0.3)', borderRadius: 6, fontSize: 9, color: '#6b7280', textAlign: 'center' }}>
                    Total Assets: CY <span style={{ color: '#e5e7eb', fontFamily: 'monospace' }}>{fmt(kpis.totalAssets)}</span> vs PY <span style={{ color: '#9ca3af', fontFamily: 'monospace' }}>{fmt(comparatives.pyTotalAssets)}</span>
                  </div>
                </div>
                
                {/* Key Ratios with Gauges */}
                <div style={{ background: 'rgba(31,41,55,0.6)', borderRadius: 12, border: '1px solid rgba(75,85,99,0.3)', padding: 16 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    Key Financial Ratios
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                    <RatioGauge title="Gross Margin" value={ratios.grossMargin} min={0} max={60} target={30} unit="%" />
                    <RatioGauge title="Operating Margin" value={ratios.operatingMargin} min={0} max={40} target={15} unit="%" />
                    <RatioGauge title="Return on Equity" value={ratios.roe} min={0} max={40} target={15} unit="%" />
                    <RatioGauge title="Current Ratio" value={ratios.currentRatio} min={0} max={4} target={1.5} />
                    <RatioGauge title="Cash Ratio" value={ratios.cashRatio} min={0} max={2} target={0.5} />
                    <RatioGauge title="Debt to Equity" value={ratios.debtToEquity} min={0} max={3} target={1} />
                  </div>
                </div>
              </div>
              
              {/* Financial Insights */}
              <div style={{ background: 'rgba(31,41,55,0.6)', borderRadius: 12, border: '1px solid rgba(75,85,99,0.3)', padding: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#f472b6', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span>🤖</span> Financial Analysis & Insights
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, maxHeight: 300, overflowY: 'auto' }}>
                  {insights.length > 0 ? insights.map((insight, i) => (
                    <div key={i} style={{ 
                      padding: 12, 
                      background: insight.type === 'success' ? 'rgba(52,211,153,0.1)' : 
                                 insight.type === 'danger' ? 'rgba(248,113,113,0.1)' : 
                                 'rgba(251,191,36,0.1)',
                      borderRadius: 8,
                      borderLeft: `3px solid ${insight.type === 'success' ? '#34d399' : insight.type === 'danger' ? '#f87171' : '#fbbf24'}`
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                        <span style={{ fontSize: 14 }}>{insight.icon}</span>
                        <span style={{ fontSize: 9, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.5 }}>{insight.category}</span>
                      </div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: '#e5e7eb', marginBottom: 4 }}>{insight.title}</div>
                      <div style={{ fontSize: 10, color: '#d1d5db', marginBottom: 6 }}>{insight.text}</div>
                      {insight.detail && (
                        <div style={{ fontSize: 9, color: '#9ca3af', padding: '8px', background: 'rgba(17,24,39,0.3)', borderRadius: 4 }}>
                          💡 {insight.detail}
                        </div>
                      )}
                    </div>
                  )) : (
                    <div style={{ gridColumn: 'span 2', color: '#6b7280', fontSize: 11, fontStyle: 'italic', textAlign: 'center', padding: 20 }}>
                      No significant insights to report. The company appears to be in stable financial condition.
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })()}
      </main>

      <footer style={{ padding: '12px 20px', borderTop: '1px solid rgba(75,85,99,0.2)', textAlign: 'center', color: '#6b7280', fontSize: 10 }}>
        Financial Statements Automation • Multi-Bank • 12-Month • MFRS / IFRS / MPERS
      </footer>
    </div>
  );
}
