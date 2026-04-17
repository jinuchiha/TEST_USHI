import type React from 'react';


export enum Role {
  MANAGER = 'Manager',
  OFFICER = 'Officer',
  ADMIN = 'Admin',
  FINANCE = 'Accountant',
  CEO = 'CEO',
}

export interface User {
  id: string;
  name: string;
  role: Role;
  password?: string;
  target?: number;
  agentCode?: string;
  dailyTarget?: number;
}

// Replaced CaseStatus with CRMStatus
export enum CRMStatus {
    CB = 'CB',
    NCC = 'NCC',
    FIP = 'FIP',
    NITP = 'NITP',
    UTR = 'UTR',
    DXB = 'DXB',
    UNDER_NEGO = 'UNDER NEGO',
    DISPUTE = 'Dispute',
    PTP = 'PTP',
    WIP = 'WIP',
    EXPIRE = 'Expire',
    WDS = 'WDS',
    CLOSED = 'Closed',
    WITHDRAWN = 'Withdrawn',
    NIP = 'NIP',
    RTP = 'RTP',
    NEW = 'New',
    HOLD = 'Hold',
}

export enum SubStatus {
    // Shared
    NONE = '',

    // CB Statuses
    RNR = 'RNR',
    ANSM = 'ANSM',
    CB_MAIL = 'CB-MAIL',
    IN_UAE = 'IN-UAE',
    MAIL_REPLY = 'MAIL-REPLY',
    MAIL_RETURN = 'MAIL-RETURN',
    MAIL_SENT = 'MAIL-SENT',
    MNSO = 'MNSO',
    MOL_A = 'MOL-A',
    MOL_I = 'MOL-I',
    OUT_UAE = 'OUT-UAE',
    SMSD = 'SMSD',
    SMSND = 'SMSND',
    TPC = 'TPC',
    UN = 'UN',
    VMAIL = 'VMAIL',
    OUT_UAE_PAKISTAN = 'Out-UAE/Pakistan',
    THIRD_PARTY_CONTACT = 'Third party Contact',
    MOL_ACTIVE = 'MOL-Active',
    MAIL_DELIVERED = 'Mail Delivered',
    
    // Other Statuses
    NOT_CONTACTABLE = 'Not Contactable',
    FINANCIAL_ISSUES = 'Financial Issues',
    NOT_INTERESTED_TO_PAY = 'Not intrested to pay',
    UNDER_TRACING = 'Under Tracing',
    CASE_BILKISH_HANDLE = 'Case Bilkish Handle',
    FOLLOW_UP = 'Follow Up',
    UNDER_NEGOTIATION = 'Under Negotiation',
    REFUSE_OR_SETTLE = 'Refuse or settle',
    PROMISE_TO_PAY = 'Promise To Pay',
    PARTIAL_PAYMENT = 'Partial Payment',
    PAID = 'Paid',
    WORK_IN_PROCESS = 'Work in Process',
    DC_DEATH_CERTIFICATE = 'DC-(Death Certificate)',
    WITHDRAWAL_STATUS = 'Withdrawal Status',
    PAID_CLOSED = 'Paid & Closed',
    BANK_RECALL = 'Bank Recall',
    PAID_AND_WITHDRAWN = 'Paid & Withdrawn',
    NOT_IN_PORTAL = 'Not in Portal',
    ARCHIVED_BANK_RECALL = 'Archived - Bank Recall',
    ARCHIVED_PAID_AND_WITHDRAWN = 'Archived - Paid & Withdrawn',
    SWITCHED_OFF = 'Switched Off',
    NOT_CONNECTED = 'Not Connected',
    CALL_BACK = 'Call Back',
    REFUSE_TO_PAY = 'Refuse to Pay',
    DISPUTE_AMOUNT = 'Dispute Amount',
    LEFT_MESSAGE = 'Left Message',
}

export enum ActionType {
  SOFT_CALL = 'Soft Call',
  EMAIL_NOTICE = 'Email Notice',
  LEGAL_ASSESSMENT = 'Legal Assessment',
  PAYMENT_PLAN_AGREED = 'Payment Plan Agreed',
  PAYMENT_RECEIVED = 'Payment Received',
  CASE_CREATED = 'Case Created',
  STATUS_UPDATE = 'Status Update',
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  userId: string;
  caseId: string;
  details: string;
}

export interface Action {
  id: string;
  caseId: string;
  type: ActionType;
  timestamp: string;
  officerId: string;
  notes: string;
  nextFollowUp: string | null;
  amountPaid?: number;
  outstandingBalanceBeforePayment?: number;
  receipt?: {
    name: string;
    dataUrl: string;
  };
  deathCertificate?: {
    name: string;
    dataUrl: string;
  };
  paymentConfirmedBy?: 'Bank' | 'User';
  paymentVerifiedByFinanceAt?: string;
  attributionDate?: string;
  paymentType?: 'Full Payment' | 'Settlement' | 'Installment';
  confirmationMethod?: 'Slip' | 'Bank Confirmation';
  settlementLetter?: {
    name: string;
    dataUrl: string;
  };
  promisedAmount?: number;
  promisedDate?: string;
}

export interface Loan {
  id: string;
  debtorId: string;
  accountNumber: string;
  originalAmount: number;
  currentBalance: number; // This can be O/S
  product: string;
  bank: string;
  subProduct: string;
  bucket: string;
  currency: 'AED' | 'SAR' | 'BHD' | 'KWD';
  lpd?: string; // Last Payment Date
  wod?: string; // Write-off Date
  cif?: string; // Customer Information File
}

export interface TracingLogEntry {
  timestamp: string;
  note: string;
  officerId: string;
}

export interface Debtor {
  id: string;
  name: string;
  emails: string[];
  phones: string[];
  address: string;
  passport: string;
  cnic: string;
  eid: string;
  dob: string;
  tracingHistory: TracingLogEntry[];
}

// Bank Draft / PDC (Post-Dated Cheque) Tracking
export interface BankDraft {
    id: string;
    caseId: string;
    debtorName: string;
    accountNumber: string;
    bank: string;
    chequeNumber: string;
    chequeDate: string;         // When cheque should be presented
    amount: number;
    currency: string;
    drawerBank: string;         // Bank that issued the cheque
    status: 'pending' | 'presented' | 'cleared' | 'bounced' | 'cancelled' | 'replaced';
    presentedDate?: string;
    clearedDate?: string;
    bounceReason?: string;
    assignedOfficerId: string;
    notes: string;
    createdAt: string;
}

export interface Case {
  id: string;
  debtorId: string;
  loanId: string;
  assignedOfficerId: string;
  crmStatus: CRMStatus;
  subStatus: SubStatus;
  creationDate: string;
  lastContactDate: string;
  contactStatus: 'Contact' | 'Non Contact';
  workStatus: 'Work' | 'Non Work';
  tracingStatus: string;
  statusCode: string;
  cyber: 'Yes' | 'No';
  history: Action[];
  auditLog: AuditLogEntry[];
  bankDrafts?: BankDraft[];
}

export interface EnrichedCase extends Case {
    debtor: Debtor;
    loan: Loan;
    officer: User;
    // FIX: Made lastActionDate required as it's always assigned in `App.tsx`, resolving a type predicate error.
    lastActionDate: string;
}

export type NavItem = {
    label: string;
    view: string;
    // FIX: Changed JSX.Element to React.ReactNode to resolve "Cannot find namespace 'JSX'" error.
    icon?: (className: string) => React.ReactNode;
    children?: NavItem[];
    isHeading?: boolean;
    roles?: Role[];
};

export type HelpRequest = {
  userId: string;
  userName: string;
  userRole: Role;
  timestamp: string;
  query: string;
  status: 'pending' | 'resolved';
  resolvedBy?: string;
  resolvedAt?: string;
  adminReplies?: {
    adminName: string;
    message: string;
    timestamp: string;
  }[];
};

export type LoginRecord = {
    userId: string;
    userName: string;
    timestamp: string;
};

export interface AllocationLogEntry {
  id: string;
  timestamp: string;
  allocatorId: string;
  recipientId: string;
  caseIds: string[];
  count: number;
  type: 'Initial Assignment' | 'Re-Assignment' | 'Re-Activation';
}

export interface NotificationReply {
  id: string;
  senderId: string;
  senderName: string;
  message: string;
  timestamp: string;
}

export interface Notification {
  id: string;
  senderId: string;
  senderName: string;
  recipientId: string; // 'all' for all officers, or a specific user ID
  message: string;
  timestamp: string;
  status: 'unread' | 'read';
  priority: 'Normal' | 'Urgent';
  isTask: boolean;
  taskStatus?: 'pending' | 'done';
  replies?: NotificationReply[];
}


/**
 * @deprecated Use CRMStatus instead.
 */
export enum CaseStatus {
  ACTIVE = 'Active',
  SETTLED = 'Settled',
  WRITE_OFF = 'Write-Off',
}

// FIX: Moved from App.tsx to resolve circular dependency
export type UpdateCaseResult = {
    success: boolean;
    conflict?: {
        caseId: string;
        officerName: string;
    } | null;
}

export interface CaseDetailViewProps {
  caseData: EnrichedCase;
  allCases: EnrichedCase[];
  onClose: () => void;
  onUpdateCase: (caseId: string, newAction: Omit<Action, 'id'>) => UpdateCaseResult;
  onStatusChange: (caseId: string, statuses: { crmStatus: CRMStatus, subStatus: SubStatus, contactStatus: 'Contact' | 'Non Contact', workStatus: 'Work' | 'Non Work' }, notes: string, ptpDetails?: { promisedAmount?: number; promisedDate?: string }) => UpdateCaseResult;
  onUpdateCaseDetails: (caseId: string, debtorDetails: Partial<Debtor>, loanDetails: Partial<Loan>) => void;
  currentUser: User;
  coordinators: User[];
  onReassign: (caseIds: string[], newOfficerId: string) => void;
  users: User[];
  onInitiateNip: (caseData: EnrichedCase, notes: string) => void;
  onInitiatePaid: (caseData: EnrichedCase, statuses: any, notes: string) => void;
  onAutoAdvance?: () => void;
}

// Settlement Approval Matrix
export interface SettlementRequest {
    id: string;
    caseId: string;
    debtorName: string;
    accountNumber: string;
    bank: string;
    originalBalance: number;
    proposedAmount: number;
    discountPercent: number;
    currency: string;
    requestedBy: string;
    requestedAt: string;
    status: 'pending' | 'approved' | 'rejected';
    approvedBy?: string;
    approvedAt?: string;
    rejectionReason?: string;
    notes: string;
}

// Settlement authority tiers
export const SETTLEMENT_AUTHORITY: Record<string, number> = {
    [Role.OFFICER]: 10,    // Up to 10% discount
    [Role.MANAGER]: 40,    // Up to 40% discount
    [Role.CEO]: 100,       // Unlimited
};

export interface LogPaymentSubmitData {
    amountPaid: number;
    paymentType: 'Full Payment' | 'Settlement' | 'Installment';
    confirmationMethod: 'Slip' | 'Bank Confirmation';
    notes: string;
    receipt?: { name: string; dataUrl: string; };
    settlementLetter?: { name: string; dataUrl: string; };
    finalSubStatus: SubStatus;
}