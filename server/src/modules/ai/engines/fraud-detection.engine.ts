/**
 * Fraud Detection Engine
 *
 * Flags suspicious patterns in debtor cases:
 * - Repeated defaults across multiple banks
 * - Fake/duplicate identity documents
 * - Unusual payment patterns
 * - Rapid case status changes
 */

export interface FraudInput {
  debtorId: string;
  debtorName: string;
  eid: string | null;
  cnic: string | null;
  passport: string | null;
  caseCount: number;           // cases across all banks for this debtor
  bankCount: number;           // how many different banks
  totalOutstanding: number;
  totalOriginal: number;
  hasPaymentReversals: boolean;
  statusChangeFrequency: number; // changes per week
  daysSinceCreation: number;
  isOutUAE: boolean;
}

export interface FraudFlag {
  severity: 'Critical' | 'Warning' | 'Info';
  type: string;
  message: string;
  score: number;               // 0-100 suspicion score
}

export interface FraudAssessment {
  overallRisk: 'Critical' | 'High' | 'Medium' | 'Low';
  riskScore: number;           // 0-100
  flags: FraudFlag[];
  requiresManualReview: boolean;
}

export function assessFraud(input: FraudInput): FraudAssessment {
  const flags: FraudFlag[] = [];

  // Rule 1: Multiple banks defaulted
  if (input.bankCount >= 4) {
    flags.push({
      severity: 'Critical',
      type: 'MULTI_BANK_DEFAULT',
      message: `Debtor has defaulted across ${input.bankCount} banks — serial default pattern`,
      score: 85,
    });
  } else if (input.bankCount >= 2) {
    flags.push({
      severity: 'Warning',
      type: 'MULTI_BANK_DEFAULT',
      message: `Debtor has obligations with ${input.bankCount} banks`,
      score: 40,
    });
  }

  // Rule 2: Missing identity documents
  const missingDocs: string[] = [];
  if (!input.eid) missingDocs.push('Emirates ID');
  if (!input.cnic) missingDocs.push('CNIC');
  if (!input.passport) missingDocs.push('Passport');

  if (missingDocs.length >= 2) {
    flags.push({
      severity: 'Warning',
      type: 'MISSING_IDENTITY',
      message: `Missing identity documents: ${missingDocs.join(', ')}`,
      score: 50,
    });
  }

  // Rule 3: Very high total outstanding
  if (input.totalOutstanding > 500000) {
    flags.push({
      severity: 'Warning',
      type: 'HIGH_EXPOSURE',
      message: `Very high total outstanding: ${input.totalOutstanding.toLocaleString()} across all cases`,
      score: 35,
    });
  }

  // Rule 4: Payment reversals
  if (input.hasPaymentReversals) {
    flags.push({
      severity: 'Critical',
      type: 'PAYMENT_REVERSAL',
      message: 'Payment reversals detected — possible fraudulent payments',
      score: 75,
    });
  }

  // Rule 5: Rapid status changes (possible manipulation)
  if (input.statusChangeFrequency > 5) {
    flags.push({
      severity: 'Warning',
      type: 'RAPID_STATUS_CHANGE',
      message: `Unusually frequent status changes (${input.statusChangeFrequency}/week)`,
      score: 45,
    });
  }

  // Rule 6: Debtor left UAE
  if (input.isOutUAE) {
    flags.push({
      severity: 'Info',
      type: 'OUT_OF_JURISDICTION',
      message: 'Debtor reported outside UAE — may complicate recovery',
      score: 30,
    });
  }

  // Rule 7: High debt-to-original ratio (barely paid anything)
  if (input.totalOriginal > 0) {
    const unpaidRatio = input.totalOutstanding / input.totalOriginal;
    if (unpaidRatio > 0.95 && input.daysSinceCreation > 180) {
      flags.push({
        severity: 'Warning',
        type: 'NO_PROGRESS',
        message: `Less than 5% recovered after ${Math.round(input.daysSinceCreation / 30)} months`,
        score: 40,
      });
    }
  }

  // Calculate overall risk
  const riskScore = flags.length > 0
    ? Math.min(100, Math.round(flags.reduce((sum, f) => sum + f.score, 0) / flags.length + flags.length * 8))
    : 5;

  const overallRisk: FraudAssessment['overallRisk'] =
    riskScore >= 75 ? 'Critical' :
    riskScore >= 50 ? 'High' :
    riskScore >= 25 ? 'Medium' : 'Low';

  return {
    overallRisk,
    riskScore,
    flags,
    requiresManualReview: flags.some(f => f.severity === 'Critical'),
  };
}
