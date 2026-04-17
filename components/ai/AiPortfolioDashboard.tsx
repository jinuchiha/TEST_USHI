import React, { useState, useEffect } from 'react';
import { useAuth } from '../../src/contexts/AuthContext';
import { aiApi, PortfolioInsights } from '../../src/api';
import RecoveryScoreBadge from './RecoveryScoreBadge';
import { EnrichedCase } from '../../types';
import { formatCurrency } from '../../utils';

interface AiPortfolioDashboardProps {
  allCases: EnrichedCase[];
  onSelectCase?: (caseId: string) => void;
}

const AiPortfolioDashboard: React.FC<AiPortfolioDashboardProps> = ({
  allCases,
  onSelectCase,
}) => {
  const { useApi } = useAuth();
  const [insights, setInsights] = useState<PortfolioInsights | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (useApi) {
      setLoading(true);
      aiApi.getPortfolioInsights()
        .then(r => setInsights(r.data))
        .catch(console.error)
        .finally(() => setLoading(false));
    } else {
      // Generate demo insights from local data
      setInsights(generateDemoInsights(allCases));
    }
  }, [useApi, allCases.length]);

  if (loading) {
    return <div className="text-center text-text-secondary py-8">Loading AI Portfolio Insights...</div>;
  }
  if (!insights) return null;

  const recoveryPct = insights.totalExposure > 0
    ? Math.round((insights.predictedRecovery / insights.totalExposure) * 100)
    : 0;

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* AI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="panel p-4">
          <p className="text-xs text-text-tertiary uppercase font-medium">Total Exposure</p>
          <p className="text-2xl font-bold text-text-primary mt-1">
            {formatCurrency(insights.totalExposure, 'AED')}
          </p>
        </div>
        <div className="panel p-4">
          <p className="text-xs text-text-tertiary uppercase font-medium">AI Predicted Recovery</p>
          <p className="text-2xl font-bold text-emerald-600 mt-1">
            {formatCurrency(insights.predictedRecovery, 'AED')}
          </p>
          <p className="text-xs text-text-tertiary">{recoveryPct}% of exposure</p>
        </div>
        <div className="panel p-4">
          <p className="text-xs text-text-tertiary uppercase font-medium">High Risk Cases</p>
          <p className="text-2xl font-bold text-red-600 mt-1">{insights.highRiskCount}</p>
          <p className="text-xs text-text-tertiary">Require attention</p>
        </div>
        <div className="panel p-4">
          <p className="text-xs text-text-tertiary uppercase font-medium">Active Cases</p>
          <p className="text-2xl font-bold text-text-primary mt-1">
            {insights.riskDistribution.veryHigh + insights.riskDistribution.high +
             insights.riskDistribution.medium + insights.riskDistribution.low +
             insights.riskDistribution.veryLow}
          </p>
        </div>
      </div>

      {/* Risk Distribution */}
      <div className="panel p-5">
        <h3 className="text-sm font-bold text-text-primary mb-4">AI Risk Distribution</h3>
        <div className="flex items-end gap-1 h-24">
          {[
            { label: 'Very High', count: insights.riskDistribution.veryHigh, color: 'bg-red-500' },
            { label: 'High', count: insights.riskDistribution.high, color: 'bg-orange-500' },
            { label: 'Medium', count: insights.riskDistribution.medium, color: 'bg-amber-500' },
            { label: 'Low', count: insights.riskDistribution.low, color: 'bg-blue-500' },
            { label: 'Very Low', count: insights.riskDistribution.veryLow, color: 'bg-emerald-500' },
          ].map(item => {
            const total = Object.values(insights.riskDistribution).reduce((a: number, b: number) => a + b, 0);
            const pct = total > 0 ? (item.count / total) * 100 : 0;
            return (
              <div key={item.label} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-[10px] text-text-tertiary font-medium">{item.count}</span>
                <div
                  className={`w-full rounded-t ${item.color} transition-all duration-500`}
                  style={{ height: `${Math.max(4, pct)}%` }}
                />
                <span className="text-[9px] text-text-tertiary text-center leading-tight">{item.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Top Opportunities */}
      <div className="panel p-5">
        <h3 className="text-sm font-bold text-text-primary mb-3">Top Recovery Opportunities</h3>
        <div className="space-y-2">
          {insights.topOpportunities.slice(0, 8).map((opp, i) => (
            <div
              key={opp.caseId}
              onClick={() => onSelectCase?.(opp.caseId)}
              className="flex items-center justify-between p-2.5 rounded-lg hover:bg-[var(--color-bg-tertiary)] cursor-pointer transition"
            >
              <div className="flex items-center gap-3">
                <span className="text-xs text-text-tertiary w-5">{i + 1}.</span>
                <div>
                  <p className="text-sm font-medium text-text-primary">{opp.debtorName}</p>
                  <p className="text-xs text-text-tertiary">{formatCurrency(opp.balance, 'AED')} outstanding</p>
                </div>
              </div>
              <RecoveryScoreBadge score={opp.score} size="sm" showLabel={false} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

function generateDemoInsights(cases: EnrichedCase[]): PortfolioInsights {
  const activeCases = cases.filter(c => c.crmStatus !== 'Closed' && c.crmStatus !== 'Withdrawn');
  const totalExposure = activeCases.reduce((sum, c) => sum + (c.loan?.currentBalance || 0), 0);

  // Simple scoring for demo
  const statusScores: Record<string, number> = {
    'PTP': 75, 'UNDER NEGO': 65, 'FIP': 55, 'WIP': 50, 'CB': 40,
    'DXB': 35, 'UTR': 25, 'NCC': 20, 'NITP': 15, 'Dispute': 30,
    'NIP': 10, 'Expire': 10,
  };

  let predictedRecovery = 0;
  const distribution = { veryHigh: 0, high: 0, medium: 0, low: 0, veryLow: 0 };
  const scored = activeCases.map(c => {
    const score = Math.max(5, Math.min(95,
      (statusScores[c.crmStatus] || 35) +
      (c.contactStatus === 'Contact' ? 10 : -10) +
      (c.workStatus === 'Work' ? 5 : 0)
    ));
    predictedRecovery += (c.loan?.currentBalance || 0) * score / 100;

    if (score >= 80) distribution.veryLow++;
    else if (score >= 60) distribution.low++;
    else if (score >= 40) distribution.medium++;
    else if (score >= 20) distribution.high++;
    else distribution.veryHigh++;

    return { caseId: c.id, debtorName: c.debtor?.name || 'Unknown', score, balance: c.loan?.currentBalance || 0 };
  });

  return {
    totalExposure: Math.round(totalExposure),
    predictedRecovery: Math.round(predictedRecovery),
    highRiskCount: distribution.veryHigh + distribution.high,
    topOpportunities: scored.sort((a, b) => b.score - a.score).slice(0, 10),
    riskDistribution: distribution,
  };
}

export default AiPortfolioDashboard;
