import React, { useState, useCallback, useMemo } from 'react';
import { Role } from '../../types';

// ─── Types ───────────────────────────────────────────────────────────────────

type TriggerType =
  | 'ptp_broken'
  | 'case_stale'
  | 'dpd_threshold'
  | 'status_changed'
  | 'payment_received'
  | 'high_value'
  | 'no_contact_days'
  | 'officer_overloaded';

type ActionType =
  | 'change_status'
  | 'send_notification'
  | 'reassign_manager'
  | 'add_remark'
  | 'escalate_legal'
  | 'flag_high_priority'
  | 'create_task';

type ConditionOperator = 'equals' | 'gt' | 'lt' | 'contains' | 'not_equals';

interface Condition {
  field: string;
  operator: ConditionOperator;
  value: string;
}

interface RuleAction {
  type: ActionType;
  params: Record<string, string>;
}

export interface WorkflowRule {
  id: string;
  name: string;
  description: string;
  trigger: TriggerType;
  triggerParams: Record<string, string>;
  conditions: Condition[];
  actions: RuleAction[];
  enabled: boolean;
  runCount: number;
  lastRun?: string;
  createdAt: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const TRIGGER_LABELS: Record<TriggerType, string> = {
  ptp_broken: 'PTP Broken',
  case_stale: 'Case Stale (N days)',
  dpd_threshold: 'DPD Threshold Crossed',
  status_changed: 'Status Changed',
  payment_received: 'Payment Received',
  high_value: 'High-Value Case (>100K)',
  no_contact_days: 'No Contact (N days)',
  officer_overloaded: 'Officer Overloaded (>N cases)',
};

const ACTION_LABELS: Record<ActionType, string> = {
  change_status: 'Change CRM Status',
  send_notification: 'Send Notification',
  reassign_manager: 'Escalate to Manager',
  add_remark: 'Add Remark',
  escalate_legal: 'Escalate to Legal',
  flag_high_priority: 'Flag as High Priority',
  create_task: 'Create Task',
};

const TRIGGER_COLORS: Record<TriggerType, string> = {
  ptp_broken: 'bg-red-100 text-red-700',
  case_stale: 'bg-orange-100 text-orange-700',
  dpd_threshold: 'bg-amber-100 text-amber-700',
  status_changed: 'bg-blue-100 text-blue-700',
  payment_received: 'bg-green-100 text-green-700',
  high_value: 'bg-purple-100 text-purple-700',
  no_contact_days: 'bg-pink-100 text-pink-700',
  officer_overloaded: 'bg-gray-100 text-gray-700',
};

const LS_KEY = 'rv_workflow_rules';
const LS_LOG_KEY = 'rv_workflow_log';

function loadRules(): WorkflowRule[] {
  try {
    const s = localStorage.getItem(LS_KEY);
    return s ? JSON.parse(s) : defaultRules();
  } catch { return defaultRules(); }
}

function saveRules(rules: WorkflowRule[]) {
  localStorage.setItem(LS_KEY, JSON.stringify(rules));
}

interface RunLogEntry {
  id: string;
  ruleName: string;
  triggeredAt: string;
  casesAffected: number;
  status: 'success' | 'failed' | 'skipped';
  detail: string;
}

function loadLog(): RunLogEntry[] {
  try {
    const s = localStorage.getItem(LS_LOG_KEY);
    return s ? JSON.parse(s) : [];
  } catch { return []; }
}

function defaultRules(): WorkflowRule[] {
  return [
    {
      id: 'rule-001',
      name: 'PTP Broken Escalation',
      description: 'When a PTP is broken 2+ times, notify manager immediately',
      trigger: 'ptp_broken',
      triggerParams: { count: '2' },
      conditions: [],
      actions: [
        { type: 'send_notification', params: { recipient: 'manager', message: 'PTP broken 2+ times. Review case urgently.' } },
        { type: 'flag_high_priority', params: {} },
      ],
      enabled: true,
      runCount: 7,
      lastRun: new Date(Date.now() - 3600000).toISOString(),
      createdAt: new Date(Date.now() - 7 * 86400000).toISOString(),
    },
    {
      id: 'rule-002',
      name: 'Stale Case Auto-Move',
      description: 'Cases with no contact in 30 days and CB status move to NCC',
      trigger: 'no_contact_days',
      triggerParams: { days: '30' },
      conditions: [{ field: 'crmStatus', operator: 'equals', value: 'CB' }],
      actions: [
        { type: 'change_status', params: { crmStatus: 'NCC' } },
        { type: 'add_remark', params: { remark: 'Auto-moved to NCC: No contact in 30+ days.' } },
      ],
      enabled: true,
      runCount: 12,
      lastRun: new Date(Date.now() - 7200000).toISOString(),
      createdAt: new Date(Date.now() - 14 * 86400000).toISOString(),
    },
    {
      id: 'rule-003',
      name: 'High-Value Alert',
      description: 'Notify manager when a high-value case (>100K AED) is logged',
      trigger: 'high_value',
      triggerParams: { threshold: '100000' },
      conditions: [],
      actions: [
        { type: 'send_notification', params: { recipient: 'manager', message: 'High-value case flagged for review.' } },
        { type: 'flag_high_priority', params: {} },
      ],
      enabled: true,
      runCount: 3,
      lastRun: new Date(Date.now() - 86400000).toISOString(),
      createdAt: new Date(Date.now() - 10 * 86400000).toISOString(),
    },
    {
      id: 'rule-004',
      name: 'Officer Overload Alert',
      description: 'Alert manager when any officer has 100+ active cases',
      trigger: 'officer_overloaded',
      triggerParams: { caseCount: '100' },
      conditions: [],
      actions: [
        { type: 'send_notification', params: { recipient: 'manager', message: 'Officer overloaded — consider rebalancing.' } },
      ],
      enabled: false,
      runCount: 1,
      lastRun: new Date(Date.now() - 2 * 86400000).toISOString(),
      createdAt: new Date(Date.now() - 5 * 86400000).toISOString(),
    },
  ];
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const TriggerBadge: React.FC<{ trigger: TriggerType }> = ({ trigger }) => (
  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${TRIGGER_COLORS[trigger]}`}>
    {TRIGGER_LABELS[trigger]}
  </span>
);

const StatusDot: React.FC<{ enabled: boolean }> = ({ enabled }) => (
  <span className={`inline-block h-2 w-2 rounded-full ${enabled ? 'bg-green-500' : 'bg-gray-400'}`} />
);

// ─── Rule Builder Modal ───────────────────────────────────────────────────────

const EMPTY_RULE: Omit<WorkflowRule, 'id' | 'runCount' | 'lastRun' | 'createdAt'> = {
  name: '',
  description: '',
  trigger: 'ptp_broken',
  triggerParams: {},
  conditions: [],
  actions: [{ type: 'send_notification', params: { recipient: 'manager', message: '' } }],
  enabled: true,
};

interface BuilderModalProps {
  initial?: WorkflowRule;
  onSave: (rule: Omit<WorkflowRule, 'id' | 'runCount' | 'lastRun' | 'createdAt'>) => void;
  onClose: () => void;
}

const BuilderModal: React.FC<BuilderModalProps> = ({ initial, onSave, onClose }) => {
  const [draft, setDraft] = useState<Omit<WorkflowRule, 'id' | 'runCount' | 'lastRun' | 'createdAt'>>(
    initial ? {
      name: initial.name,
      description: initial.description,
      trigger: initial.trigger,
      triggerParams: { ...initial.triggerParams },
      conditions: [...initial.conditions],
      actions: initial.actions.map(a => ({ ...a, params: { ...a.params } })),
      enabled: initial.enabled,
    } : { ...EMPTY_RULE }
  );

  const addCondition = () => setDraft(d => ({
    ...d,
    conditions: [...d.conditions, { field: 'crmStatus', operator: 'equals', value: '' }],
  }));

  const removeCondition = (i: number) => setDraft(d => ({
    ...d,
    conditions: d.conditions.filter((_, idx) => idx !== i),
  }));

  const updateCondition = (i: number, patch: Partial<Condition>) => setDraft(d => ({
    ...d,
    conditions: d.conditions.map((c, idx) => idx === i ? { ...c, ...patch } : c),
  }));

  const addAction = () => setDraft(d => ({
    ...d,
    actions: [...d.actions, { type: 'send_notification', params: { recipient: 'manager', message: '' } }],
  }));

  const removeAction = (i: number) => setDraft(d => ({
    ...d,
    actions: d.actions.filter((_, idx) => idx !== i),
  }));

  const updateAction = (i: number, patch: Partial<RuleAction>) => setDraft(d => ({
    ...d,
    actions: d.actions.map((a, idx) => idx === i ? { ...a, ...patch } : a),
  }));

  const setTriggerParam = (key: string, val: string) => setDraft(d => ({
    ...d,
    triggerParams: { ...d.triggerParams, [key]: val },
  }));

  const setActionParam = (actionIdx: number, key: string, val: string) => setDraft(d => ({
    ...d,
    actions: d.actions.map((a, idx) => idx === actionIdx ? { ...a, params: { ...a.params, [key]: val } } : a),
  }));

  const isValid = draft.name.trim().length > 0 && draft.actions.length > 0;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-[var(--color-bg-primary)] rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border)] shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-[#F28C28]/10">
              <svg className="w-5 h-5 text-[#F28C28]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
              </svg>
            </div>
            <h2 className="text-lg font-bold text-text-primary">{initial ? 'Edit Rule' : 'New Workflow Rule'}</h2>
          </div>
          <button onClick={onClose} className="text-text-secondary hover:text-text-primary p-1 rounded-lg hover:bg-[var(--color-bg-input)]">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto p-6 space-y-6">
          {/* Basic Info */}
          <section className="space-y-3">
            <label className="block text-xs font-semibold uppercase tracking-wider text-text-secondary">Rule Info</label>
            <input
              type="text"
              placeholder="Rule name..."
              value={draft.name}
              onChange={e => setDraft(d => ({ ...d, name: e.target.value }))}
              className="w-full text-sm rounded-xl px-4 py-2.5 bg-[var(--color-bg-input)] border border-[var(--color-border)] text-text-primary focus:outline-none focus:border-[#F28C28]"
            />
            <input
              type="text"
              placeholder="Short description (optional)..."
              value={draft.description}
              onChange={e => setDraft(d => ({ ...d, description: e.target.value }))}
              className="w-full text-sm rounded-xl px-4 py-2.5 bg-[var(--color-bg-input)] border border-[var(--color-border)] text-text-primary focus:outline-none focus:border-[#F28C28]"
            />
          </section>

          {/* Trigger */}
          <section className="space-y-3">
            <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-text-secondary">
              <span className="inline-block h-2 w-2 rounded-full bg-blue-500" />
              When (Trigger)
            </label>
            <select
              value={draft.trigger}
              onChange={e => setDraft(d => ({ ...d, trigger: e.target.value as TriggerType, triggerParams: {} }))}
              className="w-full text-sm rounded-xl px-4 py-2.5 bg-[var(--color-bg-input)] border border-[var(--color-border)] text-text-primary focus:outline-none focus:border-[#F28C28]"
            >
              {Object.entries(TRIGGER_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
            {/* Trigger params */}
            {draft.trigger === 'case_stale' && (
              <div className="flex items-center gap-3">
                <span className="text-sm text-text-secondary">After</span>
                <input type="number" value={draft.triggerParams.days || '7'} onChange={e => setTriggerParam('days', e.target.value)}
                  className="w-24 text-sm rounded-xl px-3 py-2 bg-[var(--color-bg-input)] border border-[var(--color-border)] text-text-primary focus:outline-none focus:border-[#F28C28]" />
                <span className="text-sm text-text-secondary">days without update</span>
              </div>
            )}
            {draft.trigger === 'no_contact_days' && (
              <div className="flex items-center gap-3">
                <span className="text-sm text-text-secondary">No contact for</span>
                <input type="number" value={draft.triggerParams.days || '3'} onChange={e => setTriggerParam('days', e.target.value)}
                  className="w-24 text-sm rounded-xl px-3 py-2 bg-[var(--color-bg-input)] border border-[var(--color-border)] text-text-primary focus:outline-none focus:border-[#F28C28]" />
                <span className="text-sm text-text-secondary">days</span>
              </div>
            )}
            {draft.trigger === 'dpd_threshold' && (
              <div className="flex items-center gap-3">
                <span className="text-sm text-text-secondary">DPD ≥</span>
                <input type="number" value={draft.triggerParams.dpd || '90'} onChange={e => setTriggerParam('dpd', e.target.value)}
                  className="w-24 text-sm rounded-xl px-3 py-2 bg-[var(--color-bg-input)] border border-[var(--color-border)] text-text-primary focus:outline-none focus:border-[#F28C28]" />
                <span className="text-sm text-text-secondary">days</span>
              </div>
            )}
            {draft.trigger === 'ptp_broken' && (
              <div className="flex items-center gap-3">
                <span className="text-sm text-text-secondary">After</span>
                <input type="number" value={draft.triggerParams.count || '2'} onChange={e => setTriggerParam('count', e.target.value)}
                  className="w-24 text-sm rounded-xl px-3 py-2 bg-[var(--color-bg-input)] border border-[var(--color-border)] text-text-primary focus:outline-none focus:border-[#F28C28]" />
                <span className="text-sm text-text-secondary">broken PTPs</span>
              </div>
            )}
            {draft.trigger === 'high_value' && (
              <div className="flex items-center gap-3">
                <span className="text-sm text-text-secondary">Balance ≥ AED</span>
                <input type="number" value={draft.triggerParams.threshold || '100000'} onChange={e => setTriggerParam('threshold', e.target.value)}
                  className="w-36 text-sm rounded-xl px-3 py-2 bg-[var(--color-bg-input)] border border-[var(--color-border)] text-text-primary focus:outline-none focus:border-[#F28C28]" />
              </div>
            )}
            {draft.trigger === 'officer_overloaded' && (
              <div className="flex items-center gap-3">
                <span className="text-sm text-text-secondary">Officer has &gt;</span>
                <input type="number" value={draft.triggerParams.caseCount || '100'} onChange={e => setTriggerParam('caseCount', e.target.value)}
                  className="w-24 text-sm rounded-xl px-3 py-2 bg-[var(--color-bg-input)] border border-[var(--color-border)] text-text-primary focus:outline-none focus:border-[#F28C28]" />
                <span className="text-sm text-text-secondary">active cases</span>
              </div>
            )}
          </section>

          {/* Conditions */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-text-secondary">
                <span className="inline-block h-2 w-2 rounded-full bg-purple-500" />
                Only If (Conditions)
              </label>
              <button onClick={addCondition} className="text-xs font-semibold text-[#F28C28] hover:underline">+ Add Condition</button>
            </div>
            {draft.conditions.length === 0 && (
              <p className="text-xs text-text-secondary italic">No conditions — rule applies to all matching cases.</p>
            )}
            {draft.conditions.map((cond, i) => (
              <div key={i} className="flex items-center gap-2 p-3 rounded-xl bg-[var(--color-bg-secondary)] border border-[var(--color-border)]">
                <select value={cond.field} onChange={e => updateCondition(i, { field: e.target.value })}
                  className="text-xs rounded-lg px-2 py-1.5 bg-[var(--color-bg-input)] border border-[var(--color-border)] text-text-primary focus:outline-none">
                  <option value="crmStatus">CRM Status</option>
                  <option value="dpd">DPD</option>
                  <option value="balance">Balance</option>
                  <option value="bank">Bank</option>
                </select>
                <select value={cond.operator} onChange={e => updateCondition(i, { operator: e.target.value as ConditionOperator })}
                  className="text-xs rounded-lg px-2 py-1.5 bg-[var(--color-bg-input)] border border-[var(--color-border)] text-text-primary focus:outline-none">
                  <option value="equals">equals</option>
                  <option value="not_equals">not equals</option>
                  <option value="gt">greater than</option>
                  <option value="lt">less than</option>
                  <option value="contains">contains</option>
                </select>
                <input type="text" value={cond.value} onChange={e => updateCondition(i, { value: e.target.value })}
                  placeholder="value..."
                  className="flex-1 text-xs rounded-lg px-2 py-1.5 bg-[var(--color-bg-input)] border border-[var(--color-border)] text-text-primary focus:outline-none" />
                <button onClick={() => removeCondition(i)} className="text-red-400 hover:text-red-600 p-1">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            ))}
          </section>

          {/* Actions */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-text-secondary">
                <span className="inline-block h-2 w-2 rounded-full bg-green-500" />
                Then Do (Actions)
              </label>
              <button onClick={addAction} className="text-xs font-semibold text-[#F28C28] hover:underline">+ Add Action</button>
            </div>
            {draft.actions.map((action, i) => (
              <div key={i} className="p-3 rounded-xl bg-[var(--color-bg-secondary)] border border-[var(--color-border)] space-y-2">
                <div className="flex items-center gap-2">
                  <select value={action.type} onChange={e => updateAction(i, { type: e.target.value as ActionType, params: {} })}
                    className="flex-1 text-xs rounded-lg px-2 py-1.5 bg-[var(--color-bg-input)] border border-[var(--color-border)] text-text-primary focus:outline-none">
                    {Object.entries(ACTION_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                  <button onClick={() => removeAction(i)} disabled={draft.actions.length === 1}
                    className="text-red-400 hover:text-red-600 p-1 disabled:opacity-30">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
                {/* Action-specific params */}
                {action.type === 'send_notification' && (
                  <>
                    <select value={action.params.recipient || 'manager'} onChange={e => setActionParam(i, 'recipient', e.target.value)}
                      className="w-full text-xs rounded-lg px-2 py-1.5 bg-[var(--color-bg-input)] border border-[var(--color-border)] text-text-primary focus:outline-none">
                      <option value="manager">Manager</option>
                      <option value="officer">Assigned Officer</option>
                      <option value="all_managers">All Managers</option>
                    </select>
                    <input type="text" value={action.params.message || ''} onChange={e => setActionParam(i, 'message', e.target.value)}
                      placeholder="Notification message..."
                      className="w-full text-xs rounded-lg px-2 py-1.5 bg-[var(--color-bg-input)] border border-[var(--color-border)] text-text-primary focus:outline-none" />
                  </>
                )}
                {action.type === 'change_status' && (
                  <select value={action.params.crmStatus || 'NCC'} onChange={e => setActionParam(i, 'crmStatus', e.target.value)}
                    className="w-full text-xs rounded-lg px-2 py-1.5 bg-[var(--color-bg-input)] border border-[var(--color-border)] text-text-primary focus:outline-none">
                    {['CB','PTP','NCC','FIP','UNDER NEGO','WIP','DXB','UTR','NITP','Closed','Withdrawn'].map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                )}
                {action.type === 'add_remark' && (
                  <input type="text" value={action.params.remark || ''} onChange={e => setActionParam(i, 'remark', e.target.value)}
                    placeholder="Remark text..."
                    className="w-full text-xs rounded-lg px-2 py-1.5 bg-[var(--color-bg-input)] border border-[var(--color-border)] text-text-primary focus:outline-none" />
                )}
                {action.type === 'create_task' && (
                  <input type="text" value={action.params.taskText || ''} onChange={e => setActionParam(i, 'taskText', e.target.value)}
                    placeholder="Task description..."
                    className="w-full text-xs rounded-lg px-2 py-1.5 bg-[var(--color-bg-input)] border border-[var(--color-border)] text-text-primary focus:outline-none" />
                )}
              </div>
            ))}
          </section>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-[var(--color-border)] bg-[var(--color-bg-secondary)] shrink-0">
          <label className="flex items-center gap-2 cursor-pointer">
            <div
              onClick={() => setDraft(d => ({ ...d, enabled: !d.enabled }))}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${draft.enabled ? 'bg-green-500' : 'bg-gray-300'}`}
            >
              <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${draft.enabled ? 'translate-x-4' : 'translate-x-1'}`} />
            </div>
            <span className="text-xs font-medium text-text-secondary">{draft.enabled ? 'Enabled' : 'Disabled'}</span>
          </label>
          <div className="flex gap-3">
            <button onClick={onClose} className="px-4 py-2 text-sm font-medium rounded-xl border border-[var(--color-border)] text-text-secondary hover:bg-[var(--color-bg-input)] transition-colors">
              Cancel
            </button>
            <button
              onClick={() => isValid && onSave(draft)}
              disabled={!isValid}
              className="px-5 py-2 text-sm font-bold rounded-xl bg-[#F28C28] text-white hover:opacity-90 disabled:opacity-40 transition-all"
            >
              {initial ? 'Save Changes' : 'Create Rule'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

interface WorkflowAutomationProps {
  currentUserRole: Role;
}

const WorkflowAutomation: React.FC<WorkflowAutomationProps> = ({ currentUserRole }) => {
  const [rules, setRules] = useState<WorkflowRule[]>(loadRules);
  const [log] = useState<RunLogEntry[]>(loadLog);
  const [showBuilder, setShowBuilder] = useState(false);
  const [editingRule, setEditingRule] = useState<WorkflowRule | undefined>();
  const [activeTab, setActiveTab] = useState<'rules' | 'log' | 'stats'>('rules');
  const [runningAll, setRunningAll] = useState(false);
  const [lastRunMsg, setLastRunMsg] = useState('');

  const persist = useCallback((r: WorkflowRule[]) => {
    setRules(r);
    saveRules(r);
  }, []);

  const handleToggle = (id: string) => {
    persist(rules.map(r => r.id === id ? { ...r, enabled: !r.enabled } : r));
  };

  const handleDelete = (id: string) => {
    if (confirm('Delete this rule?')) {
      persist(rules.filter(r => r.id !== id));
    }
  };

  const handleSave = (draft: Omit<WorkflowRule, 'id' | 'runCount' | 'lastRun' | 'createdAt'>) => {
    if (editingRule) {
      persist(rules.map(r => r.id === editingRule.id ? { ...r, ...draft } : r));
    } else {
      const newRule: WorkflowRule = {
        ...draft,
        id: `rule-${Date.now()}`,
        runCount: 0,
        createdAt: new Date().toISOString(),
      };
      persist([...rules, newRule]);
    }
    setShowBuilder(false);
    setEditingRule(undefined);
  };

  const handleRunAll = () => {
    setRunningAll(true);
    setTimeout(() => {
      const now = new Date().toISOString();
      const updated = rules.map(r => r.enabled ? { ...r, runCount: r.runCount + 1, lastRun: now } : r);
      persist(updated);
      setRunningAll(false);
      setLastRunMsg(`All ${rules.filter(r => r.enabled).length} active rules executed successfully`);
      setTimeout(() => setLastRunMsg(''), 4000);
    }, 1500);
  };

  const stats = useMemo(() => ({
    total: rules.length,
    enabled: rules.filter(r => r.enabled).length,
    totalRuns: rules.reduce((s, r) => s + r.runCount, 0),
  }), [rules]);

  return (
    <div className="p-4 sm:p-6 space-y-6 animate-fade-in">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl" style={{ background: 'linear-gradient(135deg, #1B2A4A, #2D4470)' }}>
            <svg className="w-6 h-6 text-[#F28C28]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-text-primary">Workflow Automation</h1>
            <p className="text-sm text-text-secondary mt-0.5">No-code rules engine — set triggers, conditions, and actions</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleRunAll}
            disabled={runningAll || stats.enabled === 0}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl border border-[var(--color-border)] text-text-primary hover:bg-[var(--color-bg-input)] disabled:opacity-50 transition-all"
          >
            {runningAll ? (
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
            )}
            {runningAll ? 'Running...' : 'Run All'}
          </button>
          <button
            onClick={() => { setEditingRule(undefined); setShowBuilder(true); }}
            className="flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-xl text-white transition-all hover:opacity-90"
            style={{ background: '#F28C28' }}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            New Rule
          </button>
        </div>
      </div>

      {/* Run success toast */}
      {lastRunMsg && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-green-50 border border-green-200 text-green-800 text-sm font-medium">
          <svg className="w-4 h-4 text-green-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {lastRunMsg}
        </div>
      )}

      {/* Stats Strip */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Rules', value: stats.total, color: 'text-[#1B2A4A]' },
          { label: 'Active', value: stats.enabled, color: 'text-green-600' },
          { label: 'Total Executions', value: stats.totalRuns, color: 'text-[#F28C28]' },
        ].map(s => (
          <div key={s.label} className="panel p-4 text-center">
            <p className={`text-3xl font-extrabold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-text-secondary mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl bg-[var(--color-bg-secondary)] border border-[var(--color-border)] w-fit">
        {(['rules', 'log', 'stats'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-1.5 text-sm font-semibold rounded-lg capitalize transition-all ${activeTab === tab ? 'bg-[var(--color-bg-primary)] text-text-primary shadow-sm' : 'text-text-secondary hover:text-text-primary'}`}
          >
            {tab === 'log' ? 'Run History' : tab === 'stats' ? 'Analytics' : 'Rules'}
          </button>
        ))}
      </div>

      {/* Rules List */}
      {activeTab === 'rules' && (
        <div className="space-y-3">
          {rules.length === 0 && (
            <div className="panel p-12 text-center">
              <svg className="w-12 h-12 text-text-secondary mx-auto mb-3 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
              </svg>
              <p className="text-text-secondary font-medium">No workflow rules yet.</p>
              <p className="text-xs text-text-secondary mt-1">Click "New Rule" to create your first automation.</p>
            </div>
          )}
          {rules.map(rule => (
            <div key={rule.id} className={`panel p-4 transition-all ${!rule.enabled ? 'opacity-60' : ''}`}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  {/* Toggle */}
                  <button
                    onClick={() => handleToggle(rule.id)}
                    className={`mt-0.5 relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${rule.enabled ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}`}
                  >
                    <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${rule.enabled ? 'translate-x-4' : 'translate-x-1'}`} />
                  </button>
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="font-semibold text-sm text-text-primary">{rule.name}</span>
                      <TriggerBadge trigger={rule.trigger} />
                    </div>
                    {rule.description && <p className="text-xs text-text-secondary mb-2">{rule.description}</p>}
                    {/* Actions summary */}
                    <div className="flex flex-wrap gap-1.5">
                      {rule.actions.map((a, i) => (
                        <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs bg-[var(--color-bg-secondary)] border border-[var(--color-border)] text-text-secondary font-medium">
                          <svg className="w-3 h-3 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                          {ACTION_LABELS[a.type]}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
                {/* Metadata + buttons */}
                <div className="flex flex-col items-end gap-2 shrink-0">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => { setEditingRule(rule); setShowBuilder(true); }}
                      className="p-1.5 rounded-lg text-text-secondary hover:text-[#1B2A4A] hover:bg-[var(--color-bg-input)] transition-colors"
                      title="Edit"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDelete(rule.id)}
                      className="p-1.5 rounded-lg text-text-secondary hover:text-red-600 hover:bg-red-50 transition-colors"
                      title="Delete"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                      </svg>
                    </button>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-text-secondary">
                      Ran <span className="font-semibold text-text-primary">{rule.runCount}</span> times
                    </p>
                    {rule.lastRun && (
                      <p className="text-xs text-text-secondary">
                        Last: {new Date(rule.lastRun).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Run Log */}
      {activeTab === 'log' && (
        <div className="panel overflow-hidden">
          <div className="p-4 border-b border-[var(--color-border)]">
            <h3 className="font-semibold text-text-primary text-sm">Recent Executions</h3>
          </div>
          {log.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-text-secondary text-sm">No execution history yet. Click "Run All" to execute your rules.</p>
            </div>
          ) : (
            <div className="divide-y divide-[var(--color-border)]">
              {log.slice(0, 20).map(entry => (
                <div key={entry.id} className="flex items-center gap-4 p-4">
                  <div className={`h-2 w-2 rounded-full shrink-0 ${entry.status === 'success' ? 'bg-green-500' : entry.status === 'failed' ? 'bg-red-500' : 'bg-yellow-500'}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-text-primary">{entry.ruleName}</p>
                    <p className="text-xs text-text-secondary truncate">{entry.detail}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs text-text-secondary">{new Date(entry.triggeredAt).toLocaleString()}</p>
                    <p className="text-xs font-semibold text-text-primary">{entry.casesAffected} cases</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Analytics */}
      {activeTab === 'stats' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="panel p-5 space-y-4">
            <h3 className="font-semibold text-text-primary text-sm">Rules by Trigger Type</h3>
            {Object.entries(TRIGGER_LABELS).map(([k, label]) => {
              const count = rules.filter(r => r.trigger === k).length;
              if (count === 0) return null;
              return (
                <div key={k} className="flex items-center gap-3">
                  <TriggerBadge trigger={k as TriggerType} />
                  <div className="flex-1 bg-[var(--color-bg-secondary)] rounded-full h-2">
                    <div
                      className="h-2 rounded-full bg-[#F28C28] transition-all"
                      style={{ width: `${(count / rules.length) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs font-semibold text-text-primary w-6 text-right">{count}</span>
                </div>
              );
            })}
          </div>
          <div className="panel p-5 space-y-4">
            <h3 className="font-semibold text-text-primary text-sm">Top Rules by Executions</h3>
            {[...rules].sort((a, b) => b.runCount - a.runCount).slice(0, 5).map(r => (
              <div key={r.id} className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <StatusDot enabled={r.enabled} />
                  <span className="text-sm text-text-primary truncate">{r.name}</span>
                </div>
                <span className="text-sm font-bold text-[#F28C28] shrink-0">{r.runCount}×</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Builder Modal */}
      {showBuilder && (
        <BuilderModal
          initial={editingRule}
          onSave={handleSave}
          onClose={() => { setShowBuilder(false); setEditingRule(undefined); }}
        />
      )}
    </div>
  );
};

export default WorkflowAutomation;
