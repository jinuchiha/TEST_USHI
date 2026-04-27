import React, { useState, useRef, useEffect } from 'react';
import { EnrichedCase } from '../../types';
import { generateResponse, initialMessages, CoachMessage, CoachIntent } from './coachEngine';
import { findMerger } from '../pakistan-tracing/bankMergers';

interface RecoveryCoachPanelProps {
  case: EnrichedCase;
  allCases: EnrichedCase[];
  compact?: boolean;
}

const RecoveryCoachPanel: React.FC<RecoveryCoachPanelProps> = ({ case: c, allCases, compact = false }) => {
  const [messages, setMessages] = useState<CoachMessage[]>(() => initialMessages(c, allCases));
  const [input, setInput] = useState('');
  const [highlights, setHighlights] = useState<{ label: string; value: string; color?: string }[]>([]);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages.length]);

  // Re-init when case changes
  useEffect(() => {
    setMessages(initialMessages(c, allCases));
  }, [c.id]);

  const send = (text: string, _intent?: CoachIntent) => {
    if (!text.trim()) return;
    const userMsg: CoachMessage = { role: 'user', text, timestamp: new Date().toISOString() };
    const ctx = { case: c, allCases, bankMerger: findMerger(c.loan.bank) };
    const result = generateResponse(text, ctx);
    const coachMsg: CoachMessage = {
      role: 'coach',
      text: result.response,
      timestamp: new Date().toISOString(),
      suggestions: result.suggestions,
    };
    setMessages(prev => [...prev, userMsg, coachMsg]);
    setHighlights(result.highlights || []);
    setInput('');
  };

  const handleSuggestion = (s: { label: string; intent: CoachIntent }) => send(s.label, s.intent);

  return (
    <div className={`panel flex flex-col ${compact ? 'h-[500px]' : 'h-[calc(100vh-180px)]'}`}>
      {/* Header */}
      <div className="p-3 border-b border-[var(--color-border)] flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white font-bold">
          🧠
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold">Recovery Coach</p>
          <p className="text-[10px] text-text-tertiary truncate">Reviewing {c.debtor.name} • {c.loan.bank}</p>
        </div>
      </div>

      {/* Quick highlights */}
      {highlights.length > 0 && (
        <div className="px-3 py-2 border-b border-[var(--color-border)] grid grid-cols-5 gap-1.5">
          {highlights.map(h => (
            <div key={h.label} className="text-center">
              <p className="text-[9px] text-text-tertiary truncate">{h.label}</p>
              <p className={`text-[11px] font-bold ${h.color || 'text-text-primary'} truncate`}>{h.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[88%] rounded-2xl px-3 py-2 ${m.role === 'user' ? 'bg-[var(--color-primary)] text-white' : 'bg-[var(--color-bg-tertiary)]'}`}>
              <p className="text-xs whitespace-pre-line leading-relaxed">{m.text}</p>
              <p className={`text-[9px] mt-1 ${m.role === 'user' ? 'text-white/60' : 'text-text-tertiary'}`}>
                {new Date(m.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
              </p>
              {m.suggestions && m.suggestions.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {m.suggestions.map((s, j) => (
                    <button
                      key={j}
                      onClick={() => handleSuggestion(s)}
                      className="px-2 py-1 text-[10px] font-semibold rounded-full bg-white dark:bg-gray-800 text-[var(--color-primary)] border border-[var(--color-primary)] hover:bg-[var(--color-primary-glow)] transition-colors"
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t border-[var(--color-border)]">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && send(input)}
            placeholder="Pochho coach se: settlement, next step, opening line..."
            className="flex-1 px-3 py-2 text-xs rounded-lg"
          />
          <button onClick={() => send(input)} disabled={!input.trim()} className="btn-primary px-3 py-2 text-xs disabled:opacity-40">
            Send
          </button>
        </div>
      </div>
    </div>
  );
};

export default RecoveryCoachPanel;
