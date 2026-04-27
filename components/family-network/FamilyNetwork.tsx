import React, { useMemo, useState } from 'react';
import { EnrichedCase, User, Role } from '../../types';
import { ICONS } from '../../constants';
import { formatCurrency } from '../../utils';

// ── Network graph: nodes (debtors) + edges (shared CNIC/phone/email/address) ─
type LinkType = 'cnic' | 'phone' | 'email' | 'address';

interface Node {
  id: string;
  case: EnrichedCase;
  x: number;
  y: number;
}

interface Edge {
  source: string;
  target: string;
  type: LinkType;
  label: string;
}

const normalize = (s: string) => (s || '').toLowerCase().trim().replace(/\s+/g, ' ');
const normalizePhone = (s: string) => (s || '').replace(/\D/g, '').replace(/^(0092|92|0)/, '');

const LINK_COLOR: Record<LinkType, string> = {
  cnic: '#ef4444',     // red — same person across banks
  phone: '#3b82f6',    // blue
  email: '#a855f7',    // purple
  address: '#f59e0b',  // amber
};

interface FamilyNetworkProps {
  cases: EnrichedCase[];
  currentUser: User;
  onSelectCase: (caseId: string) => void;
}

const FamilyNetwork: React.FC<FamilyNetworkProps> = ({ cases, currentUser, onSelectCase }) => {
  const [seedCaseId, setSeedCaseId] = useState<string>('');
  const [search, setSearch] = useState('');

  const myCases = useMemo(() => {
    return currentUser.role === Role.OFFICER
      ? cases.filter(c => c.assignedOfficerId === currentUser.id)
      : cases;
  }, [cases, currentUser]);

  const filteredCaseList = useMemo(() => {
    if (!search) return myCases.slice(0, 200);
    const q = search.toLowerCase();
    return myCases.filter(c =>
      c.debtor.name.toLowerCase().includes(q) ||
      (c.debtor.cnic || '').toLowerCase().includes(q) ||
      c.loan.accountNumber.toLowerCase().includes(q),
    ).slice(0, 200);
  }, [myCases, search]);

  // ── Build graph from seed case ────────────────────────────────────────
  const graph = useMemo(() => {
    if (!seedCaseId) return { nodes: [] as Node[], edges: [] as Edge[], maxConnections: 0, totalLinkedBalance: 0 };

    const seed = cases.find(c => c.id === seedCaseId);
    if (!seed) return { nodes: [] as Node[], edges: [] as Edge[], maxConnections: 0, totalLinkedBalance: 0 };

    // BFS up to 2 hops to find related cases
    const visited = new Set<string>([seed.id]);
    const queue: { id: string; depth: number }[] = [{ id: seed.id, depth: 0 }];
    const edges: Edge[] = [];

    while (queue.length > 0) {
      const { id: currentId, depth } = queue.shift()!;
      if (depth >= 2) continue;
      const current = cases.find(c => c.id === currentId);
      if (!current) continue;

      // Find all related cases
      cases.forEach(other => {
        if (other.id === currentId || visited.has(other.id)) return;

        // Same CNIC
        if (current.debtor.cnic && other.debtor.cnic && normalize(current.debtor.cnic) === normalize(other.debtor.cnic)) {
          edges.push({ source: currentId, target: other.id, type: 'cnic', label: 'Same CNIC' });
          if (!visited.has(other.id)) { visited.add(other.id); queue.push({ id: other.id, depth: depth + 1 }); }
          return;
        }

        // Same phone
        const myPhones = (current.debtor.phones || []).map(normalizePhone).filter(p => p.length >= 8);
        const otherPhones = (other.debtor.phones || []).map(normalizePhone).filter(p => p.length >= 8);
        const sharedPhone = myPhones.find(p => otherPhones.includes(p));
        if (sharedPhone) {
          edges.push({ source: currentId, target: other.id, type: 'phone', label: `Phone: +92${sharedPhone}` });
          if (!visited.has(other.id)) { visited.add(other.id); queue.push({ id: other.id, depth: depth + 1 }); }
          return;
        }

        // Same email
        const myEmails = (current.debtor.emails || []).map(normalize);
        const otherEmails = (other.debtor.emails || []).map(normalize);
        const sharedEmail = myEmails.find(e => otherEmails.includes(e) && e.includes('@'));
        if (sharedEmail) {
          edges.push({ source: currentId, target: other.id, type: 'email', label: `Email: ${sharedEmail}` });
          if (!visited.has(other.id)) { visited.add(other.id); queue.push({ id: other.id, depth: depth + 1 }); }
          return;
        }

        // Same address (long enough to avoid trivial)
        if (current.debtor.address && other.debtor.address && normalize(current.debtor.address) === normalize(other.debtor.address) && current.debtor.address.length >= 15) {
          edges.push({ source: currentId, target: other.id, type: 'address', label: 'Same address' });
          if (!visited.has(other.id)) { visited.add(other.id); queue.push({ id: other.id, depth: depth + 1 }); }
        }
      });
    }

    // Layout: seed in center, others around in concentric circles
    const ids = Array.from(visited);
    const W = 800, H = 500, cx = W / 2, cy = H / 2;
    const nodes: Node[] = ids.map((id, i) => {
      if (id === seed.id) {
        return { id, case: cases.find(c => c.id === id)!, x: cx, y: cy };
      }
      // Find depth (how far from seed)
      const conn = edges.find(e => e.source === id || e.target === id);
      const ringIdx = ids.indexOf(id) - 1;
      const total = ids.length - 1;
      const angle = (ringIdx / total) * Math.PI * 2;
      const radius = 180;
      return { id, case: cases.find(c => c.id === id)!, x: cx + Math.cos(angle) * radius, y: cy + Math.sin(angle) * radius };
    });

    const totalLinkedBalance = nodes.reduce((s, n) => s + n.case.loan.currentBalance, 0);
    const maxConnections = Math.max(0, ...ids.map(id => edges.filter(e => e.source === id || e.target === id).length));

    return { nodes, edges, maxConnections, totalLinkedBalance };
  }, [seedCaseId, cases]);

  const nodeMap = useMemo(() => new Map(graph.nodes.map(n => [n.id, n])), [graph.nodes]);

  return (
    <div className="space-y-6 animate-page-enter">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-text-primary flex items-center gap-3">
            <span className="text-3xl">🕸️</span>
            Debtor Network Graph
          </h1>
          <p className="text-sm text-text-secondary mt-1">Visualize family / shared / cross-bank connections — pick a seed case</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Seed picker */}
        <div className="panel overflow-hidden flex flex-col" style={{ maxHeight: 'calc(100vh - 200px)' }}>
          <div className="p-3 border-b border-[var(--color-border)]">
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search seed case..." className="w-full px-3 py-2 text-xs rounded-lg" />
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-[var(--color-border)]">
            {filteredCaseList.length === 0 ? (
              <p className="p-6 text-center text-xs text-text-secondary">No cases.</p>
            ) : filteredCaseList.map(c => (
              <button
                key={c.id}
                onClick={() => setSeedCaseId(c.id)}
                className={`w-full text-left p-3 hover:bg-[var(--color-bg-muted)] ${seedCaseId === c.id ? 'bg-[var(--color-primary-glow)] border-l-2 border-[var(--color-primary)]' : ''}`}
              >
                <p className="text-sm font-semibold truncate">{c.debtor.name}</p>
                <p className="text-[10px] text-text-tertiary truncate">{c.loan.bank} • {c.loan.accountNumber}</p>
                {c.debtor.cnic && <p className="text-[10px] text-text-tertiary truncate">CNIC: {c.debtor.cnic}</p>}
              </button>
            ))}
          </div>
        </div>

        {/* Graph */}
        <div className="lg:col-span-3 space-y-3">
          {!seedCaseId ? (
            <div className="panel p-12 text-center">
              <p className="text-sm text-text-secondary">Pick a seed case to see its network.</p>
              <p className="text-xs text-text-tertiary mt-2">Up to 2-hop connections shown via shared CNIC, phone, email, or address.</p>
            </div>
          ) : (
            <>
              {/* Legend & summary */}
              <div className="panel p-3 flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3 flex-wrap text-[11px]">
                  <span className="font-bold">{graph.nodes.length} cases</span>
                  <span>•</span>
                  <span>{graph.edges.length} links</span>
                  <span>•</span>
                  <span className="font-bold">{formatCurrency(graph.totalLinkedBalance, 'AED')} linked</span>
                </div>
                <div className="flex items-center gap-3 text-[10px]">
                  <span className="flex items-center gap-1"><span className="w-3 h-0.5" style={{ background: LINK_COLOR.cnic }} />Same CNIC</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-0.5" style={{ background: LINK_COLOR.phone }} />Phone</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-0.5" style={{ background: LINK_COLOR.email }} />Email</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-0.5" style={{ background: LINK_COLOR.address }} />Address</span>
                </div>
              </div>

              {/* SVG graph */}
              <div className="panel p-4">
                {graph.nodes.length === 1 ? (
                  <div className="text-center py-8">
                    <p className="text-sm text-text-secondary">No connections found for this case.</p>
                    <p className="text-xs text-text-tertiary mt-2">Debtor stands alone — no shared CNIC, phone, email, or address with other cases.</p>
                  </div>
                ) : (
                  <svg viewBox="0 0 800 500" className="w-full h-auto" style={{ maxHeight: '600px' }}>
                    {/* Edges */}
                    {graph.edges.map((e, i) => {
                      const s = nodeMap.get(e.source);
                      const t = nodeMap.get(e.target);
                      if (!s || !t) return null;
                      return (
                        <g key={i}>
                          <line x1={s.x} y1={s.y} x2={t.x} y2={t.y} stroke={LINK_COLOR[e.type]} strokeWidth={2} strokeOpacity={0.6} />
                          <text
                            x={(s.x + t.x) / 2}
                            y={(s.y + t.y) / 2 - 4}
                            fontSize="9"
                            fill={LINK_COLOR[e.type]}
                            textAnchor="middle"
                            fontWeight="bold"
                          >
                            {e.label}
                          </text>
                        </g>
                      );
                    })}
                    {/* Nodes */}
                    {graph.nodes.map(n => {
                      const isSeed = n.id === seedCaseId;
                      const c = n.case;
                      return (
                        <g key={n.id} onClick={() => onSelectCase(n.id)} style={{ cursor: 'pointer' }}>
                          <circle
                            cx={n.x}
                            cy={n.y}
                            r={isSeed ? 36 : 28}
                            fill={isSeed ? '#7c3aed' : '#3b82f6'}
                            stroke="#fff"
                            strokeWidth={3}
                          />
                          <text x={n.x} y={n.y - 2} fontSize="10" fill="#fff" fontWeight="bold" textAnchor="middle">
                            {c.debtor.name.slice(0, 12)}
                          </text>
                          <text x={n.x} y={n.y + 10} fontSize="8" fill="#fff" textAnchor="middle" opacity={0.85}>
                            {c.loan.bank.slice(0, 14)}
                          </text>
                          <text x={n.x} y={n.y + 20} fontSize="8" fill="#fff" textAnchor="middle" opacity={0.85}>
                            {formatCurrency(c.loan.currentBalance, c.loan.currency)}
                          </text>
                        </g>
                      );
                    })}
                  </svg>
                )}
              </div>

              {/* Linked cases list */}
              {graph.nodes.length > 1 && (
                <div className="panel">
                  <div className="p-3 border-b border-[var(--color-border)]">
                    <h3 className="text-sm font-bold">Linked Cases ({graph.nodes.length})</h3>
                  </div>
                  <div className="divide-y divide-[var(--color-border)]">
                    {graph.nodes.map(n => {
                      const isSeed = n.id === seedCaseId;
                      const incomingEdges = graph.edges.filter(e => e.target === n.id || e.source === n.id);
                      return (
                        <button
                          key={n.id}
                          onClick={() => onSelectCase(n.id)}
                          className="w-full text-left p-3 hover:bg-[var(--color-bg-muted)] flex items-center justify-between gap-3"
                        >
                          <div className="flex items-center gap-3">
                            {isSeed && <span className="text-lg">🌟</span>}
                            <div>
                              <p className="text-sm font-semibold">{n.case.debtor.name}</p>
                              <p className="text-[10px] text-text-tertiary">{n.case.loan.bank} • {n.case.loan.accountNumber}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold">{formatCurrency(n.case.loan.currentBalance, n.case.loan.currency)}</span>
                            {!isSeed && (
                              <div className="flex gap-1">
                                {Array.from(new Set(incomingEdges.map(e => e.type))).map(t => (
                                  <span key={t} className="w-2 h-2 rounded-full" style={{ background: LINK_COLOR[t] }} title={t} />
                                ))}
                              </div>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default FamilyNetwork;
