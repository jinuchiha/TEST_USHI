

import React, { useMemo } from 'react';
import { User, EnrichedCase, CRMStatus, ActionType } from '../../types';
import { convertToAED } from '../../utils';
import CoordinatorPerformanceCard from './CoordinatorPerformanceCard';

interface PerformanceLeaderboardProps {
    coordinators: User[];
    cases: EnrichedCase[];
}

const PerformanceLeaderboard: React.FC<PerformanceLeaderboardProps> = ({ coordinators, cases }) => {
    
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const performanceData = useMemo(() => {
        const data = coordinators.map(coordinator => {
            const assignedCases = cases.filter(c => c.assignedOfficerId === coordinator.id);
            const activeAssignedCases = assignedCases.filter(c => c.crmStatus !== CRMStatus.CLOSED && c.crmStatus !== CRMStatus.WITHDRAWN);
            
            const allCoordinatorActions = activeAssignedCases.flatMap(c => c.history);

            const doeAccounts = new Set(allCoordinatorActions
                .filter(a => a.timestamp.startsWith(today))
                .map(a => a.caseId)
            );

            const ptpCases = assignedCases.filter(c => c.crmStatus === CRMStatus.PTP);
            
            const monthlyPaymentsAED = assignedCases
                .flatMap(c => c.history.map(h => ({ ...h, currency: c.loan.currency })))
                .filter(h => 
                    h.type === ActionType.PAYMENT_RECEIVED && 
                    new Date(h.timestamp) >= firstDayOfMonth && 
                    h.amountPaid
                )
                .reduce((sum, h) => sum + convertToAED(h.amountPaid!, h.currency), 0);

            const ongoingPtpAED = ptpCases.reduce((sum, c) => sum + convertToAED(c.loan.currentBalance, c.loan.currency), 0);
            const projectionAED = monthlyPaymentsAED + ongoingPtpAED;
            const targetAED = coordinator.target || 0;

            const workableCases = activeAssignedCases.filter(c => c.contactStatus === 'Contact' && c.workStatus === 'Work').length;

            return {
                name: coordinator.name,
                ptpInProgress: ptpCases.length,
                workable: workableCases,
                doe: doeAccounts.size,
                paid: monthlyPaymentsAED,
                projection: projectionAED,
                target: targetAED,
                closure: targetAED > 0 ? (monthlyPaymentsAED / targetAED * 100) : 0,
            };
        });
        
        return data.sort((a, b) => b.paid - a.paid);

    }, [coordinators, cases, firstDayOfMonth, today]);
    
    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-6">
            {performanceData.map((data, index) => (
                <CoordinatorPerformanceCard 
                    key={data.name}
                    data={data}
                    rank={index + 1}
                />
            ))}
        </div>
    );
};

export default PerformanceLeaderboard;