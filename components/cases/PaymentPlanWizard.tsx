import React, { useState, useMemo } from 'react';
import { EnrichedCase } from '../../types';
import { formatCurrency } from '../../utils';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  caseData: EnrichedCase;
  onSave: (plan: PaymentPlan) => void;
}

export interface PaymentPlan {
  totalAmount: number;
  installments: number;
  frequency: 'weekly' | 'biweekly' | 'monthly';
  startDate: string;
  installmentAmount: number;
  schedule: Array<{ date: string; amount: number; status: 'upcoming' | 'paid' | 'overdue' }>;
}

const PaymentPlanWizard: React.FC<Props> = ({ isOpen, onClose, caseData, onSave }) => {
  const [step, setStep] = useState(1);
  const [totalAmount, setTotalAmount] = useState(String(caseData.loan?.currentBalance || 0));
  const [installments, setInstallments] = useState('6');
  const [frequency, setFrequency] = useState<'weekly' | 'biweekly' | 'monthly'>('monthly');
  const [startDate, setStartDate] = useState(new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]);
  const [discount, setDiscount] = useState('0');

  const plan = useMemo((): PaymentPlan => {
    const amt = parseFloat(totalAmount) * (1 - parseFloat(discount) / 100);
    const inst = parseInt(installments) || 1;
    const perInst = Math.ceil(amt / inst * 100) / 100;
    const schedule: PaymentPlan['schedule'] = [];
    const freqDays = frequency === 'weekly' ? 7 : frequency === 'biweekly' ? 14 : 30;

    for (let i = 0; i < inst; i++) {
      const d = new Date(startDate);
      d.setDate(d.getDate() + i * freqDays);
      schedule.push({
        date: d.toISOString().split('T')[0],
        amount: i === inst - 1 ? Math.round((amt - perInst * (inst - 1)) * 100) / 100 : perInst,
        status: 'upcoming',
      });
    }

    return { totalAmount: amt, installments: inst, frequency, startDate, installmentAmount: perInst, schedule };
  }, [totalAmount, installments, frequency, startDate, discount]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/40 z-[60] flex items-center justify-center p-4" onClick={onClose}>
      <div className="panel w-full max-w-lg max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()} style={{ background: 'var(--color-bg-secondary)' }}>
        <div className="p-4 border-b border-[var(--color-border)] flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold" style={{ color: '#1B2A4A' }}>Payment Plan Wizard</h2>
            <p className="text-xs text-text-secondary">{caseData.debtor.name} — {caseData.loan?.accountNumber}</p>
          </div>
          <div className="flex items-center gap-2">
            {[1, 2, 3].map(s => (
              <span key={s} className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${step >= s ? 'text-white' : 'text-text-tertiary bg-[var(--color-bg-tertiary)]'}`} style={step >= s ? { background: '#1B2A4A' } : {}}>
                {s}
              </span>
            ))}
          </div>
        </div>

        <div className="p-5">
          {step === 1 && (
            <div className="space-y-4 animate-fade-in">
              <h3 className="text-sm font-bold text-text-primary">Step 1: Amount & Terms</h3>
              <div>
                <label className="text-xs text-text-secondary font-medium">Outstanding Balance</label>
                <p className="text-lg font-bold" style={{ color: '#DC2626' }}>{formatCurrency(caseData.loan?.currentBalance || 0, caseData.loan?.currency || 'AED')}</p>
              </div>
              <div>
                <label className="text-xs text-text-secondary font-medium">Settlement Discount (%)</label>
                <input type="number" value={discount} onChange={e => setDiscount(e.target.value)} min="0" max="50" className="w-full mt-1 px-3 py-2 text-sm rounded-md" />
              </div>
              <div>
                <label className="text-xs text-text-secondary font-medium">Plan Amount (AED)</label>
                <input type="number" value={totalAmount} onChange={e => setTotalAmount(e.target.value)} className="w-full mt-1 px-3 py-2 text-sm rounded-md font-mono font-bold" />
                {parseFloat(discount) > 0 && (
                  <p className="text-xs text-emerald-600 mt-1">After {discount}% discount: {formatCurrency(parseFloat(totalAmount) * (1 - parseFloat(discount) / 100), 'AED')}</p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-text-secondary font-medium">Installments</label>
                  <select value={installments} onChange={e => setInstallments(e.target.value)} className="w-full mt-1 px-3 py-2 text-sm rounded-md">
                    {[2, 3, 4, 6, 8, 10, 12, 18, 24].map(n => <option key={n} value={n}>{n} installments</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-text-secondary font-medium">Frequency</label>
                  <select value={frequency} onChange={e => setFrequency(e.target.value as any)} className="w-full mt-1 px-3 py-2 text-sm rounded-md">
                    <option value="weekly">Weekly</option>
                    <option value="biweekly">Bi-weekly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs text-text-secondary font-medium">Start Date</label>
                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full mt-1 px-3 py-2 text-sm rounded-md" />
              </div>
              <button onClick={() => setStep(2)} className="w-full py-2.5 text-sm font-bold text-white rounded-lg" style={{ background: '#1B2A4A' }}>Next: Review Schedule →</button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4 animate-fade-in">
              <h3 className="text-sm font-bold text-text-primary">Step 2: Payment Schedule</h3>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="panel p-3"><p className="text-[10px] text-text-tertiary">Per Installment</p><p className="text-lg font-bold" style={{ color: '#F28C28' }}>{formatCurrency(plan.installmentAmount, 'AED')}</p></div>
                <div className="panel p-3"><p className="text-[10px] text-text-tertiary">Installments</p><p className="text-lg font-bold" style={{ color: '#1B2A4A' }}>{plan.installments}</p></div>
                <div className="panel p-3"><p className="text-[10px] text-text-tertiary">Total</p><p className="text-lg font-bold text-emerald-600">{formatCurrency(plan.totalAmount, 'AED')}</p></div>
              </div>
              <div className="max-h-[200px] overflow-y-auto space-y-1">
                {plan.schedule.map((s, i) => (
                  <div key={i} className="flex items-center justify-between p-2 rounded bg-[var(--color-bg-tertiary)] text-xs">
                    <span className="font-mono text-text-tertiary w-6">{i + 1}.</span>
                    <span className="font-medium text-text-primary">{new Date(s.date).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                    <span className="font-mono font-bold" style={{ color: '#1B2A4A' }}>{formatCurrency(s.amount, 'AED')}</span>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <button onClick={() => setStep(1)} className="flex-1 py-2 text-sm font-medium rounded-lg border border-[var(--color-border)]">← Back</button>
                <button onClick={() => setStep(3)} className="flex-1 py-2 text-sm font-bold text-white rounded-lg" style={{ background: '#1B2A4A' }}>Next: Confirm →</button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4 animate-fade-in text-center">
              <div className="text-4xl">✅</div>
              <h3 className="text-sm font-bold text-text-primary">Step 3: Confirm & Activate</h3>
              <p className="text-xs text-text-secondary">This will create a {plan.installments}-installment payment plan of {formatCurrency(plan.installmentAmount, 'AED')} {frequency} starting {new Date(startDate).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}.</p>
              <p className="text-xs text-text-tertiary">Auto-reminders will be sent 2 days before each due date via SMS/WhatsApp.</p>
              <div className="flex gap-2">
                <button onClick={() => setStep(2)} className="flex-1 py-2 text-sm font-medium rounded-lg border border-[var(--color-border)]">← Back</button>
                <button onClick={() => { onSave(plan); onClose(); }} className="flex-1 py-2.5 text-sm font-bold text-white rounded-lg" style={{ background: '#16A34A' }}>Activate Payment Plan</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PaymentPlanWizard;
