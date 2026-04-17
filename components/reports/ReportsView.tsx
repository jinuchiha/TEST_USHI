import React, { useMemo } from 'react';
import { EnrichedCase, User, ActionType } from '../../types';
import { ICONS } from '../../constants';
import Card from '../shared/Card';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend, LineChart, Line, CartesianGrid, XAxis, YAxis } from 'recharts';
import { formatCurrency, convertToAED, formatDate } from '../../utils';
import KpiCard from '../shared/KpiCard';

interface DetailedPerformanceDashboardProps {
  cases: EnrichedCase[];
  coordinators: User[];
  selectedOfficerId: string;
  date: string;
  setDate: (date: string) => void;
  onBack?: () => void;
  isAgentReport?: boolean;
}

const COLORS = ['#0ea5e9', '#14b8a6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#64748b'];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white/80 dark:bg-surface/80 p-2 border border-slate-200 rounded-md shadow-lg">
        <p className="label text-sm text-slate-800 dark:text-secondary">{`Day ${label}`}</p>
        <p className="intro text-sm text-primary">{`Collected: ${formatCurrency(payload[0].value, 'AED')}`}</p>
      </div>
    );
  }
  return null;
};

const DetailedPerformanceDashboard: React.FC<DetailedPerformanceDashboardProps> = ({ cases, coordinators, selectedOfficerId, date, setDate, onBack, isAgentReport }) => {
    
    const officer = useMemo(() => coordinators.find(c => c.id === selectedOfficerId), [coordinators, selectedOfficerId]);

    const officerData = useMemo(() => {
        if (!officer) return null;
        
        const officerCases = cases.filter(c => c.assignedOfficerId === officer.id);
        const allOfficerHistory = officerCases.flatMap(c => c.history.map(h => ({...h, caseData: c})));
        
        const now = new Date();
        const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        const monthlyPayments = allOfficerHistory
            .filter(h => h.type === ActionType.PAYMENT_RECEIVED && h.amountPaid && new Date(h.timestamp) >= firstDayOfMonth);

        const totalCollected = monthlyPayments.reduce((sum, h) => sum + convertToAED(h.amountPaid!, h.caseData.loan.currency), 0);
        const ptpCases = officerCases.filter(c => c.crmStatus === 'PTP');
        const ptpAmount = ptpCases.reduce((sum, c) => sum + convertToAED(c.loan.currentBalance, c.loan.currency), 0);
        const callsMade = allOfficerHistory.filter(h => h.type === ActionType.SOFT_CALL && new Date(h.timestamp) >= firstDayOfMonth).length;

        const statusBreakdown = officerCases.reduce((acc, c) => {
            acc[c.crmStatus] = (acc[c.crmStatus] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        const pieData = Object.entries(statusBreakdown).map(([name, value]) => ({ name, value }));
        
        const dailyCollectionData: {[key: number]: number} = {};
        monthlyPayments.forEach(p => {
            const day = new Date(p.timestamp).getDate();
            dailyCollectionData[day] = (dailyCollectionData[day] || 0) + convertToAED(p.amountPaid!, p.caseData.loan.currency);
        });
        const lineData = Array.from({length: new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()}, (_, i) => ({
            day: i + 1,
            collected: dailyCollectionData[i+1] || 0
        }));

        return {
            totalCollected,
            ptpAmount,
            callsMade,
            ptpCount: ptpCases.length,
            pieData,
            lineData,
            recentPayments: monthlyPayments.sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 5)
        };
    }, [officer, cases]);

    if (!officer || !officerData) return <div>Loading...</div>;

    return (
        <div className="p-4 sm:p-6 bg-slate-50 dark:bg-background min-h-full">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6">
                 <div>
                    <h1 className="text-3xl font-bold text-slate-800 dark:text-secondary">{officer.name}'s Report</h1>
                     <p className="text-slate-500 dark:text-subtle-text">Detailed performance analysis for the current month.</p>
                </div>
                {!isAgentReport && onBack && (
                     <button onClick={onBack} className="mt-2 sm:mt-0 text-sm text-primary hover:text-secondary flex items-center gap-2">
                        {ICONS.arrow('w-4 h-4')}
                        Back to Team View
                    </button>
                )}
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
                <KpiCard title="Total Collected" value={formatCurrency(officerData.totalCollected, 'AED')} icon={ICONS.recovered('w-7 h-7 text-accent')} valueColor="text-accent" iconBg="bg-accent/10"/>
                <KpiCard title="PTP Amount" value={formatCurrency(officerData.ptpAmount, 'AED')} icon={ICONS.calendar('w-7 h-7 text-warning')} valueColor="text-warning" iconBg="bg-warning/10" />
                <KpiCard title="PTP Cases" value={officerData.ptpCount} icon={ICONS.case('w-7 h-7 text-primary')} valueColor="text-primary" iconBg="bg-primary/10" />
                <KpiCard title="Calls Made" value={officerData.callsMade} icon={ICONS.phone('w-7 h-7 text-danger')} valueColor="text-danger" iconBg="bg-danger/10" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="lg:col-span-2 p-4">
                     <h3 className="font-semibold text-slate-800 dark:text-secondary mb-4">Daily Collection Trend</h3>
                     <div style={{height: '300px'}}>
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={officerData.lineData}>
                                <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-border-color/50"/>
                                <XAxis dataKey="day" stroke="currentColor" className="text-xs" />
                                <YAxis stroke="currentColor" className="text-xs" tickFormatter={val => `${val/1000}k`}/>
                                <Tooltip content={<CustomTooltip />} />
                                <Legend />
                                <Line type="monotone" dataKey="collected" name="Collected (AED)" stroke="#0ea5e9" strokeWidth={2} />
                            </LineChart>
                        </ResponsiveContainer>
                     </div>
                </Card>
                 <Card className="lg:col-span-1 p-4">
                    <h3 className="font-semibold text-slate-800 dark:text-secondary mb-4">Case Status Breakdown</h3>
                    <div style={{height: '300px'}}>
                         <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie data={officerData.pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={60} outerRadius={100} fill="#8884d8" paddingAngle={5}>
                                    {officerData.pieData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                                </Pie>
                                <Tooltip contentStyle={{ backgroundColor: 'var(--tooltip-bg, #ffffff)', border: '1px solid var(--tooltip-border, #eeeeee)' }} />
                                <Legend wrapperStyle={{fontSize: '12px'}}/>
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                 </Card>
            </div>
            
            <Card className="mt-6 !p-0">
                 <div className="p-4 border-b border-slate-200">
                    <h3 className="text-lg font-semibold text-slate-800 dark:text-secondary">Recent Payments</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="min-w-full">
                         <thead className="bg-slate-50 dark:bg-surface/50">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-subtle-text uppercase">Date</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-subtle-text uppercase">Debtor</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-subtle-text uppercase">Amount</th>
                            </tr>
                        </thead>
                         <tbody className="bg-white dark:bg-surface divide-y divide-slate-200">
                            {officerData.recentPayments.map(p => (
                                <tr key={p.id}>
                                    <td className="px-4 py-4 whitespace-nowrap text-sm text-slate-800 dark:text-base-text">{formatDate(p.timestamp)}</td>
                                    <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-slate-900 dark:text-secondary">{p.caseData.debtor.name}</td>
                                    <td className="px-4 py-4 whitespace-nowrap text-sm font-semibold text-accent">{formatCurrency(p.amountPaid, p.caseData.loan.currency)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                     {officerData.recentPayments.length === 0 && <p className="text-center p-8 text-slate-500 dark:text-subtle-text">No payments this month.</p>}
                </div>
            </Card>

        </div>
    );
};
export default DetailedPerformanceDashboard;