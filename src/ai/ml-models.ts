// ml-models.ts — Client-side ML models for Debt Recovery CRM
// Pure TypeScript implementations: logistic regression, gradient boosting stumps,
// k-means clustering, exponential smoothing, naive Bayes, and decision trees.

import type { EnrichedCase, CRMStatus, Action, ActionType, User } from '../../types';

// ─── Helper Types ────────────────────────────────────────────────────────────

interface CaseFeatures {
  dpd: number;
  balance: number;
  pastPayments: number;
  contactRate: number;
  ptpCount: number;
  brokenPtp: number;
  callCount: number;
  daysSinceContact: number;
  isSecured: number;
  productEncoded: number;
  bankEncoded: number;
  paymentHistoryRatio: number;
}

interface PaymentPrediction {
  probability: number;
  confidence: 'high' | 'medium' | 'low';
  factors: string[];
}

interface RecoveryPrediction {
  predictedAmount: number;
  recoveryRate: number;
  confidence: number;
}

interface SegmentResult {
  segment: string;
  confidence: number;
  strategy: string;
  characteristics: string[];
}

interface ForecastPoint {
  month: string;
  predicted: number;
  lower: number;
  upper: number;
}

interface CollectionForecast {
  forecast: ForecastPoint[];
  trend: 'increasing' | 'decreasing' | 'stable';
  confidence: number;
}

interface ContactPrediction {
  bestHour: number;
  bestDay: string;
  successProbability: number;
  schedule: { hour: number; day: string; probability: number }[];
}

interface WriteOffPrediction {
  probability: number;
  riskLevel: 'critical' | 'high' | 'medium' | 'low';
  factors: string[];
  recommendation: string;
}

export interface MLAnalysis {
  paymentPrediction: PaymentPrediction;
  recoveryPrediction: RecoveryPrediction;
  segmentation: SegmentResult;
  collectionForecast: CollectionForecast;
  contactPrediction: ContactPrediction;
  writeOffPrediction: WriteOffPrediction;
  modelTimestamp: string;
}

// ─── Helper Functions ────────────────────────────────────────────────────────

function sigmoid(x: number): number {
  if (x > 500) return 1;
  if (x < -500) return 0;
  return 1 / (1 + Math.exp(-x));
}

function euclideanDistance(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const diff = (a[i] ?? 0) - (b[i] ?? 0);
    sum += diff * diff;
  }
  return Math.sqrt(sum);
}

function normalize(value: number, min: number, max: number): number {
  if (max === min) return 0.5;
  return Math.max(0, Math.min(1, (value - min) / (max - min)));
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function daysBetween(dateA: string, dateB: string): number {
  const a = new Date(dateA).getTime();
  const b = new Date(dateB).getTime();
  if (isNaN(a) || isNaN(b)) return 0;
  return Math.abs(Math.floor((b - a) / (1000 * 60 * 60 * 24)));
}

function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

/**
 * Extracts numeric ML features from an EnrichedCase.
 */
export function extractFeatures(caseData: EnrichedCase): CaseFeatures {
  const now = new Date().toISOString();
  const history = caseData.history || [];

  // Days Past Due: from last payment date or creation date
  const referenceDate = caseData.loan.lpd || caseData.creationDate;
  const dpd = daysBetween(referenceDate, now);

  const balance = caseData.loan.currentBalance || 0;

  // Count past payments
  const pastPayments = history.filter(
    (a) => a.type === ('Payment Received' as string) && (a.amountPaid ?? 0) > 0
  ).length;

  // Contact rate: ratio of actions that are calls / total actions
  const totalActions = history.length || 1;
  const contactActions = history.filter(
    (a) =>
      a.type === ('Soft Call' as string) ||
      a.type === ('Status Update' as string)
  ).length;
  const contactRate = contactActions / totalActions;

  // PTP (Promise to Pay) count
  const ptpCount = history.filter(
    (a) => a.promisedAmount !== undefined && a.promisedAmount > 0
  ).length;

  // Broken PTPs: promised but no payment followed within reasonable window
  const ptpActions = history.filter((a) => a.promisedDate);
  const paymentDates = history
    .filter((a) => a.type === ('Payment Received' as string))
    .map((a) => new Date(a.timestamp).getTime());
  let brokenPtp = 0;
  for (const ptp of ptpActions) {
    const promisedTime = new Date(ptp.promisedDate!).getTime();
    const kept = paymentDates.some(
      (pd) => pd >= promisedTime - 7 * 86400000 && pd <= promisedTime + 14 * 86400000
    );
    if (!kept) brokenPtp++;
  }

  // Call count
  const callCount = history.filter(
    (a) => a.type === ('Soft Call' as string)
  ).length;

  // Days since last contact
  const daysSinceContact = caseData.lastContactDate
    ? daysBetween(caseData.lastContactDate, now)
    : 999;

  // Product encoding: secured products get 1
  const securedProducts = ['mortgage', 'auto', 'car', 'home', 'secured'];
  const productLower = (caseData.loan.product || '').toLowerCase();
  const isSecured = securedProducts.some((p) => productLower.includes(p)) ? 1 : 0;

  // Simple numeric encoding for product and bank
  const productEncoded = simpleHash(caseData.loan.product || 'unknown') % 10;
  const bankEncoded = simpleHash(caseData.loan.bank || 'unknown') % 10;

  const paymentHistoryRatio =
    totalActions > 0 ? pastPayments / totalActions : 0;

  return {
    dpd,
    balance,
    pastPayments,
    contactRate,
    ptpCount,
    brokenPtp,
    callCount,
    daysSinceContact,
    isSecured,
    productEncoded,
    bankEncoded,
    paymentHistoryRatio,
  };
}

// ─── Model 1: Logistic Regression Payment Predictor ─────────────────────────

const LR_WEIGHTS = {
  dpd: -0.015,
  balance: -0.00001,
  pastPayments: 0.3,
  contactRate: 0.8,
  ptpCount: 0.2,
  brokenPtp: -0.4,
  callCount: 0.05,
  daysSinceContact: -0.03,
  isSecured: 0.2,
};
const LR_BIAS = 0.5;

export class LogisticRegressionPaymentPredictor {
  private weights = LR_WEIGHTS;
  private bias = LR_BIAS;

  predict(caseData: EnrichedCase): PaymentPrediction {
    const f = extractFeatures(caseData);

    // Compute linear combination: w . x + b
    const z =
      this.weights.dpd * f.dpd +
      this.weights.balance * f.balance +
      this.weights.pastPayments * f.pastPayments +
      this.weights.contactRate * f.contactRate +
      this.weights.ptpCount * f.ptpCount +
      this.weights.brokenPtp * f.brokenPtp +
      this.weights.callCount * f.callCount +
      this.weights.daysSinceContact * f.daysSinceContact +
      this.weights.isSecured * f.isSecured +
      this.bias;

    const probability = sigmoid(z);

    // Confidence based on how far from 0.5 the prediction is
    const distance = Math.abs(probability - 0.5);
    let confidence: 'high' | 'medium' | 'low';
    if (distance > 0.3) confidence = 'high';
    else if (distance > 0.15) confidence = 'medium';
    else confidence = 'low';

    // Identify top contributing factors
    const contributions: { name: string; value: number; label: string }[] = [
      { name: 'dpd', value: this.weights.dpd * f.dpd, label: `DPD of ${f.dpd} days` },
      { name: 'balance', value: this.weights.balance * f.balance, label: `Outstanding balance of ${f.balance.toFixed(0)}` },
      { name: 'pastPayments', value: this.weights.pastPayments * f.pastPayments, label: `${f.pastPayments} past payment(s)` },
      { name: 'contactRate', value: this.weights.contactRate * f.contactRate, label: `Contact rate of ${(f.contactRate * 100).toFixed(0)}%` },
      { name: 'ptpCount', value: this.weights.ptpCount * f.ptpCount, label: `${f.ptpCount} promise-to-pay records` },
      { name: 'brokenPtp', value: this.weights.brokenPtp * f.brokenPtp, label: `${f.brokenPtp} broken PTP(s)` },
      { name: 'callCount', value: this.weights.callCount * f.callCount, label: `${f.callCount} calls made` },
      { name: 'daysSinceContact', value: this.weights.daysSinceContact * f.daysSinceContact, label: `${f.daysSinceContact} days since last contact` },
      { name: 'isSecured', value: this.weights.isSecured * f.isSecured, label: f.isSecured ? 'Secured product' : 'Unsecured product' },
    ];

    // Sort by absolute contribution, pick top 3
    contributions.sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
    const factors = contributions.slice(0, 3).map(
      (c) => `${c.label} (${c.value > 0 ? '+' : ''}${c.value.toFixed(3)} weight)`
    );

    return { probability: parseFloat(probability.toFixed(4)), confidence, factors };
  }
}

// ─── Model 2: Gradient Boosting Recovery Predictor ──────────────────────────

export class GradientBoostingRecoveryPredictor {
  /**
   * Ensemble of 5 decision stumps that additively predict recovery rate.
   */
  predict(caseData: EnrichedCase): RecoveryPrediction {
    const f = extractFeatures(caseData);

    // Stump 1: DPD threshold
    let recoveryRate = f.dpd > 90 ? 0.15 : 0.45;

    // Stump 2: Balance threshold (multiplicative)
    recoveryRate *= f.balance > 100000 ? 0.7 : 1.0;

    // Stump 3: Contact rate (additive)
    recoveryRate += f.contactRate > 0.5 ? 0.15 : 0;

    // Stump 4: Past payments (additive)
    recoveryRate += f.pastPayments > 0 ? 0.2 : 0;

    // Stump 5: Broken PTPs (subtractive)
    recoveryRate -= f.brokenPtp > 2 ? 0.1 : 0;

    // Clamp to valid range
    recoveryRate = clamp(recoveryRate, 0.05, 0.95);

    const predictedAmount = f.balance * recoveryRate;

    // Confidence: higher when features are decisive (far from stump thresholds)
    const dpdDist = Math.abs(f.dpd - 90) / 365;
    const balDist = Math.abs(f.balance - 100000) / 500000;
    const confidence = clamp(0.5 + (dpdDist + balDist) / 2, 0.3, 0.95);

    return {
      predictedAmount: parseFloat(predictedAmount.toFixed(2)),
      recoveryRate: parseFloat(recoveryRate.toFixed(4)),
      confidence: parseFloat(confidence.toFixed(4)),
    };
  }
}

// ─── Model 3: K-Means Debtor Segmentation ───────────────────────────────────

interface ClusterDef {
  name: string;
  center: number[]; // [normalizedDPD, normalizedBalance, contactRate, paymentHistoryRatio]
  strategy: string;
  characteristics: string[];
}

const CLUSTER_DEFINITIONS: ClusterDef[] = [
  {
    name: 'Cooperator',
    center: [0.15, 0.3, 0.8, 0.6],
    strategy: 'Maintain positive relationship; offer flexible payment plans and early settlement discounts.',
    characteristics: ['Low DPD', 'High contact rate', 'History of payments', 'Responsive to communication'],
  },
  {
    name: 'Negotiator',
    center: [0.4, 0.5, 0.7, 0.2],
    strategy: 'Engage in structured negotiation; present clear settlement options with deadlines.',
    characteristics: ['Medium DPD', 'High contact rate', 'Disputes or counter-offers', 'Seeks better terms'],
  },
  {
    name: 'Avoider',
    center: [0.85, 0.6, 0.1, 0.05],
    strategy: 'Escalate tracing efforts; consider legal notice or field visits to re-establish contact.',
    characteristics: ['High DPD', 'Very low contact rate', 'No payment history', 'Avoids all communication'],
  },
  {
    name: 'Hardship',
    center: [0.5, 0.4, 0.5, 0.3],
    strategy: 'Offer hardship programs; structure small affordable installments over extended period.',
    characteristics: ['Medium DPD', 'Moderate contact', 'Partial payments', 'Genuine financial difficulty'],
  },
  {
    name: 'Refuser',
    center: [0.6, 0.7, 0.6, 0.0],
    strategy: 'Prepare legal escalation; document all contact attempts for potential litigation.',
    characteristics: ['Contacted but refuses to pay', 'May dispute validity', 'Zero payment history', 'Hostile or dismissive'],
  },
];

export class KMeansDebtorSegmentation {
  private clusters: ClusterDef[];
  private iterations: number;

  constructor(iterations: number = 3) {
    // Deep-copy cluster definitions so we can refine centroids
    this.clusters = CLUSTER_DEFINITIONS.map((c) => ({
      ...c,
      center: [...c.center],
    }));
    this.iterations = iterations;
  }

  /**
   * Runs K-Means assignment (with pre-defined centroids refined over provided cases).
   * If allCases is provided, we refine centroids for `iterations` rounds before assignment.
   */
  segment(caseData: EnrichedCase, allCases?: EnrichedCase[]): SegmentResult {
    const featureVec = this.caseToVector(caseData);

    // Optionally refine centroids using all available cases
    if (allCases && allCases.length > 0) {
      this.refineCentroids(allCases);
    }

    // Assign to nearest centroid
    let minDist = Infinity;
    let bestCluster = this.clusters[0];

    for (const cluster of this.clusters) {
      const dist = euclideanDistance(featureVec, cluster.center);
      if (dist < minDist) {
        minDist = dist;
        bestCluster = cluster;
      }
    }

    // Confidence: inverse of distance, normalized. Max distance in 4D unit cube is 2.0
    const maxPossibleDist = 2.0;
    const confidence = clamp(1 - minDist / maxPossibleDist, 0.1, 0.99);

    return {
      segment: bestCluster.name,
      confidence: parseFloat(confidence.toFixed(4)),
      strategy: bestCluster.strategy,
      characteristics: bestCluster.characteristics,
    };
  }

  private caseToVector(caseData: EnrichedCase): number[] {
    const f = extractFeatures(caseData);
    return [
      normalize(f.dpd, 0, 730),        // DPD normalized to ~2 years
      normalize(f.balance, 0, 500000),  // Balance normalized to 500k
      f.contactRate,                     // Already 0-1
      f.paymentHistoryRatio,             // Already 0-1
    ];
  }

  private refineCentroids(allCases: EnrichedCase[]): void {
    const k = this.clusters.length;
    const vectors = allCases.map((c) => this.caseToVector(c));

    for (let iter = 0; iter < this.iterations; iter++) {
      // Assignment step: assign each vector to nearest centroid
      const assignments: number[][] = Array.from({ length: k }, () => []);

      for (let i = 0; i < vectors.length; i++) {
        let minDist = Infinity;
        let bestIdx = 0;
        for (let j = 0; j < k; j++) {
          const dist = euclideanDistance(vectors[i], this.clusters[j].center);
          if (dist < minDist) {
            minDist = dist;
            bestIdx = j;
          }
        }
        assignments[bestIdx].push(i);
      }

      // Update step: recompute centroids as mean of assigned vectors
      for (let j = 0; j < k; j++) {
        const members = assignments[j];
        if (members.length === 0) continue; // Keep existing centroid if no members

        const dims = this.clusters[j].center.length;
        const newCenter = new Array(dims).fill(0);

        for (const idx of members) {
          for (let d = 0; d < dims; d++) {
            newCenter[d] += vectors[idx][d];
          }
        }
        for (let d = 0; d < dims; d++) {
          newCenter[d] /= members.length;
        }

        this.clusters[j].center = newCenter;
      }
    }
  }
}

// ─── Model 4: Time Series Collection Forecast ───────────────────────────────

export class TimeSeriesCollectionForecast {
  private alpha: number;

  constructor(alpha: number = 0.3) {
    this.alpha = alpha;
  }

  /**
   * Forecasts next 6 months of collection amounts.
   * Extracts monthly totals from all cases' payment history.
   */
  forecast(allCases: EnrichedCase[]): CollectionForecast {
    // Extract monthly collection amounts for past 12 months
    const monthlyTotals = this.extractMonthlyCollections(allCases, 12);

    // If insufficient data, generate synthetic baseline
    if (monthlyTotals.length < 3) {
      const avgBalance =
        allCases.reduce((s, c) => s + (c.loan.currentBalance || 0), 0) /
        (allCases.length || 1);
      const synthetic = avgBalance * 0.05;
      while (monthlyTotals.length < 12) {
        monthlyTotals.unshift(synthetic * (0.8 + Math.random() * 0.4));
      }
    }

    // Simple Exponential Smoothing
    const smoothed: number[] = [monthlyTotals[0]];
    for (let i = 1; i < monthlyTotals.length; i++) {
      smoothed.push(this.alpha * monthlyTotals[i] + (1 - this.alpha) * smoothed[i - 1]);
    }

    // Linear regression on smoothed values to detect trend
    const n = smoothed.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
    for (let i = 0; i < n; i++) {
      sumX += i;
      sumY += smoothed[i];
      sumXY += i * smoothed[i];
      sumX2 += i * i;
    }
    const denominator = n * sumX2 - sumX * sumX;
    const slope = denominator !== 0 ? (n * sumXY - sumX * sumY) / denominator : 0;
    const intercept = denominator !== 0 ? (sumY - slope * sumX) / n : sumY / n;

    // Forecast 6 months ahead
    const lastSmoothed = smoothed[smoothed.length - 1];
    const forecastPoints: ForecastPoint[] = [];
    const now = new Date();

    // Compute residual standard error for confidence bands
    let residualSumSq = 0;
    for (let i = 0; i < n; i++) {
      const fitted = intercept + slope * i;
      residualSumSq += (smoothed[i] - fitted) ** 2;
    }
    const stdError = Math.sqrt(residualSumSq / Math.max(n - 2, 1));

    for (let m = 1; m <= 6; m++) {
      const trendComponent = slope * m;
      const predicted = Math.max(0, lastSmoothed + trendComponent);

      // Expanding confidence intervals
      const marginMultiplier = 1.96 * Math.sqrt(m); // Widens over time
      const margin = stdError * marginMultiplier;

      const futureDate = new Date(now.getFullYear(), now.getMonth() + m, 1);
      const monthLabel = futureDate.toLocaleString('default', {
        month: 'short',
        year: 'numeric',
      });

      forecastPoints.push({
        month: monthLabel,
        predicted: parseFloat(predicted.toFixed(2)),
        lower: parseFloat(Math.max(0, predicted - margin).toFixed(2)),
        upper: parseFloat((predicted + margin).toFixed(2)),
      });
    }

    // Determine trend
    const trendThreshold = Math.abs(lastSmoothed) * 0.02; // 2% of last value
    let trend: 'increasing' | 'decreasing' | 'stable';
    if (slope > trendThreshold) trend = 'increasing';
    else if (slope < -trendThreshold) trend = 'decreasing';
    else trend = 'stable';

    // Confidence from data quality
    const dataPoints = monthlyTotals.filter((v) => v > 0).length;
    const confidence = clamp(dataPoints / 12, 0.2, 0.95);

    return {
      forecast: forecastPoints,
      trend,
      confidence: parseFloat(confidence.toFixed(4)),
    };
  }

  private extractMonthlyCollections(
    allCases: EnrichedCase[],
    months: number
  ): number[] {
    const now = new Date();
    const buckets: number[] = new Array(months).fill(0);

    for (const c of allCases) {
      for (const action of c.history || []) {
        if (
          action.type === ('Payment Received' as string) &&
          (action.amountPaid ?? 0) > 0
        ) {
          const actionDate = new Date(action.timestamp);
          const monthsAgo =
            (now.getFullYear() - actionDate.getFullYear()) * 12 +
            (now.getMonth() - actionDate.getMonth());

          if (monthsAgo >= 0 && monthsAgo < months) {
            buckets[months - 1 - monthsAgo] += action.amountPaid!;
          }
        }
      }
    }

    return buckets;
  }
}

// ─── Model 5: Naive Bayes Contact Success Predictor ─────────────────────────

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export class NaiveBayesContactSuccessPredictor {
  private laplaceSmoothingAlpha = 1;

  /**
   * Predicts best time/day to contact based on prior successful contacts in case history.
   */
  predict(caseData: EnrichedCase, allCases?: EnrichedCase[]): ContactPrediction {
    // Collect contact events (successful = resulted in status update, PTP, or payment)
    const cases = allCases && allCases.length > 0 ? allCases : [caseData];

    // Count successes and total contacts per hour and per day
    const hourSuccess = new Array(24).fill(0);
    const hourTotal = new Array(24).fill(0);
    const daySuccess = new Array(7).fill(0);
    const dayTotal = new Array(7).fill(0);
    let totalSuccess = 0;
    let totalContacts = 0;

    for (const c of cases) {
      for (let i = 0; i < (c.history || []).length; i++) {
        const action = c.history[i];
        if (
          action.type === ('Soft Call' as string) ||
          action.type === ('Email Notice' as string)
        ) {
          const dt = new Date(action.timestamp);
          if (isNaN(dt.getTime())) continue;

          const hour = dt.getHours();
          const day = dt.getDay();

          hourTotal[hour]++;
          dayTotal[day]++;
          totalContacts++;

          // Determine success: next action is PTP, payment, or status update
          const isSuccess =
            action.promisedAmount !== undefined ||
            (i + 1 < c.history.length &&
              (c.history[i + 1].type === ('Payment Received' as string) ||
                c.history[i + 1].type === ('Payment Plan Agreed' as string) ||
                c.history[i + 1].promisedAmount !== undefined));

          if (isSuccess) {
            hourSuccess[hour]++;
            daySuccess[day]++;
            totalSuccess++;
          }
        }
      }
    }

    // Apply Naive Bayes with Laplace smoothing
    // P(success | hour, day) proportional to P(hour | success) * P(day | success) * P(success)
    const alpha = this.laplaceSmoothingAlpha;
    const pSuccess = (totalSuccess + alpha) / (totalContacts + 2 * alpha);

    const schedule: { hour: number; day: string; probability: number }[] = [];
    let bestProb = -1;
    let bestHour = 10;
    let bestDay = 'Monday';

    // Evaluate a grid of hour x day combinations
    // For efficiency, sample key hours (8-20) and all 7 days
    for (let h = 8; h <= 20; h++) {
      for (let d = 0; d < 7; d++) {
        // P(hour | success) with Laplace smoothing
        const pHourGivenSuccess =
          (hourSuccess[h] + alpha) / (totalSuccess + 24 * alpha);
        const pHourGivenFail =
          (hourTotal[h] - hourSuccess[h] + alpha) /
          (totalContacts - totalSuccess + 24 * alpha);

        // P(day | success) with Laplace smoothing
        const pDayGivenSuccess =
          (daySuccess[d] + alpha) / (totalSuccess + 7 * alpha);
        const pDayGivenFail =
          (dayTotal[d] - daySuccess[d] + alpha) /
          (totalContacts - totalSuccess + 7 * alpha);

        // Posterior: P(success | hour, day) via Bayes rule
        const numerator = pHourGivenSuccess * pDayGivenSuccess * pSuccess;
        const denominator =
          numerator + pHourGivenFail * pDayGivenFail * (1 - pSuccess);

        const posterior = denominator > 0 ? numerator / denominator : 0.5;

        schedule.push({
          hour: h,
          day: DAY_NAMES[d],
          probability: parseFloat(posterior.toFixed(4)),
        });

        if (posterior > bestProb) {
          bestProb = posterior;
          bestHour = h;
          bestDay = DAY_NAMES[d];
        }
      }
    }

    // Sort schedule by probability descending, keep top 10
    schedule.sort((a, b) => b.probability - a.probability);
    const topSchedule = schedule.slice(0, 10);

    return {
      bestHour,
      bestDay,
      successProbability: parseFloat(bestProb.toFixed(4)),
      schedule: topSchedule,
    };
  }
}

// ─── Model 6: Decision Tree Write-Off Predictor ─────────────────────────────

export class DecisionTreeWriteOffPredictor {
  predict(caseData: EnrichedCase): WriteOffPrediction {
    const f = extractFeatures(caseData);
    let probability: number;
    const factors: string[] = [];

    // 4-level decision tree
    if (f.dpd > 365) {
      probability = 0.90;
      factors.push(`DPD exceeds 365 days (${f.dpd} days) — very high write-off risk`);
    } else if (f.dpd > 180) {
      factors.push(`DPD exceeds 180 days (${f.dpd} days)`);
      if (f.contactRate < 0.1) {
        probability = 0.75;
        factors.push(`Extremely low contact rate (${(f.contactRate * 100).toFixed(1)}%)`);
      } else if (f.pastPayments === 0) {
        probability = 0.65;
        factors.push('No past payments recorded');
      } else {
        probability = 0.40;
        factors.push(`${f.pastPayments} past payment(s) and some contact — partial mitigation`);
      }
    } else if (f.dpd > 90) {
      factors.push(`DPD exceeds 90 days (${f.dpd} days)`);
      if (f.brokenPtp > 3) {
        probability = 0.50;
        factors.push(`${f.brokenPtp} broken promise-to-pay records`);
      } else {
        probability = 0.25;
        factors.push('Broken PTPs within acceptable range');
      }
    } else {
      if (f.contactRate > 0.5) {
        probability = 0.05;
        factors.push(`Good contact rate (${(f.contactRate * 100).toFixed(1)}%) and low DPD`);
      } else {
        probability = 0.15;
        factors.push(`Low contact rate (${(f.contactRate * 100).toFixed(1)}%) despite low DPD`);
      }
    }

    // Risk level mapping
    let riskLevel: 'critical' | 'high' | 'medium' | 'low';
    if (probability >= 0.75) riskLevel = 'critical';
    else if (probability >= 0.50) riskLevel = 'high';
    else if (probability >= 0.25) riskLevel = 'medium';
    else riskLevel = 'low';

    // Recommendation
    let recommendation: string;
    switch (riskLevel) {
      case 'critical':
        recommendation =
          'Immediate escalation recommended. Consider legal proceedings or prepare write-off documentation. Recovery probability is very low.';
        break;
      case 'high':
        recommendation =
          'Assign to senior agent for intensive recovery effort. Explore settlement at significant discount before write-off window.';
        break;
      case 'medium':
        recommendation =
          'Increase contact frequency and offer structured payment plans. Monitor closely for deterioration.';
        break;
      case 'low':
        recommendation =
          'Continue standard collection process. Case shows positive recovery indicators.';
        break;
    }

    return {
      probability: parseFloat(probability.toFixed(4)),
      riskLevel,
      factors,
      recommendation,
    };
  }
}

// ─── Combined Analysis Runner ────────────────────────────────────────────────

export function runAllMLModels(
  caseData: EnrichedCase,
  allCases: EnrichedCase[]
): MLAnalysis {
  const paymentPredictor = new LogisticRegressionPaymentPredictor();
  const recoveryPredictor = new GradientBoostingRecoveryPredictor();
  const segmenter = new KMeansDebtorSegmentation(3);
  const forecaster = new TimeSeriesCollectionForecast(0.3);
  const contactPredictor = new NaiveBayesContactSuccessPredictor();
  const writeOffPredictor = new DecisionTreeWriteOffPredictor();

  return {
    paymentPrediction: paymentPredictor.predict(caseData),
    recoveryPrediction: recoveryPredictor.predict(caseData),
    segmentation: segmenter.segment(caseData, allCases),
    collectionForecast: forecaster.forecast(allCases),
    contactPrediction: contactPredictor.predict(caseData, allCases),
    writeOffPrediction: writeOffPredictor.predict(caseData),
    modelTimestamp: new Date().toISOString(),
  };
}
