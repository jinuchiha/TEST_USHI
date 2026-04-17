

import React, { useMemo } from 'react';
import { EnrichedCase, CRMStatus, ActionType } from '../../types';
import { formatCurrency, convertToAED } from '../../utils';
import { ICONS } from '../../constants';
import KpiCard from '../shared/KpiCard';

interface DashboardMetricsGridProps {
    allCases: EnrichedCase[];
}

const DashboardMetricsGrid: React.FC<DashboardMetricsGridProps> = ({ allCases }) => {
    
    const stats = useMemo(() => {
        const now = new Date();
        const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        
        const activeCasesList = allCases.filter(c => c.crmStatus !== CRMStatus.CLOSED && c.crmStatus !== CRMStatus.WITHDRAWN);

        const totalOutstanding = activeCasesList.reduce((sum, c) => sum + convertToAED(c.loan.currentBalance, c.loan.currency), 0);
        
        const allPayments = allCases.flatMap(c => c.history)
            .filter(h => h.type === ActionType.PAYMENT_RECEIVED && h.amountPaid);

        const monthlyCollections = allPayments
            .filter(h => new Date(h.attributionDate || h.timestamp) >= firstDayOfMonth)
            .reduce((sum, h) => {
                const currency = allCases.find(c => c.id === h.caseId)?.loan.currency || 'AED';
                return sum + convertToAED(h.amountPaid!, currency);
            }, 0);
            
        const totalRecoveredAllTime = allPayments.reduce((sum, h) => {
            const currency = allCases.find(c => c.id === h.caseId)?.loan.currency || 'AED';
            return sum + convertToAED(h.amountPaid!, currency);
        }, 0);
        
        const ptpCases = activeCasesList.filter(c => c.crmStatus === CRMStatus.PTP);
        const ptpAmount = ptpCases.reduce((sum, c) => sum + convertToAED(c.loan.currentBalance, c.loan.currency), 0);

        const workableCases = activeCasesList.filter(c => c.workStatus === 'Work').length;
        const contactableCases = activeCasesList.filter(c => c.contactStatus === 'Contact').length;

        return {
            totalOutstanding,
            monthlyCollections,
            totalRecoveredAllTime,
            ptpAmount,
            activeCases: activeCasesList.length,
            workableCases,
            contactableCases,
        };

    }, [allCases]);
    
    const financialMetrics = [
        { title:"Total O/S Portfolio", value:formatCurrency(stats.totalOutstanding, 'AED'), icon:ICONS.wallet('w-6 h-6 text-primary'), iconBg:"bg-primary/10", valueColor:"text-primary" },
        { title:"Monthly Collections", value:formatCurrency(stats.monthlyCollections, 'AED'), icon:ICONS.recovered('w-6 h-6 text-accent'), iconBg:"bg-accent/10", valueColor:"text-accent" },
        { title:"Total Recovered (All Time)", value:formatCurrency(stats.totalRecoveredAllTime, 'AED'), icon:ICONS.globe('w-6 h-6 text-green-500'), iconBg:"bg-green-500/10", valueColor:"text-green-500" },
        { title:"PTP Amount", value:formatCurrency(stats.ptpAmount, 'AED'), icon:ICONS.calendar('w-6 h-6 text-warning'), iconBg:"bg-warning/10", valueColor:"text-warning" },
    ];

    const caseMetrics = [
        { title:"Active Cases", value:stats.activeCases.toLocaleString(), icon:ICONS.case('w-6 h-6 text-danger'), iconBg:"bg-danger/10", valueColor:"text-danger" },
        { title:"Workable Cases", value:stats.workableCases.toLocaleString(), icon:ICONS.clients('w-6 h-6 text-sky-500'), iconBg:"bg-sky-500/10", valueColor:"text-sky-500" },
        { title:"Contactable Cases", value:stats.contactableCases.toLocaleString(), icon:ICONS.phone('w-6 h-6 text-teal-500'), iconBg:"bg-teal-500/10", valueColor:"text-teal-500" },
    ];

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-4">
            {financialMetrics.map((metric, index) => (
                <div key={index} className="lg:col-span-3 animate-fade-in-up" style={{ animationDelay: `${index * 50}ms` }}>
                    <KpiCard {...metric} />
                </div>
            ))}
            {caseMetrics.map((metric, index) => (
                <div key={index} className="lg:col-span-4 animate-fade-in-up" style={{ animationDelay: `${(financialMetrics.length + index) * 50}ms` }}>
                    <KpiCard {...metric} />
                </div>
            ))}
        </div>
    );
};

export default DashboardMetricsGrid;