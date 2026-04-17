import React, { useState, useEffect, useCallback } from 'react';
import { EnrichedCase, User } from '../../types';

interface SkipTracingProps {
  caseData: EnrichedCase;
  currentUser: User;
}

type Confidence = 'High' | 'Medium' | 'Low';

interface FoundPhone { number: string; source: string; confidence: Confidence; dateFound: string; }
interface FoundAddress { address: string; source: string; confidence: Confidence; dateFound: string; }
interface EmployerInfo { company: string; designation: string; salaryRange: string; source: string; confidence: Confidence; dateFound: string; }
interface SocialProfile { platform: string; url: string; confidence: Confidence; dateFound: string; }
interface VehicleInfo { plate: string; make: string; model: string; year: string; source: string; confidence: Confidence; dateFound: string; }
interface ImmigrationInfo { status: 'In UAE' | 'Left UAE'; lastEntryDate: string; source: string; confidence: Confidence; dateFound: string; }

interface TraceResult {
  id: string;
  traceDate: string;
  tracedBy: string;
  phones: FoundPhone[];
  addresses: FoundAddress[];
  employer: EmployerInfo | null;
  socialProfiles: SocialProfile[];
  vehicle: VehicleInfo | null;
  immigration: ImmigrationInfo;
}

const STORAGE_KEY = (caseId: string) => `rv_skip_trace_${caseId}`;
const COST_PER_TRACE = 15;

const PHONE_SOURCES = ['AECB', 'Etihad Bureau', 'MOL Records', 'Telecom Registry'];
const ADDRESS_SOURCES = ['AECB', 'Etihad Bureau', 'Emirates ID Authority', 'DEWA Records'];
const UAE_AREAS = ['Dubai Marina', 'Al Barsha', 'Jumeirah Village Circle', 'Business Bay', 'Al Nahda, Sharjah', 'Khalifa City, Abu Dhabi', 'Al Majaz, Sharjah', 'Deira, Dubai'];
const COMPANIES = ['Emirates Group', 'ADNOC', 'Emaar Properties', 'Dubai Holding', 'Etisalat', 'Majid Al Futtaim', 'Al Futtaim Group', 'Noon.com', 'Careem'];
const DESIGNATIONS = ['Senior Manager', 'Sales Executive', 'Operations Coordinator', 'Accountant', 'IT Specialist', 'Engineer', 'Marketing Manager'];
const SALARY_RANGES = ['AED 5,000 - 8,000', 'AED 8,000 - 12,000', 'AED 12,000 - 18,000', 'AED 18,000 - 30,000', 'AED 30,000+'];

const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
const randPhone = () => `+971 5${Math.floor(Math.random() * 10)} ${String(Math.floor(Math.random() * 9000000 + 1000000))}`;
const randConf = (): Confidence => pick(['High', 'Medium', 'Low'] as Confidence[]);
const today = () => new Date().toISOString().split('T')[0];

function generateMockResult(currentUser: User): TraceResult {
  const phoneCount = 2 + Math.floor(Math.random() * 3);
  const addressCount = 1 + Math.floor(Math.random() * 2);
  const dt = today();

  const phones: FoundPhone[] = Array.from({ length: phoneCount }, () => ({
    number: randPhone(), source: pick(PHONE_SOURCES), confidence: randConf(), dateFound: dt,
  }));
  const addresses: FoundAddress[] = Array.from({ length: addressCount }, () => ({
    address: `Apt ${Math.floor(Math.random() * 2000 + 100)}, Tower ${Math.floor(Math.random() * 20 + 1)}, ${pick(UAE_AREAS)}`,
    source: pick(ADDRESS_SOURCES), confidence: randConf(), dateFound: dt,
  }));
  const employer: EmployerInfo = {
    company: pick(COMPANIES), designation: pick(DESIGNATIONS), salaryRange: pick(SALARY_RANGES),
    source: 'MOL/MOHRE Records', confidence: pick(['High', 'Medium'] as Confidence[]), dateFound: dt,
  };
  const socialProfiles: SocialProfile[] = [
    { platform: 'LinkedIn', url: 'https://linkedin.com/in/profile-' + Math.floor(Math.random() * 99999), confidence: 'Medium', dateFound: dt },
    ...(Math.random() > 0.5 ? [{ platform: 'Facebook', url: 'https://facebook.com/profile/' + Math.floor(Math.random() * 99999), confidence: 'Low' as Confidence, dateFound: dt }] : []),
  ];
  const vehicle: VehicleInfo | null = Math.random() > 0.4 ? {
    plate: `${pick(['Dubai', 'Abu Dhabi', 'Sharjah'])} ${String.fromCharCode(65 + Math.floor(Math.random() * 26))} ${Math.floor(Math.random() * 90000 + 10000)}`,
    make: pick(['Toyota', 'Nissan', 'Honda', 'BMW', 'Mercedes', 'Lexus']),
    model: pick(['Camry', 'Patrol', 'Accord', 'X5', 'C-Class', 'RX350']),
    year: String(2018 + Math.floor(Math.random() * 8)), source: 'RTA Vehicle Registry',
    confidence: 'High', dateFound: dt,
  } : null;
  const immigration: ImmigrationInfo = {
    status: Math.random() > 0.2 ? 'In UAE' : 'Left UAE',
    lastEntryDate: `202${4 + Math.floor(Math.random() * 2)}-${String(Math.floor(Math.random() * 12 + 1)).padStart(2, '0')}-${String(Math.floor(Math.random() * 28 + 1)).padStart(2, '0')}`,
    source: 'ICA / GDRFA Records', confidence: 'High', dateFound: dt,
  };

  return {
    id: `trace_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    traceDate: new Date().toISOString(), tracedBy: currentUser.name,
    phones, addresses, employer, socialProfiles, vehicle, immigration,
  };
}

const confidenceBadge = (c: Confidence) => {
  const colors: Record<Confidence, string> = { High: 'var(--color-success)', Medium: 'var(--color-warning)', Low: 'var(--color-danger)' };
  return (
    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 4, background: colors[c], color: 'var(--color-bg-secondary)', textTransform: 'uppercase' }}>
      {c}
    </span>
  );
};

const SkipTracing: React.FC<SkipTracingProps> = ({ caseData, currentUser }) => {
  const [traceHistory, setTraceHistory] = useState<TraceResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeResult, setActiveResult] = useState<TraceResult | null>(null);
  const [addedItems, setAddedItems] = useState<Set<string>>(new Set());

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY(caseData.id));
      if (raw) {
        const history: TraceResult[] = JSON.parse(raw);
        setTraceHistory(history);
        if (history.length > 0) setActiveResult(history[0]);
      }
    } catch { /* ignore */ }
  }, [caseData.id]);

  const saveHistory = useCallback((history: TraceResult[]) => {
    localStorage.setItem(STORAGE_KEY(caseData.id), JSON.stringify(history));
  }, [caseData.id]);

  const runTrace = () => {
    setLoading(true);
    setTimeout(() => {
      const result = generateMockResult(currentUser);
      const updated = [result, ...traceHistory];
      setTraceHistory(updated);
      setActiveResult(result);
      saveHistory(updated);
      setLoading(false);
    }, 2000);
  };

  const handleAddToCase = (type: string, value: string) => {
    const key = `${type}_${value}`;
    setAddedItems(prev => new Set(prev).add(key));
  };

  const sectionCard: React.CSSProperties = {
    background: 'var(--color-bg-secondary)', borderRadius: 12, padding: 16,
    border: '1px solid var(--color-border)', marginBottom: 14,
  };
  const sectionHead: React.CSSProperties = {
    fontSize: 13, fontWeight: 700, color: 'var(--color-text-primary)',
    marginBottom: 10, paddingBottom: 6, borderBottom: '1px solid var(--color-border)',
  };
  const rowStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
    padding: '8px 0', borderBottom: '1px solid var(--color-border)',
  };
  const addBtnStyle = (added: boolean): React.CSSProperties => ({
    fontSize: 11, padding: '3px 10px', borderRadius: 6, border: 'none', cursor: added ? 'default' : 'pointer',
    background: added ? 'var(--color-success)' : 'var(--color-primary)',
    color: 'var(--color-bg-secondary)', fontWeight: 600, opacity: added ? 0.7 : 1,
    transition: 'opacity 0.15s',
  });

  return (
    <div style={{ padding: 24 }}>
      <div style={{ maxWidth: 860, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-text-primary)', margin: 0 }}>Skip Tracing Bureau</h2>
            <p style={{ fontSize: 12, color: 'var(--color-text-tertiary)', margin: '4px 0 0' }}>
              Case: {caseData.loan.accountNumber} | Debtor: {caseData.debtor.name}
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 11, color: 'var(--color-text-tertiary)', padding: '4px 10px', borderRadius: 6, background: 'var(--color-bg-tertiary)', border: '1px solid var(--color-border)' }}>
              Bureau lookup cost: AED {COST_PER_TRACE} per trace
            </span>
            <button
              onClick={runTrace}
              disabled={loading}
              style={{
                padding: '10px 22px', borderRadius: 10, border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
                background: 'var(--color-primary)', color: 'var(--color-bg-secondary)',
                fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8,
                opacity: loading ? 0.6 : 1, transition: 'opacity 0.15s',
              }}
            >
              {loading && (
                <span style={{ width: 14, height: 14, border: '2px solid var(--color-bg-secondary)', borderTopColor: 'transparent', borderRadius: '50%', display: 'inline-block', animation: 'rv-spin 0.8s linear infinite' }} />
              )}
              {loading ? 'Running Trace...' : 'Run Skip Trace'}
            </button>
          </div>
        </div>

        {/* Trace History Bar */}
        {traceHistory.length > 0 && (
          <div style={{ ...sectionCard, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)', marginRight: 4 }}>Trace History ({traceHistory.length}):</span>
            {traceHistory.map((t, i) => (
              <button
                key={t.id}
                onClick={() => setActiveResult(t)}
                style={{
                  fontSize: 11, padding: '4px 10px', borderRadius: 6, border: '1px solid var(--color-border)',
                  background: activeResult?.id === t.id ? 'var(--color-primary)' : 'var(--color-bg-muted)',
                  color: activeResult?.id === t.id ? 'var(--color-bg-secondary)' : 'var(--color-text-secondary)',
                  cursor: 'pointer', fontWeight: 600, transition: 'all 0.15s',
                }}
              >
                {new Date(t.traceDate).toLocaleDateString()} by {t.tracedBy}
              </button>
            ))}
          </div>
        )}

        {/* Loading Spinner */}
        {loading && (
          <div style={{ textAlign: 'center', padding: 60 }}>
            <div style={{ width: 40, height: 40, border: '3px solid var(--color-border)', borderTopColor: 'var(--color-primary)', borderRadius: '50%', margin: '0 auto 16px', animation: 'rv-spin 0.8s linear infinite' }} />
            <p style={{ fontSize: 14, color: 'var(--color-text-secondary)', fontWeight: 600 }}>Querying bureau databases...</p>
            <p style={{ fontSize: 12, color: 'var(--color-text-tertiary)' }}>AECB, Etihad Bureau, MOL/MOHRE, ICA/GDRFA</p>
          </div>
        )}

        {/* Results */}
        {!loading && activeResult && (
          <div>
            {/* Phone Numbers */}
            <div style={sectionCard}>
              <div style={sectionHead}>Phone Numbers Found ({activeResult.phones.length})</div>
              {activeResult.phones.map((p, i) => {
                const key = `phone_${p.number}`;
                const added = addedItems.has(key);
                return (
                  <div key={i} style={rowStyle}>
                    <div style={{ flex: 1 }}>
                      <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text-primary)', fontFamily: 'monospace' }}>{p.number}</span>
                      <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginTop: 2 }}>Source: {p.source} | Found: {p.dateFound}</div>
                    </div>
                    {confidenceBadge(p.confidence)}
                    <button style={addBtnStyle(added)} onClick={() => handleAddToCase('phone', p.number)}>
                      {added ? 'Added' : 'Add to Case'}
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Addresses */}
            <div style={sectionCard}>
              <div style={sectionHead}>Addresses Found ({activeResult.addresses.length})</div>
              {activeResult.addresses.map((a, i) => {
                const key = `address_${a.address}`;
                const added = addedItems.has(key);
                return (
                  <div key={i} style={rowStyle}>
                    <div style={{ flex: 1 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)' }}>{a.address}</span>
                      <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginTop: 2 }}>Source: {a.source} | Found: {a.dateFound}</div>
                    </div>
                    {confidenceBadge(a.confidence)}
                    <button style={addBtnStyle(added)} onClick={() => handleAddToCase('address', a.address)}>
                      {added ? 'Added' : 'Add to Case'}
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Employer Info */}
            {activeResult.employer && (
              <div style={sectionCard}>
                <div style={sectionHead}>Employer Information</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                  {[
                    { label: 'Company', value: activeResult.employer.company },
                    { label: 'Designation', value: activeResult.employer.designation },
                    { label: 'Salary Range', value: activeResult.employer.salaryRange },
                  ].map(item => (
                    <div key={item.label} style={{ padding: 12, borderRadius: 8, background: 'var(--color-bg-tertiary)' }}>
                      <div style={{ fontSize: 10, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>{item.label}</div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)' }}>{item.value}</div>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: 'var(--color-text-tertiary)' }}>
                  Source: {activeResult.employer.source} | {confidenceBadge(activeResult.employer.confidence)}
                </div>
              </div>
            )}

            {/* Social Media */}
            {activeResult.socialProfiles.length > 0 && (
              <div style={sectionCard}>
                <div style={sectionHead}>Social Media Profiles</div>
                {activeResult.socialProfiles.map((s, i) => (
                  <div key={i} style={rowStyle}>
                    <div style={{ flex: 1 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)' }}>{s.platform}</span>
                      <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginTop: 2 }}>{s.url}</div>
                    </div>
                    {confidenceBadge(s.confidence)}
                  </div>
                ))}
              </div>
            )}

            {/* Vehicle Registration */}
            {activeResult.vehicle && (
              <div style={sectionCard}>
                <div style={sectionHead}>Vehicle Registration</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12 }}>
                  {[
                    { label: 'Plate', value: activeResult.vehicle.plate },
                    { label: 'Make', value: activeResult.vehicle.make },
                    { label: 'Model', value: activeResult.vehicle.model },
                    { label: 'Year', value: activeResult.vehicle.year },
                  ].map(item => (
                    <div key={item.label} style={{ padding: 10, borderRadius: 8, background: 'var(--color-bg-tertiary)' }}>
                      <div style={{ fontSize: 10, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 }}>{item.label}</div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)' }}>{item.value}</div>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: 'var(--color-text-tertiary)' }}>
                  Source: {activeResult.vehicle.source} | {confidenceBadge(activeResult.vehicle.confidence)}
                </div>
              </div>
            )}

            {/* Immigration Status */}
            <div style={sectionCard}>
              <div style={sectionHead}>Immigration Status</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{
                  padding: '10px 20px', borderRadius: 10,
                  background: activeResult.immigration.status === 'In UAE' ? 'var(--color-success)' : 'var(--color-danger)',
                  color: 'var(--color-bg-secondary)', fontWeight: 700, fontSize: 14,
                }}>
                  {activeResult.immigration.status}
                </div>
                <div>
                  <div style={{ fontSize: 13, color: 'var(--color-text-primary)', fontWeight: 600 }}>
                    Last Entry: {activeResult.immigration.lastEntryDate}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginTop: 2 }}>
                    Source: {activeResult.immigration.source} | {confidenceBadge(activeResult.immigration.confidence)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Empty State */}
        {!loading && !activeResult && traceHistory.length === 0 && (
          <div style={{ textAlign: 'center', padding: 60, background: 'var(--color-bg-secondary)', borderRadius: 12, border: '1px solid var(--color-border)' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>{'\uD83D\uDD0D'}</div>
            <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: 4 }}>No Trace Results Yet</p>
            <p style={{ fontSize: 13, color: 'var(--color-text-tertiary)', maxWidth: 400, margin: '0 auto' }}>
              Run a skip trace to search AECB, Etihad Bureau, MOL/MOHRE, and other GCC databases for debtor contact information.
            </p>
          </div>
        )}
      </div>

      <style>{`
        @keyframes rv-spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default SkipTracing;
