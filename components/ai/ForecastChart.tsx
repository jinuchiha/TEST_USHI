import React, { useState, useEffect } from 'react';
import { useAuth } from '../../src/contexts/AuthContext';
import { apiClient } from '../../src/api/client';
import { formatCurrency } from '../../utils';
import { EnrichedCase } from '../../types';

interface ForecastData {
  monthly: Array<{
    month: string;
    predicted: number;
    lower: number;
    upper: number;
    isHistorical: boolean;
    actual?: number;
  }>;
  quarterlyForecast: Array<{
    quarter: string;
    predicted: number;
    lower: number;
    upper: number;
  }>;
  annualForecast: { predicted: number; lower: number; upper: number };
  trend: 'improving' | 'stable' | 'declining';
  trendPct: number;
  confidenceNote: string;
}

interface ForecastChartProps {
  allCases: EnrichedCase[];
}

const ForecastChart: React.FC<ForecastChartProps> = ({ allCases }) => {
  const { useApi } = useAuth();
  const [forecast, setForecast] = useState<ForecastData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (useApi) {
      setLoading(true);
      apiClient.get<{ data: ForecastData }>('/api/ai/forecast')
        .then(res => setForecast(res.data))
        .catch(console.error)
        .finally(() => setLoading(false));
    } else {
      setForecast(generateDemoForecast(allCases));
    }
  }, [useApi, allCases.length]);

  if (loading) return <div className="text-center py-8 text-text-secondary">Generating forecast...</div>;
  if (!forecast) return null;

  const trendColor = forecast.trend === 'improving' ? 'text-emerald-600' : forecast.trend === 'declining' ? 'text-red-600' : 'text-amber-600';
  const trendIcon = forecast.trend === 'improving' ? '↑' : forecast.trend === 'declining' ? '↓' : '→';

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="panel p-4">
          <p className="text-xs text-text-tertiary uppercase font-medium">Annual Forecast</p>
          <p className="text-2xl font-bold text-primary mt-1">
            {formatCurrency(forecast.annualForecast.predicted, 'AED')}
          </p>
          <p className="text-xs text-text-tertiary">
            Range: {formatCurrency(forecast.annualForecast.lower, 'AED')} - {formatCurrency(forecast.annualForecast.upper, 'AED')}
          </p>
        </div>
        <div className="panel p-4">
          <p className="text-xs text-text-tertiary uppercase font-medium">Trend</p>
          <p className={`text-2xl font-bold mt-1 ${trendColor}`}>
            {trendIcon} {forecast.trend.charAt(0).toUpperCase() + forecast.trend.slice(1)}
          </p>
          {forecast.trendPct !== 0 && (
            <p className={`text-xs ${trendColor}`}>{forecast.trendPct > 0 ? '+' : ''}{forecast.trendPct}% vs prior period</p>
          )}
        </div>
        <div className="panel p-4">
          <p className="text-xs text-text-tertiary uppercase font-medium">Confidence</p>
          <p className="text-sm text-text-secondary mt-2">{forecast.confidenceNote}</p>
        </div>
      </div>

      {/* Quarterly Breakdown */}
      <div className="panel p-5">
        <h3 className="text-sm font-bold text-text-primary mb-4">Quarterly Forecast</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {forecast.quarterlyForecast.map(q => (
            <div key={q.quarter} className="text-center p-3 bg-[var(--color-bg-tertiary)] rounded-lg">
              <p className="text-xs text-text-tertiary font-medium">{q.quarter}</p>
              <p className="text-lg font-bold text-text-primary mt-1">
                {formatCurrency(q.predicted, 'AED')}
              </p>
              <div className="flex justify-center gap-2 mt-1">
                <span className="text-[10px] text-text-tertiary">{formatCurrency(q.lower, 'AED')}</span>
                <span className="text-[10px] text-text-tertiary">-</span>
                <span className="text-[10px] text-text-tertiary">{formatCurrency(q.upper, 'AED')}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Monthly Bar Chart (simplified) */}
      <div className="panel p-5">
        <h3 className="text-sm font-bold text-text-primary mb-4">Monthly Projection</h3>
        <div className="flex items-end gap-1 h-40 overflow-x-auto pb-6">
          {forecast.monthly.slice(-18).map((m, i) => {
            const maxVal = Math.max(...forecast.monthly.slice(-18).map(x => x.upper || x.predicted));
            const pct = maxVal > 0 ? (m.predicted / maxVal) * 100 : 0;
            const upperPct = maxVal > 0 ? (m.upper / maxVal) * 100 : 0;

            return (
              <div key={m.month} className="flex-1 min-w-[28px] flex flex-col items-center gap-0.5 relative group">
                {/* Tooltip */}
                <div className="absolute bottom-full mb-1 hidden group-hover:block bg-[var(--color-bg-primary)] shadow-lg rounded p-2 text-xs z-10 whitespace-nowrap border border-[var(--color-border)]">
                  <p className="font-medium">{m.month}</p>
                  <p>{m.isHistorical ? 'Actual' : 'Predicted'}: {formatCurrency(m.predicted, 'AED')}</p>
                  {!m.isHistorical && <p className="text-text-tertiary">Range: {formatCurrency(m.lower, 'AED')} - {formatCurrency(m.upper, 'AED')}</p>}
                </div>
                {/* Uncertainty range */}
                {!m.isHistorical && (
                  <div
                    className="w-full bg-primary/10 rounded-t absolute bottom-0"
                    style={{ height: `${upperPct}%` }}
                  />
                )}
                {/* Bar */}
                <div
                  className={`w-full rounded-t relative z-10 transition-all duration-300 ${
                    m.isHistorical ? 'bg-blue-500' : 'bg-primary'
                  }`}
                  style={{ height: `${Math.max(2, pct)}%` }}
                />
                <span className="text-[8px] text-text-tertiary rotate-45 origin-left absolute -bottom-5 left-1/2">
                  {m.month.slice(5)}
                </span>
              </div>
            );
          })}
        </div>
        <div className="flex items-center gap-4 mt-2 text-[10px] text-text-tertiary">
          <span className="flex items-center gap-1"><span className="w-3 h-2 bg-blue-500 rounded" /> Historical</span>
          <span className="flex items-center gap-1"><span className="w-3 h-2 bg-primary rounded" /> Forecast</span>
          <span className="flex items-center gap-1"><span className="w-3 h-2 bg-primary/10 rounded" /> Uncertainty</span>
        </div>
      </div>
    </div>
  );
};

function generateDemoForecast(cases: EnrichedCase[]): ForecastData {
  const activeCases = cases.filter(c => c.crmStatus !== 'Closed' && c.crmStatus !== 'Withdrawn');
  const totalBalance = activeCases.reduce((s, c) => s + (c.loan?.currentBalance || 0), 0);
  const baseMonthly = totalBalance * 0.035; // ~3.5% monthly recovery rate

  const now = new Date();
  const monthly: ForecastData['monthly'] = [];

  // 6 months of "history"
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const variation = 0.8 + Math.random() * 0.4;
    const actual = Math.round(baseMonthly * variation);
    monthly.push({ month, predicted: actual, lower: actual, upper: actual, isHistorical: true, actual });
  }

  // 12 months forecast
  const seasonalFactors = [0.85, 0.90, 0.95, 1.00, 1.05, 1.00, 0.90, 0.85, 0.95, 1.10, 1.15, 1.20];
  for (let i = 1; i <= 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const seasonal = seasonalFactors[d.getMonth()];
    const predicted = Math.round(baseMonthly * seasonal * (1 + i * 0.01));
    const uncertainty = 0.15 + i * 0.025;
    monthly.push({
      month, predicted,
      lower: Math.round(predicted * (1 - uncertainty)),
      upper: Math.round(predicted * (1 + uncertainty)),
      isHistorical: false,
    });
  }

  const futureMonths = monthly.filter(m => !m.isHistorical);
  const quarterlyForecast = [];
  for (let i = 0; i < futureMonths.length; i += 3) {
    const chunk = futureMonths.slice(i, i + 3);
    quarterlyForecast.push({
      quarter: `Q${Math.floor(i / 3) + 1}`,
      predicted: chunk.reduce((s, m) => s + m.predicted, 0),
      lower: chunk.reduce((s, m) => s + m.lower, 0),
      upper: chunk.reduce((s, m) => s + m.upper, 0),
    });
  }

  return {
    monthly,
    quarterlyForecast,
    annualForecast: {
      predicted: futureMonths.reduce((s, m) => s + m.predicted, 0),
      lower: futureMonths.reduce((s, m) => s + m.lower, 0),
      upper: futureMonths.reduce((s, m) => s + m.upper, 0),
    },
    trend: 'improving',
    trendPct: 8,
    confidenceNote: 'Medium confidence — based on current portfolio analysis',
  };
}

export default ForecastChart;
