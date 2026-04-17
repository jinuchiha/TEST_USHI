import React, { useState, useEffect, useMemo } from 'react';
import { EnrichedCase, User } from '../../types';

interface HardshipAssessmentProps {
  caseData: EnrichedCase;
  currentUser: User;
}

interface IncomeFields {
  salary: number;
  otherIncome: number;
}

interface ExpenseFields {
  rent: number;
  food: number;
  transport: number;
  utilities: number;
  education: number;
  medical: number;
  otherDebts: number;
}

type EmploymentStatus = 'Employed' | 'Self-Employed' | 'Unemployed' | 'Retired';

interface HardshipData {
  income: IncomeFields;
  expenses: ExpenseFields;
  dependents: number;
  employmentStatus: EmploymentStatus;
  employerName: string;
  selectedTenure: number;
  assessedBy: string;
  assessedAt: string;
}

const TENURE_OPTIONS = [12, 24, 36, 48];

const STORAGE_KEY = (caseId: string) => `rv_hardship_${caseId}`;

const fieldLabel = (key: string): string => {
  const map: Record<string, string> = {
    salary: 'Salary', otherIncome: 'Other Income',
    rent: 'Rent / Housing', food: 'Food / Groceries', transport: 'Transport',
    utilities: 'Utilities (DEWA, Internet, etc.)', education: 'Education',
    medical: 'Medical / Insurance', otherDebts: 'Other Debt Obligations',
  };
  return map[key] || key;
};

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 12px', borderRadius: 8,
  border: '1px solid var(--color-border)', background: 'var(--color-bg-input)',
  color: 'var(--color-text-primary)', fontSize: 13, outline: 'none',
};

const selectStyle: React.CSSProperties = { ...inputStyle, cursor: 'pointer' };

const sectionTitle: React.CSSProperties = {
  fontSize: 14, fontWeight: 700, color: 'var(--color-text-primary)',
  marginBottom: 10, paddingBottom: 6,
  borderBottom: '1px solid var(--color-border)',
};

const HardshipAssessment: React.FC<HardshipAssessmentProps> = ({ caseData, currentUser }) => {
  const [income, setIncome] = useState<IncomeFields>({ salary: 0, otherIncome: 0 });
  const [expenses, setExpenses] = useState<ExpenseFields>({ rent: 0, food: 0, transport: 0, utilities: 0, education: 0, medical: 0, otherDebts: 0 });
  const [dependents, setDependents] = useState(0);
  const [employmentStatus, setEmploymentStatus] = useState<EmploymentStatus>('Employed');
  const [employerName, setEmployerName] = useState('');
  const [selectedTenure, setSelectedTenure] = useState(24);
  const [saved, setSaved] = useState(false);
  const [previousAssessment, setPreviousAssessment] = useState<HardshipData | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY(caseData.id));
      if (raw) {
        const data: HardshipData = JSON.parse(raw);
        setPreviousAssessment(data);
        setIncome(data.income);
        setExpenses(data.expenses);
        setDependents(data.dependents);
        setEmploymentStatus(data.employmentStatus);
        setEmployerName(data.employerName);
        setSelectedTenure(data.selectedTenure);
      }
    } catch { /* ignore corrupted data */ }
  }, [caseData.id]);

  const totalIncome = useMemo(() => income.salary + income.otherIncome, [income]);
  const totalExpenses = useMemo(() => Object.values(expenses).reduce((s, v) => s + v, 0), [expenses]);
  const disposableIncome = useMemo(() => Math.max(0, totalIncome - totalExpenses), [totalIncome, totalExpenses]);
  const affordableMonthly = useMemo(() => Math.round(disposableIncome * 0.6), [disposableIncome]);
  const outstandingBalance = caseData.loan.currentBalance;

  const handleSave = () => {
    const data: HardshipData = {
      income, expenses, dependents, employmentStatus, employerName, selectedTenure,
      assessedBy: currentUser.name,
      assessedAt: new Date().toISOString(),
    };
    localStorage.setItem(STORAGE_KEY(caseData.id), JSON.stringify(data));
    setPreviousAssessment(data);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const renderNumberInput = (value: number, onChange: (v: number) => void, placeholder?: string) => (
    <input
      type="number" min={0} value={value || ''} placeholder={placeholder || '0'}
      onChange={e => onChange(Number(e.target.value) || 0)}
      style={inputStyle}
      onFocus={e => (e.currentTarget.style.borderColor = 'var(--color-primary)')}
      onBlur={e => (e.currentTarget.style.borderColor = 'var(--color-border)')}
    />
  );

  const renderRow = (label: string, value: number, onChange: (v: number) => void) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
      <label style={{ flex: 1, fontSize: 13, color: 'var(--color-text-secondary)' }}>{label}</label>
      <div style={{ width: 180 }}>
        <div style={{ position: 'relative' }}>
          <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: 'var(--color-text-tertiary)' }}>AED</span>
          <input
            type="number" min={0} value={value || ''} placeholder="0"
            onChange={e => onChange(Number(e.target.value) || 0)}
            style={{ ...inputStyle, paddingLeft: 40 }}
            onFocus={e => (e.currentTarget.style.borderColor = 'var(--color-primary)')}
            onBlur={e => (e.currentTarget.style.borderColor = 'var(--color-border)')}
          />
        </div>
      </div>
    </div>
  );

  const totalRow = (label: string, value: number, color: string) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderTop: '1px solid var(--color-border)', marginTop: 4 }}>
      <span style={{ flex: 1, fontSize: 13, fontWeight: 700, color: 'var(--color-text-primary)' }}>{label}</span>
      <span style={{ width: 180, textAlign: 'right', fontWeight: 700, fontSize: 15, color, paddingRight: 12 }}>
        AED {value.toLocaleString()}
      </span>
    </div>
  );

  return (
    <div style={{ padding: 24 }}>
      <div style={{ maxWidth: 820, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-text-primary)', margin: 0 }}>
              Financial Hardship Assessment
            </h2>
            <p style={{ fontSize: 12, color: 'var(--color-text-tertiary)', margin: '4px 0 0 0' }}>
              Case: {caseData.loan.accountNumber} | Debtor: {caseData.debtor.name}
            </p>
          </div>
          {previousAssessment && (
            <span style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, background: 'var(--color-bg-tertiary)', color: 'var(--color-text-secondary)', border: '1px solid var(--color-border)' }}>
              Last assessed: {new Date(previousAssessment.assessedAt).toLocaleDateString()} by {previousAssessment.assessedBy}
            </span>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          {/* Monthly Income */}
          <div style={{ background: 'var(--color-bg-secondary)', borderRadius: 12, padding: 18, border: '1px solid var(--color-border)' }}>
            <div style={sectionTitle}>Monthly Income</div>
            {renderRow(fieldLabel('salary'), income.salary, v => setIncome(p => ({ ...p, salary: v })))}
            {renderRow(fieldLabel('otherIncome'), income.otherIncome, v => setIncome(p => ({ ...p, otherIncome: v })))}
            {totalRow('Total Income', totalIncome, 'var(--color-success)')}
          </div>

          {/* Monthly Expenses */}
          <div style={{ background: 'var(--color-bg-secondary)', borderRadius: 12, padding: 18, border: '1px solid var(--color-border)' }}>
            <div style={sectionTitle}>Monthly Expenses</div>
            {(Object.keys(expenses) as (keyof ExpenseFields)[]).map(k => (
              renderRow(fieldLabel(k), expenses[k], v => setExpenses(p => ({ ...p, [k]: v })))
            ))}
            {totalRow('Total Expenses', totalExpenses, 'var(--color-danger)')}
          </div>
        </div>

        {/* Disposable Income */}
        <div style={{ marginTop: 20, background: 'var(--color-bg-secondary)', borderRadius: 12, padding: 18, border: '1px solid var(--color-border)' }}>
          <div style={sectionTitle}>Disposable Income & Affordability</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
            <div style={{ textAlign: 'center', padding: 14, borderRadius: 10, background: 'var(--color-bg-tertiary)' }}>
              <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>Disposable Income</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: disposableIncome > 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
                AED {disposableIncome.toLocaleString()}
              </div>
            </div>
            <div style={{ textAlign: 'center', padding: 14, borderRadius: 10, background: 'var(--color-bg-tertiary)' }}>
              <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>Affordable Monthly (60%)</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--color-primary)' }}>
                AED {affordableMonthly.toLocaleString()}
              </div>
            </div>
            <div style={{ textAlign: 'center', padding: 14, borderRadius: 10, background: 'var(--color-bg-tertiary)' }}>
              <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>Outstanding Balance</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--color-text-primary)' }}>
                AED {outstandingBalance.toLocaleString()}
              </div>
            </div>
          </div>
          <div style={{ marginTop: 14, padding: '12px 16px', borderRadius: 10, background: 'var(--color-bg-muted)', border: '1px solid var(--color-border)', fontSize: 13, color: 'var(--color-text-secondary)' }}>
            Debtor can afford <strong style={{ color: 'var(--color-primary)' }}>AED {affordableMonthly.toLocaleString()}/month</strong> based on 60% of disposable income.
          </div>
        </div>

        {/* Suggested Repayment Plan */}
        <div style={{ marginTop: 20, background: 'var(--color-bg-secondary)', borderRadius: 12, padding: 18, border: '1px solid var(--color-border)' }}>
          <div style={sectionTitle}>Suggested Repayment Plan</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
            {TENURE_OPTIONS.map(months => {
              const monthlyPayment = affordableMonthly > 0 ? Math.round(outstandingBalance / months) : 0;
              const isFeasible = affordableMonthly >= monthlyPayment && monthlyPayment > 0;
              const isSelected = selectedTenure === months;
              return (
                <div
                  key={months}
                  onClick={() => setSelectedTenure(months)}
                  style={{
                    padding: 14, borderRadius: 10, textAlign: 'center', cursor: 'pointer',
                    border: isSelected ? '2px solid var(--color-primary)' : '1px solid var(--color-border)',
                    background: isSelected ? 'var(--color-bg-tertiary)' : 'var(--color-bg-muted)',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-text-primary)' }}>{months} Mo</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: isFeasible ? 'var(--color-success)' : 'var(--color-danger)', marginTop: 4 }}>
                    AED {monthlyPayment.toLocaleString()}/mo
                  </div>
                  <div style={{ fontSize: 10, marginTop: 4, padding: '2px 8px', borderRadius: 4, display: 'inline-block', background: isFeasible ? 'var(--color-success)' : 'var(--color-danger)', color: 'var(--color-bg-secondary)', fontWeight: 600 }}>
                    {isFeasible ? 'FEASIBLE' : 'NOT FEASIBLE'}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Employment & Dependents */}
        <div style={{ marginTop: 20, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          <div style={{ background: 'var(--color-bg-secondary)', borderRadius: 12, padding: 18, border: '1px solid var(--color-border)' }}>
            <div style={sectionTitle}>Employment Details</div>
            <label style={{ fontSize: 12, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 4 }}>Employment Status</label>
            <select
              value={employmentStatus}
              onChange={e => setEmploymentStatus(e.target.value as EmploymentStatus)}
              style={selectStyle}
            >
              <option value="Employed">Employed</option>
              <option value="Self-Employed">Self-Employed</option>
              <option value="Unemployed">Unemployed</option>
              <option value="Retired">Retired</option>
            </select>
            {(employmentStatus === 'Employed' || employmentStatus === 'Self-Employed') && (
              <div style={{ marginTop: 12 }}>
                <label style={{ fontSize: 12, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 4 }}>
                  {employmentStatus === 'Employed' ? 'Employer Name' : 'Business / Company Name'}
                </label>
                <input
                  type="text" value={employerName} placeholder="Enter name..."
                  onChange={e => setEmployerName(e.target.value)}
                  style={inputStyle}
                  onFocus={e => (e.currentTarget.style.borderColor = 'var(--color-primary)')}
                  onBlur={e => (e.currentTarget.style.borderColor = 'var(--color-border)')}
                />
              </div>
            )}
          </div>
          <div style={{ background: 'var(--color-bg-secondary)', borderRadius: 12, padding: 18, border: '1px solid var(--color-border)' }}>
            <div style={sectionTitle}>Dependents</div>
            <label style={{ fontSize: 12, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 4 }}>Number of Dependents</label>
            {renderNumberInput(dependents, setDependents, '0')}
            <p style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginTop: 8 }}>
              Includes spouse, children, and any other family members financially dependent on the debtor.
            </p>
          </div>
        </div>

        {/* CBUAE Compliance Notice */}
        <div style={{ marginTop: 20, padding: '14px 18px', borderRadius: 10, background: 'var(--color-bg-muted)', border: '1px solid var(--color-border)', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <span style={{ fontSize: 16, flexShrink: 0 }}>{'\u2139\uFE0F'}</span>
          <p style={{ margin: 0, fontSize: 12, color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
            This assessment was conducted per <strong style={{ color: 'var(--color-text-primary)' }}>CBUAE Consumer Protection Regulation</strong> and the
            UAE Central Bank Circular No. 8/2020 on consumer protection standards. All financial data is self-declared by the debtor
            and subject to verification. The affordability calculation uses 60% of disposable income as the maximum repayment threshold.
          </p>
        </div>

        {/* Save Button */}
        <div style={{ marginTop: 20, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 12 }}>
          {saved && (
            <span style={{ fontSize: 13, color: 'var(--color-success)', fontWeight: 600 }}>
              Assessment saved successfully
            </span>
          )}
          <button
            onClick={handleSave}
            style={{
              padding: '10px 28px', borderRadius: 10, border: 'none', cursor: 'pointer',
              background: 'var(--color-primary)', color: 'var(--color-bg-secondary)',
              fontSize: 14, fontWeight: 600, transition: 'opacity 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
            onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
          >
            Save Assessment
          </button>
        </div>
      </div>
    </div>
  );
};

export default HardshipAssessment;
