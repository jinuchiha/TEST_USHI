import React, { useMemo, useState, useCallback } from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { EnrichedCase, User, ActionType, Role } from '../../types';
import { formatCurrency, convertToAED, formatDate } from '../../utils';
import Card from '../shared/Card';
import KpiCard from '../shared/KpiCard';
import { ICONS } from '../../constants';
import OfficerCollectionsSummary from './OfficerCollectionsSummary';

interface AccountantDashboardProps {
  allCases: EnrichedCase[];
  coordinators: User[];
  onVerifyPayment: (caseId: string, actionId: string) => void;
  currentUser: User;
}

type PaidFilter = 'this_month' | 'last_month' | 'all_time';
type SortColumn = 'bank' | 'casesPaid' | 'totalAED' | 'pendingVerify' | 'verified';
type SortDir = 'asc' | 'desc';

interface CommissionVerified {
  [officerId: string]: { amount: number; verifiedAt: string };
}

const COMMISSION_RATE = 0.0075;
const COMMISSION_THRESHOLD = 30000;
const LS_KEY = 'rv_commission_verified';

const loadCommissionVerified = (): CommissionVerified => {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) || '{}');
  } catch { return {}; }
};

const saveCommissionVerified = (data: CommissionVerified) => {
  localStorage.setItem(LS_KEY, JSON.stringify(data));
};

// -- Tooltip for Recharts --
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="panel p-2 border-border rounded-md shadow-lg !bg-background">
        <p className="text-sm text-text-primary">{`${label}`}</p>
        <p className="text-sm text-accent">{`Collected: ${formatCurrency(payload[0].value, 'AED')}`}</p>
      </div>
    );
  }
  return null;
};

// -- Slip Viewer Modal --
const SlipViewerModal: React.FC<{
  payment: any;
  onClose: () => void;
  onVerify: () => void;
  onReject: (reason: string) => void;
  isFinance: boolean;
}> = ({ payment, onClose, onVerify, onReject, isFinance }) => {
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectField, setShowRejectField] = useState(false);
  const receipt = payment.receipt;
  const isImage = receipt?.dataUrl?.startsWith('data:image');
  const isPdf = receipt?.dataUrl?.startsWith('data:application/pdf');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}>
      <div className="panel rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col" style={{ border: '1px solid var(--color-border)' }}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: 'var(--color-border)' }}>
          <h3 className="text-lg font-bold text-text-primary">Payment Slip Viewer</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-surface-muted transition-colors">
            {ICONS.close('w-5 h-5 text-text-secondary')}
          </button>
        </div>

        {/* Payment Info */}
        <div className="p-4 grid grid-cols-2 gap-3 text-sm" style={{ borderBottom: '1px solid var(--color-border)' }}>
          <div><span className="text-text-secondary">Amount:</span> <span className="font-semibold text-accent">{formatCurrency(payment.amountPaid, payment.currency)}</span></div>
          <div><span className="text-text-secondary">Date:</span> <span className="font-medium text-text-primary">{formatDate(payment.attributionDate || payment.timestamp)}</span></div>
          <div><span className="text-text-secondary">Officer:</span> <span className="font-medium text-text-primary">{payment.officer?.name}</span></div>
          <div><span className="text-text-secondary">Method:</span> <span className="font-medium text-text-primary">{payment.confirmationMethod || 'N/A'}</span></div>
          <div><span className="text-text-secondary">Type:</span> <span className="font-medium text-text-primary">{payment.paymentType || 'N/A'}</span></div>
          <div><span className="text-text-secondary">Status:</span>
            <span className={`ml-1 px-2 py-0.5 text-xs font-semibold rounded-full ${payment.paymentVerifiedByFinanceAt ? 'pill-success' : 'pill-warning'}`}>
              {payment.paymentVerifiedByFinanceAt ? 'Verified' : 'Pending'}
            </span>
          </div>
        </div>

        {/* Slip Preview */}
        <div className="flex-1 overflow-auto p-4 flex items-center justify-center" style={{ minHeight: '200px', backgroundColor: 'var(--color-surface-muted)' }}>
          {receipt?.dataUrl ? (
            isImage ? (
              <img src={receipt.dataUrl} alt={receipt.name || 'Payment Slip'} className="max-w-full max-h-[400px] rounded-lg shadow-md object-contain" />
            ) : isPdf ? (
              <iframe src={receipt.dataUrl} title="Payment Slip PDF" className="w-full h-[400px] rounded-lg" />
            ) : (
              <div className="text-center">
                <p className="text-text-secondary mb-2">File: {receipt.name}</p>
                <a href={receipt.dataUrl} download={receipt.name} className="btn-primary text-sm px-4 py-2">Download Attachment</a>
              </div>
            )
          ) : (
            <div className="text-center text-text-secondary">
              <svg className="w-16 h-16 mx-auto mb-3 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>
              <p>No receipt attached</p>
            </div>
          )}
        </div>

        {/* Actions */}
        {isFinance && !payment.paymentVerifiedByFinanceAt && (
          <div className="p-4 flex flex-col gap-3" style={{ borderTop: '1px solid var(--color-border)' }}>
            {showRejectField ? (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={rejectReason}
                  onChange={e => setRejectReason(e.target.value)}
                  placeholder="Reason for rejection..."
                  className="flex-1 px-3 py-2 rounded-lg text-sm"
                  style={{ border: '1px solid var(--color-border)', backgroundColor: 'var(--color-background)', color: 'var(--color-text-primary)' }}
                />
                <button onClick={() => { onReject(rejectReason); onClose(); }} disabled={!rejectReason.trim()} className="btn-primary text-sm px-4 py-2" style={{ backgroundColor: 'var(--color-danger)', opacity: rejectReason.trim() ? 1 : 0.5 }}>
                  Confirm Reject
                </button>
                <button onClick={() => setShowRejectField(false)} className="text-sm px-3 py-2 rounded-lg" style={{ border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}>Cancel</button>
              </div>
            ) : (
              <div className="flex gap-3">
                <button onClick={() => { onVerify(); onClose(); }} className="btn-primary flex-1 py-2.5 text-sm font-semibold">Verify Payment</button>
                <button onClick={() => setShowRejectField(true)} className="flex-1 py-2.5 text-sm font-semibold rounded-lg" style={{ border: '1px solid var(--color-danger)', color: 'var(--color-danger)' }}>Reject</button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};


const AccountantDashboard: React.FC<AccountantDashboardProps> = ({ allCases, coordinators, onVerifyPayment, currentUser }) => {
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [selectedOfficerId, setSelectedOfficerId] = useState('all');
  const [paidFilter, setPaidFilter] = useState<PaidFilter>('this_month');
  const [slipPayment, setSlipPayment] = useState<any>(null);
  const [bankSortCol, setBankSortCol] = useState<SortColumn>('totalAED');
  const [bankSortDir, setBankSortDir] = useState<SortDir>('desc');
  const [bulkSelected, setBulkSelected] = useState<Set<string>>(new Set());
  const [commissionVerified, setCommissionVerified] = useState<CommissionVerified>(loadCommissionVerified);
  const [bankConfirmed, setBankConfirmed] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem('rv_bank_confirmed') || '[]')); } catch { return new Set(); }
  });
  const [activeTab, setActiveTab] = useState<'paid' | 'reconciliation' | 'commission'>('paid');

  // -- All payments extraction --
  const { allPayments, monthOptions } = useMemo(() => {
    const payments = allCases.flatMap(c =>
      c.history
        .filter(h => h.type === ActionType.PAYMENT_RECEIVED && h.amountPaid && h.amountPaid > 0)
        .map(h => ({
          ...h,
          debtor: c.debtor,
          loan: c.loan,
          officer: c.officer,
          officerId: c.officer.id,
          currency: c.loan.currency,
          caseId: c.id,
        }))
    ).sort((a, b) => new Date(a.attributionDate || a.timestamp).getTime() - new Date(b.attributionDate || b.timestamp).getTime());

    const months = [...new Set(payments.map(p => {
      const date = new Date(p.attributionDate || p.timestamp);
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    }))];

    return { allPayments: payments, monthOptions: months };
  }, [allCases]);

  // -- Cases that have at least one payment --
  const paidCases = useMemo(() => {
    return allCases.filter(c => c.history.some(h => h.type === ActionType.PAYMENT_RECEIVED));
  }, [allCases]);

  // -- Finance stats for selected month --
  const financeStats = useMemo(() => {
    const [year, month] = selectedMonth.split('-').map(Number);

    let filteredPayments = allPayments.filter(p => {
      const d = new Date(p.attributionDate || p.timestamp);
      return d.getFullYear() === year && d.getMonth() === month - 1;
    });

    if (selectedOfficerId !== 'all') {
      filteredPayments = filteredPayments.filter(p => p.officerId === selectedOfficerId);
    }

    const totalMonthlyCollectionsAED = filteredPayments.reduce((sum, h) => sum + convertToAED(h.amountPaid || 0, h.currency), 0);
    const paymentsToReconcile = filteredPayments.filter(p => !p.paymentVerifiedByFinanceAt).length;
    const verifiedThisMonth = filteredPayments.filter(p => !!p.paymentVerifiedByFinanceAt).length;
    const totalOutstanding = allCases.reduce((sum, c) => sum + convertToAED(c.loan.currentBalance, c.loan.currency), 0);
    const averagePayment = filteredPayments.length > 0 ? Number(totalMonthlyCollectionsAED) / Number(filteredPayments.length) : 0;
    const largestPayment = filteredPayments.reduce((max, p) => Math.max(max, convertToAED(p.amountPaid || 0, p.currency)), 0);
    const collectionRate = totalOutstanding > 0 ? (totalMonthlyCollectionsAED / totalOutstanding) * 100 : 0;
    const commissionPayable = totalMonthlyCollectionsAED * COMMISSION_RATE;

    // Bank-wise breakdown
    const bankMap: Record<string, { casesPaid: number; totalOriginal: number; totalAED: number; pendingVerify: number; verified: number; currency: string }> = {};
    filteredPayments.forEach(p => {
      const bank = p.loan.bank;
      if (!bankMap[bank]) bankMap[bank] = { casesPaid: 0, totalOriginal: 0, totalAED: 0, pendingVerify: 0, verified: 0, currency: p.currency };
      bankMap[bank].casesPaid += 1;
      bankMap[bank].totalOriginal += p.amountPaid || 0;
      bankMap[bank].totalAED += convertToAED(p.amountPaid || 0, p.currency);
      if (p.paymentVerifiedByFinanceAt) bankMap[bank].verified += 1;
      else bankMap[bank].pendingVerify += 1;
    });
    const bankTableData = Object.entries(bankMap).map(([bank, data]) => ({ bank, ...data }));
    const bankChartData = bankTableData.map(b => ({ name: b.bank, total: b.totalAED })).sort((a, b) => b.total - a.total);

    return {
      monthlyPayments: [...filteredPayments].reverse(),
      totalMonthlyCollectionsAED,
      paymentsToReconcile,
      verifiedThisMonth,
      totalOutstanding,
      averagePayment,
      largestPayment,
      collectionRate,
      commissionPayable,
      bankChartData,
      bankTableData,
    };
  }, [allPayments, selectedMonth, allCases, selectedOfficerId]);

  // -- Paid Accounts filtered --
  const paidAccounts = useMemo(() => {
    const now = new Date();
    const thisYear = now.getFullYear();
    const thisMonth = now.getMonth();
    const lastMonth = thisMonth === 0 ? 11 : thisMonth - 1;
    const lastMonthYear = thisMonth === 0 ? thisYear - 1 : thisYear;

    let filtered = allPayments;
    if (paidFilter === 'this_month') {
      filtered = allPayments.filter(p => {
        const d = new Date(p.attributionDate || p.timestamp);
        return d.getFullYear() === thisYear && d.getMonth() === thisMonth;
      });
    } else if (paidFilter === 'last_month') {
      filtered = allPayments.filter(p => {
        const d = new Date(p.attributionDate || p.timestamp);
        return d.getFullYear() === lastMonthYear && d.getMonth() === lastMonth;
      });
    }

    if (selectedOfficerId !== 'all') {
      filtered = filtered.filter(p => p.officerId === selectedOfficerId);
    }

    return filtered.slice().reverse();
  }, [allPayments, paidFilter, selectedOfficerId]);

  const paidAccountsTotal = useMemo(() => paidAccounts.reduce((s, p) => s + convertToAED(p.amountPaid || 0, p.currency), 0), [paidAccounts]);

  // -- Commission data --
  const commissionData = useMemo(() => {
    const [year, month] = selectedMonth.split('-').map(Number);
    const officerMap: Record<string, { officer: User; totalAED: number; commissionEarned: number }> = {};
    allPayments.forEach(p => {
      const d = new Date(p.attributionDate || p.timestamp);
      if (d.getFullYear() !== year || d.getMonth() !== month - 1) return;
      if (!officerMap[p.officerId]) officerMap[p.officerId] = { officer: p.officer, totalAED: 0, commissionEarned: 0 };
      officerMap[p.officerId].totalAED += convertToAED(p.amountPaid || 0, p.currency);
    });
    Object.values(officerMap).forEach(o => {
      o.commissionEarned = o.totalAED * COMMISSION_RATE;
    });
    return Object.entries(officerMap)
      .filter(([, v]) => v.totalAED >= COMMISSION_THRESHOLD)
      .sort((a, b) => b[1].totalAED - a[1].totalAED);
  }, [allPayments, selectedMonth]);

  // -- Bank table sort --
  const sortedBankTable = useMemo(() => {
    const data = [...financeStats.bankTableData];
    data.sort((a, b) => {
      const aVal = a[bankSortCol] as any;
      const bVal = b[bankSortCol] as any;
      if (typeof aVal === 'string') return bankSortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      return bankSortDir === 'asc' ? aVal - bVal : bVal - aVal;
    });
    return data;
  }, [financeStats.bankTableData, bankSortCol, bankSortDir]);

  const toggleBankSort = (col: SortColumn) => {
    if (bankSortCol === col) setBankSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setBankSortCol(col); setBankSortDir('desc'); }
  };

  // -- Bulk verify --
  const handleBulkVerify = useCallback(() => {
    bulkSelected.forEach(key => {
      const [caseId, actionId] = key.split('::');
      onVerifyPayment(caseId, actionId);
    });
    setBulkSelected(new Set());
  }, [bulkSelected, onVerifyPayment]);

  const toggleBulkItem = (caseId: string, actionId: string) => {
    const key = `${caseId}::${actionId}`;
    setBulkSelected(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const toggleBulkAll = () => {
    const pending = financeStats.monthlyPayments.filter(p => !p.paymentVerifiedByFinanceAt);
    if (bulkSelected.size === pending.length) setBulkSelected(new Set());
    else setBulkSelected(new Set(pending.map(p => `${p.caseId}::${p.id}`)));
  };

  // -- Bank confirm --
  const handleBankConfirm = useCallback((caseId: string, actionId: string) => {
    const key = `${caseId}::${actionId}`;
    setBankConfirmed(prev => {
      const next = new Set(prev);
      next.add(key);
      localStorage.setItem('rv_bank_confirmed', JSON.stringify([...next]));
      return next;
    });
  }, []);

  // -- Commission verify --
  const handleVerifyCommission = (officerId: string, amount: number) => {
    const updated = { ...commissionVerified, [officerId]: { amount, verifiedAt: new Date().toISOString() } };
    setCommissionVerified(updated);
    saveCommissionVerified(updated);
  };

  const TH = "px-4 py-3 text-left text-xs font-semibold text-text-secondary uppercase tracking-wider";
  const TD = "px-4 py-3.5 whitespace-nowrap text-sm text-text-primary";
  const isFinance = currentUser.role === Role.FINANCE;

  const SortIcon: React.FC<{ col: SortColumn }> = ({ col }) => (
    <span className="ml-1 inline-block" style={{ opacity: bankSortCol === col ? 1 : 0.3 }}>
      {bankSortCol === col && bankSortDir === 'asc' ? '\u2191' : '\u2193'}
    </span>
  );

  return (
    <div className="p-0 md:p-2 min-h-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 p-4 md:p-2 animate-fade-in-up">
        <div>
          <h1 className="text-3xl font-bold text-text-primary">Finance Portal</h1>
          <p className="text-sm text-text-secondary mt-1">Payment verification, reconciliation, and commission management.</p>
        </div>
        <div className="flex items-center gap-2 mt-3 sm:mt-0">
          <select value={selectedOfficerId} onChange={e => setSelectedOfficerId(e.target.value)}
            className="block w-full sm:w-auto pl-3 pr-10 py-2 text-sm rounded-md shadow-sm"
            style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}>
            <option value="all">All Officers</option>
            {coordinators.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)}
            className="block w-full sm:w-auto pl-3 pr-10 py-2 text-sm rounded-md shadow-sm"
            style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}>
            {monthOptions.map(m => <option key={m} value={m}>{new Date(m + '-02').toLocaleString('default', { month: 'long', year: 'numeric' })}</option>)}
          </select>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-9 gap-4 mb-6 px-4 md:px-2">
        <div className="animate-fade-in-up" style={{ animationDelay: '25ms' }}><KpiCard title="Paid Cases" value={paidCases.length.toLocaleString()} icon={ICONS.case('w-6 h-6 text-primary')} valueColor="text-primary" /></div>
        <div className="animate-fade-in-up" style={{ animationDelay: '50ms' }}><KpiCard title="Collected (Month)" value={formatCurrency(financeStats.totalMonthlyCollectionsAED, 'AED')} icon={ICONS.recovered('w-6 h-6 text-accent')} valueColor="text-accent" /></div>
        <div className="animate-fade-in-up" style={{ animationDelay: '100ms' }}><KpiCard title="Pending Verify" value={financeStats.paymentsToReconcile.toLocaleString()} icon={ICONS.info('w-6 h-6 text-warning')} valueColor="text-warning" /></div>
        <div className="animate-fade-in-up" style={{ animationDelay: '150ms' }}><KpiCard title="Verified (Month)" value={financeStats.verifiedThisMonth.toLocaleString()} icon={ICONS.success('w-6 h-6 text-success')} valueColor="text-success" /></div>
        <div className="animate-fade-in-up" style={{ animationDelay: '200ms' }}><KpiCard title="Total Outstanding" value={formatCurrency(financeStats.totalOutstanding, 'AED')} icon={ICONS.wallet('w-6 h-6 text-primary')} valueColor="text-text-primary" /></div>
        <div className="animate-fade-in-up" style={{ animationDelay: '250ms' }}><KpiCard title="Avg. Payment" value={formatCurrency(financeStats.averagePayment, 'AED')} icon={ICONS.money('w-6 h-6 text-primary')} valueColor="text-primary" /></div>
        <div className="animate-fade-in-up" style={{ animationDelay: '300ms' }}><KpiCard title="Largest Payment" value={formatCurrency(financeStats.largestPayment, 'AED')} icon={ICONS.bolt('w-6 h-6 text-accent')} valueColor="text-accent" /></div>
        <div className="animate-fade-in-up" style={{ animationDelay: '350ms' }}><KpiCard title="Collection Rate" value={`${financeStats.collectionRate.toFixed(1)}%`} icon={ICONS.performance('w-6 h-6 text-success')} valueColor="text-success" /></div>
        <div className="animate-fade-in-up" style={{ animationDelay: '400ms' }}><KpiCard title="Commission Due" value={formatCurrency(financeStats.commissionPayable, 'AED')} icon={ICONS.payment('w-6 h-6 text-warning')} valueColor="text-warning" /></div>
      </div>

      {/* Chart + Officer Summary */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 px-4 md:px-2 mb-6">
        <div className="xl:col-span-2 animate-fade-in-up" style={{ animationDelay: '450ms' }}>
          <Card className="p-4 h-full flex flex-col">
            <h3 className="text-lg font-semibold text-text-primary mb-4">Collections by Bank ({new Date(selectedMonth + '-02').toLocaleString('default', { month: 'long', year: 'numeric' })})</h3>
            <div className="flex-grow" style={{ minHeight: '260px' }}>
              {financeStats.bankChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={financeStats.bankChartData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                    <XAxis type="number" stroke="var(--color-text-secondary)" className="text-xs" tickFormatter={(val) => `${val / 1000}k`} />
                    <YAxis type="category" dataKey="name" stroke="var(--color-text-secondary)" className="text-xs" width={80} />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(34, 211, 238, 0.1)' }} />
                    <Bar dataKey="total" fill="var(--color-primary)" name="Collected (AED)" barSize={20} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-text-secondary">No collection data for this month.</div>
              )}
            </div>
          </Card>
        </div>
        <div className="xl:col-span-1 animate-fade-in-up" style={{ animationDelay: '500ms' }}>
          <OfficerCollectionsSummary allCases={allCases} coordinators={coordinators} selectedMonth={selectedMonth} />
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="px-4 md:px-2 mb-4 animate-fade-in-up" style={{ animationDelay: '550ms' }}>
        <div className="flex gap-1 p-1 rounded-lg" style={{ backgroundColor: 'var(--color-surface-muted)' }}>
          {([['paid', 'Paid Accounts'], ['reconciliation', 'Reconciliation'], ['commission', 'Commission']] as const).map(([key, label]) => (
            <button key={key} onClick={() => setActiveTab(key)}
              className={`flex-1 py-2.5 px-4 rounded-md text-sm font-semibold transition-all ${activeTab === key ? 'shadow-sm' : ''}`}
              style={{
                backgroundColor: activeTab === key ? 'var(--color-surface)' : 'transparent',
                color: activeTab === key ? 'var(--color-primary)' : 'var(--color-text-secondary)',
              }}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* -- TAB: Paid Accounts -- */}
      {activeTab === 'paid' && (
        <div className="px-4 md:px-2 animate-fade-in-up">
          <Card className="!p-0">
            <div className="p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3" style={{ borderBottom: '1px solid var(--color-border)' }}>
              <div>
                <h3 className="text-lg font-semibold text-text-primary">Paid Accounts</h3>
                <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>
                  {paidAccounts.length} payments | Running Total: <span className="font-bold" style={{ color: 'var(--color-accent)' }}>{formatCurrency(paidAccountsTotal, 'AED')}</span>
                </p>
              </div>
              <div className="flex gap-1 p-1 rounded-lg" style={{ backgroundColor: 'var(--color-surface-muted)' }}>
                {([['this_month', 'This Month'], ['last_month', 'Last Month'], ['all_time', 'All Time']] as const).map(([key, label]) => (
                  <button key={key} onClick={() => setPaidFilter(key)}
                    className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all`}
                    style={{
                      backgroundColor: paidFilter === key ? 'var(--color-primary)' : 'transparent',
                      color: paidFilter === key ? 'var(--color-text-on-primary, #fff)' : 'var(--color-text-secondary)',
                    }}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead style={{ backgroundColor: 'var(--color-surface-muted)' }}>
                  <tr>
                    <th className={TH}>Debtor</th>
                    <th className={TH}>Account #</th>
                    <th className={TH}>Bank</th>
                    <th className={TH}>Amount Paid</th>
                    <th className={TH}>Payment Date</th>
                    <th className={TH}>Officer</th>
                    <th className={TH}>Status</th>
                    <th className={TH}>Slip</th>
                  </tr>
                </thead>
                <tbody className="divide-y" style={{ borderColor: 'var(--color-border)' }}>
                  {paidAccounts.map(p => (
                    <tr key={p.id} className="hover:bg-surface-muted/50 transition-colors">
                      <td className={`${TD} font-medium`}>{p.debtor.name}</td>
                      <td className={`${TD} font-mono text-xs`}>{p.loan.accountNumber}</td>
                      <td className={TD}>{p.loan.bank}</td>
                      <td className={TD}><span className="font-semibold" style={{ color: 'var(--color-accent)' }}>{formatCurrency(p.amountPaid, p.currency)}</span></td>
                      <td className={TD}>{formatDate(p.attributionDate || p.timestamp)}</td>
                      <td className={TD}>{p.officer.name}</td>
                      <td className={TD}>
                        <span className={`px-2.5 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${p.paymentVerifiedByFinanceAt ? 'pill-success' : 'pill-warning'}`}>
                          {p.paymentVerifiedByFinanceAt ? 'Verified' : 'Pending'}
                        </span>
                      </td>
                      <td className={TD}>
                        <button onClick={() => setSlipPayment(p)}
                          className="px-3 py-1.5 text-xs font-medium rounded-md transition-colors"
                          style={{ border: '1px solid var(--color-border)', color: p.receipt ? 'var(--color-primary)' : 'var(--color-text-secondary)' }}>
                          {p.receipt ? 'View Slip' : 'No Slip'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {paidAccounts.length === 0 && <p className="text-center p-8 text-text-secondary">No paid accounts found for this period.</p>}
            </div>
          </Card>
        </div>
      )}

      {/* -- TAB: Reconciliation (Bank Table + Payment Table) -- */}
      {activeTab === 'reconciliation' && (
        <div className="px-4 md:px-2 space-y-6 animate-fade-in-up">
          {/* Bank-wise Collection Table */}
          <Card className="!p-0">
            <div className="p-4" style={{ borderBottom: '1px solid var(--color-border)' }}>
              <h3 className="text-lg font-semibold text-text-primary">Bank-wise Collections ({new Date(selectedMonth + '-02').toLocaleString('default', { month: 'long', year: 'numeric' })})</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead style={{ backgroundColor: 'var(--color-surface-muted)' }}>
                  <tr>
                    {([['bank', 'Bank'], ['casesPaid', 'Cases Paid'], ['totalAED', 'Total (AED)'], ['pendingVerify', 'Pending'], ['verified', 'Verified']] as const).map(([col, label]) => (
                      <th key={col} className={`${TH} cursor-pointer select-none hover:text-text-primary transition-colors`} onClick={() => toggleBankSort(col)}>
                        {label}<SortIcon col={col} />
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y" style={{ borderColor: 'var(--color-border)' }}>
                  {sortedBankTable.map(row => (
                    <tr key={row.bank} className="hover:bg-surface-muted/50 transition-colors">
                      <td className={`${TD} font-medium`}>{row.bank}</td>
                      <td className={TD}>{row.casesPaid}</td>
                      <td className={TD}><span className="font-semibold" style={{ color: 'var(--color-accent)' }}>{formatCurrency(row.totalAED, 'AED')}</span></td>
                      <td className={TD}>
                        {row.pendingVerify > 0 && <span className="px-2 py-0.5 text-xs font-semibold rounded-full pill-warning">{row.pendingVerify}</span>}
                        {row.pendingVerify === 0 && <span className="text-text-secondary">0</span>}
                      </td>
                      <td className={TD}>
                        <span className="px-2 py-0.5 text-xs font-semibold rounded-full pill-success">{row.verified}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {sortedBankTable.length === 0 && <p className="text-center p-8 text-text-secondary">No bank data for this month.</p>}
            </div>
          </Card>

          {/* Payment Reconciliation Table */}
          <Card className="!p-0">
            <div className="p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2" style={{ borderBottom: '1px solid var(--color-border)' }}>
              <h3 className="text-lg font-semibold text-text-primary">Payment Reconciliation ({new Date(selectedMonth + '-02').toLocaleString('default', { month: 'long', year: 'numeric' })})</h3>
              {isFinance && bulkSelected.size > 0 && (
                <button onClick={handleBulkVerify} className="btn-primary text-xs px-4 py-2 font-semibold">
                  Verify Selected ({bulkSelected.size})
                </button>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead style={{ backgroundColor: 'var(--color-surface-muted)' }}>
                  <tr>
                    {isFinance && (
                      <th className={TH} style={{ width: '40px' }}>
                        <input type="checkbox" onChange={toggleBulkAll}
                          checked={bulkSelected.size > 0 && bulkSelected.size === financeStats.monthlyPayments.filter(p => !p.paymentVerifiedByFinanceAt).length}
                          className="rounded" style={{ accentColor: 'var(--color-primary)' }} />
                      </th>
                    )}
                    <th className={TH}>Date</th>
                    <th className={TH}>Debtor</th>
                    <th className={TH}>Amount</th>
                    <th className={TH}>Officer</th>
                    <th className={TH}>Receipt</th>
                    <th className={TH}>Slip Status</th>
                    <th className={TH}>Commission</th>
                    <th className={TH}>Status</th>
                    <th className={TH}>Bank Verify</th>
                    <th className={TH}>Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y" style={{ borderColor: 'var(--color-border)' }}>
                  {financeStats.monthlyPayments.map(p => {
                    const aedAmount = convertToAED(p.amountPaid || 0, p.currency);
                    const commImpact = aedAmount * COMMISSION_RATE;
                    const paymentKey = `${p.caseId}::${p.id}`;
                    const isVerified = !!p.paymentVerifiedByFinanceAt;
                    const isBankConfirmed = bankConfirmed.has(paymentKey);
                    return (
                      <tr key={p.id} className="hover:bg-surface-muted/50 transition-colors">
                        {isFinance && (
                          <td className={TD}>
                            {!isVerified && (
                              <input type="checkbox" checked={bulkSelected.has(paymentKey)}
                                onChange={() => toggleBulkItem(p.caseId, p.id)}
                                className="rounded" style={{ accentColor: 'var(--color-primary)' }} />
                            )}
                          </td>
                        )}
                        <td className={TD}>{formatDate(p.attributionDate || p.timestamp)}</td>
                        <td className={`${TD} font-medium`}>{p.debtor.name}</td>
                        <td className={TD}><span className="font-semibold" style={{ color: 'var(--color-accent)' }}>{formatCurrency(p.amountPaid, p.currency)}</span></td>
                        <td className={TD}>{p.officer.name}</td>
                        <td className={TD}>
                          {p.receipt ? (
                            <button onClick={() => setSlipPayment(p)} className="flex items-center gap-1 text-xs font-medium" style={{ color: 'var(--color-primary)' }}>
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
                              View
                            </button>
                          ) : (
                            <span className="text-xs text-text-secondary">None</span>
                          )}
                        </td>
                        <td className={TD}>
                          <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${p.receipt ? (isVerified ? 'pill-success' : 'pill-warning') : 'pill-secondary'}`}>
                            {!p.receipt ? 'No Slip' : isVerified ? 'Verified' : 'Pending Review'}
                          </span>
                        </td>
                        <td className={TD}>
                          <span className="text-xs font-mono" style={{ color: 'var(--color-text-secondary)' }}>{formatCurrency(commImpact, 'AED')}</span>
                        </td>
                        <td className={TD}>
                          <span className={`px-2.5 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${isBankConfirmed ? 'pill-success' : isVerified ? 'pill-info' : 'pill-warning'}`}>
                            {isBankConfirmed ? 'Bank Confirmed' : isVerified ? 'Verified' : 'Pending'}
                          </span>
                        </td>
                        <td className={TD}>
                          {isBankConfirmed ? (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-md" style={{ color: 'var(--color-success)' }}>
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                              Confirmed
                            </span>
                          ) : isVerified ? (
                            <button onClick={() => handleBankConfirm(p.caseId, p.id)}
                              className="text-xs font-semibold px-3 py-1.5 rounded-md transition-colors"
                              style={{ backgroundColor: 'var(--color-info, #3b82f6)', color: '#fff' }}>
                              Bank Confirm
                            </button>
                          ) : (
                            <span className="text-xs text-text-secondary">--</span>
                          )}
                        </td>
                        <td className={TD}>
                          <div className="flex items-center gap-2">
                            {isFinance && !isVerified && (
                              <button onClick={() => onVerifyPayment(p.caseId, p.id)}
                                className="text-xs font-semibold px-3 py-1.5 rounded-md transition-colors"
                                style={{ backgroundColor: 'var(--color-warning)', color: '#fff' }}>
                                Verify
                              </button>
                            )}
                            <button onClick={() => setSlipPayment(p)} className="text-xs px-2 py-1.5 rounded-md transition-colors" style={{ border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}>
                              Details
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {financeStats.monthlyPayments.length === 0 && <p className="text-center p-8 text-text-secondary">No payments found for this month.</p>}
            </div>
          </Card>
        </div>
      )}

      {/* -- TAB: Commission Verification -- */}
      {activeTab === 'commission' && (
        <div className="px-4 md:px-2 animate-fade-in-up">
          <Card className="!p-0">
            <div className="p-4" style={{ borderBottom: '1px solid var(--color-border)' }}>
              <h3 className="text-lg font-semibold text-text-primary">Commission Verification Panel</h3>
              <p className="text-sm text-text-secondary mt-1">Officers who reached {formatCurrency(COMMISSION_THRESHOLD, 'AED')} threshold | Rate: {(COMMISSION_RATE * 100).toFixed(2)}%</p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead style={{ backgroundColor: 'var(--color-surface-muted)' }}>
                  <tr>
                    <th className={TH}>Officer</th>
                    <th className={TH}>Total Collections (AED)</th>
                    <th className={TH}>Commission Earned</th>
                    <th className={TH}>Verification Status</th>
                    <th className={TH}>Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y" style={{ borderColor: 'var(--color-border)' }}>
                  {commissionData.map(([officerId, data]) => {
                    const isVerified = !!commissionVerified[officerId];
                    const verifiedAmount = commissionVerified[officerId]?.amount || 0;
                    return (
                      <tr key={officerId} className="hover:bg-surface-muted/50 transition-colors">
                        <td className={`${TD} font-medium`}>
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold" style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-text-on-primary, #fff)' }}>
                              {data.officer.name.charAt(0)}
                            </div>
                            {data.officer.name}
                          </div>
                        </td>
                        <td className={TD}>
                          <span className="font-semibold" style={{ color: 'var(--color-accent)' }}>{formatCurrency(data.totalAED, 'AED')}</span>
                        </td>
                        <td className={TD}>
                          <span className="font-semibold" style={{ color: 'var(--color-success)' }}>{formatCurrency(data.commissionEarned, 'AED')}</span>
                        </td>
                        <td className={TD}>
                          {isVerified ? (
                            <div>
                              <span className="px-2.5 py-1 text-xs font-semibold rounded-full pill-success">Verified</span>
                              <span className="ml-2 text-xs text-text-secondary">{formatCurrency(verifiedAmount, 'AED')}</span>
                            </div>
                          ) : (
                            <span className="px-2.5 py-1 text-xs font-semibold rounded-full pill-warning">Pending</span>
                          )}
                        </td>
                        <td className={TD}>
                          {isFinance && !isVerified && (
                            <button onClick={() => handleVerifyCommission(officerId, data.commissionEarned)}
                              className="btn-primary text-xs px-4 py-1.5 font-semibold">
                              Verify Commission
                            </button>
                          )}
                          {isVerified && (
                            <span className="text-xs text-text-secondary">Verified on {formatDate(commissionVerified[officerId].verifiedAt)}</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {commissionData.length === 0 && (
                <div className="text-center p-10 text-text-secondary">
                  <p className="text-lg mb-1">No officers reached the {formatCurrency(COMMISSION_THRESHOLD, 'AED')} threshold this month.</p>
                  <p className="text-sm">Commission is calculated at {(COMMISSION_RATE * 100).toFixed(2)}% of total collections.</p>
                </div>
              )}
            </div>

            {/* Commission Summary */}
            {commissionData.length > 0 && (
              <div className="p-4 flex flex-wrap gap-6 text-sm" style={{ borderTop: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface-muted)' }}>
                <div>
                  <span className="text-text-secondary">Total Pending: </span>
                  <span className="font-bold" style={{ color: 'var(--color-warning)' }}>
                    {formatCurrency(
                      commissionData.filter(([id]) => !commissionVerified[id]).reduce((s, [, d]) => s + d.commissionEarned, 0),
                      'AED'
                    )}
                  </span>
                </div>
                <div>
                  <span className="text-text-secondary">Total Verified: </span>
                  <span className="font-bold" style={{ color: 'var(--color-success)' }}>
                    {formatCurrency(
                      commissionData.filter(([id]) => !!commissionVerified[id]).reduce((s, [, d]) => s + d.commissionEarned, 0),
                      'AED'
                    )}
                  </span>
                </div>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* Slip Viewer Modal */}
      {slipPayment && (
        <SlipViewerModal
          payment={slipPayment}
          onClose={() => setSlipPayment(null)}
          onVerify={() => onVerifyPayment(slipPayment.caseId, slipPayment.id)}
          onReject={() => { /* rejection logic can be extended */ }}
          isFinance={isFinance}
        />
      )}
    </div>
  );
};

export default AccountantDashboard;
