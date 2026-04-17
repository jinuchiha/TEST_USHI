import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../src/contexts/AuthContext';
import { apiClient } from '../../../src/api/client';
import { EnrichedCase } from '../../../types';
import { formatCurrency } from '../../../utils';

interface Props { allCases: EnrichedCase[]; }

const PortfolioAgingDashboard: React.FC<Props> = ({ allCases }) => {
  const { useApi } = useAuth();
  const [agingData, setAgingData] = useState<any>(null);
  const [dobInsights, setDobInsights] = useState<any[]>([]);
  const [writeOffAlerts, setWriteOffAlerts] = useState<any[]>([]);
  const [recommendations, setRecommendations] = useState<any[]>([]);

  useEffect(() => {
    if (useApi) {
      apiClient.get<any>('/api/ai/intelligence/aging').then(r => setAgingData(r.data)).catch(() => {});
      apiClient.get<any>('/api/ai/intelligence/dob-insights').then(r => setDobInsights(r.data || [])).catch(() => {});
      apiClient.get<any>('/api/ai/intelligence/write-off-alerts').then(r => setWriteOffAlerts(r.data || [])).catch(() => {});
      apiClient.get<any>('/api/ai/intelligence/portfolio-recommendations').then(r => setRecommendations(r.data || [])).catch(() => {});
    } else {
      // Demo data
      const active = allCases.filter(c => !['Closed','Withdrawn'].includes(c.crmStatus));
      const buckets = [
        { label: '0-30 Days', caseCount: Math.round(active.length * 0.3), totalBalance: 450000, recoveryProbability: 65, recommendation: 'Focus: Quick resolution through active negotiation' },
        { label: '31-60 Days', caseCount: Math.round(active.length * 0.25), totalBalance: 380000, recoveryProbability: 45, recommendation: 'Priority: Settlement offers and payment plans' },
        { label: '61-90 Days', caseCount: Math.round(active.length * 0.2), totalBalance: 290000, recoveryProbability: 30, recommendation: 'Escalate: Consider legal notices' },
        { label: '91-180 Days', caseCount: Math.round(active.length * 0.15), totalBalance: 210000, recoveryProbability: 18, recommendation: 'Legal: Initiate formal proceedings' },
        { label: '180+ Days', caseCount: Math.round(active.length * 0.1), totalBalance: 120000, recoveryProbability: 8, recommendation: 'Review: Assess for write-off' },
      ];
      setAgingData({ buckets, totalExposure: 1450000, totalCases: active.length, recommendations: ['Focus on 0-30 day bucket for highest recovery'] });
      setDobInsights([
        { ageGroup: '18-25', caseCount: 8, avgRecoveryScore: 45, preferredChannel: 'WhatsApp / SMS', paymentBehavior: 'Higher digital payment response', recommendation: 'Use WhatsApp with payment links' },
        { ageGroup: '26-35', caseCount: 22, avgRecoveryScore: 52, preferredChannel: 'Phone + WhatsApp', paymentBehavior: 'Negotiation-oriented', recommendation: 'Offer installment plans via phone' },
        { ageGroup: '36-45', caseCount: 30, avgRecoveryScore: 48, preferredChannel: 'Phone call', paymentBehavior: 'Prefers formal communication', recommendation: 'Professional phone calls during business hours' },
        { ageGroup: '46-55', caseCount: 18, avgRecoveryScore: 38, preferredChannel: 'Phone + Email', paymentBehavior: 'Slower decision making', recommendation: 'Patient approach with formal email follow-ups' },
        { ageGroup: '56+', caseCount: 5, avgRecoveryScore: 30, preferredChannel: 'Phone call', paymentBehavior: 'Traditional preference', recommendation: 'Respectful approach, consider family involvement' },
      ]);
      setWriteOffAlerts([
        { caseId: 'demo-1', debtorName: 'Ahmad K.', daysUntilWriteOff: 5, balance: 85000, urgency: 'critical', recommendation: 'URGENT: Final settlement attempt required' },
        { caseId: 'demo-2', debtorName: 'Sara M.', daysUntilWriteOff: 22, balance: 45000, urgency: 'high', recommendation: 'Send final legal notice' },
      ]);
      setRecommendations([
        { priority: 'high', category: 'PTP Follow-up', message: '15 cases with active PTP — ensure daily follow-ups', impact: 'Potential recovery of high-probability cases' },
        { priority: 'medium', category: 'Settlement Strategy', message: 'Offer 30-40% settlement on 90+ day cases', impact: '25% acceptance rate historically' },
      ]);
    }
  }, [useApi, allCases.length]);

  const urgencyColor = (u: string) => u === 'critical' ? 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400 border-red-300' : u === 'high' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400 border-amber-300' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400 border-blue-300';
  const probColor = (p: number) => p >= 50 ? 'bg-emerald-500' : p >= 30 ? 'bg-amber-500' : p >= 15 ? 'bg-orange-500' : 'bg-red-500';

  return (
    <div className="p-4 sm:p-6 space-y-6 animate-fade-in-up">
      <h2 className="text-xl font-bold text-text-primary">Portfolio Aging & AI Intelligence</h2>

      {/* Aging Buckets */}
      {agingData && (
        <div className="panel p-5">
          <h3 className="text-sm font-bold text-text-primary mb-4">Aging Buckets — Recovery Probability</h3>
          <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 stagger-children">
            {agingData.buckets?.map((b: any) => (
              <div key={b.label} className="p-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-tertiary)] text-center">
                <p className="text-xs text-text-tertiary font-medium">{b.label}</p>
                <p className="text-2xl font-bold text-text-primary mt-1">{b.caseCount}</p>
                <p className="text-xs text-text-tertiary">{formatCurrency(b.totalBalance, 'AED')}</p>
                <div className="mt-2 flex items-center justify-center gap-1">
                  <div className="w-16 h-2 bg-[var(--color-border)] rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${probColor(b.recoveryProbability)}`} style={{ width: `${b.recoveryProbability}%` }} />
                  </div>
                  <span className="text-[10px] text-text-tertiary">{b.recoveryProbability}%</span>
                </div>
                <p className="text-[10px] text-text-tertiary mt-1">{b.recommendation.split(':')[0]}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Write-Off Alerts */}
      {writeOffAlerts.length > 0 && (
        <div className="panel p-5 border-l-4 border-red-500">
          <h3 className="text-sm font-bold text-text-primary mb-3">Write-Off Countdown Alerts</h3>
          <div className="space-y-2">
            {writeOffAlerts.map((a: any) => (
              <div key={a.caseId} className={`flex items-center justify-between p-3 rounded-lg border ${urgencyColor(a.urgency)}`}>
                <div>
                  <span className="font-semibold">{a.debtorName}</span>
                  <span className="ml-2 text-xs">{formatCurrency(a.balance, 'AED')}</span>
                  <p className="text-xs mt-0.5 opacity-80">{a.recommendation}</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold">{a.daysUntilWriteOff}d</p>
                  <p className="text-[10px] uppercase font-semibold">{a.urgency}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* DOB Insights */}
        {dobInsights.length > 0 && (
          <div className="panel p-5">
            <h3 className="text-sm font-bold text-text-primary mb-3">Age Group Behavioral Insights</h3>
            <div className="space-y-3">
              {dobInsights.map((d: any) => (
                <div key={d.ageGroup} className="p-3 bg-[var(--color-bg-tertiary)] rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm text-text-primary">Age {d.ageGroup}</span>
                    <span className="text-xs text-text-tertiary">{d.caseCount} cases</span>
                  </div>
                  <p className="text-xs text-primary mt-1">Best channel: {d.preferredChannel}</p>
                  <p className="text-xs text-text-secondary mt-0.5">{d.paymentBehavior}</p>
                  <p className="text-[10px] text-text-tertiary mt-1">Recommendation: {d.recommendation}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* AI Recommendations */}
        {recommendations.length > 0 && (
          <div className="panel p-5">
            <h3 className="text-sm font-bold text-text-primary mb-3">AI Strategic Recommendations</h3>
            <div className="space-y-3">
              {recommendations.map((r: any, i: number) => (
                <div key={i} className={`p-3 rounded-lg border-l-4 ${r.priority === 'high' ? 'border-red-500 bg-red-50 dark:bg-red-900/10' : 'border-blue-500 bg-blue-50 dark:bg-blue-900/10'}`}>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${r.priority === 'high' ? 'bg-red-200 text-red-800' : 'bg-blue-200 text-blue-800'}`}>{r.priority}</span>
                    <span className="text-xs font-semibold text-text-primary">{r.category}</span>
                  </div>
                  <p className="text-xs text-text-secondary mt-1">{r.message}</p>
                  <p className="text-[10px] text-text-tertiary mt-1">Impact: {r.impact}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PortfolioAgingDashboard;
