import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { EnrichedCase, User, Role, SettlementRequest } from '../../types';
import { formatCurrency } from '../../utils';

interface SettlementCalculatorProps {
  caseData: EnrichedCase;
  currentUser: User;
}

type PaymentPlanType = 'lump_sum' | '2_installments' | '3_installments' | '6_installments';
type ValidityPeriod = 7 | 14 | 30;
type ApprovalTier = 'full' | 'tier1' | 'tier2' | 'tier3' | 'rejected';

const STORAGE_KEY = 'rv_settlement_requests';

const getTierInfo = (pct: number): { tier: ApprovalTier; label: string; color: string; approvalNote: string } => {
  if (pct === 100) return { tier: 'full', label: 'Full Settlement', color: 'var(--color-success)', approvalNote: 'Officer can approve' };
  if (pct >= 80) return { tier: 'tier1', label: 'Tier 1 (80-99%)', color: 'var(--color-success)', approvalNote: 'Officer can approve' };
  if (pct >= 60) return { tier: 'tier2', label: 'Tier 2 (60-79%)', color: 'var(--color-warning)', approvalNote: 'Requires Manager approval' };
  if (pct >= 40) return { tier: 'tier3', label: 'Tier 3 (40-59%)', color: 'var(--color-danger)', approvalNote: 'Requires Manager + CEO approval' };
  return { tier: 'rejected', label: 'Below Minimum', color: 'var(--color-danger)', approvalNote: 'Auto-rejected — below 40% threshold' };
};

const canAutoApprove = (tier: ApprovalTier, role: Role): boolean => {
  if (tier === 'rejected') return false;
  if (tier === 'full' || tier === 'tier1') return true;
  if (tier === 'tier2' && (role === Role.MANAGER || role === Role.CEO || role === Role.ADMIN)) return true;
  if (tier === 'tier3' && role === Role.CEO) return true;
  return false;
};

const loadRequests = (): SettlementRequest[] => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch { return []; }
};

const saveRequests = (reqs: SettlementRequest[]) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(reqs));
};

const installmentCount = (plan: PaymentPlanType): number => {
  switch (plan) {
    case 'lump_sum': return 1;
    case '2_installments': return 2;
    case '3_installments': return 3;
    case '6_installments': return 6;
  }
};

const planLabel = (plan: PaymentPlanType): string => {
  switch (plan) {
    case 'lump_sum': return 'Lump Sum';
    case '2_installments': return '2 Installments';
    case '3_installments': return '3 Installments';
    case '6_installments': return '6 Installments';
  }
};

const StatusBadge: React.FC<{ status: SettlementRequest['status'] }> = ({ status }) => {
  const styles: Record<string, { bg: string; text: string }> = {
    pending: { bg: 'var(--color-warning-bg, var(--color-warning))', text: 'var(--color-warning-text, #fff)' },
    approved: { bg: 'var(--color-success-bg, var(--color-success))', text: 'var(--color-success-text, #fff)' },
    rejected: { bg: 'var(--color-danger-bg, var(--color-danger))', text: 'var(--color-danger-text, #fff)' },
  };
  const s = styles[status] || styles.pending;
  return (
    <span style={{
      display: 'inline-block', padding: '2px 8px', borderRadius: '9999px', fontSize: '0.7rem',
      fontWeight: 600, textTransform: 'uppercase', background: s.bg, color: s.text,
    }}>
      {status}
    </span>
  );
};

const SettlementCalculator: React.FC<SettlementCalculatorProps> = ({ caseData, currentUser }) => {
  const loan = caseData.loan;
  const currency = loan?.currency || 'AED';
  const originalAmount = loan?.originalAmount || 0;
  const currentOutstanding = loan?.currentBalance || 0;
  const totalPaymentsMade = originalAmount - currentOutstanding;

  const [settlementPct, setSettlementPct] = useState(80);
  const [paymentPlan, setPaymentPlan] = useState<PaymentPlanType>('lump_sum');
  const [validity, setValidity] = useState<ValidityPeriod>(14);
  const [notes, setNotes] = useState('');
  const [requests, setRequests] = useState<SettlementRequest[]>(loadRequests);
  const [activeTab, setActiveTab] = useState<'calculator' | 'history' | 'approvals'>('calculator');
  const [submitMsg, setSubmitMsg] = useState('');

  useEffect(() => { setRequests(loadRequests()); }, [activeTab]);

  const tierInfo = useMemo(() => getTierInfo(settlementPct), [settlementPct]);
  const settlementAmount = useMemo(() => Math.round(currentOutstanding * settlementPct / 100), [currentOutstanding, settlementPct]);
  const discountAmount = currentOutstanding - settlementAmount;
  const savingsPct = currentOutstanding > 0 ? Math.round((discountAmount / currentOutstanding) * 100) : 0;
  const bankRecoveryRate = originalAmount > 0 ? Math.round((settlementAmount / originalAmount) * 100) : 0;

  const numInstallments = installmentCount(paymentPlan);
  const monthlyAmount = Math.ceil(settlementAmount / numInstallments);

  const installmentSchedule = useMemo(() => {
    const schedule: Array<{ date: string; amount: number }> = [];
    const today = new Date();
    for (let i = 0; i < numInstallments; i++) {
      const d = new Date(today);
      d.setMonth(d.getMonth() + i);
      const remaining = settlementAmount - monthlyAmount * i;
      schedule.push({
        date: d.toISOString().split('T')[0],
        amount: i === numInstallments - 1 ? remaining : monthlyAmount,
      });
    }
    return schedule;
  }, [numInstallments, settlementAmount, monthlyAmount]);

  const caseHistory = useMemo(
    () => requests.filter(r => r.caseId === caseData.id).sort((a, b) => b.requestedAt.localeCompare(a.requestedAt)),
    [requests, caseData.id]
  );

  const pendingApprovals = useMemo(
    () => requests.filter(r => r.status === 'pending').sort((a, b) => b.requestedAt.localeCompare(a.requestedAt)),
    [requests]
  );

  const isManager = currentUser.role === Role.MANAGER || currentUser.role === Role.CEO || currentUser.role === Role.ADMIN;

  const handleGenerate = useCallback(() => {
    if (tierInfo.tier === 'rejected') return;
    const autoApproved = canAutoApprove(tierInfo.tier, currentUser.role);

    const newReq: SettlementRequest = {
      id: `SR-${Date.now()}`,
      caseId: caseData.id,
      debtorName: caseData.debtor?.name || '',
      accountNumber: loan?.accountNumber || '',
      bank: loan?.bank || '',
      originalBalance: currentOutstanding,
      proposedAmount: settlementAmount,
      discountPercent: savingsPct,
      currency,
      requestedBy: currentUser.name,
      requestedAt: new Date().toISOString(),
      status: autoApproved ? 'approved' : 'pending',
      approvedBy: autoApproved ? currentUser.name : undefined,
      approvedAt: autoApproved ? new Date().toISOString() : undefined,
      notes: `${notes}${numInstallments > 1 ? ` | Payment: ${planLabel(paymentPlan)} (${formatCurrency(monthlyAmount, currency)}/mo)` : ' | Lump Sum'} | Valid ${validity} days`,
    };

    const updated = [newReq, ...requests];
    saveRequests(updated);
    setRequests(updated);
    setSubmitMsg(autoApproved ? 'Approved — offer generated successfully.' : 'Submitted for approval.');
    setTimeout(() => setSubmitMsg(''), 4000);
  }, [tierInfo, currentUser, caseData, loan, currentOutstanding, settlementAmount, savingsPct, currency, notes, numInstallments, paymentPlan, monthlyAmount, validity, requests]);

  const handleApproval = useCallback((id: string, approved: boolean) => {
    const updated = requests.map(r =>
      r.id === id
        ? { ...r, status: (approved ? 'approved' : 'rejected') as SettlementRequest['status'], approvedBy: currentUser.name, approvedAt: new Date().toISOString() }
        : r
    );
    saveRequests(updated);
    setRequests(updated);
  }, [requests, currentUser.name]);

  const sectionStyle: React.CSSProperties = {
    background: 'var(--color-bg-primary)', borderRadius: '8px', border: '1px solid var(--color-border)', padding: '12px', marginBottom: '12px',
  };
  const labelStyle: React.CSSProperties = { fontSize: '0.7rem', color: 'var(--color-text-secondary)', fontWeight: 500, marginBottom: '2px' };
  const valueStyle: React.CSSProperties = { fontSize: '0.95rem', fontWeight: 700, color: 'var(--color-text-primary)' };
  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '6px 10px', fontSize: '0.8rem', borderRadius: '6px',
    border: '1px solid var(--color-border)', background: 'var(--color-bg-primary)', color: 'var(--color-text-primary)',
  };

  return (
    <div style={{ background: 'var(--color-bg-secondary)', borderRadius: '10px', border: '1px solid var(--color-border)', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>Settlement Calculator</h3>
          <span style={{ fontSize: '0.72rem', color: 'var(--color-text-secondary)' }}>{caseData.debtor?.name} — {loan?.accountNumber}</span>
        </div>
        <div style={{ display: 'flex', gap: '4px' }}>
          {(['calculator', 'history', ...(isManager ? ['approvals' as const] : [])] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              style={{
                padding: '4px 12px', fontSize: '0.72rem', fontWeight: 600, borderRadius: '6px', border: 'none', cursor: 'pointer',
                background: activeTab === tab ? 'var(--color-primary)' : 'var(--color-bg-primary)',
                color: activeTab === tab ? 'var(--color-primary-text, #fff)' : 'var(--color-text-secondary)',
              }}>
              {tab === 'calculator' ? 'Calculator' : tab === 'history' ? `History (${caseHistory.length})` : `Approvals (${pendingApprovals.length})`}
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding: '16px', maxHeight: '60vh', overflowY: 'auto' }}>
        {/* ——— CALCULATOR TAB ——— */}
        {activeTab === 'calculator' && (
          <>
            {/* Summary Row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '12px' }}>
              <div style={sectionStyle}>
                <div style={labelStyle}>Original Amount</div>
                <div style={valueStyle}>{formatCurrency(originalAmount, currency)}</div>
              </div>
              <div style={sectionStyle}>
                <div style={labelStyle}>Current Outstanding</div>
                <div style={valueStyle}>{formatCurrency(currentOutstanding, currency)}</div>
              </div>
              <div style={sectionStyle}>
                <div style={labelStyle}>Total Payments Made</div>
                <div style={{ ...valueStyle, color: 'var(--color-success)' }}>{formatCurrency(totalPaymentsMade, currency)}</div>
              </div>
            </div>

            {/* Slider + Tier */}
            <div style={sectionStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text-primary)' }}>Settlement Percentage</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input type="number" min={40} max={100} value={settlementPct}
                    onChange={e => setSettlementPct(Math.min(100, Math.max(40, Number(e.target.value) || 40)))}
                    style={{ ...inputStyle, width: '60px', textAlign: 'center', fontWeight: 700 }} />
                  <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>%</span>
                </div>
              </div>
              <input type="range" min={40} max={100} value={settlementPct}
                onChange={e => setSettlementPct(Number(e.target.value))}
                style={{ width: '100%', accentColor: tierInfo.color, cursor: 'pointer' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
                <span>40%</span><span>60%</span><span>80%</span><span>100%</span>
              </div>
              {/* Tier badge */}
              <div style={{ marginTop: '10px', padding: '8px 12px', borderRadius: '6px', background: tierInfo.color, opacity: 0.9, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 700, fontSize: '0.78rem', color: 'var(--color-primary-text, #fff)' }}>{tierInfo.label}</span>
                <span style={{ fontSize: '0.7rem', color: 'var(--color-primary-text, #fff)' }}>{tierInfo.approvalNote}</span>
              </div>
            </div>

            {/* Calculated Values */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '10px', marginBottom: '12px' }}>
              <div style={sectionStyle}>
                <div style={labelStyle}>Settlement Amount</div>
                <div style={{ ...valueStyle, color: 'var(--color-primary)' }}>{formatCurrency(settlementAmount, currency)}</div>
              </div>
              <div style={sectionStyle}>
                <div style={labelStyle}>Discount Amount</div>
                <div style={valueStyle}>{formatCurrency(discountAmount, currency)}</div>
              </div>
              <div style={sectionStyle}>
                <div style={labelStyle}>Savings</div>
                <div style={valueStyle}>{savingsPct}%</div>
              </div>
              <div style={sectionStyle}>
                <div style={labelStyle}>Bank Recovery Rate</div>
                <div style={{ ...valueStyle, color: bankRecoveryRate >= 70 ? 'var(--color-success)' : bankRecoveryRate >= 50 ? 'var(--color-warning)' : 'var(--color-danger)' }}>
                  {bankRecoveryRate}%
                </div>
              </div>
            </div>

            {/* Offer Form */}
            <div style={sectionStyle}>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: '10px' }}>Settlement Offer</div>

              {/* Payment Plan */}
              <div style={{ marginBottom: '10px' }}>
                <div style={labelStyle}>Payment Plan</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '6px' }}>
                  {(['lump_sum', '2_installments', '3_installments', '6_installments'] as PaymentPlanType[]).map(p => (
                    <button key={p} onClick={() => setPaymentPlan(p)}
                      style={{
                        padding: '6px 4px', fontSize: '0.7rem', fontWeight: 600, borderRadius: '6px', cursor: 'pointer',
                        border: paymentPlan === p ? '2px solid var(--color-primary)' : '1px solid var(--color-border)',
                        background: paymentPlan === p ? 'var(--color-primary)' : 'var(--color-bg-primary)',
                        color: paymentPlan === p ? 'var(--color-primary-text, #fff)' : 'var(--color-text-secondary)',
                      }}>
                      {planLabel(p)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Installment breakdown */}
              {numInstallments > 1 && (
                <div style={{ marginBottom: '10px', padding: '8px', borderRadius: '6px', background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)' }}>
                  <div style={{ ...labelStyle, marginBottom: '6px' }}>Installment Schedule ({formatCurrency(monthlyAmount, currency)}/month)</div>
                  {installmentSchedule.map((inst, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', padding: '3px 0', borderBottom: i < installmentSchedule.length - 1 ? '1px solid var(--color-border)' : 'none' }}>
                      <span style={{ color: 'var(--color-text-secondary)' }}>#{i + 1} — {inst.date}</span>
                      <span style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{formatCurrency(inst.amount, currency)}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Validity */}
              <div style={{ marginBottom: '10px' }}>
                <div style={labelStyle}>Validity Period</div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  {([7, 14, 30] as ValidityPeriod[]).map(v => (
                    <button key={v} onClick={() => setValidity(v)}
                      style={{
                        padding: '5px 14px', fontSize: '0.72rem', fontWeight: 600, borderRadius: '6px', cursor: 'pointer',
                        border: validity === v ? '2px solid var(--color-primary)' : '1px solid var(--color-border)',
                        background: validity === v ? 'var(--color-primary)' : 'var(--color-bg-primary)',
                        color: validity === v ? 'var(--color-primary-text, #fff)' : 'var(--color-text-secondary)',
                      }}>
                      {v} Days
                    </button>
                  ))}
                </div>
              </div>

              {/* Notes */}
              <div style={{ marginBottom: '12px' }}>
                <div style={labelStyle}>Notes</div>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Additional notes for this settlement offer..."
                  style={{ ...inputStyle, resize: 'vertical' }} />
              </div>

              {/* Submit */}
              {submitMsg && (
                <div style={{ padding: '8px 12px', borderRadius: '6px', marginBottom: '10px', fontSize: '0.75rem', fontWeight: 600,
                  background: submitMsg.includes('Approved') ? 'var(--color-success)' : 'var(--color-warning)',
                  color: 'var(--color-primary-text, #fff)',
                }}>
                  {submitMsg}
                </div>
              )}
              <button onClick={handleGenerate} disabled={tierInfo.tier === 'rejected'}
                style={{
                  width: '100%', padding: '10px', fontWeight: 700, fontSize: '0.82rem', borderRadius: '8px', border: 'none', cursor: tierInfo.tier === 'rejected' ? 'not-allowed' : 'pointer',
                  background: tierInfo.tier === 'rejected' ? 'var(--color-border)' : canAutoApprove(tierInfo.tier, currentUser.role) ? 'var(--color-success)' : 'var(--color-warning)',
                  color: 'var(--color-primary-text, #fff)', opacity: tierInfo.tier === 'rejected' ? 0.5 : 1,
                }}>
                {tierInfo.tier === 'rejected'
                  ? 'Below Minimum — Cannot Generate'
                  : canAutoApprove(tierInfo.tier, currentUser.role)
                    ? 'Approved — Generate Letter'
                    : tierInfo.tier === 'tier2'
                      ? 'Submit for Manager Approval'
                      : 'Submit for Manager + CEO Approval'}
              </button>
            </div>
          </>
        )}

        {/* ——— HISTORY TAB ——— */}
        {activeTab === 'history' && (
          <div>
            {caseHistory.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--color-text-secondary)', fontSize: '0.82rem' }}>
                No previous settlement offers for this case.
              </div>
            ) : (
              caseHistory.map(req => (
                <div key={req.id} style={{ ...sectionStyle, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <span style={{ fontWeight: 700, fontSize: '0.82rem', color: 'var(--color-text-primary)' }}>{formatCurrency(req.proposedAmount, req.currency)}</span>
                      <StatusBadge status={req.status} />
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--color-text-secondary)' }}>
                      {req.discountPercent}% discount — by {req.requestedBy} — {new Date(req.requestedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </div>
                    {req.notes && <div style={{ fontSize: '0.68rem', color: 'var(--color-text-secondary)', marginTop: '2px', fontStyle: 'italic' }}>{req.notes}</div>}
                  </div>
                  {req.approvedBy && (
                    <div style={{ textAlign: 'right', fontSize: '0.68rem', color: 'var(--color-text-secondary)' }}>
                      {req.status === 'approved' ? 'Approved' : 'Rejected'} by {req.approvedBy}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* ——— APPROVALS TAB (managers only) ——— */}
        {activeTab === 'approvals' && isManager && (
          <div>
            {pendingApprovals.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--color-text-secondary)', fontSize: '0.82rem' }}>
                No pending settlement requests.
              </div>
            ) : (
              pendingApprovals.map(req => (
                <div key={req.id} style={sectionStyle}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--color-text-primary)' }}>{req.debtorName}</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--color-text-secondary)' }}>{req.accountNumber} — {req.bank}</div>
                    </div>
                    <StatusBadge status={req.status} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '8px' }}>
                    <div>
                      <div style={labelStyle}>Outstanding</div>
                      <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text-primary)' }}>{formatCurrency(req.originalBalance, req.currency)}</div>
                    </div>
                    <div>
                      <div style={labelStyle}>Proposed</div>
                      <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-primary)' }}>{formatCurrency(req.proposedAmount, req.currency)}</div>
                    </div>
                    <div>
                      <div style={labelStyle}>Discount</div>
                      <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-danger)' }}>{req.discountPercent}%</div>
                    </div>
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--color-text-secondary)', marginBottom: '8px' }}>
                    Requested by {req.requestedBy} — {new Date(req.requestedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </div>
                  {req.notes && <div style={{ fontSize: '0.68rem', color: 'var(--color-text-secondary)', fontStyle: 'italic', marginBottom: '8px' }}>{req.notes}</div>}
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={() => handleApproval(req.id, true)}
                      style={{ flex: 1, padding: '7px', fontWeight: 700, fontSize: '0.75rem', borderRadius: '6px', border: 'none', cursor: 'pointer', background: 'var(--color-success)', color: 'var(--color-primary-text, #fff)' }}>
                      Approve
                    </button>
                    <button onClick={() => handleApproval(req.id, false)}
                      style={{ flex: 1, padding: '7px', fontWeight: 700, fontSize: '0.75rem', borderRadius: '6px', border: 'none', cursor: 'pointer', background: 'var(--color-danger)', color: 'var(--color-primary-text, #fff)' }}>
                      Reject
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default SettlementCalculator;
