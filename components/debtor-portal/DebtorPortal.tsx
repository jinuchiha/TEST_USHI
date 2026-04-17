import React, { useState, useMemo } from 'react';
import { User, EnrichedCase, CRMStatus, SubStatus, Role } from '../../types';
import { formatCurrency, formatDate } from '../../utils';

interface DebtorPortalProps {
  cases: EnrichedCase[];
  currentUser: User;
}

type PortalView = 'dashboard' | 'payment' | 'settlement' | 'history' | 'messages' | 'documents' | 'faq';

interface DebtorPayment {
  id: string;
  caseId: string;
  amount: number;
  method: string;
  timestamp: string;
  reference: string;
  status: 'Completed' | 'Pending' | 'Failed';
}

interface SettlementReq {
  id: string;
  caseId: string;
  type: 'full' | 'settlement' | 'plan';
  amount: number;
  timestamp: string;
  status: 'Pending' | 'Approved' | 'Rejected';
}

interface DebtorMessage {
  id: string;
  debtorName: string;
  message: string;
  timestamp: string;
  direction: 'sent' | 'received';
}

const LS_PAYMENTS = 'rv_debtor_payments';
const LS_SETTLEMENTS = 'rv_settlement_requests';
const LS_MESSAGES = 'rv_debtor_messages';

const loadLS = <T,>(key: string): T[] => {
  try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch { return []; }
};
const saveLS = <T,>(key: string, data: T[]) => localStorage.setItem(key, JSON.stringify(data));
const genRef = () => 'RV-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).substring(2, 6).toUpperCase();

const portalStyles: Record<string, React.CSSProperties> = {
  wrapper: { minHeight: '100vh', background: '#f8f9fa', fontFamily: "'Segoe UI', system-ui, sans-serif", color: 'var(--color-text-primary)' },
  header: { background: 'linear-gradient(135deg, var(--color-primary), var(--color-accent))', padding: '16px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 },
  headerTitle: { color: '#fff', fontSize: 22, fontWeight: 700, margin: 0 },
  headerSub: { color: 'rgba(255,255,255,0.8)', fontSize: 12, margin: 0 },
  headerRight: { display: 'flex', alignItems: 'center', gap: 12 },
  select: { padding: '8px 12px', borderRadius: 8, border: '1px solid var(--color-border)', fontSize: 13, background: '#fff', color: 'var(--color-text-primary)', minWidth: 200 },
  langBtn: { padding: '6px 14px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.4)', background: 'transparent', color: '#fff', cursor: 'pointer', fontSize: 12 },
  banner: { background: 'var(--color-bg-secondary)', borderBottom: '1px solid var(--color-border)', padding: '10px 32px', display: 'flex', gap: 24, alignItems: 'center', fontSize: 11, color: 'var(--color-text-primary)', flexWrap: 'wrap' as const },
  trustBadge: { display: 'flex', alignItems: 'center', gap: 4, opacity: 0.7 },
  nav: { display: 'flex', gap: 4, padding: '12px 32px', background: '#fff', borderBottom: '1px solid var(--color-border)', flexWrap: 'wrap' as const },
  navBtn: { padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 500, transition: 'all .2s' },
  main: { maxWidth: 1100, margin: '0 auto', padding: '24px 32px' },
  card: { background: '#fff', borderRadius: 12, border: '1px solid var(--color-border)', padding: 24, marginBottom: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' },
  cardTitle: { fontSize: 16, fontWeight: 600, marginBottom: 16, color: 'var(--color-text-primary)' },
  grid2: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 },
  btn: { padding: '10px 20px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, transition: 'all .2s' },
  btnPrimary: { background: 'var(--color-primary)', color: '#fff' },
  btnSuccess: { background: 'var(--color-success)', color: '#fff' },
  btnDanger: { background: 'var(--color-danger)', color: '#fff' },
  btnOutline: { background: 'transparent', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' },
  input: { width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--color-border)', fontSize: 14, boxSizing: 'border-box' as const },
  table: { width: '100%', borderCollapse: 'collapse' as const, fontSize: 13 },
  th: { textAlign: 'left' as const, padding: '10px 12px', borderBottom: '2px solid var(--color-border)', fontWeight: 600, fontSize: 11, textTransform: 'uppercase' as const, color: 'var(--color-text-primary)', opacity: 0.6 },
  td: { padding: '10px 12px', borderBottom: '1px solid var(--color-border)' },
  pill: { display: 'inline-block', padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600 },
  label: { display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4, color: 'var(--color-text-primary)', opacity: 0.7 },
  statValue: { fontSize: 28, fontWeight: 700, color: 'var(--color-primary)' },
  demoBar: { background: 'var(--color-accent)', color: '#fff', textAlign: 'center' as const, padding: '8px 16px', fontSize: 12, fontWeight: 600 },
};

const getDpdColor = (dpd: number): string => {
  if (dpd <= 30) return 'var(--color-success)';
  if (dpd <= 90) return '#e6a817';
  return 'var(--color-danger)';
};

const statusBadge = (status: CRMStatus) => {
  const colors: Record<string, { bg: string; fg: string }> = {
    PTP: { bg: 'rgba(34,197,94,0.12)', fg: 'var(--color-success)' },
    Closed: { bg: 'rgba(34,197,94,0.12)', fg: 'var(--color-success)' },
    'UNDER NEGO': { bg: 'rgba(234,179,8,0.12)', fg: '#b8960f' },
    WIP: { bg: 'rgba(234,179,8,0.12)', fg: '#b8960f' },
    Dispute: { bg: 'rgba(239,68,68,0.12)', fg: 'var(--color-danger)' },
    Expire: { bg: 'rgba(239,68,68,0.12)', fg: 'var(--color-danger)' },
  };
  const c = colors[status] || { bg: 'var(--color-bg-secondary)', fg: 'var(--color-text-primary)' };
  return <span style={{ ...portalStyles.pill, background: c.bg, color: c.fg }}>{status}</span>;
};

const FAQ_ITEMS = [
  { q: 'How do I make a payment?', a: 'Select an account from your dashboard and click "Make Payment". You can pay via card, bank transfer, or PayTabs link. Minimum payment is AED 100.' },
  { q: 'Can I get a settlement discount?', a: 'Yes. Click "Request Settlement" on any account to view available settlement options. Discounts up to 30% may be available for one-time payments, subject to approval.' },
  { q: 'What happens if I don\'t pay?', a: 'Continued non-payment may result in escalation including legal proceedings, credit bureau reporting, and additional collection costs as permitted under UAE law.' },
  { q: 'How do I dispute the amount?', a: 'Send a message to your assigned agent through the Communication panel with details of your dispute. You may also upload supporting documents in the Documents section.' },
  { q: 'Can I set up a payment plan?', a: 'Yes. Use "Request Settlement" and select the "Payment Plan" option. Plans of up to 12 months are available, subject to approval by the collections team.' },
  { q: 'How do I contact my agent?', a: 'Use the Communication panel to send a direct message or request a callback at your preferred time. Your agent will respond within 1 business day.' },
  { q: 'What are my rights as a debtor?', a: 'Under UAE Central Bank regulations, you have the right to fair treatment, accurate information about your debt, privacy protection, and the right to dispute amounts you believe are incorrect.' },
  { q: 'How is interest calculated?', a: 'Interest and fees are calculated according to the original credit agreement with your bank. The outstanding balance shown reflects all applicable charges as of the last update date.' },
];

const DebtorPortal: React.FC<DebtorPortalProps> = ({ cases, currentUser }) => {
  const [selectedDebtorId, setSelectedDebtorId] = useState<string>('');
  const [activeView, setActiveView] = useState<PortalView>('dashboard');
  const [activeCaseId, setActiveCaseId] = useState<string>('');
  const [lang, setLang] = useState<'EN' | 'AR'>('EN');

  // Payment state
  const [payAmount, setPayAmount] = useState<string>('');
  const [payMethod, setPayMethod] = useState<string>('Card');
  const [payConfirm, setPayConfirm] = useState<{ ref: string; amount: number } | null>(null);

  // Settlement state
  const [settlementOption, setSettlementOption] = useState<'full' | 'settlement' | 'plan' | ''>('');
  const [settlementConfirm, setSettlementConfirm] = useState(false);

  // Communication state
  const [msgText, setMsgText] = useState('');
  const [callbackTime, setCallbackTime] = useState('');
  const [callbackSent, setCallbackSent] = useState(false);

  // FAQ state
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

  // Derive unique debtors
  const debtorMap = useMemo(() => {
    const map = new Map<string, { name: string; cases: EnrichedCase[] }>();
    cases.forEach(c => {
      if (!map.has(c.debtorId)) map.set(c.debtorId, { name: c.debtor.name, cases: [] });
      map.get(c.debtorId)!.cases.push(c);
    });
    return map;
  }, [cases]);

  const debtorList = useMemo(() => Array.from(debtorMap.entries()).map(([id, d]) => ({ id, name: d.name })), [debtorMap]);
  const debtorCases = selectedDebtorId ? (debtorMap.get(selectedDebtorId)?.cases || []) : [];
  const debtorName = selectedDebtorId ? (debtorMap.get(selectedDebtorId)?.name || '') : '';
  const activeCase = debtorCases.find(c => c.id === activeCaseId);

  const totalOutstanding = debtorCases.reduce((s, c) => s + (c.loan.currentBalance || 0), 0);
  const lastPayment = debtorCases
    .flatMap(c => c.history.filter(h => h.amountPaid && h.amountPaid > 0))
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];

  const payments: DebtorPayment[] = loadLS<DebtorPayment>(LS_PAYMENTS).filter(p => debtorCases.some(c => c.id === p.caseId));
  const settlements: SettlementReq[] = loadLS<SettlementReq>(LS_SETTLEMENTS).filter(s => debtorCases.some(c => c.id === s.caseId));
  const messages: DebtorMessage[] = loadLS<DebtorMessage>(LS_MESSAGES).filter(m => m.debtorName === debtorName);

  const computeDPD = (c: EnrichedCase): number => {
    const lpd = c.loan.lpd ? new Date(c.loan.lpd) : new Date(c.creationDate);
    return Math.max(0, Math.floor((Date.now() - lpd.getTime()) / 86400000));
  };

  const handlePay = () => {
    if (!activeCase) return;
    const amount = parseFloat(payAmount);
    if (isNaN(amount) || amount < 100 || amount > (activeCase.loan.currentBalance || 0)) return;
    const ref = genRef();
    const payment: DebtorPayment = { id: ref, caseId: activeCase.id, amount, method: payMethod, timestamp: new Date().toISOString(), reference: ref, status: 'Completed' };
    const all = loadLS<DebtorPayment>(LS_PAYMENTS);
    all.push(payment);
    saveLS(LS_PAYMENTS, all);
    setPayConfirm({ ref, amount });
    setPayAmount('');
  };

  const handleDownloadReceipt = () => {
    if (!payConfirm || !activeCase) return;
    const text = [
      '=== PAYMENT RECEIPT ===',
      `RecoVantage Private Limited`,
      `Reference: ${payConfirm.ref}`,
      `Date: ${new Date().toLocaleString()}`,
      `Debtor: ${debtorName}`,
      `Account: ${activeCase.loan.accountNumber}`,
      `Bank: ${activeCase.loan.bank}`,
      `Amount Paid: AED ${payConfirm.amount.toLocaleString()}`,
      `Method: ${payMethod}`,
      `Status: Completed`,
      '',
      'This is an electronically generated receipt.',
      'Licensed by CBUAE | RecoVantage Private Limited',
    ].join('\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `receipt_${payConfirm.ref}.txt`;
    a.click();
  };

  const handleSettlementRequest = () => {
    if (!activeCase || !settlementOption) return;
    const bal = activeCase.loan.currentBalance || 0;
    const amount = settlementOption === 'full' ? bal : settlementOption === 'settlement' ? Math.round(bal * 0.7) : Math.round((bal / 12) * 100) / 100;
    const req: SettlementReq = { id: genRef(), caseId: activeCase.id, type: settlementOption, amount, timestamp: new Date().toISOString(), status: 'Pending' };
    const all = loadLS<SettlementReq>(LS_SETTLEMENTS);
    all.push(req);
    saveLS(LS_SETTLEMENTS, all);
    setSettlementConfirm(true);
    setSettlementOption('');
  };

  const handleSendMessage = () => {
    if (!msgText.trim() || !debtorName) return;
    const msg: DebtorMessage = { id: genRef(), debtorName, message: msgText.trim(), timestamp: new Date().toISOString(), direction: 'sent' };
    const all = loadLS<DebtorMessage>(LS_MESSAGES);
    all.push(msg);
    saveLS(LS_MESSAGES, all);
    setMsgText('');
  };

  const handleCallback = () => {
    if (!callbackTime) return;
    const msg: DebtorMessage = { id: genRef(), debtorName, message: `Callback requested for: ${callbackTime}`, timestamp: new Date().toISOString(), direction: 'sent' };
    const all = loadLS<DebtorMessage>(LS_MESSAGES);
    all.push(msg);
    saveLS(LS_MESSAGES, all);
    setCallbackSent(true);
    setTimeout(() => setCallbackSent(false), 3000);
  };

  const downloadLiabilityStatement = () => {
    const text = [
      '=== LIABILITY STATEMENT ===',
      `RecoVantage Private Limited`,
      `Date: ${new Date().toLocaleDateString()}`,
      `Debtor: ${debtorName}`,
      '',
      ...debtorCases.map(c => [
        `Account: ${c.loan.accountNumber} | Bank: ${c.loan.bank}`,
        `Product: ${c.loan.product} | ${c.loan.subProduct}`,
        `Original Amount: AED ${c.loan.originalAmount.toLocaleString()}`,
        `Outstanding Balance: AED ${c.loan.currentBalance.toLocaleString()}`,
        `Status: ${c.crmStatus}`,
        '---',
      ].join('\n')),
      '',
      `Total Outstanding: AED ${totalOutstanding.toLocaleString()}`,
      '',
      'This statement is for informational purposes only.',
      'Licensed by CBUAE | RecoVantage Private Limited',
    ].join('\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `liability_statement_${debtorName.replace(/\s/g, '_')}.txt`;
    a.click();
  };

  const navItems: { key: PortalView; label: string }[] = [
    { key: 'dashboard', label: 'Dashboard' },
    { key: 'history', label: 'Payment History' },
    { key: 'messages', label: 'Communication' },
    { key: 'documents', label: 'Documents' },
    { key: 'faq', label: 'FAQ' },
  ];

  const resetSubViews = () => {
    setActiveCaseId('');
    setPayConfirm(null);
    setSettlementConfirm(false);
    setSettlementOption('');
    setPayAmount('');
  };

  // ---- RENDER ----
  return (
    <div style={portalStyles.wrapper}>
      {/* Demo Bar */}
      <div style={portalStyles.demoBar}>
        DEMO MODE -- This is a simulation of the debtor self-service portal as seen by {currentUser.role}
      </div>

      {/* Header */}
      <div style={portalStyles.header}>
        <div>
          <h1 style={portalStyles.headerTitle}>RecoVantage Debtor Portal</h1>
          <p style={portalStyles.headerSub}>Secure Self-Service Debt Management</p>
        </div>
        <div style={portalStyles.headerRight}>
          <select style={portalStyles.select} value={selectedDebtorId} onChange={e => { setSelectedDebtorId(e.target.value); resetSubViews(); setActiveView('dashboard'); }}>
            <option value="">-- Select Debtor to Preview --</option>
            {debtorList.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <button style={portalStyles.langBtn} onClick={() => setLang(l => l === 'EN' ? 'AR' : 'EN')}>{lang === 'EN' ? 'العربية' : 'English'}</button>
        </div>
      </div>

      {/* Trust Badges */}
      <div style={portalStyles.banner}>
        <span style={portalStyles.trustBadge}>&#128274; Secure Portal (256-bit SSL)</span>
        <span style={portalStyles.trustBadge}>&#127970; Licensed by CBUAE</span>
        <span style={portalStyles.trustBadge}>&#128737; Data Protected under UAE Federal Law</span>
        <span style={{ marginLeft: 'auto', opacity: 0.5, fontSize: 10 }}>Portal v2.1 | RecoVantage Private Limited</span>
      </div>

      {!selectedDebtorId ? (
        <div style={{ ...portalStyles.main, textAlign: 'center', paddingTop: 80 }}>
          <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.3 }}>&#128100;</div>
          <h2 style={{ color: 'var(--color-text-primary)', marginBottom: 8 }}>Select a Debtor to Preview</h2>
          <p style={{ opacity: 0.6, fontSize: 14 }}>Choose a debtor from the dropdown above to simulate their portal experience.</p>
        </div>
      ) : (
        <>
          {/* Navigation */}
          <div style={portalStyles.nav}>
            {navItems.map(n => (
              <button key={n.key} onClick={() => { setActiveView(n.key); resetSubViews(); }}
                style={{ ...portalStyles.navBtn, background: activeView === n.key ? 'var(--color-primary)' : 'transparent', color: activeView === n.key ? '#fff' : 'var(--color-text-primary)' }}>
                {n.label}
              </button>
            ))}
          </div>

          <div style={portalStyles.main}>
            {/* ===== DASHBOARD ===== */}
            {activeView === 'dashboard' && !activeCaseId && (
              <>
                <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 20 }}>Welcome, {debtorName}</h2>

                {/* Outstanding Balance Card */}
                <div style={{ ...portalStyles.card, background: 'linear-gradient(135deg, var(--color-primary), var(--color-accent))', color: '#fff', border: 'none' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
                    <div>
                      <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 4 }}>Total Outstanding Balance</div>
                      <div style={{ fontSize: 32, fontWeight: 700 }}>AED {totalOutstanding.toLocaleString()}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 12, opacity: 0.8 }}>Accounts: {debtorCases.length}</div>
                      <div style={{ fontSize: 12, opacity: 0.8, marginTop: 4 }}>Last Payment: {lastPayment ? formatDate(lastPayment.timestamp) : 'None recorded'}</div>
                    </div>
                  </div>
                </div>

                {/* Account Cards */}
                <h3 style={{ ...portalStyles.cardTitle, marginTop: 24 }}>Your Accounts</h3>
                <div style={portalStyles.grid2}>
                  {debtorCases.map(c => {
                    const dpd = computeDPD(c);
                    return (
                      <div key={c.id} style={portalStyles.card}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 12 }}>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: 15 }}>{c.loan.bank}</div>
                            <div style={{ fontSize: 12, opacity: 0.6 }}>{c.loan.accountNumber} | {c.loan.product}</div>
                          </div>
                          {statusBadge(c.crmStatus)}
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
                          <div>
                            <div style={portalStyles.label}>Original Amount</div>
                            <div style={{ fontWeight: 600, fontSize: 14 }}>{formatCurrency(c.loan.originalAmount, c.loan.currency)}</div>
                          </div>
                          <div>
                            <div style={portalStyles.label}>Outstanding</div>
                            <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--color-danger)' }}>{formatCurrency(c.loan.currentBalance, c.loan.currency)}</div>
                          </div>
                          <div>
                            <div style={portalStyles.label}>Days Past Due</div>
                            <div style={{ fontWeight: 600, fontSize: 14, color: getDpdColor(dpd) }}>{dpd} days</div>
                          </div>
                          <div>
                            <div style={portalStyles.label}>Product Type</div>
                            <div style={{ fontSize: 13 }}>{c.loan.subProduct || c.loan.product}</div>
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          <button style={{ ...portalStyles.btn, ...portalStyles.btnPrimary, flex: 1 }} onClick={() => { setActiveCaseId(c.id); setActiveView('payment'); setPayConfirm(null); }}>Make Payment</button>
                          <button style={{ ...portalStyles.btn, ...portalStyles.btnSuccess, flex: 1 }} onClick={() => { setActiveCaseId(c.id); setActiveView('settlement'); setSettlementConfirm(false); }}>Settlement</button>
                          <button style={{ ...portalStyles.btn, ...portalStyles.btnOutline }} onClick={() => { setActiveCaseId(c.id); setActiveView('history'); }}>History</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {/* ===== PAYMENT ===== */}
            {activeView === 'payment' && activeCase && (
              <div>
                <button style={{ ...portalStyles.btn, ...portalStyles.btnOutline, marginBottom: 16 }} onClick={() => { setActiveView('dashboard'); resetSubViews(); }}>&#8592; Back to Dashboard</button>
                <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 4 }}>Make a Payment</h2>
                <p style={{ opacity: 0.6, fontSize: 13, marginBottom: 20 }}>{activeCase.loan.bank} - {activeCase.loan.accountNumber}</p>

                {!payConfirm ? (
                  <div style={portalStyles.card}>
                    <div style={{ marginBottom: 20 }}>
                      <div style={portalStyles.label}>Outstanding Balance</div>
                      <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--color-danger)' }}>{formatCurrency(activeCase.loan.currentBalance, activeCase.loan.currency)}</div>
                    </div>
                    <div style={{ marginBottom: 16 }}>
                      <label style={portalStyles.label}>Payment Amount (AED) *</label>
                      <input type="number" style={portalStyles.input} value={payAmount} onChange={e => setPayAmount(e.target.value)}
                        min={100} max={activeCase.loan.currentBalance} placeholder={`Min AED 100 - Max AED ${activeCase.loan.currentBalance.toLocaleString()}`} />
                      {payAmount && (parseFloat(payAmount) < 100 || parseFloat(payAmount) > activeCase.loan.currentBalance) && (
                        <div style={{ color: 'var(--color-danger)', fontSize: 11, marginTop: 4 }}>Amount must be between AED 100 and AED {activeCase.loan.currentBalance.toLocaleString()}</div>
                      )}
                    </div>
                    <div style={{ marginBottom: 20 }}>
                      <label style={portalStyles.label}>Payment Method</label>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {['Card', 'Bank Transfer', 'PayTabs Link'].map(m => (
                          <button key={m} onClick={() => setPayMethod(m)}
                            style={{ ...portalStyles.btn, ...(payMethod === m ? portalStyles.btnPrimary : portalStyles.btnOutline) }}>{m}</button>
                        ))}
                      </div>
                    </div>
                    {/* Simulated payment form */}
                    <div style={{ background: 'var(--color-bg-secondary)', borderRadius: 8, padding: 16, marginBottom: 20, border: '1px dashed var(--color-border)' }}>
                      <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8, opacity: 0.6 }}>SIMULATED {payMethod.toUpperCase()} FORM</div>
                      {payMethod === 'Card' && (
                        <div style={{ display: 'grid', gap: 8 }}>
                          <input style={portalStyles.input} placeholder="Card Number: 4242 XXXX XXXX XXXX" disabled />
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                            <input style={portalStyles.input} placeholder="MM/YY" disabled />
                            <input style={portalStyles.input} placeholder="CVV" disabled />
                          </div>
                        </div>
                      )}
                      {payMethod === 'Bank Transfer' && (
                        <div style={{ fontSize: 13, lineHeight: 1.8 }}>
                          <div>Bank: Emirates NBD</div>
                          <div>Account: 1234-5678-9012-3456</div>
                          <div>IBAN: AE07 0331 2345 6789 0123 456</div>
                          <div>SWIFT: EABORAED</div>
                          <div>Reference: {activeCase.loan.accountNumber}</div>
                        </div>
                      )}
                      {payMethod === 'PayTabs Link' && (
                        <div style={{ fontSize: 13 }}>A secure PayTabs payment link will be generated and sent to your registered email.</div>
                      )}
                    </div>
                    <button style={{ ...portalStyles.btn, ...portalStyles.btnPrimary, width: '100%', padding: '14px 20px', fontSize: 15 }} onClick={handlePay}
                      disabled={!payAmount || parseFloat(payAmount) < 100 || parseFloat(payAmount) > activeCase.loan.currentBalance}>
                      Pay Now - AED {payAmount ? parseFloat(payAmount).toLocaleString() : '0'}
                    </button>
                  </div>
                ) : (
                  <div style={{ ...portalStyles.card, textAlign: 'center' }}>
                    <div style={{ fontSize: 48, marginBottom: 8 }}>&#9989;</div>
                    <h3 style={{ color: 'var(--color-success)', marginBottom: 4 }}>Payment Successful</h3>
                    <p style={{ opacity: 0.6, fontSize: 13, marginBottom: 20 }}>Your payment has been processed.</p>
                    <div style={{ background: 'var(--color-bg-secondary)', borderRadius: 8, padding: 16, marginBottom: 20, textAlign: 'left' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 13 }}>
                        <div><strong>Reference:</strong></div><div>{payConfirm.ref}</div>
                        <div><strong>Amount:</strong></div><div>AED {payConfirm.amount.toLocaleString()}</div>
                        <div><strong>Method:</strong></div><div>{payMethod}</div>
                        <div><strong>Date:</strong></div><div>{new Date().toLocaleString()}</div>
                        <div><strong>Account:</strong></div><div>{activeCase.loan.accountNumber}</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                      <button style={{ ...portalStyles.btn, ...portalStyles.btnPrimary }} onClick={handleDownloadReceipt}>Download Receipt</button>
                      <button style={{ ...portalStyles.btn, ...portalStyles.btnOutline }} onClick={() => { setActiveView('dashboard'); resetSubViews(); }}>Back to Dashboard</button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ===== SETTLEMENT ===== */}
            {activeView === 'settlement' && activeCase && (
              <div>
                <button style={{ ...portalStyles.btn, ...portalStyles.btnOutline, marginBottom: 16 }} onClick={() => { setActiveView('dashboard'); resetSubViews(); }}>&#8592; Back to Dashboard</button>
                <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 4 }}>Settlement Options</h2>
                <p style={{ opacity: 0.6, fontSize: 13, marginBottom: 20 }}>{activeCase.loan.bank} - {activeCase.loan.accountNumber} | Outstanding: {formatCurrency(activeCase.loan.currentBalance, activeCase.loan.currency)}</p>

                {!settlementConfirm ? (
                  <>
                    <div style={portalStyles.grid2}>
                      {[
                        { key: 'full' as const, title: 'Full Payment (100%)', desc: 'Clear your account today', amount: activeCase.loan.currentBalance, save: 0 },
                        { key: 'settlement' as const, title: 'Settlement (70%)', desc: 'Save 30% with one-time payment', amount: Math.round(activeCase.loan.currentBalance * 0.7), save: 30 },
                        { key: 'plan' as const, title: 'Payment Plan (12 months)', desc: `AED ${Math.round(activeCase.loan.currentBalance / 12).toLocaleString()}/month for 12 months`, amount: activeCase.loan.currentBalance, save: 0 },
                      ].map(opt => (
                        <div key={opt.key} onClick={() => setSettlementOption(opt.key)}
                          style={{ ...portalStyles.card, cursor: 'pointer', border: settlementOption === opt.key ? '2px solid var(--color-primary)' : '1px solid var(--color-border)', transition: 'all .2s' }}>
                          <h4 style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>{opt.title}</h4>
                          <p style={{ fontSize: 13, opacity: 0.6, marginBottom: 12 }}>{opt.desc}</p>
                          <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--color-primary)', marginBottom: 4 }}>AED {opt.amount.toLocaleString()}</div>
                          {opt.save > 0 && <div style={{ fontSize: 12, color: 'var(--color-success)', fontWeight: 600 }}>You save {opt.save}%</div>}
                        </div>
                      ))}
                    </div>
                    <button style={{ ...portalStyles.btn, ...portalStyles.btnSuccess, width: '100%', marginTop: 16, padding: '14px 20px', fontSize: 15 }}
                      onClick={handleSettlementRequest} disabled={!settlementOption}>
                      Request This Option
                    </button>

                    {/* Existing settlement requests for this case */}
                    {settlements.filter(s => s.caseId === activeCase.id).length > 0 && (
                      <div style={{ ...portalStyles.card, marginTop: 20 }}>
                        <h4 style={portalStyles.cardTitle}>Your Settlement Requests</h4>
                        <table style={portalStyles.table}>
                          <thead><tr>
                            <th style={portalStyles.th}>Date</th><th style={portalStyles.th}>Type</th><th style={portalStyles.th}>Amount</th><th style={portalStyles.th}>Status</th>
                          </tr></thead>
                          <tbody>
                            {settlements.filter(s => s.caseId === activeCase.id).map(s => (
                              <tr key={s.id}>
                                <td style={portalStyles.td}>{formatDate(s.timestamp)}</td>
                                <td style={portalStyles.td}>{s.type === 'full' ? 'Full Payment' : s.type === 'settlement' ? 'Settlement (70%)' : '12-Month Plan'}</td>
                                <td style={portalStyles.td}>AED {s.amount.toLocaleString()}</td>
                                <td style={portalStyles.td}>
                                  <span style={{ ...portalStyles.pill, background: s.status === 'Approved' ? 'rgba(34,197,94,0.12)' : s.status === 'Rejected' ? 'rgba(239,68,68,0.12)' : 'rgba(234,179,8,0.12)',
                                    color: s.status === 'Approved' ? 'var(--color-success)' : s.status === 'Rejected' ? 'var(--color-danger)' : '#b8960f' }}>{s.status}</span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </>
                ) : (
                  <div style={{ ...portalStyles.card, textAlign: 'center' }}>
                    <div style={{ fontSize: 48, marginBottom: 8 }}>&#128230;</div>
                    <h3 style={{ color: 'var(--color-success)', marginBottom: 4 }}>Request Submitted</h3>
                    <p style={{ opacity: 0.6, fontSize: 13, marginBottom: 16 }}>Your settlement request has been submitted for review. You will be notified once a decision is made.</p>
                    <button style={{ ...portalStyles.btn, ...portalStyles.btnOutline }} onClick={() => { setActiveView('dashboard'); resetSubViews(); }}>Back to Dashboard</button>
                  </div>
                )}
              </div>
            )}

            {/* ===== PAYMENT HISTORY ===== */}
            {activeView === 'history' && (
              <div>
                <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 20 }}>Payment History</h2>
                <div style={portalStyles.card}>
                  {(() => {
                    const casePayments = debtorCases.flatMap(c =>
                      c.history.filter(h => h.amountPaid && h.amountPaid > 0).map(h => ({
                        date: h.timestamp, amount: h.amountPaid!, method: h.paymentType || 'N/A', status: 'Confirmed' as const, ref: h.id, source: 'system' as const
                      }))
                    );
                    const localPayments = payments.map(p => ({
                      date: p.timestamp, amount: p.amount, method: p.method, status: p.status, ref: p.reference, source: 'portal' as const
                    }));
                    const allPayments = [...casePayments, ...localPayments].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

                    if (allPayments.length === 0) return <p style={{ textAlign: 'center', opacity: 0.5, padding: 32 }}>No payment records found.</p>;

                    return (
                      <table style={portalStyles.table}>
                        <thead><tr>
                          <th style={portalStyles.th}>Date</th><th style={portalStyles.th}>Amount</th><th style={portalStyles.th}>Method</th><th style={portalStyles.th}>Status</th><th style={portalStyles.th}>Reference</th>
                        </tr></thead>
                        <tbody>
                          {allPayments.map((p, i) => (
                            <tr key={i}>
                              <td style={portalStyles.td}>{formatDate(p.date)}</td>
                              <td style={portalStyles.td}>AED {p.amount.toLocaleString()}</td>
                              <td style={portalStyles.td}>{p.method}</td>
                              <td style={portalStyles.td}>
                                <span style={{ ...portalStyles.pill, background: 'rgba(34,197,94,0.12)', color: 'var(--color-success)' }}>{p.status}</span>
                              </td>
                              <td style={{ ...portalStyles.td, fontSize: 11, fontFamily: 'monospace' }}>{p.ref}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    );
                  })()}
                </div>
              </div>
            )}

            {/* ===== COMMUNICATION ===== */}
            {activeView === 'messages' && (
              <div>
                <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 20 }}>Communication</h2>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  {/* Send Message */}
                  <div style={portalStyles.card}>
                    <h4 style={portalStyles.cardTitle}>Send Message to Agent</h4>
                    <textarea style={{ ...portalStyles.input, minHeight: 100, resize: 'vertical' }} placeholder="Type your message here..." value={msgText} onChange={e => setMsgText(e.target.value)} />
                    <button style={{ ...portalStyles.btn, ...portalStyles.btnPrimary, marginTop: 12, width: '100%' }} onClick={handleSendMessage} disabled={!msgText.trim()}>Send Message</button>
                  </div>

                  {/* Request Callback */}
                  <div style={portalStyles.card}>
                    <h4 style={portalStyles.cardTitle}>Request Callback</h4>
                    <p style={{ fontSize: 13, opacity: 0.6, marginBottom: 12 }}>Select your preferred date and time for a callback from your agent.</p>
                    <input type="datetime-local" style={portalStyles.input} value={callbackTime} onChange={e => setCallbackTime(e.target.value)} />
                    <button style={{ ...portalStyles.btn, ...portalStyles.btnSuccess, marginTop: 12, width: '100%' }} onClick={handleCallback} disabled={!callbackTime}>
                      {callbackSent ? 'Callback Requested!' : 'Request Callback'}
                    </button>
                  </div>
                </div>

                {/* Messages Timeline */}
                <div style={{ ...portalStyles.card, marginTop: 16 }}>
                  <h4 style={portalStyles.cardTitle}>Message History</h4>
                  {messages.length === 0 ? (
                    <p style={{ textAlign: 'center', opacity: 0.5, padding: 24 }}>No messages yet.</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {messages.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).map(m => (
                        <div key={m.id} style={{ padding: 12, borderRadius: 8, background: m.direction === 'sent' ? 'rgba(59,130,246,0.06)' : 'var(--color-bg-secondary)', borderLeft: `3px solid ${m.direction === 'sent' ? 'var(--color-primary)' : 'var(--color-success)'}` }}>
                          <div style={{ fontSize: 11, opacity: 0.5, marginBottom: 4 }}>{formatDate(m.timestamp)} | {m.direction === 'sent' ? 'You' : 'Agent'}</div>
                          <div style={{ fontSize: 13 }}>{m.message}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ===== DOCUMENTS ===== */}
            {activeView === 'documents' && (
              <div>
                <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 20 }}>Documents</h2>
                <div style={portalStyles.grid2}>
                  <div style={portalStyles.card}>
                    <h4 style={portalStyles.cardTitle}>Download Liability Statement</h4>
                    <p style={{ fontSize: 13, opacity: 0.6, marginBottom: 16 }}>A complete statement of all your outstanding accounts and balances.</p>
                    <button style={{ ...portalStyles.btn, ...portalStyles.btnPrimary, width: '100%' }} onClick={downloadLiabilityStatement}>Download Statement</button>
                  </div>

                  <div style={portalStyles.card}>
                    <h4 style={portalStyles.cardTitle}>Download Payment Schedule</h4>
                    <p style={{ fontSize: 13, opacity: 0.6, marginBottom: 16 }}>
                      {settlements.some(s => s.type === 'plan') ? 'Your approved payment plan schedule.' : 'No active payment plan. Request a settlement first.'}
                    </p>
                    <button style={{ ...portalStyles.btn, ...portalStyles.btnOutline, width: '100%' }}
                      disabled={!settlements.some(s => s.type === 'plan')}
                      onClick={() => {
                        const plan = settlements.find(s => s.type === 'plan');
                        if (!plan) return;
                        const monthly = Math.round(plan.amount / 12);
                        const lines = Array.from({ length: 12 }, (_, i) => `Month ${i + 1}: AED ${monthly.toLocaleString()}`);
                        const text = ['=== PAYMENT SCHEDULE ===', `Debtor: ${debtorName}`, `Total: AED ${plan.amount.toLocaleString()}`, '', ...lines, '', 'RecoVantage Private Limited'].join('\n');
                        const blob = new Blob([text], { type: 'text/plain' });
                        const a = document.createElement('a');
                        a.href = URL.createObjectURL(blob);
                        a.download = 'payment_schedule.txt';
                        a.click();
                      }}>
                      Download Schedule
                    </button>
                  </div>

                  <div style={portalStyles.card}>
                    <h4 style={portalStyles.cardTitle}>Upload Documents</h4>
                    <p style={{ fontSize: 13, opacity: 0.6, marginBottom: 16 }}>Upload supporting documents (salary certificate, bank statements, etc.)</p>
                    <input type="file" style={{ fontSize: 13 }} accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" onChange={() => {
                      alert('Document uploaded successfully (demo). In production, this would be securely stored.');
                    }} />
                  </div>
                </div>
              </div>
            )}

            {/* ===== FAQ ===== */}
            {activeView === 'faq' && (
              <div>
                <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 20 }}>Frequently Asked Questions</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {FAQ_ITEMS.map((item, i) => (
                    <div key={i} style={{ ...portalStyles.card, padding: 0, overflow: 'hidden', marginBottom: 0 }}>
                      <button onClick={() => setExpandedFaq(expandedFaq === i ? null : i)}
                        style={{ width: '100%', padding: '16px 20px', border: 'none', background: 'transparent', textAlign: 'left', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 14, fontWeight: 600, color: 'var(--color-text-primary)' }}>
                        <span>{item.q}</span>
                        <span style={{ fontSize: 18, opacity: 0.4, transform: expandedFaq === i ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}>&#9660;</span>
                      </button>
                      {expandedFaq === i && (
                        <div style={{ padding: '0 20px 16px', fontSize: 13, lineHeight: 1.7, opacity: 0.75, borderTop: '1px solid var(--color-border)' }}>
                          {item.a}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div style={{ textAlign: 'center', padding: '24px 32px', fontSize: 11, opacity: 0.4, borderTop: '1px solid var(--color-border)' }}>
            RecoVantage Private Limited | Licensed Debt Collection Agency | CBUAE Reg. No. DC-2024-0847 | All rights reserved
          </div>
        </>
      )}
    </div>
  );
};

export default DebtorPortal;