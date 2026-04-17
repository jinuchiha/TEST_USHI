/**
 * Forecasting Engine
 *
 * Predicts future recovery amounts based on:
 * - Historical monthly collections trend
 * - Current pipeline (active cases * AI scores)
 * - Seasonal patterns
 * - Officer capacity
 *
 * Uses exponential smoothing + pipeline-weighted projection.
 */

export interface MonthlyDataPoint {
  month: string;       // YYYY-MM
  actual: number;      // actual collected amount
  casesClosed: number;
}

export interface ForecastResult {
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
  annualForecast: {
    predicted: number;
    lower: number;
    upper: number;
  };
  trend: 'improving' | 'stable' | 'declining';
  trendPct: number;
  confidenceNote: string;
}

export function generateForecast(
  historicalData: MonthlyDataPoint[],
  activePipelineValue: number,
  avgRecoveryScore: number,
  forecastMonths: number = 12,
): ForecastResult {
  const monthly: ForecastResult['monthly'] = [];

  // Add historical data
  for (const d of historicalData) {
    monthly.push({
      month: d.month,
      predicted: d.actual,
      lower: d.actual,
      upper: d.actual,
      isHistorical: true,
      actual: d.actual,
    });
  }

  // Exponential smoothing (alpha = 0.3)
  const alpha = 0.3;
  const values = historicalData.map(d => d.actual);

  if (values.length === 0) {
    // No history — estimate from pipeline
    const monthlyEstimate = (activePipelineValue * avgRecoveryScore / 100) / 12;
    const now = new Date();
    for (let i = 0; i < forecastMonths; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i + 1, 1);
      const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      monthly.push({
        month,
        predicted: Math.round(monthlyEstimate),
        lower: Math.round(monthlyEstimate * 0.6),
        upper: Math.round(monthlyEstimate * 1.4),
        isHistorical: false,
      });
    }
  } else {
    // Calculate smoothed forecast
    let smoothed = values[0];
    let trend = 0;

    if (values.length >= 2) {
      trend = values[values.length - 1] - values[values.length - 2];
    }

    for (let i = 1; i < values.length; i++) {
      const prevSmoothed = smoothed;
      smoothed = alpha * values[i] + (1 - alpha) * smoothed;
      trend = alpha * (smoothed - prevSmoothed) + (1 - alpha) * trend;
    }

    // Pipeline adjustment factor
    const pipelineBoost = activePipelineValue > 0
      ? (avgRecoveryScore / 50) // normalize around 1.0
      : 1.0;

    // Seasonal factors (simplified — Q4 tends to be higher, Q1 lower)
    const seasonalFactors: Record<number, number> = {
      1: 0.85, 2: 0.90, 3: 0.95,  // Q1
      4: 1.00, 5: 1.05, 6: 1.00,  // Q2
      7: 0.90, 8: 0.85, 9: 0.95,  // Q3 (summer lull)
      10: 1.10, 11: 1.15, 12: 1.20, // Q4 (year-end push)
    };

    // Generate future months
    const lastMonth = historicalData[historicalData.length - 1].month;
    const [lastYear, lastMon] = lastMonth.split('-').map(Number);
    let baseDate = new Date(lastYear, lastMon - 1, 1);

    for (let i = 0; i < forecastMonths; i++) {
      baseDate = new Date(baseDate.getFullYear(), baseDate.getMonth() + 1, 1);
      const month = `${baseDate.getFullYear()}-${String(baseDate.getMonth() + 1).padStart(2, '0')}`;
      const seasonFactor = seasonalFactors[baseDate.getMonth() + 1] || 1.0;

      const rawPrediction = (smoothed + trend * (i + 1)) * seasonFactor * pipelineBoost;
      const predicted = Math.max(0, Math.round(rawPrediction));
      const uncertainty = 0.15 + (i * 0.03); // Uncertainty grows with time

      monthly.push({
        month,
        predicted,
        lower: Math.max(0, Math.round(predicted * (1 - uncertainty))),
        upper: Math.round(predicted * (1 + uncertainty)),
        isHistorical: false,
      });
    }
  }

  // Quarterly aggregation
  const futureMonths = monthly.filter(m => !m.isHistorical);
  const quarterlyForecast: ForecastResult['quarterlyForecast'] = [];
  for (let i = 0; i < futureMonths.length; i += 3) {
    const chunk = futureMonths.slice(i, i + 3);
    if (chunk.length === 0) break;
    const qNum = Math.floor(i / 3) + 1;
    quarterlyForecast.push({
      quarter: `Q${qNum}`,
      predicted: chunk.reduce((s, m) => s + m.predicted, 0),
      lower: chunk.reduce((s, m) => s + m.lower, 0),
      upper: chunk.reduce((s, m) => s + m.upper, 0),
    });
  }

  // Annual forecast
  const annualForecast = {
    predicted: futureMonths.reduce((s, m) => s + m.predicted, 0),
    lower: futureMonths.reduce((s, m) => s + m.lower, 0),
    upper: futureMonths.reduce((s, m) => s + m.upper, 0),
  };

  // Trend analysis
  let trendDirection: 'improving' | 'stable' | 'declining' = 'stable';
  let trendPct = 0;
  if (values.length >= 3) {
    const recent = values.slice(-3);
    const older = values.slice(-6, -3);
    if (older.length > 0) {
      const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
      const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;
      trendPct = olderAvg > 0 ? Math.round(((recentAvg - olderAvg) / olderAvg) * 100) : 0;
      if (trendPct > 5) trendDirection = 'improving';
      else if (trendPct < -5) trendDirection = 'declining';
    }
  }

  const confidenceNote = values.length >= 6
    ? 'High confidence — based on 6+ months of data'
    : values.length >= 3
    ? 'Medium confidence — limited historical data'
    : 'Low confidence — insufficient data, using pipeline estimates';

  return {
    monthly,
    quarterlyForecast,
    annualForecast,
    trend: trendDirection,
    trendPct,
    confidenceNote,
  };
}
