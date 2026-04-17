import React, { useMemo, useState } from 'react';
import { EnrichedCase, User, ActionType } from '../../types';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, Legend, CartesianGrid } from 'recharts';
import Card from '../shared/Card';
import KpiCard from '../shared/KpiCard';
import { ICONS, banks } from '../../constants';
import { convertToAED, formatCurrency } from '../../utils';

interface AnnualForecastReportProps {
  cases: EnrichedCase[];
  coordinators: User[];
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="panel p-3 border border-border rounded-md shadow-lg text-sm !bg-background">
        <p className="font-bold text-text-primary mb-2">{label}</p>
        {payload.map((p: any) => (
          <p key={p.name} style={{ color: p.color }}>
            {`${p.name}: ${p.value ? formatCurrency(p.value, 'AED') : 'N/A'}`}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

const AnnualForecastReport: React.FC<AnnualForecastReportProps> = ({ cases, coordinators }) => {
    const [selectedCoordinatorId, setSelectedCoordinatorId] = useState('all');
    const [selectedBank, setSelectedBank] = useState('all');

    const reportData = useMemo(() => {
        let filteredCases = cases;
        if (selectedCoordinatorId !== 'all') {
            filteredCases = filteredCases.filter(c => c.assignedOfficerId === selectedCoordinatorId);
        }
        if (selectedBank !== 'all') {
            filteredCases = filteredCases.filter(c => c.loan.bank === selectedBank);
        }

        const targetCoordinators = selectedCoordinatorId === 'all' ? coordinators : coordinators.filter(c => c.id === selectedCoordinatorId);

        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth(); // 0-indexed

        const annualTarget = targetCoordinators.reduce((sum, c) => sum + (c.target || 0), 0) * 12;

        const allPayments = filteredCases.flatMap(c => 
        c.history
            .filter(h => h.type === ActionType.PAYMENT_RECEIVED && h.amountPaid && new Date(h.timestamp).getFullYear() === currentYear)
            .map(h => ({
                amountAED: convertToAED(h.amountPaid!, c.loan.currency),
                month: new Date(h.timestamp).getMonth(),
            }))
        );

        const ytdCollections = allPayments.reduce((sum, p) => sum + p.amountAED, 0);

        const monthlyActuals = Array(12).fill(0);
        allPayments.forEach(p => {
            monthlyActuals[p.month] += p.amountAED;
        });

        const averageMonthlyCollection = currentMonth > 0 ? ytdCollections / (currentMonth + 1) : ytdCollections;
        const forecastedTotal = ytdCollections + (averageMonthlyCollection * (11 - currentMonth));
        const deficit = annualTarget - forecastedTotal;
        
        const monthlyTarget = annualTarget / 12;
        
        const chartData = Array.from({ length: 12 }, (_, i) => {
            const monthName = new Date(currentYear, i).toLocaleString('default', { month: 'short' });
            const actual = i <= currentMonth ? monthlyActuals[i] : null;
            
            return {
                name: monthName,
                'Actual': actual,
                'Projected': monthlyTarget,
            };
        });

        return {
            annualTarget,
            ytdCollections,
            forecastedTotal,
            deficit,
            chartData
        };
    }, [cases, coordinators, selectedCoordinatorId, selectedBank]);

  return (
    <div className="p-4 sm:p-6 min-h-full">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <div>
            <h1 className="text-3xl font-bold text-text-primary">Strategic Forecast & Annual Report</h1>
            <p className="text-text-secondary">Yearly performance overview with projected outcomes.</p>
        </div>
        <div className="flex items-center gap-4">
            <select value={selectedCoordinatorId} onChange={e => setSelectedCoordinatorId(e.target.value)} className="w-full sm:w-auto pl-3 pr-10 py-2 text-base rounded-md shadow-sm">
                <option value="all">Global</option>
                {coordinators.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
             <select value={selectedBank} onChange={e => setSelectedBank(e.target.value)} className="w-full sm:w-auto pl-3 pr-10 py-2 text-base rounded-md shadow-sm">
                <option value="all">All Banks</option>
                {banks.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        <KpiCard title="Annual Target" value={formatCurrency(reportData.annualTarget, 'AED')} icon={ICONS.performance('w-7 h-7 text-primary')} valueColor="text-text-primary" />
        <KpiCard title="YTD Collections" value={formatCurrency(reportData.ytdCollections, 'AED')} icon={ICONS.recovered('w-7 h-7 text-accent')} valueColor="text-accent" />
        <KpiCard title="Forecasted Total" value={formatCurrency(reportData.forecastedTotal, 'AED')} icon={ICONS.lightbulb('w-7 h-7 text-warning')} valueColor="text-warning" />
        <KpiCard 
          title="Projected Deficit/Surplus" 
          value={formatCurrency(Math.abs(reportData.deficit), 'AED')} 
          icon={reportData.deficit > 0 ? ICONS.arrow('w-7 h-7 -rotate-45') : ICONS.arrow('w-7 h-7 rotate-45')} 
          valueColor={reportData.deficit > 0 ? "text-danger" : "text-success"} 
        />
      </div>

      <Card className="p-6">
        <h3 className="font-semibold text-text-primary mb-4 text-lg">Forecast Trend</h3>
        <div style={{ width: '100%', height: 400 }}>
          <ResponsiveContainer>
            <AreaChart data={reportData.chartData}>
               <defs>
                  <linearGradient id="areaGradient1" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--gradient-start)" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="var(--gradient-start)" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="areaGradient2" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--gradient-end)" stopOpacity={0.6}/>
                    <stop offset="95%" stopColor="var(--gradient-end)" stopOpacity={0}/>
                  </linearGradient>
                </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
              <XAxis dataKey="name" stroke="var(--color-text-secondary)" className="text-xs" tickLine={false} axisLine={false} />
              <YAxis stroke="var(--color-text-secondary)" className="text-xs" tickFormatter={val => `${val / 1000}k`} tickLine={false} axisLine={false}/>
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(59, 130, 246, 0.1)' }}/>
              <Legend wrapperStyle={{ color: 'var(--color-text-secondary)' }} />
              <Area type="monotone" dataKey="Projected" stroke="var(--gradient-end)" fill="url(#areaGradient2)" strokeWidth={2} />
              <Area type="monotone" dataKey="Actual" stroke="var(--gradient-start)" fill="url(#areaGradient1)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
};

export default AnnualForecastReport;