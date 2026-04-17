import React, { useState, useMemo } from 'react';
import { EnrichedCase, User, Role } from '../../types';
import { formatCurrency } from '../../utils';

// ── Types ──────────────────────────────────────────────────────────────────────

interface LiabilityEmailProps {
    cases: EnrichedCase[];
    currentUser: User;
    onSelectCase: (caseId: string) => void;
}

interface BankTemplate {
    bankName: string;
    emailFormat: string;
    subjectTemplate: (accountNumber: string) => string;
    bodyTemplate: (date: string, bankName: string, accountNumber: string, debtorName: string, address: string, principalAmount: string, accruedInterest: string, lateCharges: string, totalOutstanding: string) => string;
}

interface LiabilityEmailRecord {
    id: string;
    caseId: string;
    debtorName: string;
    accountNumber: string;
    bankName: string;
    bankEmail: string;
    officerId: string;
    officerName: string;
    sentAt: string;
    status: 'Sent' | 'Pending Response' | 'Received';
}

// ── Bank Liability Letter Templates ───────────────────────────────────────────

const BANK_TEMPLATES: BankTemplate[] = [
    {
        bankName: 'Emirates NBD',
        emailFormat: 'collections@emiratesnbd.com',
        subjectTemplate: (accountNumber: string) =>
            `Outstanding Liability Statement \u2014 Account: ${accountNumber}`,
        bodyTemplate: (date, bankName, accountNumber, debtorName, address, principalAmount, accruedInterest, lateCharges, totalOutstanding) =>
`${bankName} PJSC
Collections & Recovery Department
Ref: ENBD/COL/${accountNumber}

Date: ${date}

To: ${debtorName}
${address}

Re: Outstanding Liability \u2014 Account No: ${accountNumber}

Dear ${debtorName},

This is to inform you that as per our records, the following amounts are outstanding against your account held with ${bankName}:

-----------------------------------------------
  Description              Amount (AED)
-----------------------------------------------
  Principal Amount         ${principalAmount}
  Accrued Interest         ${accruedInterest}
  Late Payment Charges     ${lateCharges}
-----------------------------------------------
  Total Outstanding        ${totalOutstanding}
-----------------------------------------------

You are hereby requested to settle the above outstanding amount in full within 30 days from the date of this letter.

Failure to settle the outstanding dues within the stipulated period may result in legal proceedings being initiated against you without further notice, including but not limited to filing a civil case before the competent courts of the UAE.

For any queries or to discuss a settlement arrangement, please contact our Collections Department at +971-600-540000 or visit your nearest ${bankName} branch.

Yours sincerely,

____________________________
Head of Collections & Recovery
${bankName} PJSC
Licensed by the Central Bank of the UAE
`,
    },
    {
        bankName: 'ADCB',
        emailFormat: 'collections@adcb.com',
        subjectTemplate: (accountNumber: string) =>
            `Outstanding Liability Statement \u2014 Account: ${accountNumber}`,
        bodyTemplate: (date, bankName, accountNumber, debtorName, address, principalAmount, accruedInterest, lateCharges, totalOutstanding) =>
`Abu Dhabi Commercial Bank PJSC
Debt Recovery & Collections Division
Reference: ADCB/DRC/${accountNumber}

Date: ${date}

To: ${debtorName}
${address}

Re: Outstanding Liability \u2014 Account No: ${accountNumber}

Dear ${debtorName},

We write to bring to your attention that as per our banking records, the following amounts remain outstanding and overdue against your account maintained with ${bankName}:

-----------------------------------------------
  Description              Amount (AED)
-----------------------------------------------
  Principal Amount         ${principalAmount}
  Accrued Interest         ${accruedInterest}
  Late Payment Charges     ${lateCharges}
-----------------------------------------------
  Total Outstanding        ${totalOutstanding}
-----------------------------------------------

You are kindly requested to arrange for the settlement of the above outstanding amount within 30 days from the date of this notice.

In the event that the above amount is not settled within the specified timeframe, the Bank reserves the right to initiate legal proceedings and recovery actions as deemed appropriate, without further correspondence.

For any queries regarding this statement, please contact our Debt Recovery Division at +971-2-6210090 or email collections@adcb.com.

Yours faithfully,

____________________________
Manager, Debt Recovery & Collections
Abu Dhabi Commercial Bank PJSC
Regulated by the Central Bank of the UAE
`,
    },
    {
        bankName: 'Dubai Islamic Bank',
        emailFormat: 'collections@dib.ae',
        subjectTemplate: (accountNumber: string) =>
            `Outstanding Liability Statement \u2014 Account: ${accountNumber}`,
        bodyTemplate: (date, bankName, accountNumber, debtorName, address, principalAmount, accruedInterest, lateCharges, totalOutstanding) =>
`Dubai Islamic Bank PJSC
Collections & Remedial Management Department
Ref: DIB/CRM/${accountNumber}

Date: ${date}

To: ${debtorName}
${address}

Re: Outstanding Liability \u2014 Account No: ${accountNumber}

Dear ${debtorName},

In accordance with our records, we hereby notify you that the following amounts are outstanding against your financing account with ${bankName}:

-----------------------------------------------
  Description              Amount (AED)
-----------------------------------------------
  Principal Amount         ${principalAmount}
  Accrued Profit           ${accruedInterest}
  Late Payment Charges     ${lateCharges}
-----------------------------------------------
  Total Outstanding        ${totalOutstanding}
-----------------------------------------------

You are hereby requested to settle the above outstanding amount within 30 days from the date of this communication.

Failure to make the required payment within the above period may compel the Bank to pursue all available legal remedies, including filing proceedings before the competent judicial authorities.

Should you wish to discuss a payment plan or have any queries, please contact our Collections Department at +971-4-6091111 or visit any DIB branch.

Wassalam,

____________________________
Head of Collections & Remedial Management
Dubai Islamic Bank PJSC
Licensed by the Central Bank of the UAE
`,
    },
    {
        bankName: 'Mashreq',
        emailFormat: 'collections@mashreqbank.com',
        subjectTemplate: (accountNumber: string) =>
            `Outstanding Liability Statement \u2014 Account: ${accountNumber}`,
        bodyTemplate: (date, bankName, accountNumber, debtorName, address, principalAmount, accruedInterest, lateCharges, totalOutstanding) =>
`Mashreqbank PSC
Recovery & Collections Unit
Ref: MSHQ/RCU/${accountNumber}

Date: ${date}

To: ${debtorName}
${address}

Re: Outstanding Liability \u2014 Account No: ${accountNumber}

Dear ${debtorName},

This letter serves to formally notify you that as per the records of ${bankName}, the following balances are outstanding and overdue on your account:

-----------------------------------------------
  Description              Amount (AED)
-----------------------------------------------
  Principal Amount         ${principalAmount}
  Accrued Interest         ${accruedInterest}
  Late Payment Charges     ${lateCharges}
-----------------------------------------------
  Total Outstanding        ${totalOutstanding}
-----------------------------------------------

You are requested to settle the total outstanding amount within 30 days of the date of this letter.

Should you fail to settle the outstanding amount within the prescribed period, ${bankName} shall be compelled to take necessary legal action, which may include civil proceedings and reporting to credit bureaus, without any further notice.

For settlement discussions or queries, please reach out to our Recovery Unit at +971-4-4244444 or email collections@mashreqbank.com.

Sincerely,

____________________________
Senior Manager, Recovery & Collections
Mashreqbank PSC
Regulated by the Central Bank of the UAE
`,
    },
    {
        bankName: 'First Abu Dhabi Bank',
        emailFormat: 'collections@bankfab.com',
        subjectTemplate: (accountNumber: string) =>
            `Outstanding Liability Statement \u2014 Account: ${accountNumber}`,
        bodyTemplate: (date, bankName, accountNumber, debtorName, address, principalAmount, accruedInterest, lateCharges, totalOutstanding) =>
`First Abu Dhabi Bank PJSC
Collections & Recovery Department
Reference: FAB/CRD/${accountNumber}

Date: ${date}

To: ${debtorName}
${address}

Re: Outstanding Liability \u2014 Account No: ${accountNumber}

Dear ${debtorName},

We refer to the above-mentioned account and wish to inform you that, according to our records, the following amounts are outstanding against your name:

-----------------------------------------------
  Description              Amount (AED)
-----------------------------------------------
  Principal Amount         ${principalAmount}
  Accrued Interest         ${accruedInterest}
  Late Payment Charges     ${lateCharges}
-----------------------------------------------
  Total Outstanding        ${totalOutstanding}
-----------------------------------------------

You are hereby required to settle the above total outstanding balance within 30 days from the date of this letter.

Failure to comply with this demand may result in the Bank initiating appropriate legal proceedings and enforcement measures as permitted under UAE law, without further notice to you.

For any clarification or to arrange a settlement, please contact our Collections Department at +971-2-6811511 or visit your nearest FAB branch.

Yours sincerely,

____________________________
Director, Collections & Recovery
First Abu Dhabi Bank PJSC
Licensed by the Central Bank of the UAE
`,
    },
    {
        bankName: 'RAK Bank',
        emailFormat: 'collections@rakbank.ae',
        subjectTemplate: (accountNumber: string) =>
            `Outstanding Liability Statement \u2014 Account: ${accountNumber}`,
        bodyTemplate: (date, bankName, accountNumber, debtorName, address, principalAmount, accruedInterest, lateCharges, totalOutstanding) =>
`The National Bank of Ras Al-Khaimah (RAKBANK) PJSC
Collections Department
Ref: RAK/COL/${accountNumber}

Date: ${date}

To: ${debtorName}
${address}

Re: Outstanding Liability \u2014 Account No: ${accountNumber}

Dear ${debtorName},

This is to officially inform you that the following amounts are currently outstanding and overdue on your account with ${bankName}:

-----------------------------------------------
  Description              Amount (AED)
-----------------------------------------------
  Principal Amount         ${principalAmount}
  Accrued Interest         ${accruedInterest}
  Late Payment Charges     ${lateCharges}
-----------------------------------------------
  Total Outstanding        ${totalOutstanding}
-----------------------------------------------

You are requested to clear the above outstanding balance within 30 days from the date hereof.

Non-payment within the specified period will leave the Bank with no option but to pursue legal remedies, including but not limited to filing a case before the courts of the UAE, without further correspondence.

For queries or to negotiate a repayment arrangement, please contact our Collections Department at +971-7-2064444 or email collections@rakbank.ae.

Kind regards,

____________________________
Head of Collections
RAKBANK PJSC
Regulated by the Central Bank of the UAE
`,
    },
    {
        bankName: 'ADIB',
        emailFormat: 'collections@adib.ae',
        subjectTemplate: (accountNumber: string) =>
            `Outstanding Liability Statement \u2014 Account: ${accountNumber}`,
        bodyTemplate: (date, bankName, accountNumber, debtorName, address, principalAmount, accruedInterest, lateCharges, totalOutstanding) =>
`Abu Dhabi Islamic Bank PJSC
Remedial & Collections Department
Reference: ADIB/RCD/${accountNumber}

Date: ${date}

To: ${debtorName}
${address}

Re: Outstanding Liability \u2014 Account No: ${accountNumber}

Dear ${debtorName},

In accordance with our records, we wish to inform you that the following amounts remain outstanding against your financing facility with ${bankName}:

-----------------------------------------------
  Description              Amount (AED)
-----------------------------------------------
  Principal Amount         ${principalAmount}
  Accrued Profit           ${accruedInterest}
  Late Payment Charges     ${lateCharges}
-----------------------------------------------
  Total Outstanding        ${totalOutstanding}
-----------------------------------------------

You are kindly requested to settle the above outstanding amount within 30 days from the date of this letter.

Should the above amount not be settled within the given period, the Bank may be obligated to pursue all legal remedies available under the laws of the UAE, including initiating court proceedings without further notice.

For any enquiries or to discuss settlement options, please contact our Remedial Department at +971-2-6100600 or visit any ADIB branch.

Wassalam,

____________________________
Manager, Remedial & Collections
Abu Dhabi Islamic Bank PJSC
Licensed by the Central Bank of the UAE
`,
    },
    {
        bankName: 'CBD',
        emailFormat: 'collections@cbd.ae',
        subjectTemplate: (accountNumber: string) =>
            `Outstanding Liability Statement \u2014 Account: ${accountNumber}`,
        bodyTemplate: (date, bankName, accountNumber, debtorName, address, principalAmount, accruedInterest, lateCharges, totalOutstanding) =>
`Commercial Bank of Dubai PSC
Recovery & Collections Department
Ref: CBD/RCD/${accountNumber}

Date: ${date}

To: ${debtorName}
${address}

Re: Outstanding Liability \u2014 Account No: ${accountNumber}

Dear ${debtorName},

We hereby notify you that as per the records of ${bankName}, the following balances are outstanding on your account:

-----------------------------------------------
  Description              Amount (AED)
-----------------------------------------------
  Principal Amount         ${principalAmount}
  Accrued Interest         ${accruedInterest}
  Late Payment Charges     ${lateCharges}
-----------------------------------------------
  Total Outstanding        ${totalOutstanding}
-----------------------------------------------

You are requested to settle the above outstanding amount in full within 30 days from the date of this letter.

In the absence of payment within the above timeframe, the Bank shall proceed with legal action and all other recovery measures as deemed necessary, without issuing further notices.

For any queries or to discuss a payment arrangement, please contact our Recovery Department at +971-4-2128900 or email collections@cbd.ae.

Yours truly,

____________________________
Head of Recovery & Collections
Commercial Bank of Dubai PSC
Regulated by the Central Bank of the UAE
`,
    },
    {
        bankName: 'Ajman Bank',
        emailFormat: 'collections@ajmanbank.ae',
        subjectTemplate: (accountNumber: string) =>
            `Outstanding Liability Statement \u2014 Account: ${accountNumber}`,
        bodyTemplate: (date, bankName, accountNumber, debtorName, address, principalAmount, accruedInterest, lateCharges, totalOutstanding) =>
`Ajman Bank PJSC
Collections & Recovery Division
Reference: AJB/CRD/${accountNumber}

Date: ${date}

To: ${debtorName}
${address}

Re: Outstanding Liability \u2014 Account No: ${accountNumber}

Dear ${debtorName},

This letter is to advise you that according to our banking records, the following amounts are outstanding on your account with ${bankName}:

-----------------------------------------------
  Description              Amount (AED)
-----------------------------------------------
  Principal Amount         ${principalAmount}
  Accrued Profit           ${accruedInterest}
  Late Payment Charges     ${lateCharges}
-----------------------------------------------
  Total Outstanding        ${totalOutstanding}
-----------------------------------------------

You are hereby requested to arrange for the full settlement of the above amount within 30 days from the date of this notice.

Failure to settle the above within the stipulated period may result in the Bank taking legal action, including filing a civil suit, without any further intimation.

For any queries, please contact our Collections Division at +971-6-7029222 or email collections@ajmanbank.ae.

Wassalam,

____________________________
Manager, Collections & Recovery
Ajman Bank PJSC
Licensed by the Central Bank of the UAE
`,
    },
    {
        bankName: 'ENBD Islamic',
        emailFormat: 'islamic.collections@emiratesnbd.com',
        subjectTemplate: (accountNumber: string) =>
            `Outstanding Liability Statement \u2014 Account: ${accountNumber}`,
        bodyTemplate: (date, bankName, accountNumber, debtorName, address, principalAmount, accruedInterest, lateCharges, totalOutstanding) =>
`Emirates NBD Islamic (Emirates Islamic)
Collections & Remedial Department
Ref: EI/CRD/${accountNumber}

Date: ${date}

To: ${debtorName}
${address}

Re: Outstanding Liability \u2014 Account No: ${accountNumber}

Dear ${debtorName},

This is to formally notify you that as per our records, the following amounts are outstanding against your financing account with ${bankName}:

-----------------------------------------------
  Description              Amount (AED)
-----------------------------------------------
  Principal Amount         ${principalAmount}
  Accrued Profit           ${accruedInterest}
  Late Payment Charges     ${lateCharges}
-----------------------------------------------
  Total Outstanding        ${totalOutstanding}
-----------------------------------------------

You are hereby requested to settle the above outstanding amount within 30 days from the date of this letter.

Non-settlement within the prescribed period may result in the Bank exercising its legal rights, including but not limited to initiating judicial proceedings before the competent courts of the UAE.

For any queries or settlement discussions, please contact our Collections Department at +971-600-540000 or visit any Emirates Islamic branch.

Wassalam,

____________________________
Head of Collections & Remedial
Emirates Islamic (ENBD Islamic)
Licensed by the Central Bank of the UAE
`,
    },
];

// ── Helpers ────────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'rv_liability_emails';

const loadRecords = (): LiabilityEmailRecord[] => {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch {
        return [];
    }
};

const saveRecords = (records: LiabilityEmailRecord[]) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
};

const todayFormatted = (): string => {
    return new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
};

const generateId = (): string => `le_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

// ── Icons (inline SVGs matching CRM pattern) ──────────────────────────────────

type IconProps = { className?: string; style?: React.CSSProperties };

const MailIcon: React.FC<IconProps> = ({ className, style }) => (
    <svg className={className} style={style} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
        <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z" />
    </svg>
);

const CopyIcon: React.FC<IconProps> = ({ className, style }) => (
    <svg className={className} style={style} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
);

const CheckIcon: React.FC<IconProps> = ({ className, style }) => (
    <svg className={className} style={style} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12" />
    </svg>
);

const FileTextIcon: React.FC<IconProps> = ({ className, style }) => (
    <svg className={className} style={style} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <polyline points="10 9 9 9 8 9" />
    </svg>
);

const SearchIcon: React.FC<IconProps> = ({ className, style }) => (
    <svg className={className} style={style} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
);

const SendIcon: React.FC<IconProps> = ({ className, style }) => (
    <svg className={className} style={style} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="22" y1="2" x2="11" y2="13" />
        <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
);

const DownloadIcon: React.FC<IconProps> = ({ className, style }) => (
    <svg className={className} style={style} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="7 10 12 15 17 10" />
        <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
);

// ── Main Component ─────────────────────────────────────────────────────────────

const LiabilityEmail: React.FC<LiabilityEmailProps> = ({ cases, currentUser, onSelectCase }) => {
    const [records, setRecords] = useState<LiabilityEmailRecord[]>(loadRecords);
    const [selectedCaseId, setSelectedCaseId] = useState<string>('');
    const [selectedBankIdx, setSelectedBankIdx] = useState<number>(0);
    const [caseSearch, setCaseSearch] = useState('');
    const [caseDropdownOpen, setCaseDropdownOpen] = useState(false);
    const [bankFilter, setBankFilter] = useState<string>('all');
    const [copied, setCopied] = useState(false);
    const [justMarked, setJustMarked] = useState(false);

    // ── Derived data ───────────────────────────────────────────────────────────

    const myCases = useMemo(() => {
        if (currentUser.role === Role.OFFICER) {
            return cases.filter(c => c.assignedOfficerId === currentUser.id);
        }
        return cases;
    }, [cases, currentUser]);

    const filteredCaseOptions = useMemo(() => {
        if (!caseSearch.trim()) return myCases;
        const q = caseSearch.toLowerCase();
        return myCases.filter(c =>
            c.debtor.name.toLowerCase().includes(q) ||
            c.loan.accountNumber.toLowerCase().includes(q) ||
            c.loan.bank.toLowerCase().includes(q)
        );
    }, [myCases, caseSearch]);

    const selectedCase = useMemo(() => {
        return myCases.find(c => c.id === selectedCaseId) || null;
    }, [myCases, selectedCaseId]);

    const currentTemplate = BANK_TEMPLATES[selectedBankIdx];

    const emailSubject = useMemo(() => {
        if (!selectedCase) return '';
        return currentTemplate.subjectTemplate(
            selectedCase.loan.accountNumber
        );
    }, [selectedCase, currentTemplate]);

    const emailBody = useMemo(() => {
        if (!selectedCase) return '';
        const balance = selectedCase.loan.currentBalance || 0;
        const principalAmount = formatCurrency(balance * 0.75, selectedCase.loan.currency);
        const accruedInterest = formatCurrency(balance * 0.18, selectedCase.loan.currency);
        const lateCharges = formatCurrency(balance * 0.07, selectedCase.loan.currency);
        const totalOutstanding = formatCurrency(balance, selectedCase.loan.currency);
        const address = selectedCase.debtor.address || 'United Arab Emirates';

        return currentTemplate.bodyTemplate(
            todayFormatted(),
            currentTemplate.bankName,
            selectedCase.loan.accountNumber,
            selectedCase.debtor.name,
            address,
            principalAmount,
            accruedInterest,
            lateCharges,
            totalOutstanding
        );
    }, [selectedCase, currentTemplate]);

    const authorityLetter = useMemo(() => {
        if (!selectedCase) return '';
        return `AUTHORITY LETTER

Date: ${todayFormatted()}

To Whom It May Concern,

Re: Authorization to Collect Liability Statement
Account Number: ${selectedCase.loan.accountNumber}
Debtor Name: ${selectedCase.debtor.name}

We, RecoVantage Private Limited, a duly authorized and licensed debt collection agency operating in the United Arab Emirates, hereby authorize our officer:

Officer Name: ${currentUser.name}
${currentUser.agentCode ? `Agent Code: ${currentUser.agentCode}` : ''}

to collect the outstanding liability statement for the above-mentioned account on behalf of our firm. The said officer is fully authorized to receive, review, and process any documents related to this account.

This authorization is issued in connection with our debt recovery mandate and is valid for a period of 30 days from the date of issuance.

We kindly request your full cooperation in this matter.

Yours faithfully,

____________________________
Authorized Signatory
RecoVantage Private Limited
Licensed Debt Collection Agency
United Arab Emirates
`;
    }, [selectedCase, currentUser]);

    // ── Visible records (role-scoped) ──────────────────────────────────────────

    const visibleRecords = useMemo(() => {
        let data = records;
        if (currentUser.role === Role.OFFICER) {
            data = data.filter(r => r.officerId === currentUser.id);
        }
        if (bankFilter !== 'all') {
            data = data.filter(r => r.bankName === bankFilter);
        }
        return data.sort((a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime());
    }, [records, currentUser, bankFilter]);

    // ── Stats ──────────────────────────────────────────────────────────────────

    const stats = useMemo(() => {
        const scoped = currentUser.role === Role.OFFICER
            ? records.filter(r => r.officerId === currentUser.id)
            : records;

        const totalSent = scoped.length;
        const pendingResponse = scoped.filter(r => r.status === 'Pending Response' || r.status === 'Sent').length;

        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const receivedThisMonth = scoped.filter(r =>
            r.status === 'Received' && new Date(r.sentAt) >= startOfMonth
        ).length;

        const received = scoped.filter(r => r.status === 'Received').length;
        const responseRate = totalSent > 0 ? Math.round((received / totalSent) * 100) : 0;

        return { totalSent, pendingResponse, receivedThisMonth, responseRate };
    }, [records, currentUser]);

    // ── Unique banks for filter ────────────────────────────────────────────────

    const uniqueBanks = useMemo(() => {
        const banks = new Set(records.map(r => r.bankName));
        return Array.from(banks).sort();
    }, [records]);

    // ── Handlers ───────────────────────────────────────────────────────────────

    const handleCopyToClipboard = () => {
        const fullText = `TO: ${currentTemplate.emailFormat}\nSubject: ${emailSubject}\n\n${emailBody}`;
        navigator.clipboard.writeText(fullText).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    };

    const handleMarkAsSent = () => {
        if (!selectedCase) return;
        const newRecord: LiabilityEmailRecord = {
            id: generateId(),
            caseId: selectedCase.id,
            debtorName: selectedCase.debtor.name,
            accountNumber: selectedCase.loan.accountNumber,
            bankName: currentTemplate.bankName,
            bankEmail: currentTemplate.emailFormat,
            officerId: currentUser.id,
            officerName: currentUser.name,
            sentAt: new Date().toISOString(),
            status: 'Sent',
        };
        const updated = [newRecord, ...records];
        setRecords(updated);
        saveRecords(updated);
        setJustMarked(true);
        setTimeout(() => setJustMarked(false), 2500);
    };

    const handleStatusToggle = (recordId: string) => {
        const updated = records.map(r => {
            if (r.id !== recordId) return r;
            const nextStatus: Record<string, LiabilityEmailRecord['status']> = {
                'Sent': 'Pending Response',
                'Pending Response': 'Received',
                'Received': 'Sent',
            };
            return { ...r, status: nextStatus[r.status] || 'Sent' };
        });
        setRecords(updated);
        saveRecords(updated);
    };

    const handleDownloadAuthority = () => {
        const blob = new Blob([authorityLetter], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Authority_Letter_${selectedCase?.loan.accountNumber || 'draft'}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const formatRecordDate = (iso: string) => {
        try {
            return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
        } catch {
            return 'N/A';
        }
    };

    // ── Render ─────────────────────────────────────────────────────────────────

    return (
        <div className="p-4 md:p-6 space-y-5">

            {/* ── Page Header ─────────────────────────────────────────── */}
            <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, var(--gradient-start), var(--gradient-end))' }}>
                        <MailIcon className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold" style={{ color: 'var(--color-text-accent)' }}>Liability Letters</h1>
                        <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-tertiary)' }}>Generate & track bank liability letters to debtors</p>
                    </div>
                </div>
            </div>

            {/* ── Stats Strip ─────────────────────────────────────────── */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="panel p-4 rounded-lg border-l-4" style={{ borderLeftColor: 'var(--color-primary)' }}>
                    <p className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--color-text-tertiary)' }}>Total Sent</p>
                    <p className="text-2xl font-bold mt-1" style={{ color: 'var(--color-text-accent)' }}>{stats.totalSent}</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-tertiary)' }}>All time</p>
                </div>
                <div className="panel p-4 rounded-lg border-l-4" style={{ borderLeftColor: 'var(--color-accent)' }}>
                    <p className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--color-text-tertiary)' }}>Pending Response</p>
                    <p className="text-2xl font-bold mt-1" style={{ color: 'var(--color-accent)' }}>{stats.pendingResponse}</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-tertiary)' }}>Awaiting banks</p>
                </div>
                <div className="panel p-4 rounded-lg border-l-4" style={{ borderLeftColor: 'var(--color-success)' }}>
                    <p className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--color-text-tertiary)' }}>Received This Month</p>
                    <p className="text-2xl font-bold mt-1" style={{ color: 'var(--color-success)' }}>{stats.receivedThisMonth}</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-tertiary)' }}>Liability statements</p>
                </div>
                <div className="panel p-4 rounded-lg border-l-4" style={{ borderLeftColor: 'var(--color-primary)' }}>
                    <p className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--color-text-tertiary)' }}>Response Rate</p>
                    <p className="text-2xl font-bold mt-1" style={{ color: 'var(--color-primary)' }}>{stats.responseRate}%</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-tertiary)' }}>Overall</p>
                </div>
            </div>

            {/* ── Compose Section ─────────────────────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

                {/* Left: Case Selector + Bank Picker */}
                <div className="space-y-4">

                    {/* Case Selector */}
                    <div className="panel p-4 rounded-lg">
                        <h3 className="text-sm font-bold mb-3" style={{ color: 'var(--color-text-accent)' }}>Select Case</h3>
                        <div className="relative">
                            <div className="relative">
                                <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: 'var(--color-text-tertiary)' }} />
                                <input
                                    type="text"
                                    value={caseSearch}
                                    onChange={e => { setCaseSearch(e.target.value); setCaseDropdownOpen(true); }}
                                    onFocus={() => setCaseDropdownOpen(true)}
                                    placeholder="Search by name, account, bank..."
                                    className="w-full pl-9 pr-3 py-2.5 text-xs rounded-lg"
                                    style={{ background: 'var(--color-bg-input)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}
                                />
                            </div>
                            {caseDropdownOpen && (
                                <div
                                    className="absolute z-20 w-full mt-1 rounded-lg overflow-hidden max-h-56 overflow-y-auto"
                                    style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', boxShadow: 'var(--shadow-lg)' }}
                                >
                                    {filteredCaseOptions.length > 0 ? filteredCaseOptions.slice(0, 50).map(c => (
                                        <button
                                            key={c.id}
                                            className="w-full text-left px-3 py-2.5 text-xs transition-colors"
                                            style={{ color: 'var(--color-text-primary)' }}
                                            onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-bg-tertiary)')}
                                            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                                            onClick={() => {
                                                setSelectedCaseId(c.id);
                                                setCaseSearch(c.debtor.name);
                                                setCaseDropdownOpen(false);
                                                // Auto-select matching bank template
                                                const bankMatch = BANK_TEMPLATES.findIndex(t => c.loan.bank?.toLowerCase().includes(t.bankName.toLowerCase().split(' ')[0].toLowerCase()));
                                                if (bankMatch >= 0) setSelectedBankIdx(bankMatch);
                                                onSelectCase(c.id);
                                            }}
                                        >
                                            <span className="font-semibold">{c.debtor.name}</span>
                                            <span className="ml-2" style={{ color: 'var(--color-text-tertiary)' }}>
                                                {c.loan.accountNumber} &middot; {c.loan.bank}
                                            </span>
                                        </button>
                                    )) : (
                                        <div className="px-3 py-4 text-xs text-center" style={{ color: 'var(--color-text-tertiary)' }}>
                                            No cases found
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {selectedCase && (
                            <div className="mt-3 p-3 rounded-lg" style={{ background: 'var(--color-bg-muted)', border: '1px solid var(--color-border)' }}>
                                <p className="text-xs font-bold" style={{ color: 'var(--color-text-primary)' }}>{selectedCase.debtor.name}</p>
                                <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-2">
                                    <div>
                                        <p className="text-[10px]" style={{ color: 'var(--color-text-tertiary)' }}>Account</p>
                                        <p className="text-[11px] font-mono font-semibold" style={{ color: 'var(--color-text-primary)' }}>{selectedCase.loan.accountNumber}</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px]" style={{ color: 'var(--color-text-tertiary)' }}>Bank</p>
                                        <p className="text-[11px] font-semibold" style={{ color: 'var(--color-text-primary)' }}>{selectedCase.loan.bank}</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px]" style={{ color: 'var(--color-text-tertiary)' }}>O/S Balance</p>
                                        <p className="text-[11px] font-bold" style={{ color: 'var(--color-danger)' }}>{formatCurrency(selectedCase.loan.currentBalance, selectedCase.loan.currency)}</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px]" style={{ color: 'var(--color-text-tertiary)' }}>Passport</p>
                                        <p className="text-[11px] font-mono" style={{ color: 'var(--color-text-primary)' }}>{selectedCase.debtor.passport || 'N/A'}</p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Bank Template Picker */}
                    <div className="panel p-4 rounded-lg">
                        <h3 className="text-sm font-bold mb-3" style={{ color: 'var(--color-text-accent)' }}>Bank Template</h3>
                        <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                            {BANK_TEMPLATES.map((t, idx) => (
                                <button
                                    key={t.bankName}
                                    onClick={() => setSelectedBankIdx(idx)}
                                    className="w-full text-left px-3 py-2.5 rounded-lg text-xs transition-all flex items-center justify-between"
                                    style={{
                                        background: selectedBankIdx === idx ? 'var(--color-primary-glow)' : 'transparent',
                                        border: selectedBankIdx === idx ? '1px solid var(--color-primary)' : '1px solid transparent',
                                        color: selectedBankIdx === idx ? 'var(--color-text-accent)' : 'var(--color-text-secondary)',
                                        fontWeight: selectedBankIdx === idx ? 600 : 400,
                                    }}
                                >
                                    <span>{t.bankName}</span>
                                    <span className="text-[10px] font-mono" style={{ color: 'var(--color-text-tertiary)' }}>{t.emailFormat}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Authority Letter */}
                    {selectedCase && (
                        <div className="panel p-4 rounded-lg">
                            <div className="flex items-center justify-between mb-3">
                                <h3 className="text-sm font-bold" style={{ color: 'var(--color-text-accent)' }}>Authority Letter</h3>
                                <FileTextIcon className="w-4 h-4" style={{ color: 'var(--color-text-tertiary)' }} />
                            </div>
                            <div
                                className="p-3 rounded-lg text-[11px] leading-relaxed font-mono whitespace-pre-wrap max-h-40 overflow-y-auto"
                                style={{
                                    background: 'var(--color-bg-muted)',
                                    border: '1px solid var(--color-border)',
                                    color: 'var(--color-text-secondary)',
                                }}
                            >
                                {authorityLetter}
                            </div>
                            <button
                                onClick={handleDownloadAuthority}
                                className="mt-3 w-full flex items-center justify-center gap-2 py-2 text-xs font-semibold rounded-lg transition-all"
                                style={{
                                    background: 'var(--color-bg-tertiary)',
                                    border: '1px solid var(--color-border)',
                                    color: 'var(--color-text-primary)',
                                }}
                            >
                                <DownloadIcon className="w-3.5 h-3.5" />
                                Download Authority Letter
                            </button>
                        </div>
                    )}
                </div>

                {/* Right: Email Preview Panel (2 cols wide) */}
                <div className="lg:col-span-2">
                    <div className="panel rounded-lg overflow-hidden">
                        {/* Email Header Bar */}
                        <div className="px-5 py-4 flex items-center justify-between" style={{ background: 'linear-gradient(135deg, var(--gradient-start), var(--gradient-end))' }}>
                            <div className="flex items-center gap-2">
                                <MailIcon className="w-4 h-4 text-white/70" />
                                <span className="text-sm font-semibold text-white">Liability Letter Preview</span>
                            </div>
                            {selectedCase && (
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={handleCopyToClipboard}
                                        className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold rounded-lg transition-all"
                                        style={{
                                            background: copied ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255,255,255,0.15)',
                                            color: copied ? '#6EE7B7' : 'white',
                                            border: copied ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(255,255,255,0.2)',
                                        }}
                                    >
                                        {copied ? <CheckIcon className="w-3 h-3" /> : <CopyIcon className="w-3 h-3" />}
                                        {copied ? 'Copied' : 'Copy to Clipboard'}
                                    </button>
                                    <button
                                        onClick={handleMarkAsSent}
                                        className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold rounded-lg transition-all"
                                        style={{
                                            background: justMarked ? 'var(--color-success)' : 'var(--color-accent)',
                                            color: 'white',
                                        }}
                                    >
                                        {justMarked ? <CheckIcon className="w-3 h-3" /> : <SendIcon className="w-3 h-3" />}
                                        {justMarked ? 'Marked as Sent' : 'Mark as Sent'}
                                    </button>
                                </div>
                            )}
                        </div>

                        {selectedCase ? (
                            <div className="p-5 space-y-4">
                                {/* TO field */}
                                <div>
                                    <label className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--color-text-tertiary)' }}>To</label>
                                    <div
                                        className="mt-1 px-3 py-2 rounded-lg text-xs font-mono"
                                        style={{ background: 'var(--color-bg-muted)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}
                                    >
                                        {currentTemplate.emailFormat}
                                    </div>
                                </div>

                                {/* Subject */}
                                <div>
                                    <label className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--color-text-tertiary)' }}>Subject</label>
                                    <div
                                        className="mt-1 px-3 py-2 rounded-lg text-xs font-semibold"
                                        style={{ background: 'var(--color-bg-muted)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}
                                    >
                                        {emailSubject}
                                    </div>
                                </div>

                                {/* Body */}
                                <div>
                                    <label className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--color-text-tertiary)' }}>Body</label>
                                    <textarea
                                        readOnly
                                        value={emailBody}
                                        rows={18}
                                        className="mt-1 w-full px-4 py-3 rounded-lg text-xs leading-relaxed resize-none"
                                        style={{
                                            background: 'var(--color-bg-muted)',
                                            border: '1px solid var(--color-border)',
                                            color: 'var(--color-text-primary)',
                                            fontFamily: 'inherit',
                                        }}
                                    />
                                </div>

                                {/* Attached Authority Letter Preview */}
                                <div className="mt-1 p-3 rounded-lg" style={{ background: 'var(--color-bg-tertiary)', border: '1px solid var(--color-border)' }}>
                                    <div className="flex items-center gap-2 mb-2">
                                        <FileTextIcon className="w-3.5 h-3.5" style={{ color: 'var(--color-accent)' }} />
                                        <span className="text-[11px] font-bold" style={{ color: 'var(--color-text-primary)' }}>Attached: Authority Letter</span>
                                        <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full font-semibold" style={{ background: 'var(--color-primary-glow)', color: 'var(--color-accent)' }}>PDF</span>
                                    </div>
                                    <pre className="text-[10px] leading-relaxed font-mono whitespace-pre-wrap max-h-32 overflow-y-auto" style={{ color: 'var(--color-text-secondary)' }}>
                                        {authorityLetter}
                                    </pre>
                                </div>
                            </div>
                        ) : (
                            <div className="px-5 py-20 flex flex-col items-center justify-center text-center">
                                <div
                                    className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
                                    style={{ background: 'var(--color-bg-muted)' }}
                                >
                                    <MailIcon className="w-7 h-7" style={{ color: 'var(--color-text-tertiary)' }} />
                                </div>
                                <p className="text-sm font-semibold" style={{ color: 'var(--color-text-secondary)' }}>
                                    Select a case to preview the liability letter
                                </p>
                                <p className="text-xs mt-1" style={{ color: 'var(--color-text-tertiary)' }}>
                                    Pick a case from the dropdown and choose a bank template to auto-generate the letter
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* ── Sent History ─────────────────────────────────────────── */}
            <div className="panel rounded-lg overflow-hidden">
                <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <div>
                        <h3 className="text-sm font-bold" style={{ color: 'var(--color-text-accent)' }}>Sent History</h3>
                        <p className="text-[10px] mt-0.5" style={{ color: 'var(--color-text-tertiary)' }}>
                            {visibleRecords.length} record{visibleRecords.length !== 1 ? 's' : ''}
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <select
                            value={bankFilter}
                            onChange={e => setBankFilter(e.target.value)}
                            className="text-xs px-3 py-1.5 rounded-lg"
                            style={{
                                background: 'var(--color-bg-input)',
                                border: '1px solid var(--color-border)',
                                color: 'var(--color-text-primary)',
                            }}
                        >
                            <option value="all">All Banks</option>
                            {uniqueBanks.map(b => (
                                <option key={b} value={b}>{b}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="overflow-auto">
                    <table className="w-full">
                        <thead>
                            <tr style={{ background: 'var(--color-bg-tertiary)' }}>
                                <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--color-text-tertiary)' }}>Date</th>
                                <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--color-text-tertiary)' }}>Debtor</th>
                                <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--color-text-tertiary)' }}>Account</th>
                                <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--color-text-tertiary)' }}>Bank</th>
                                {currentUser.role !== Role.OFFICER && (
                                    <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--color-text-tertiary)' }}>Officer</th>
                                )}
                                <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--color-text-tertiary)' }}>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {visibleRecords.length > 0 ? visibleRecords.map(rec => {
                                const statusStyles: Record<string, React.CSSProperties> = {
                                    'Sent': { background: 'var(--color-primary-glow)', color: 'var(--color-primary)' },
                                    'Pending Response': { background: 'var(--color-primary-glow)', color: 'var(--color-accent)' },
                                    'Received': { background: 'var(--color-primary-glow)', color: 'var(--color-success)' },
                                };
                                return (
                                    <tr
                                        key={rec.id}
                                        className="transition-colors cursor-pointer"
                                        style={{ borderBottom: '1px solid var(--color-border)' }}
                                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-bg-muted)')}
                                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                                        onClick={() => onSelectCase(rec.caseId)}
                                    >
                                        <td className="px-4 py-3 text-xs" style={{ color: 'var(--color-text-secondary)' }}>{formatRecordDate(rec.sentAt)}</td>
                                        <td className="px-4 py-3">
                                            <p className="text-xs font-semibold" style={{ color: 'var(--color-text-primary)' }}>{rec.debtorName}</p>
                                        </td>
                                        <td className="px-4 py-3 text-xs font-mono" style={{ color: 'var(--color-text-primary)' }}>{rec.accountNumber}</td>
                                        <td className="px-4 py-3 text-xs" style={{ color: 'var(--color-text-secondary)' }}>{rec.bankName}</td>
                                        {currentUser.role !== Role.OFFICER && (
                                            <td className="px-4 py-3 text-xs" style={{ color: 'var(--color-text-secondary)' }}>{rec.officerName}</td>
                                        )}
                                        <td className="px-4 py-3">
                                            <button
                                                onClick={e => { e.stopPropagation(); handleStatusToggle(rec.id); }}
                                                className="text-[10px] font-bold px-2.5 py-1 rounded-full transition-colors"
                                                style={statusStyles[rec.status] || { background: 'var(--color-bg-muted)', color: 'var(--color-text-tertiary)' }}
                                                title="Click to cycle status"
                                            >
                                                {rec.status.toUpperCase()}
                                            </button>
                                        </td>
                                    </tr>
                                );
                            }) : (
                                <tr>
                                    <td colSpan={currentUser.role !== Role.OFFICER ? 6 : 5} className="px-4 py-12 text-center">
                                        <p className="text-sm" style={{ color: 'var(--color-text-tertiary)' }}>No liability letters sent yet</p>
                                        <p className="text-xs mt-1" style={{ color: 'var(--color-text-tertiary)' }}>
                                            Select a case and bank above, then click "Mark as Sent" to track your letters
                                        </p>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default LiabilityEmail;
