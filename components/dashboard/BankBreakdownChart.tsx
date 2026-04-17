import React, { useMemo } from 'react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from 'recharts';
import { EnrichedCase } from '../../types';

interface BankBreakdownChartProps {
    cases: EnrichedCase[];
}

const COLORS = ['#3B82F6', '#14B8A6', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#64748B'];

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="panel p-2 border border-border rounded-md shadow-sm !bg-background">
        <p className="label text-sm font-semibold text-text-primary">{`${payload[0].name} : ${payload[0].value.toLocaleString()} cases`}</p>
      </div>
    );
  }
  return null;
};

const BankBreakdownChart: React.FC<BankBreakdownChartProps> = ({ cases }) => {
    const bankData = useMemo(() => {
        const bankCounts = cases.reduce((acc, curr) => {
            const bankName = curr.loan?.bank || 'Unknown';
            acc[bankName] = (acc[bankName] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);
        return Object.entries(bankCounts).map(([name, value]) => ({ name, value: value as number })).sort((a,b) => b.value - a.value);
    }, [cases]);

    return (
        <div style={{ width: '100%', height: 200 }}>
             <ResponsiveContainer>
                <PieChart>
                    <Pie data={bankData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={40} outerRadius={60} fill="#8884d8" paddingAngle={5}>
                        {
                        // Fix: Explicitly cast array length to a Number to resolve an arithmetic operation error.
                        bankData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % Number(COLORS.length)]} />)
                        }
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                    <Legend iconSize={10} wrapperStyle={{fontSize: '12px', color: 'var(--color-text-secondary)'}}/>
                </PieChart>
            </ResponsiveContainer>
        </div>
    );
};

export default BankBreakdownChart;