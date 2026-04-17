import React, { useMemo } from 'react';
import { EnrichedCase, User, ActionType } from '../../types';
import { formatCurrency, convertToAED } from '../../utils';
import Card from '../shared/Card';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell, Legend } from 'recharts';
import DashboardMetricsGrid from './DashboardMetricsGrid';
import { ICONS } from '../../constants';
import PerformanceLeaderboard from '../reports/PerformanceLeaderboard';

interface CEODashboardProps {
  allCases: EnrichedCase[];
  coordinators: User[];
  onOpenSendNotificationModal: () => void;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="panel p-2 border-border rounded-md shadow-lg !bg-background">
        <p className="label text-sm text-text-primary font-bold">{`Day ${label}`}</p>
        <p className="intro text-sm text-sky-400">{`Recovery : ${formatCurrency(payload[0].value, 'AED')}`}</p>
      </div>
    );
  }
  return null;
};

const CustomBankTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="panel p-2 border-border rounded-md shadow-lg !bg-background">
        <p className="label text-sm text-text-primary font-bold">{`${payload[0].name}`}</p>
        <p className="intro text-sm" style={{ color: payload[0].fill }}>{`Cases : ${payload[0].value.toLocaleString()}`}</p>
      </div>
    );
  }
  return null;
};

const COLORS = ['#3B82F6', '#14B8A6', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#64748B', '#F97316', '#84CC16', '#D946EF', '#0891B2', '#65A30D'];


const CEODashboard: React.FC<CEODashboardProps> = ({ allCases, coordinators, onOpenSendNotificationModal }) => {
    
    const stats = useMemo(() => {
        const now = new Date();
        const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        
        const allHistory = allCases.flatMap(c => c.history.map(h => ({ ...h, currency: c.loan.currency })));
        
        const monthlyPayments = allHistory.filter(h => {
            if (h.type !== ActionType.PAYMENT_RECEIVED || !h.amountPaid) return false;
            const actionDate = new Date(h.attributionDate || h.timestamp);
            return actionDate >= firstDayOfMonth;
        });
        
        const monthlyTrendData = Array.from({ length: now.getDate() }, (_, i) => {
            const day = i + 1;
            const date = new Date(now.getFullYear(), now.getMonth(), day);
            const dateString = date.toISOString().split('T')[0];
            
            const dailyTotal = monthlyPayments
                .filter(p => (p.attributionDate || p.timestamp).startsWith(dateString))
                .reduce((sum, p) => sum + convertToAED(p.amountPaid!, p.currency), 0);

            return { name: day, Recovery: dailyTotal };
        });

        const bankCounts = allCases.reduce((acc, c) => {
            const bank = c.loan.bank;
            acc[bank] = (acc[bank] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        const MAX_SLICES = 11;
        const sortedData = Object.entries(bankCounts).map(([name, value]) => ({ name, value: value as number })).sort((a, b) => b.value - a.value);

        let bankChartData;
        if (sortedData.length <= MAX_SLICES) {
            bankChartData = sortedData;
        } else {
            const mainData = sortedData.slice(0, MAX_SLICES - 1);
            // Fix: Explicitly cast `curr.value` to a Number within the reduce function to prevent a TypeScript arithmetic error.
            const otherValue = sortedData.slice(MAX_SLICES - 1).reduce((acc, curr) => acc + Number(curr.value), 0);
            mainData.push({ name: 'Other', value: otherValue });
            bankChartData = mainData;
        }


        return {
            trendData: monthlyTrendData,
            bankChartData
        };
    }, [allCases]);


    return (
        <div className="p-0 md:p-2 min-h-full">
             <div className="flex flex-col sm:flex-row justify-between items-center mb-6 p-4 md:p-2 animate-fade-in-up">
                <div>
                    <h1 className="text-3xl font-bold text-text-primary">Executive Overview</h1>
                    <p className="text-text-secondary">Company-wide strategic performance indicators.</p>
                </div>
                <button onClick={onOpenSendNotificationModal} className="btn-primary px-4 py-2 text-sm flex items-center gap-2">
                    {ICONS.bell('w-4 h-4')} Send Notification
                </button>
            </div>
            
            <div className="animate-fade-in-up" style={{ animationDelay: '100ms' }}>
                <DashboardMetricsGrid allCases={allCases} />
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mt-6">
                <div className="xl:col-span-2 animate-fade-in-up" style={{ animationDelay: '200ms' }}>
                     <Card className="p-6">
                        <h2 className="text-lg font-semibold text-text-primary mb-4">Monthly Recovery Trend</h2>
                         <div style={{ width: '100%', height: 350 }}>
                            <ResponsiveContainer>
                                <AreaChart data={stats.trendData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                                    <defs>
                                        <linearGradient id="ceoRecovery" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="var(--gradient-start)" stopOpacity={0.8}/>
                                            <stop offset="95%" stopColor="var(--gradient-end)" stopOpacity={0.1}/>
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false}/>
                                    <XAxis dataKey="name" className="text-xs" stroke="var(--color-text-secondary)" tickLine={false} axisLine={false}/>
                                    <YAxis className="text-xs" stroke="var(--color-text-secondary)" tickFormatter={(val) => `${val/1000}k`} tickLine={false} axisLine={false}/>
                                    <Tooltip content={<CustomTooltip />} />
                                    <Area type="monotone" dataKey="Recovery" stroke="var(--color-primary)" strokeWidth={2} fillOpacity={1} fill="url(#ceoRecovery)" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </Card>
                </div>

                 <div className="xl:col-span-1 animate-fade-in-up" style={{ animationDelay: '300ms' }}>
                     <Card className="p-6 h-full">
                        <h2 className="text-lg font-semibold text-text-primary mb-4">Portfolio by Bank</h2>
                         <div style={{ width: '100%', height: 350 }}>
                            <ResponsiveContainer>
                               <PieChart>
                                    <Pie data={stats.bankChartData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={70} outerRadius={100} fill="#8884d8" paddingAngle={5}>
                                        {
                                        // Fix: Explicitly cast array length to a Number to resolve an arithmetic operation error with the modulo operator.
                                        stats.bankChartData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % Number(COLORS.length)]} />
                                        ))
                                        }
                                    </Pie>
                                    <Tooltip content={<CustomBankTooltip />} />
                                    <Legend iconSize={10} wrapperStyle={{fontSize: '12px', color: 'var(--color-text-secondary)'}}/>
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </Card>
                </div>
            </div>

            <div className="mt-6 animate-fade-in-up" style={{ animationDelay: '400ms' }}>
                <h2 className="text-xl font-bold text-text-primary mb-4 px-4 md:px-2">Monthly Performance Leaderboard</h2>
                <PerformanceLeaderboard coordinators={coordinators} cases={allCases} />
            </div>

        </div>
    );
};

export default CEODashboard;