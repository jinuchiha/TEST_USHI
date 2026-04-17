import React, { useState, useMemo, useEffect, useCallback, memo } from 'react';
import { EnrichedCase, Action, ActionType, User, CRMStatus, SubStatus, AuditLogEntry, CaseDetailViewProps, Debtor, Loan, TracingLogEntry } from '../../types';
import { formatDate, formatCurrency } from '../../utils';
import { ICONS, STATUS_MAP } from '../../constants';
import { generateAutoRemark } from '../../src/ai/engines';
import DocumentAttachments from './DocumentAttachments';
import MessageTemplates from './MessageTemplates';
import SettlementCalculator from './SettlementCalculator';
import HardshipAssessment from './HardshipAssessment';
import SkipTracing from './SkipTracing';

const InfoPair: React.FC<{ label: string; value: React.ReactNode; className?: string }> = ({ label, value, className = '' }) => (
    <div className={className}>
        <p className="text-[11px] text-text-secondary uppercase tracking-wide">{label}</p>
        <p className="text-sm font-medium text-text-primary break-words mt-0.5">{value || 'N/A'}</p>
    </div>
);


const EditableInfoPair: React.FC<{
    label: string;
    value: string | number | undefined | null;
    isEditing: boolean;
    onChange: (value: string) => void;
    name: string;
    type?: string;
    className?: string;
}> = ({ label, value, isEditing, onChange, name, type = 'text', className = '' }) => (
    <div className={className}>
        <p className="text-[11px] text-text-secondary uppercase tracking-wide">{label}</p>
        {isEditing ? (
            <input
                type={type}
                name={name}
                value={value || ''}
                onChange={(e) => onChange(e.target.value)}
                className="mt-0.5 block w-full text-sm bg-background border border-border rounded-md px-2.5 py-1.5 focus:ring-1"
            />
        ) : (
            <p className="text-sm font-medium text-text-primary break-words mt-0.5">{value || 'N/A'}</p>
        )}
    </div>
);


const actionTypeIcons: Record<ActionType, React.ReactNode> = {
    [ActionType.SOFT_CALL]: ICONS.phone('w-5 h-5'),
    [ActionType.EMAIL_NOTICE]: ICONS.email('w-5 h-5'),
    [ActionType.LEGAL_ASSESSMENT]: ICONS.legal('w-5 h-5'),
    [ActionType.PAYMENT_PLAN_AGREED]: ICONS.calendar('w-5 h-5'),
    [ActionType.PAYMENT_RECEIVED]: ICONS.money('w-5 h-5'),
    [ActionType.CASE_CREATED]: ICONS.case('w-5 h-5'),
    [ActionType.STATUS_UPDATE]: ICONS.interaction('w-5 h-5'),
};

const TimelineItem: React.FC<{ item: Action; users: User[]; currency: string; }> = ({ item, users, currency }) => {
    const officer = users.find(u => u.id === item.officerId);
    return (
        <div className="flex gap-4">
            <div className="flex flex-col items-center">
                <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center flex-shrink-0">
                    {actionTypeIcons[item.type] || ICONS.general('w-5 h-5')}
                </div>
                <div className="w-px h-full bg-borderborder"></div>
            </div>
            <div className="pb-6 w-full">
                <div className="flex justify-between items-center">
                    <p className="font-semibold text-sm text-text-primary">{item.type} by {officer?.name || 'Unknown'}</p>
                    <p className="text-xs text-text-secondary">{new Date(item.timestamp).toLocaleString()}</p>
                </div>
                <p className="text-sm mt-1">{item.notes}</p>
                {item.type === ActionType.STATUS_UPDATE && item.promisedAmount && item.promisedDate && (
                     <div className="mt-2 p-2 bg-background rounded-md border border-border text-xs">
                        <p className="font-semibold">Promise to Pay Details:</p>
                        <p><strong>Amount:</strong> {formatCurrency(item.promisedAmount, currency)}</p>
                        <p><strong>Date:</strong> {formatDate(item.promisedDate)}</p>
                    </div>
                )}
            </div>
        </div>
    );
};

const AuditLogItem: React.FC<{ item: AuditLogEntry; users: User[] }> = ({ item, users }) => {
     const user = users.find(u => u.id === item.userId);
    return (
         <div className="flex gap-4">
            <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center flex-shrink-0">
                {ICONS.legal('w-5 h-5')}
            </div>
            <div className="pb-4 w-full">
                <p className="font-semibold text-sm text-text-primary">
                    {user?.name || 'System'}
                </p>
                 <p className="text-xs text-text-secondary">{new Date(item.timestamp).toLocaleString()}</p>
                <p className="text-sm mt-1">{item.details}</p>
            </div>
        </div>
    );
}

const TracingLogItem: React.FC<{ item: TracingLogEntry; users: User[] }> = ({ item, users }) => {
    const officer = users.find(u => u.id === item.officerId);
    return (
        <div className="flex gap-4">
            <div className="flex flex-col items-center">
                <div className="w-8 h-8 rounded-full bg-teal-100 dark:bg-teal-900/50 text-teal-700 dark:text-teal-300 flex items-center justify-center flex-shrink-0">
                    {ICONS.search('w-5 h-5')}
                </div>
                <div className="w-px h-full bg-borderborder"></div>
            </div>
            <div className="pb-6 w-full">
                <div className="flex justify-between items-center">
                    <p className="font-semibold text-sm text-text-primary">Note by {officer?.name || 'Unknown'}</p>
                    <p className="text-xs text-text-secondary">{new Date(item.timestamp).toLocaleString()}</p>
                </div>
                <p className="text-sm mt-1">{item.note}</p>
            </div>
        </div>
    );
}


// One-click disposition presets — each auto-fills all statuses + notes in ONE click
const QUICK_DISPOSITIONS: { label: string; short: string; color: string; contact: 'Contact' | 'Non Contact'; work: 'Work' | 'Non Work'; crm: CRMStatus; sub: SubStatus; note: string }[] = [
    { label: 'RNR', short: 'RNR', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400', contact: 'Non Contact', work: 'Non Work', crm: CRMStatus.NCC, sub: SubStatus.RNR, note: 'Ring no response' },
    { label: 'Switched Off', short: 'SO', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400', contact: 'Non Contact', work: 'Non Work', crm: CRMStatus.NCC, sub: SubStatus.SWITCHED_OFF, note: 'Phone switched off' },
    { label: 'Not Connected', short: 'NC', color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400', contact: 'Non Contact', work: 'Non Work', crm: CRMStatus.NCC, sub: SubStatus.NOT_CONNECTED, note: 'Number not connected' },
    { label: 'Call Back', short: 'CB', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400', contact: 'Contact', work: 'Work', crm: CRMStatus.CB, sub: SubStatus.CALL_BACK, note: 'Debtor requested call back' },
    { label: 'PTP', short: 'PTP', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400', contact: 'Contact', work: 'Work', crm: CRMStatus.PTP, sub: SubStatus.PROMISE_TO_PAY, note: 'Promise to pay' },
    { label: 'Refused', short: 'RTP', color: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300', contact: 'Contact', work: 'Work', crm: CRMStatus.RTP, sub: SubStatus.REFUSE_TO_PAY, note: 'Debtor refused to pay' },
    { label: 'Dispute', short: 'DSP', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400', contact: 'Contact', work: 'Work', crm: CRMStatus.DISPUTE, sub: SubStatus.DISPUTE_AMOUNT, note: 'Debtor disputes the amount' },
    { label: 'Left VM', short: 'LVM', color: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400', contact: 'Non Contact', work: 'Non Work', crm: CRMStatus.NCC, sub: SubStatus.LEFT_MESSAGE, note: 'Left voicemail' },
];

// Click-to-copy utility
const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
        // Show a brief visual feedback
        const toast = document.createElement('div');
        toast.textContent = `Copied: ${text}`;
        toast.className = 'fixed bottom-4 right-4 bg-emerald-600 text-white text-xs px-3 py-2 rounded-lg shadow-lg z-[999] animate-fade-in-up';
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 1500);
    });
};

const CaseDetailView: React.FC<CaseDetailViewProps> = ({ caseData, allCases, onStatusChange, currentUser, users, onInitiateNip, onInitiatePaid, onUpdateCaseDetails, onAutoAdvance }) => {
    const { history, auditLog } = caseData;

    // State for the new action form
    const [contactStatus, setContactStatus] = useState<'Contact' | 'Non Contact'>(caseData.contactStatus);
    const [workStatus, setWorkStatus] = useState<'Work' | 'Non Work'>(caseData.workStatus);
    const [crmStatus, setCrmStatus] = useState<CRMStatus>(caseData.crmStatus);
    const [subStatus, setSubStatus] = useState<SubStatus>(caseData.subStatus);
    const [notes, setNotes] = useState('');
    const [promisedAmount, setPromisedAmount] = useState('');
    const [promisedDate, setPromisedDate] = useState('');
    const [nextFollowUp, setNextFollowUp] = useState('');
    const [showCallbackForm, setShowCallbackForm] = useState(false);
    const [callbackTime, setCallbackTime] = useState('');
    const [callbackNote, setCallbackNote] = useState('');
    const [bucketType, setBucketType] = useState('Recovery');
    const [newTracingNote, setNewTracingNote] = useState('');
    const [showTracingModal, setShowTracingModal] = useState(false);
    const [showRemarkForm, setShowRemarkForm] = useState(false);

    const [activeTab, setActiveTab] = useState<'caseDetails' | 'actionHistory' | 'auditLog' | 'relatedCases' | 'documents' | 'messages' | 'settlement' | 'hardship' | 'skipTrace'>('caseDetails');
    const [isEditing, setIsEditing] = useState(false);
    const [editedData, setEditedData] = useState({ ...caseData.debtor, ...caseData.loan });
    
    useEffect(() => {
        setEditedData({ ...caseData.debtor, ...caseData.loan });
    }, [caseData]);
    
     useEffect(() => {
        if (contactStatus === 'Non Contact') {
            setWorkStatus('Non Work');
        }
    }, [contactStatus]);

    const relatedCases = useMemo(() => {
        return allCases.filter(c => c.debtor.id === caseData.debtor.id && c.id !== caseData.id);
    }, [allCases, caseData]);

    const handleDetailChange = (field: keyof typeof editedData, value: string) => {
        setEditedData(prev => ({ ...prev, [field]: value }));
    };
    
    const handleDetailListChange = (field: 'emails' | 'phones', index: number, value: string) => {
        setEditedData(prev => {
            const newList = [...(prev[field] || [])];
            newList[index] = value;
            return { ...prev, [field]: newList };
        });
    };

    const handleAddDetailListItem = (field: 'emails' | 'phones') => {
        setEditedData(prev => ({
            ...prev,
            [field]: [...(prev[field] || []), '']
        }));
    };

    const handleRemoveDetailListItem = (field: 'emails' | 'phones', index: number) => {
        setEditedData(prev => ({
            ...prev,
            [field]: (prev[field] || []).filter((_, i) => i !== index)
        }));
    };


    const handleSaveDetails = () => {
        const debtorFields: (keyof Debtor)[] = ['name', 'address', 'passport', 'cnic', 'eid', 'dob', 'emails', 'phones'];
        const loanFields: (keyof Loan)[] = ['accountNumber', 'originalAmount', 'currentBalance', 'product', 'bank', 'subProduct', 'bucket', 'lpd', 'wod', 'cif'];
        
        const debtorDetails: Partial<Debtor> = {};
        const loanDetails: Partial<Loan> = {};
        
        for (const key in editedData) {
            if (debtorFields.includes(key as any)) {
                (debtorDetails as any)[key] = (editedData as any)[key];
            } else if (loanFields.includes(key as any)) {
                let value = (editedData as any)[key];
                if (key === 'originalAmount' || key === 'currentBalance') {
                    value = parseFloat(value);
                }
                (loanDetails as any)[key] = value;
            }
        }

        onUpdateCaseDetails(caseData.id, debtorDetails, loanDetails);
        setIsEditing(false);
    };
    
    const handleAddTracingNote = () => {
        if (!newTracingNote.trim() || !currentUser) return;
        
        const newLogEntry: TracingLogEntry = {
            timestamp: new Date().toISOString(),
            note: newTracingNote.trim(),
            officerId: currentUser.id,
        };

        const updatedDebtor: Partial<Debtor> = {
            tracingHistory: [...(caseData.debtor.tracingHistory || []), newLogEntry]
        };

        onUpdateCaseDetails(caseData.id, updatedDebtor, {});
        setNewTracingNote('');
    };

    const availableSubStatuses = useMemo(() => STATUS_MAP[crmStatus] || [], [crmStatus]);
    
    const handleLogAction = (e: React.FormEvent) => {
        e.preventDefault();
        const statuses = { crmStatus, subStatus, contactStatus, workStatus };

        if (crmStatus === CRMStatus.CLOSED || subStatus === SubStatus.PAID || subStatus === SubStatus.PAID_CLOSED) {
            onInitiatePaid(caseData, statuses, '');
        } else if (crmStatus === CRMStatus.NIP) {
            onInitiateNip(caseData, notes);
        } else {
             let ptpDetails;
            if (crmStatus === CRMStatus.PTP && subStatus === SubStatus.PROMISE_TO_PAY) {
                const pAmount = parseFloat(promisedAmount);
                if (isNaN(pAmount) || pAmount <= 0 || !promisedDate) {
                    alert("Please provide a valid positive promised amount and date for PTP.");
                    return;
                }
                ptpDetails = { promisedAmount: pAmount, promisedDate };
            }
            // Notes are required only for legal escalation and settlement — optional for others
            const requiresNotes = [CRMStatus.DISPUTE].includes(crmStatus) || subStatus === SubStatus.REFUSE_OR_SETTLE;
            if (requiresNotes && !notes.trim() && !ptpDetails) {
                alert("Please add notes for legal/settlement actions.");
                return;
            }
            onStatusChange(caseData.id, statuses, notes || `Status updated to ${crmStatus}/${subStatus}`, ptpDetails);
            setNotes('');
            setPromisedAmount('');
            setPromisedDate('');
        }
    };

    // ONE-CLICK DISPOSITION: Auto-fills all fields and saves in ONE click
    const handleQuickDisposition = useCallback((preset: typeof QUICK_DISPOSITIONS[0]) => {
        // Skip PTP quick disposition if no amount/date (needs manual entry)
        if (preset.crm === CRMStatus.PTP) {
            setContactStatus(preset.contact);
            setWorkStatus(preset.work);
            setCrmStatus(preset.crm);
            setSubStatus(preset.sub);
            setNotes(preset.note);
            return; // Don't auto-save PTP — officer needs to enter amount/date
        }
        const statuses = { crmStatus: preset.crm, subStatus: preset.sub, contactStatus: preset.contact, workStatus: preset.work };
        onStatusChange(caseData.id, statuses, preset.note);
        // Auto-advance to next case after 500ms
        if (onAutoAdvance) {
            setTimeout(() => onAutoAdvance(), 500);
        }
    }, [caseData.id, onStatusChange, onAutoAdvance]);

    const saveCallback = useCallback(() => {
        if (!callbackTime) return;
        const existing = (() => { try { const s = localStorage.getItem('rv_callbacks'); return s ? JSON.parse(s) : []; } catch { return []; } })();
        const newCb = {
            id: `cb-${Date.now()}`,
            caseId: caseData.id,
            debtorName: caseData.debtor.name,
            officerId: currentUser.id,
            callbackTime: new Date(`${new Date().toISOString().split('T')[0]}T${callbackTime}`).toISOString(),
            note: callbackNote || `Call back ${caseData.debtor.name}`,
        };
        localStorage.setItem('rv_callbacks', JSON.stringify([...existing, newCb]));
        setShowCallbackForm(false);
        setCallbackTime('');
        setCallbackNote('');
        // Show brief toast
        const toast = document.createElement('div');
        toast.textContent = `Callback set for ${callbackTime}`;
        toast.className = 'fixed bottom-4 right-4 bg-blue-600 text-white text-xs px-3 py-2 rounded-lg shadow-lg z-[999]';
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 1500);
    }, [callbackTime, callbackNote, caseData, currentUser.id]);

    const handleCrmStatusChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
        const newStatus = e.target.value as CRMStatus;
        setCrmStatus(newStatus);
        const available = STATUS_MAP[newStatus] || [];
        if (available.length === 1) {
            setSubStatus(available[0]);
            // Auto-generate remark using AI
            const remark = generateAutoRemark(caseData, newStatus, available[0], contactStatus);
            setNotes(remark.text);
        } else {
            setSubStatus(SubStatus.NONE);
        }
    }, [caseData, contactStatus]);

    // Pre-compute CRM status options once (not on every render)
    const crmStatusOptions = useMemo(() => Object.values(CRMStatus), []);

    // Memoize heavy data so dropdown changes don't re-compute
    const memoizedHistory = useMemo(() => history, [history]);
    const memoizedAuditLog = useMemo(() => auditLog, [auditLog]);

    // AI-powered smart remarks based on CRM status
    const smartRemarkTags: Record<string, string[]> = {
        [CRMStatus.CB]: ['Call back requested', 'Will call after work', 'Asked to call tomorrow', 'Busy right now', 'In meeting'],
        [CRMStatus.PTP]: ['Promised full payment', 'Promised partial payment', 'Will pay by salary date', 'Requested extension', 'Settlement discussion'],
        [CRMStatus.RTP]: ['Refused completely', 'Denies responsibility', 'Disputes amount', 'Claims already paid', 'Abusive language'],
        [CRMStatus.NIP]: ['No response', 'Number unreachable', 'Switched off', 'Number not connected', 'Left voicemail', 'Debtor abroad'],
        [CRMStatus.UTR]: ['Under tracing', 'New number found', 'Address verified', 'Employer contacted', 'Social media traced'],
        [CRMStatus.CLOSED]: ['Full payment received', 'Settlement accepted', 'Account closed by bank', 'Duplicate case'],
        [CRMStatus.NEW]: ['First contact attempt', 'No prior history', 'Assigned for review', 'Pending initial call'],
        [CRMStatus.WDS]: ['Bank recalled', 'Legal issue', 'Duplicate case', 'Customer dispute upheld'],
        [CRMStatus.DISPUTE]: ['Amount disputed', 'Identity fraud claim', 'Unauthorized charges', 'Legal notice received'],
        [CRMStatus.HOLD]: ['Legal hold', 'Bank instruction', 'Awaiting documents', 'Under investigation'],
    };
    const defaultRemarkTags = ['No response', 'RNR', 'Number unreachable', 'Switched off', 'Refused to pay', 'Promise to call back', 'Left voicemail', 'Debtor abroad', 'Number not connected'];

    const TabButton: React.FC<{label: string, count: number, value: typeof activeTab, activeTab: typeof activeTab, setActiveTab: (tab: typeof activeTab) => void}> = ({label, count, value, activeTab, setActiveTab}) => (
         <button
            onClick={() => setActiveTab(value)}
            className={`${activeTab === value ? 'border-primary text-primary dark:text-accent' : 'border-transparent text-text-secondary hover:text-text-primary hover:border-border'} whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm flex items-center gap-2`}
        >
            {label}
            {count > 0 && <span className="ml-2 bg-gray-600 text-gray-200 text-xs font-bold px-2 py-0.5 rounded-full">{count}</span>}
        </button>
    );

    return (
        <div className="bg-transparent dark:bg-transparent">
            {/* === STICKY TOP: Quick Dispositions + Phones === */}
            <div className="sticky top-0 z-[100] bg-[var(--color-bg-secondary)] border-b border-[var(--color-border)] shadow-sm px-4 py-2">
                <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] text-[var(--color-text-tertiary)] uppercase tracking-wide mr-1 font-semibold">Quick:</span>
                    {QUICK_DISPOSITIONS.map(d => (
                        <button key={d.short} type="button" onClick={() => handleQuickDisposition(d)} title={d.label}
                            className={`px-2 py-1 text-[11px] font-bold rounded-md transition hover:scale-105 active:scale-95 ${d.color}`}>
                            {d.short}
                        </button>
                    ))}
                    <div className="ml-auto flex items-center gap-2">
                        {(caseData.debtor.phones || []).filter(Boolean).map((phone, i) => (
                            <button key={i} type="button" onClick={() => copyToClipboard(phone)} title={`Click to copy: ${phone}`}
                                className="flex items-center gap-1 px-2 py-0.5 text-[11px] font-mono bg-[var(--color-bg-tertiary)] rounded border border-[var(--color-border)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] transition cursor-pointer">
                                {ICONS.phone('w-3 h-3')} {phone}
                            </button>
                        ))}
                        <div className="relative">
                            <button type="button" onClick={() => setShowCallbackForm(f => !f)}
                                className="flex items-center gap-1 px-2 py-0.5 text-[11px] font-bold rounded border transition bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800 dark:hover:bg-blue-900/50">
                                {ICONS.calendar('w-3 h-3')} Set CB
                            </button>
                            {showCallbackForm && (
                                <div className="absolute right-0 top-full mt-1 z-[200] bg-[var(--glass-bg)] border border-[var(--color-border)] rounded-lg shadow-xl p-3 w-56">
                                    <p className="text-[10px] font-bold text-[var(--color-text-secondary)] uppercase mb-2">Set Callback Time</p>
                                    <input type="time" value={callbackTime} onChange={e => setCallbackTime(e.target.value)}
                                        className="w-full text-sm border border-[var(--color-border)] rounded-md px-2 py-1.5 bg-[var(--color-bg-secondary)] mb-2" />
                                    <input type="text" value={callbackNote} onChange={e => setCallbackNote(e.target.value)}
                                        placeholder="Note (optional)"
                                        className="w-full text-xs border border-[var(--color-border)] rounded-md px-2 py-1.5 bg-[var(--color-bg-secondary)] mb-2" />
                                    <button onClick={saveCallback} disabled={!callbackTime}
                                        className="w-full px-2 py-1.5 text-xs font-bold text-white rounded-md disabled:opacity-40"
                                        style={{ background: 'var(--color-accent)' }}>
                                        Save Callback
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* === REMARKS & ACTION FORM SECTION — Primary work area === */}
            <div className="px-4 py-3 border-b border-[var(--color-border)] bg-[var(--color-bg-muted)] space-y-3">
                {/* Add Remark — inline form */}
                <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-[var(--color-text-primary)] uppercase tracking-wide">Remarks</h4>
                    <button type="button" onClick={() => setShowRemarkForm(f => !f)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-[var(--color-border)] text-[var(--color-text-accent)] hover:bg-[var(--color-bg-tertiary)] transition">
                        {ICONS.plus('w-3.5 h-3.5')}
                        Add Remark
                    </button>
                </div>

                {/* Remark form — toggleable */}
                {showRemarkForm && (
                    <form onSubmit={handleLogAction} className="p-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] space-y-2">
                        {/* Status row */}
                        <div className="flex items-center gap-2 flex-wrap">
                            <select value={contactStatus} onChange={e => setContactStatus(e.target.value as 'Contact' | 'Non Contact')} className="text-[11px] px-2 py-1.5 rounded-md">
                                <option>Contact</option>
                                <option>Non Contact</option>
                            </select>
                            <select value={workStatus} onChange={e => setWorkStatus(e.target.value as 'Work' | 'Non Work')} disabled={contactStatus === 'Non Contact'} className="text-[11px] px-2 py-1.5 rounded-md disabled:opacity-50">
                                <option>Work</option>
                                <option>Non Work</option>
                            </select>
                            <select value={crmStatus} onChange={handleCrmStatusChange} className="text-[11px] px-2 py-1.5 rounded-md">
                                {crmStatusOptions.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                            <select value={subStatus} onChange={e => setSubStatus(e.target.value as SubStatus)} disabled={availableSubStatuses.length === 0} className="text-[11px] px-2 py-1.5 rounded-md disabled:opacity-50">
                                <option value={SubStatus.NONE}>-- Sub --</option>
                                {availableSubStatuses.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                            <input type="date" value={nextFollowUp} onChange={e => setNextFollowUp(e.target.value)} className="text-[11px] px-2 py-1.5 rounded-md" title="Follow-up date" />
                            <select value={bucketType} onChange={e => setBucketType(e.target.value)} className="text-[11px] px-2 py-1.5 rounded-md">
                                <option value="Recovery">Recovery</option>
                                <option value="Bucket">Bucket</option>
                            </select>
                            {crmStatus === CRMStatus.PTP && subStatus === SubStatus.PROMISE_TO_PAY && (
                                <>
                                    <input type="number" value={promisedAmount} onChange={e => setPromisedAmount(e.target.value)} placeholder="PTP Amt" required className="text-[11px] px-2 py-1.5 w-20 rounded-md"/>
                                    <input type="date" value={promisedDate} onChange={e => setPromisedDate(e.target.value)} required className="text-[11px] px-2 py-1.5 rounded-md" />
                                </>
                            )}
                        </div>
                        {/* Smart remark tags */}
                        <div className="flex flex-wrap gap-1">
                            {(smartRemarkTags[crmStatus] || defaultRemarkTags).map(tag => (
                                <button key={tag} type="button" onClick={() => setNotes(prev => prev ? `${prev}. ${tag}` : tag)} className={`px-1.5 py-0.5 text-[10px] rounded border transition ${notes.includes(tag) ? 'bg-[var(--color-primary)] text-white border-[var(--color-primary)]' : 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] border-[var(--color-border)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]'}`}>{tag}</button>
                            ))}
                        </div>
                        {/* Remark input + Save */}
                        <div className="flex items-center gap-2">
                            <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Type your remark here..." className="flex-1 text-xs px-3 py-2 rounded-lg" />
                            <button type="submit" className="px-4 py-2 text-xs font-bold text-white rounded-lg transition hover:brightness-110" style={{ background: 'var(--color-accent)' }}>
                                Save Action
                            </button>
                        </div>
                    </form>
                )}

                {/* Remarks history */}
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {history.filter(h => h.notes).length > 0 ? history.filter(h => h.notes).slice(0, 8).map((h, i) => {
                        const officer = users.find(u => u.id === h.officerId);
                        return (
                            <div key={h.id || i} className="flex gap-2.5 p-2 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border)]">
                                <div className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold text-white shrink-0 mt-0.5" style={{ background: 'var(--color-primary)' }}>
                                    {(officer?.name || 'U').charAt(0)}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-[10px] font-semibold text-[var(--color-text-primary)]">{officer?.name || 'Unknown'}</span>
                                        <span className="text-[9px] px-1 py-0.5 rounded font-medium bg-[var(--color-bg-tertiary)] text-[var(--color-text-tertiary)]">{h.type}</span>
                                        <span className="text-[9px] text-[var(--color-text-tertiary)] ml-auto shrink-0">{new Date(h.timestamp).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })} {new Date(h.timestamp).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>
                                    </div>
                                    <p className="text-[11px] text-[var(--color-text-secondary)] mt-0.5">{h.notes}</p>
                                    {h.promisedAmount && <p className="text-[10px] mt-0.5 font-semibold" style={{ color: 'var(--color-accent)' }}>PTP: {formatCurrency(h.promisedAmount, caseData.loan.currency)} due {h.promisedDate ? formatDate(h.promisedDate) : 'N/A'}</p>}
                                </div>
                            </div>
                        );
                    }) : (
                        <p className="text-center text-[var(--color-text-tertiary)] text-[11px] py-3">No remarks yet. Click "Add Remark" or use Quick Dispositions.</p>
                    )}
                    {history.filter(h => h.notes).length > 8 && (
                        <button onClick={() => setActiveTab('actionHistory')} className="text-[10px] text-[var(--color-text-accent)] font-medium hover:underline">
                            View all {history.filter(h => h.notes).length} remarks...
                        </button>
                    )}
                </div>
            </div>

            {/* === TABS === */}
             <div className="border-b border-border">
                <nav className="-mb-px flex space-x-4 px-6" aria-label="Tabs">
                    <TabButton label="Case Details" count={0} value="caseDetails" activeTab={activeTab} setActiveTab={setActiveTab} />
                    <TabButton label="History" count={history.length} value="actionHistory" activeTab={activeTab} setActiveTab={setActiveTab} />
                    <TabButton label="Documents" count={0} value="documents" activeTab={activeTab} setActiveTab={setActiveTab} />
                    <TabButton label="Messages" count={0} value="messages" activeTab={activeTab} setActiveTab={setActiveTab} />
                    <TabButton label="Settlement" count={0} value="settlement" activeTab={activeTab} setActiveTab={setActiveTab} />
                    <TabButton label="Hardship" count={0} value="hardship" activeTab={activeTab} setActiveTab={setActiveTab} />
                    <TabButton label="Skip Trace" count={0} value="skipTrace" activeTab={activeTab} setActiveTab={setActiveTab} />
                    <TabButton label="Audit" count={auditLog.length} value="auditLog" activeTab={activeTab} setActiveTab={setActiveTab} />
                    <TabButton label="Related" count={relatedCases.length} value="relatedCases" activeTab={activeTab} setActiveTab={setActiveTab} />
                </nav>
            </div>

            {activeTab === 'caseDetails' && (
                <div className="p-4 space-y-4">
                    {/* Full width case details - no more split with Log Action */}
                    <div className="space-y-4">
                        <div className="flex justify-between items-center">
                            <h3 className="text-sm font-bold text-text-primary uppercase tracking-wide">Case Information</h3>
                             {!isEditing && (
                                <button onClick={() => setIsEditing(true)} className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300 rounded-md hover:bg-blue-200 dark:hover:bg-blue-900/80">
                                    {ICONS.edit('w-4 h-4')}
                                    Edit Details
                                </button>
                            )}
                        </div>
                        
                        {/* Debtor Info */}
                        <div className="space-y-3">
                            <div className="flex justify-between items-center">
                               <h4 className="text-xs font-bold text-text-primary uppercase tracking-wide">Debtor Details</h4>
                                {isEditing && (
                                     <div className="flex items-center gap-2">
                                        <button onClick={() => { setIsEditing(false); setEditedData({ ...caseData.debtor, ...caseData.loan }); }} className="px-3 py-1.5 text-sm font-medium rounded-md border border-border hover:bg-surface-muted">Cancel</button>
                                        <button onClick={handleSaveDetails} className="px-3 py-1.5 text-sm font-medium text-white bg-primary rounded-md hover:bg-primary-dark">Save Changes</button>
                                    </div>
                                )}
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-3">
                                <EditableInfoPair label="Full Name" value={editedData.name} isEditing={isEditing} name="name" onChange={(v) => handleDetailChange('name', v)} className="col-span-2 sm:col-span-3" />
                                <div className="sm:col-span-1">
                                    <p className="text-sm text-text-secondary">Emails</p>
                                    {isEditing ? (
                                        <div className="space-y-2 mt-1">
                                            {(editedData.emails || []).map((email, index) => (
                                                <div key={index} className="flex items-center gap-2">
                                                    <input type="email" value={email} onChange={(e) => handleDetailListChange('emails', index, e.target.value)} className="block w-full text-base bg-background border border-border rounded-md px-3 py-2 focus:ring-1"/>
                                                    <button type="button" onClick={() => handleRemoveDetailListItem('emails', index)} disabled={(editedData.emails || []).length <= 1} className="p-1 text-danger disabled:opacity-50 disabled:cursor-not-allowed">{ICONS.trash('w-4 h-4')}</button>
                                                </div>
                                            ))}
                                            <button type="button" onClick={() => handleAddDetailListItem('emails')} className="text-sm text-primary flex items-center gap-1 pt-1">{ICONS.plus('w-4 h-4')} Add Email</button>
                                        </div>
                                    ) : ( (caseData.debtor.emails || []).map((email, index) => (<p key={index} className="text-base font-medium text-text-primary break-words mt-1">{email || 'N/A'}</p>)) )}
                                </div>
                                 <div className="sm:col-span-1">
                                    <p className="text-sm text-text-secondary">Phone Numbers</p>
                                    {isEditing ? (
                                        <div className="space-y-2 mt-1">
                                            {(editedData.phones || []).map((phone, index) => (
                                                <div key={index} className="flex items-center gap-2">
                                                    <input type="tel" value={phone} onChange={(e) => handleDetailListChange('phones', index, e.target.value)} className="block w-full text-base bg-background border border-border rounded-md px-3 py-2 focus:ring-1"/>
                                                    <button type="button" onClick={() => handleRemoveDetailListItem('phones', index)} disabled={(editedData.phones || []).length <= 1} className="p-1 text-danger disabled:opacity-50 disabled:cursor-not-allowed">{ICONS.trash('w-4 h-4')}</button>
                                                </div>
                                            ))}
                                            <button type="button" onClick={() => handleAddDetailListItem('phones')} className="text-sm text-primary flex items-center gap-1 pt-1">{ICONS.plus('w-4 h-4')} Add Phone</button>
                                        </div>
                                    ) : ( (caseData.debtor.phones || []).map((phone, index) => (<p key={index} className="text-base font-medium text-text-primary break-words mt-1">{phone || 'N/A'}</p>)) )}
                                </div>

                                <EditableInfoPair label="Date of Birth" value={editedData.dob} isEditing={isEditing} name="dob" onChange={(v) => handleDetailChange('dob', v)} type="date"/>
                                <EditableInfoPair label="Passport" value={editedData.passport} isEditing={isEditing} name="passport" onChange={(v) => handleDetailChange('passport', v)} />
                                <EditableInfoPair label="CNIC" value={editedData.cnic} isEditing={isEditing} name="cnic" onChange={(v) => handleDetailChange('cnic', v)} />
                                <EditableInfoPair label="Emirates ID" value={editedData.eid} isEditing={isEditing} name="eid" onChange={(v) => handleDetailChange('eid', v)} />
                                <EditableInfoPair label="Address" value={editedData.address} isEditing={isEditing} name="address" onChange={(v) => handleDetailChange('address', v)} className="col-span-2 sm:col-span-3"/>
                            </div>
                        </div>
                        <hr className="border-border"/>
                        {/* Loan Info */}
                        <div className="space-y-3">
                            <h4 className="text-xs font-bold text-text-primary uppercase tracking-wide">Loan Details</h4>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-3">
                                <EditableInfoPair label="Outstanding (O/S)" value={isEditing ? editedData.currentBalance : formatCurrency(caseData.loan.currentBalance, caseData.loan.currency)} isEditing={isEditing} name="currentBalance" onChange={(v) => handleDetailChange('currentBalance', v)} type="number" />
                                <EditableInfoPair label="Original Amount" value={isEditing ? editedData.originalAmount : formatCurrency(caseData.loan.originalAmount, caseData.loan.currency)} isEditing={isEditing} name="originalAmount" onChange={(v) => handleDetailChange('originalAmount', v)} type="number" />
                                <EditableInfoPair label="Product" value={editedData.product} isEditing={isEditing} name="product" onChange={(v) => handleDetailChange('product', v)} />
                                <EditableInfoPair label="Bank" value={editedData.bank} isEditing={isEditing} name="bank" onChange={(v) => handleDetailChange('bank', v)} />
                                <EditableInfoPair label="Sub Product" value={editedData.subProduct} isEditing={isEditing} name="subProduct" onChange={(v) => handleDetailChange('subProduct', v)} />
                                <EditableInfoPair label="Bucket" value={editedData.bucket} isEditing={isEditing} name="bucket" onChange={(v) => handleDetailChange('bucket', v)} />
                                <EditableInfoPair label="LPD" value={editedData.lpd} isEditing={isEditing} name="lpd" onChange={(v) => handleDetailChange('lpd', v)} type="date"/>
                                <EditableInfoPair label="WOD" value={editedData.wod} isEditing={isEditing} name="wod" onChange={(v) => handleDetailChange('wod', v)} type="date"/>
                                <EditableInfoPair label="CIF" value={editedData.cif} isEditing={isEditing} name="cif" onChange={(v) => handleDetailChange('cif', v)} />
                            </div>
                        </div>
                        <hr className="border-border"/>
                        
                        {/* Case Attributes */}
                        <div className="space-y-3">
                            <h4 className="text-xs font-bold text-text-primary uppercase tracking-wide">Case Attributes</h4>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-3">
                               <InfoPair label="Creation Date" value={formatDate(caseData.creationDate)} />
                               <InfoPair label="Status Code" value={caseData.statusCode} />
                               <InfoPair label="Cyber" value={caseData.cyber} />
                               <InfoPair label="Tracing Status" value={caseData.tracingStatus} />
                            </div>
                        </div>
                        <hr className="border-border"/>

                        {/* Tracing — Button to open tracing details (like Edit Details) */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <h4 className="text-xs font-bold text-text-primary uppercase tracking-wide">Tracing Details</h4>
                                <button onClick={() => setShowTracingModal(true)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-[var(--color-border)] text-[var(--color-text-accent)] hover:bg-[var(--color-bg-tertiary)] transition">
                                    {ICONS.search('w-3.5 h-3.5')}
                                    Add Tracing Details
                                </button>
                            </div>
                            {(caseData.debtor.tracingHistory || []).length > 0 ? (
                                <div className="space-y-1.5 max-h-32 overflow-y-auto">
                                    {[...(caseData.debtor.tracingHistory || [])].reverse().slice(0, 3).map((item, idx) => {
                                        const officer = users.find(u => u.id === item.officerId);
                                        return (
                                            <div key={idx} className="flex items-start gap-2 text-[11px] p-2 rounded-lg bg-[var(--color-bg-muted)]">
                                                <span className="text-[var(--color-text-tertiary)] shrink-0">{new Date(item.timestamp).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}</span>
                                                <span className="text-[var(--color-text-secondary)] flex-1">{item.note}</span>
                                                <span className="text-[var(--color-text-tertiary)] shrink-0">{officer?.name?.split(' ')[0]}</span>
                                            </div>
                                        );
                                    })}
                                    {(caseData.debtor.tracingHistory || []).length > 3 && (
                                        <button onClick={() => setShowTracingModal(true)} className="text-[10px] text-[var(--color-text-accent)] font-medium hover:underline">
                                            View all {(caseData.debtor.tracingHistory || []).length} entries...
                                        </button>
                                    )}
                                </div>
                            ) : (
                                <p className="text-center text-[var(--color-text-tertiary)] text-xs py-2">No tracing records. Click "Add Tracing Details" to start.</p>
                            )}
                        </div>

                    </div>
                </div>
            )}
            
            {activeTab === 'actionHistory' && (
                <div className="p-4">
                    <div className="space-y-2 -ml-4">
                        {history.map(item => <TimelineItem key={item.id} item={item} users={users} currency={caseData.loan.currency} />)}
                            {history.length === 0 && <p className="text-center text-text-secondary p-4">No activities logged yet.</p>}
                    </div>
                </div>
            )}
            {activeTab === 'auditLog' && (
                <div className="p-4">
                    <div className="space-y-4">
                            {auditLog.map(item => <AuditLogItem key={item.id} item={item} users={users} />)}
                            {auditLog.length === 0 && <p className="text-center text-text-secondary p-4">No audit records found.</p>}
                    </div>
                </div>
            )}
            {activeTab === 'relatedCases' && (
                <div className="p-4">
                    {relatedCases.length > 0 ? (
                         <div className="space-y-4">
                            {relatedCases.map(c => (
                                <div key={c.id} className="p-4 border border-border rounded-lg bg-surface-muted">
                                    <p className="font-semibold text-text-primary">{c.loan.bank} - {c.loan.product}</p>
                                    <p className="text-sm text-text-secondary">Account: {c.loan.accountNumber}</p>
                                    <p className="text-sm font-bold text-red-500 mt-1">O/S: {formatCurrency(c.loan.currentBalance, c.loan.currency)}</p>
                                    <p className="text-xs text-text-secondary mt-1">Assigned to: {c.officer.name}</p>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center text-text-secondary">
                            <p>No other cases found for this debtor.</p>
                        </div>
                    )}
                </div>
            )}
            {activeTab === 'documents' && (
                <div className="p-4">
                    <DocumentAttachments caseId={caseData.id} debtorName={caseData.debtor.name} currentUser={currentUser} />
                </div>
            )}
            {activeTab === 'messages' && (
                <div className="p-4">
                    <MessageTemplates caseData={caseData} currentUser={currentUser} />
                </div>
            )}
            {activeTab === 'settlement' && (
                <div className="p-4">
                    <SettlementCalculator caseData={caseData} currentUser={currentUser} />
                </div>
            )}
            {activeTab === 'hardship' && (
                <div className="p-4">
                    <HardshipAssessment caseData={caseData} currentUser={currentUser} />
                </div>
            )}
            {activeTab === 'skipTrace' && (
                <div className="p-4">
                    <SkipTracing caseData={caseData} currentUser={currentUser} />
                </div>
            )}

            {/* === TRACING DETAILS MODAL === */}
            {showTracingModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[200] flex items-center justify-center p-4" onClick={() => setShowTracingModal(false)}>
                    <div className="bg-[var(--color-bg-secondary)] rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col overflow-hidden border border-[var(--color-border)]" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--color-border)]" style={{ background: 'linear-gradient(135deg, var(--gradient-start), var(--gradient-end))' }}>
                            <div className="flex items-center gap-2">
                                {ICONS.search('w-4 h-4 text-white/70')}
                                <h3 className="text-sm font-bold text-white">Tracing Details — {caseData.debtor.name}</h3>
                            </div>
                            <button onClick={() => setShowTracingModal(false)} className="text-white/60 hover:text-white p-1">
                                {ICONS.close('w-4 h-4')}
                            </button>
                        </div>
                        <div className="p-5 space-y-4 overflow-y-auto flex-1">
                            <div>
                                <label className="text-[11px] font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wide">Add New Tracing Note</label>
                                <textarea
                                    value={newTracingNote}
                                    onChange={(e) => setNewTracingNote(e.target.value)}
                                    placeholder="e.g., Found new contact via MOL, Debtor relocated to Sharjah, Employer verified at XYZ Co..."
                                    rows={3}
                                    className="mt-1.5 block w-full text-sm rounded-lg"
                                />
                                <button
                                    onClick={() => { handleAddTracingNote(); }}
                                    disabled={!newTracingNote.trim()}
                                    className="mt-2 w-full py-2 text-xs font-bold rounded-lg text-white disabled:opacity-40 transition"
                                    style={{ background: 'var(--color-primary)' }}
                                >
                                    Add to Tracing Log
                                </button>
                            </div>
                            <hr className="border-[var(--color-border)]" />
                            <div>
                                <p className="text-[11px] font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wide mb-2">
                                    Tracing History ({(caseData.debtor.tracingHistory || []).length})
                                </p>
                                <div className="space-y-2">
                                    {[...(caseData.debtor.tracingHistory || [])].reverse().map((item, idx) => {
                                        const officer = users.find(u => u.id === item.officerId);
                                        return (
                                            <div key={idx} className="p-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-muted)]">
                                                <div className="flex items-center justify-between mb-1">
                                                    <span className="text-[11px] font-semibold text-[var(--color-text-primary)]">{officer?.name || 'Unknown'}</span>
                                                    <span className="text-[10px] text-[var(--color-text-tertiary)]">{new Date(item.timestamp).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                                                </div>
                                                <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">{item.note}</p>
                                            </div>
                                        );
                                    })}
                                    {(caseData.debtor.tracingHistory || []).length === 0 && (
                                        <p className="text-center text-[var(--color-text-tertiary)] text-xs py-6">No tracing records yet.</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

export default CaseDetailView;