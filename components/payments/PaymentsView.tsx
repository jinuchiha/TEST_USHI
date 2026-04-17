import React, { useMemo, useState } from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid } from 'recharts';
import { EnrichedCase, ActionType, User, Role } from '../../types';
import Card from '../shared/Card';
import { formatDate, formatCurrency, convertToAED, exportToCsv } from '../../utils';
import { ICONS, USERS } from '../../constants';
import KpiCard from '../shared/KpiCard';
import EmptyState from '../shared/EmptyState';

interface PaymentsViewProps {
  cases: EnrichedCase[];
  currentUser: User;
  onVerifyPayment: (caseId: string, actionId: string) => void;
}

type SortableKey = 'timestamp' | 'debtor.name' | 'loan.bank' | 'amountPaid' | 'officer.name';

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-surface p-2 border border-border rounded-md shadow-lg">
        <p className="label text-sm text-text-primary">{`Day: ${label}`}</p>
        <p className="intro text-sm text-primary dark:text-accent">{`Collections (AED) : ${formatCurrency(payload[0].value, 'AED')}`}</p>
      </div>
    );
  }
  return null;
};

const PaymentsView: React.FC<PaymentsViewProps> = ({ cases, currentUser, onVerifyPayment }) => {
  const [isFilterOpen, setIsFilterOpen] = useState(true);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedBank, setSelectedBank] = useState('all');
  const [verificationStatus, setVerificationStatus] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: SortableKey; direction: 'ascending' | 'descending' } | null>(null);


  const allPayments = useMemo(() => {
    return cases
      .flatMap(c => 
        c.history
          .filter(h => h.type === ActionType.PAYMENT_RECEIVED && h.amountPaid && h.amountPaid > 0)
          .map(h => {
            return {
              ...h,
              debtor: c.debtor,
              loan: c.loan,
              officer: c.officer,
              verified: !!h.paymentVerifiedByFinanceAt,
              caseId: c.id
            };
          })
      )
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [cases]);
  
  const uniqueBanks = useMemo(() => {
    const banks = new Set<string>();
    allPayments.forEach(p => banks.add(p.loan.bank));
    return Array.from(banks).sort();
  }, [allPayments]);
  
  const isManagerView = currentUser.role !== Role.OFFICER;

  const requestSort = (key: SortableKey) => {
    let direction: 'ascending' | 'descending' = 'ascending';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
        direction = 'descending';
    }
    setSortConfig({ key, direction });
  };
  
  const getNestedValue = (obj: any, path: string) => path.split('.').reduce((acc, part) => acc && acc[part], obj);

  const filteredPayments = useMemo(() => {
    let payments = allPayments;
    if (!isManagerView) {
        payments = payments.filter(p => p.officerId === currentUser.id);
    }
    
    payments = payments.filter(p => {
        const paymentDate = new Date(p.attributionDate || p.timestamp);
        
        const startMatch = !startDate || paymentDate >= new Date(startDate + 'T00:00:00');
        const endMatch = !endDate || paymentDate <= new Date(endDate + 'T23:59:59');
        const bankMatch = selectedBank === 'all' || p.loan.bank === selectedBank;
        const statusMatch = verificationStatus === 'all' || (verificationStatus === 'verified' && p.verified) || (verificationStatus === 'pending' && !p.verified);

        return startMatch && endMatch && bankMatch && statusMatch;
    });

    if (searchTerm) {
        const lowercasedFilter = searchTerm.toLowerCase();
        payments = payments.filter(p => 
            p.debtor?.name.toLowerCase().includes(lowercasedFilter) ||
            p.loan?.accountNumber.toLowerCase().includes(lowercasedFilter)
        );
    }

    if (sortConfig !== null) {
        payments.sort((a, b) => {
            const aValue = getNestedValue(a, sortConfig.key);
            const bValue = getNestedValue(b, sortConfig.key);

            if (aValue === undefined || aValue === null) return 1;
            if (bValue === undefined || bValue === null) return -1;
            
            if (sortConfig.key === 'timestamp') {
                 const dateA = new Date(aValue).getTime();
                 const dateB = new Date(bValue).getTime();
                 if (dateA < dateB) return sortConfig.direction === 'ascending' ? -1 : 1;
                 if (dateA > dateB) return sortConfig.direction === 'ascending' ? 1 : -1;
                 return 0;
            }

            if (aValue < bValue) return sortConfig.direction === 'ascending' ? -1 : 1;
            if (aValue > bValue) return sortConfig.direction === 'ascending' ? 1 : -1;
            return 0;
        });
    }

    return payments;
  }, [allPayments, startDate, endDate, selectedBank, verificationStatus, currentUser, isManagerView, searchTerm, sortConfig]);

   const { totalFilteredAED, averagePaymentAED } = useMemo(() => {
        const total = filteredPayments.reduce((sum, p) => sum + convertToAED(p.amountPaid!, p.loan.currency), 0);
        const average = filteredPayments.length > 0 ? total / filteredPayments.length : 0;
        return { totalFilteredAED: total, averagePaymentAED: average };
    }, [filteredPayments]);
  
  const chartData = useMemo(() => {
    const data: {[key: string]: number} = {};
    
    filteredPayments.forEach(p => {
        const day = new Date(p.attributionDate || p.timestamp).toLocaleDateString('en-CA'); // YYYY-MM-DD
        const amountAED = convertToAED(p.amountPaid!, p.loan.currency);
        data[day] = (data[day] || 0) + amountAED;
    });
    
    return Object.entries(data).map(([day, total]) => ({day, total})).sort((a,b) => new Date(a.day).getTime() - new Date(b.day).getTime());
  }, [filteredPayments]);

  const handleExport = () => {
    const headers = {
        'timestamp': 'Payment Date',
        'debtor.name': 'Debtor Name',
        'loan.bank': 'Bank',
        'loan.accountNumber': 'Account',
        'outstandingBalanceBeforePayment': 'O/S Before',
        'amountPaid': 'Amount Paid',
        'loan.currency': 'Currency',
        'officer.name': 'Logged By',
        'receipt.name': 'Receipt Filename',
    };
    exportToCsv(`payment_history_${startDate}_to_${endDate}`, filteredPayments, headers);
  };

  const TH_CLASS = "px-4 py-3 text-left text-xs font-semibold text-text-secondary uppercase tracking-wider bg-surface-muted";
  const SORTABLE_TH_CLASS = `${TH_CLASS} cursor-pointer hover:bg-gray-200`;
  const TD_CLASS = "px-4 py-4 whitespace-nowrap text-sm text-text-primary";

  const getSortIndicator = (key: SortableKey) => {
    if (sortConfig?.key !== key) return ' ';
    return sortConfig.direction === 'ascending' ? '▲' : '▼';
  };

  return (
    <div className="p-6 bg-background min-h-full">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 animate-fade-in-up">
            <div>
                <h1 className="text-3xl font-bold text-text-primary">Advanced Payment History</h1>
                <p className="text-text-secondary mt-1">Analyze and export detailed payment records.</p>
            </div>
             <button onClick={handleExport} className="mt-4 sm:mt-0 flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary border border-transparent rounded-md shadow-sm hover:bg-primary-dark">
                {ICONS.export('w-5 h-5')}
                Export to CSV
            </button>
        </div>

        <div className="animate-fade-in-up" style={{ animationDelay: '100ms' }}>
            <Card className="p-4 mb-6">
                <div className="flex justify-between items-center cursor-pointer" onClick={() => setIsFilterOpen(!isFilterOpen)}>
                    <h3 className="font-semibold text-text-primary text-lg">Filters & Search</h3>
                    {ICONS.chevronDown(`w-5 h-5 text-text-secondary transition-transform ${isFilterOpen ? 'rotate-180' : ''}`)}
                </div>
                {isFilterOpen && (
                    <div className="pt-4 border-t border-border mt-4">
                        <div className="mb-4">
                            <label className="text-sm font-medium text-text-secondary">Search Debtor / Account</label>
                            <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Search..." className="w-full mt-1 py-2 px-3 border border-border bg-surface rounded-md shadow-sm text-sm text-text-primary"/>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            <div>
                                <label className="text-sm font-medium text-text-secondary">Start Date</label>
                                <div className="relative mt-1">
                                    <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full py-2 pl-3 pr-10 border border-border bg-surface rounded-md shadow-sm text-sm text-text-primary"/>
                                    <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                                        {ICONS.calendar('h-5 h-5 text-text-secondary')}
                                    </div>
                                </div>
                            </div>
                            <div>
                                <label className="text-sm font-medium text-text-secondary">End Date</label>
                                <div className="relative mt-1">
                                    <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full py-2 pl-3 pr-10 border border-border bg-surface rounded-md shadow-sm text-sm text-text-primary"/>
                                    <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                                        {ICONS.calendar('h-5 h-5 text-text-secondary')}
                                    </div>
                                </div>
                            </div>
                            <div>
                                <label className="text-sm font-medium text-text-secondary">Bank</label>
                                <select value={selectedBank} onChange={e => setSelectedBank(e.target.value)} className="w-full mt-1 py-2 pl-3 pr-8 border border-border bg-surface rounded-md shadow-sm text-sm text-text-primary">
                                    <option value="all">All Banks</option>
                                    {uniqueBanks.map(b => <option key={b} value={b}>{b}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="text-sm font-medium text-text-secondary">Verification Status</label>
                                <select value={verificationStatus} onChange={e => setVerificationStatus(e.target.value)} className="w-full mt-1 py-2 pl-3 pr-8 border border-border bg-surface rounded-md shadow-sm text-sm text-text-primary">
                                    <option value="all">All Statuses</option>
                                    <option value="verified">Verified</option>
                                    <option value="pending">Pending</option>
                                </select>
                            </div>
                        </div>
                    </div>
                )}
            </Card>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <div className="animate-fade-in-up" style={{ animationDelay: '200ms' }}><KpiCard title="Total Collected" value={formatCurrency(totalFilteredAED, 'AED')} icon={ICONS.recovered('w-7 h-7 text-accent')} valueColor="text-accent" iconBg="bg-accent/10" /></div>
            <div className="animate-fade-in-up" style={{ animationDelay: '300ms' }}><KpiCard title="# of Payments" value={filteredPayments.length.toLocaleString()} icon={ICONS.payment('w-7 h-7 text-accent')} valueColor="text-primary" iconBg="bg-primary/10" /></div>
            <div className="animate-fade-in-up" style={{ animationDelay: '400ms' }}><KpiCard title="Avg. Payment" value={formatCurrency(averagePaymentAED, 'AED')} icon={ICONS.money('w-7 h-7 text-warning')} valueColor="text-warning" iconBg="bg-warning/10" /></div>
        </div>

        <div className="animate-fade-in-up" style={{ animationDelay: '500ms' }}>
            <Card className="p-4 mb-6">
                <h3 className="font-semibold text-text-primary mb-4">Daily Collections</h3>
                    <div style={{ width: '100%', height: 250 }}>
                    <ResponsiveContainer>
                        <BarChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                            <XAxis dataKey="day" stroke="currentColor" className="text-xs text-text-secondary" tickFormatter={(str) => formatDate(str)} />
                            <YAxis stroke="currentColor" className="text-xs text-text-secondary" tickFormatter={(val) => `${val/1000}k`}/>
                            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(59, 130, 246, 0.1)' }} />
                            <Bar dataKey="total" fill="#3b82f6" name="Collections (AED)" />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </Card>
        </div>


      <div className="animate-fade-in-up" style={{ animationDelay: '600ms' }}>
        <Card className="!p-0 mt-6">
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-border">
                <thead className="bg-surface-muted">
                    <tr>
                    <th scope="col" className={SORTABLE_TH_CLASS} onClick={() => requestSort('timestamp')}>Payment Date {getSortIndicator('timestamp')}</th>
                    <th scope="col" className={SORTABLE_TH_CLASS} onClick={() => requestSort('debtor.name')}>Debtor Name {getSortIndicator('debtor.name')}</th>
                    <th scope="col" className={SORTABLE_TH_CLASS} onClick={() => requestSort('loan.bank')}>Bank {getSortIndicator('loan.bank')}</th>
                    <th scope="col" className={TH_CLASS}>O/S Before Payment</th>
                    <th scope="col" className={SORTABLE_TH_CLASS} onClick={() => requestSort('amountPaid')}>Amount Paid {getSortIndicator('amountPaid')}</th>
                    <th scope="col" className={TH_CLASS}>Receipt</th>
                    <th scope="col" className={SORTABLE_TH_CLASS} onClick={() => requestSort('officer.name')}>Assigned Officer {getSortIndicator('officer.name')}</th>
                    <th scope="col" className={TH_CLASS}>Status</th>
                    {currentUser.role === Role.FINANCE && <th scope="col" className={TH_CLASS}>Action</th>}
                    </tr>
                </thead>
                <tbody className="bg-surface divide-y divide-border">
                    {filteredPayments.length > 0 ? filteredPayments.map(p => (
                    <tr key={p.id} className="transition-colors hover:bg-surface-muted">
                        <td className={TD_CLASS}>{formatDate(p.attributionDate || p.timestamp)}</td>
                        <td className={`${TD_CLASS} font-medium text-text-primary`}>{p.debtor?.name}</td>
                        <td className={TD_CLASS}>{p.loan?.bank}</td>
                        <td className={`${TD_CLASS} text-warning`}>{formatCurrency(p.outstandingBalanceBeforePayment, p.loan?.currency)}</td>
                        <td className={`${TD_CLASS} font-semibold text-accent`}>{formatCurrency(p.amountPaid, p.loan?.currency)}</td>
                        <td className={TD_CLASS}>
                            {p.receipt ? (
                                <div className="flex items-center gap-3">
                                    <a href={p.receipt.dataUrl} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline text-sm font-medium flex items-center gap-1">
                                        {ICONS.case('w-4 h-4')} View
                                    </a>
                                </div>
                            ) : (
                                <span className="text-text-secondary text-xs">N/A</span>
                            )}
                        </td>
                        <td className={TD_CLASS}>{p.officer?.name}</td>
                        <td className={TD_CLASS}>
                            <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${p.verified ? 'bg-green-500/10 text-green-400' : 'bg-amber-500/10 text-amber-400'}`}>
                                {p.verified ? 'Verified' : 'Pending'}
                            </span>
                        </td>
                        {currentUser.role === Role.FINANCE && (
                            <td className={TD_CLASS}>
                                {!p.verified && <button onClick={() => onVerifyPayment(p.caseId, p.id)} className="btn-primary text-xs px-3 py-1.5">Verify</button>}
                            </td>
                        )}
                    </tr>
                    )) : (
                        <tr>
                            <td colSpan={currentUser.role === Role.FINANCE ? 9 : 8} className="p-4">
                                 <EmptyState
                                    icon={ICONS.payment('w-16 h-16')}
                                    title="No Payments Found"
                                    description="There are no payment records matching your current filters."
                                />
                            </td>
                        </tr>
                    )}
                </tbody>
                </table>
            </div>
        </Card>
      </div>
    </div>
  );
};

export default PaymentsView;
