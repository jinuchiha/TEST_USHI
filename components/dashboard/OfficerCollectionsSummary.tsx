import React, { useMemo } from 'react';
import { EnrichedCase, User, ActionType } from '../../types';
import { formatCurrency, convertToAED } from '../../utils';
import Card from '../shared/Card';
import EmptyState from '../shared/EmptyState';
import { ICONS } from '../../constants';

interface OfficerCollectionsSummaryProps {
  allCases: EnrichedCase[];
  coordinators: User[];
  selectedMonth?: string;
}

const OfficerCollectionsSummary: React.FC<OfficerCollectionsSummaryProps> = ({ allCases, coordinators, selectedMonth }) => {
    
    const summaryData = useMemo(() => {
        const [year, month] = selectedMonth 
            ? selectedMonth.split('-').map(Number) 
            : [new Date().getFullYear(), new Date().getMonth() + 1];
        
        const firstDayOfMonth = new Date(year, month - 1, 1);
        const lastDayOfMonth = new Date(year, month, 0);

        const monthlyPayments = allCases.flatMap(c => 
            c.history
             .filter(h => {
                if (h.type !== ActionType.PAYMENT_RECEIVED || !h.amountPaid || h.amountPaid <= 0) return false;
                const paymentDate = new Date(h.attributionDate || h.timestamp);
                return paymentDate >= firstDayOfMonth && paymentDate <= lastDayOfMonth;
             })
             .map(h => ({
                amountAED: convertToAED(h.amountPaid!, c.loan.currency),
                officerId: c.officer.id,
            }))
        );

        return coordinators.map(coordinator => {
            const collected = monthlyPayments
                .filter(p => p.officerId === coordinator.id)
                .reduce((sum, p) => sum + p.amountAED, 0);
            
            return {
                id: coordinator.id,
                name: coordinator.name,
                collected,
            };
        }).sort((a, b) => b.collected - a.collected);

    }, [allCases, coordinators, selectedMonth]);
    
    const monthLabel = useMemo(() => {
        const dateString = selectedMonth ? `${selectedMonth}-02` : new Date().toISOString();
        return new Date(dateString).toLocaleString('default', { month: 'long', year: 'numeric' });
    }, [selectedMonth]);

    const TH_CLASS = "px-4 py-3 text-left text-xs font-semibold text-text-secondary uppercase tracking-wider";
    const TD_CLASS = "px-4 py-4 whitespace-nowrap text-sm text-text-primary";

    return (
        <Card className="!p-0 h-full max-h-[442px] flex flex-col">
            <div className="p-4 border-b border-border">
                <h3 className="text-lg font-semibold text-text-primary">Officer Collections ({monthLabel})</h3>
            </div>
            <div className="overflow-y-auto">
                <table className="min-w-full">
                    <thead className="bg-black/5 dark:bg-white/5">
                        <tr>
                            <th className={TH_CLASS}>Officer</th>
                            <th className={TH_CLASS}>Collected</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                        {summaryData.length > 0 ? summaryData.map(p => (
                            <tr key={p.id}>
                                <td className={`${TD_CLASS} font-medium text-text-primary`}>{p.name}</td>
                                <td className={`${TD_CLASS} font-semibold text-accent`}>{formatCurrency(p.collected, 'AED')}</td>
                            </tr>
                        )) : (
                            <tr>
                                <td colSpan={2} className="p-4">
                                    <EmptyState
                                        icon={ICONS.money('w-16 h-16')}
                                        title="No Collections Yet"
                                        description="There have been no recorded payments for the selected month."
                                    />
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </Card>
    );
};

export default OfficerCollectionsSummary;
