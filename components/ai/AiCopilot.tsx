import React, { useState, useRef, useEffect } from 'react';
import { EnrichedCase, User } from '../../types';
import { formatCurrency } from '../../utils';
import { processAIChat, AIChatResponse } from '../../src/ai/brain';

interface Props {
  allCases: EnrichedCase[];
  coordinators: User[];
  onSelectCase: (id: string) => void;
  currentUser: User;
}

const AiCopilot: React.FC<Props> = ({ allCases, coordinators, onSelectCase, currentUser }) => {
  const [query, setQuery] = useState('');
  const [chatHistory, setChatHistory] = useState<{ query: string; response: AIChatResponse }[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const handleSubmit = (q: string) => {
    if (!q.trim()) return;
    const response = processAIChat(q, allCases, coordinators, currentUser);
    setChatHistory(prev => [...prev, { query: q, response }]);
    setQuery('');
    setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(true);
        setTimeout(() => inputRef.current?.focus(), 100);
      }
      if (e.key === 'Escape') setIsOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  if (!isOpen) {
    return (
      <button onClick={() => { setIsOpen(true); setTimeout(() => inputRef.current?.focus(), 100); }}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[var(--color-border)] text-[var(--color-text-tertiary)] text-xs hover:border-[var(--color-accent)] transition">
        <span>🧠</span> AI Assistant <span className="text-[10px] px-1 py-0.5 rounded bg-[var(--color-bg-tertiary)] ml-1">Ctrl+K</span>
      </button>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-[70] flex items-start justify-center pt-[10vh]" onClick={() => setIsOpen(false)}>
      <div className="w-full max-w-2xl mx-4 animate-fade-in-up" style={{ animationDuration: '0.15s' }} onClick={e => e.stopPropagation()}>
        <div className="rounded-2xl overflow-hidden shadow-2xl border border-[var(--color-border)]" style={{ background: 'var(--color-bg-secondary)' }}>

          {/* Header */}
          <div className="px-5 py-3 flex items-center gap-3 border-b border-[var(--color-border)]" style={{ background: '#1B2A4A' }}>
            <span className="text-lg">🧠</span>
            <div>
              <p className="text-sm font-bold text-white">RecoVantage AI</p>
              <p className="text-[10px] text-blue-200/50">Ask anything about your cases, portfolio, or officers</p>
            </div>
            <kbd className="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-white/40">ESC</kbd>
          </div>

          {/* Chat History */}
          <div className="max-h-[50vh] overflow-y-auto p-4 space-y-4" style={{ minHeight: chatHistory.length > 0 ? '200px' : '0' }}>
            {chatHistory.map((entry, i) => (
              <div key={i} className="space-y-2">
                {/* User query */}
                <div className="flex justify-end">
                  <div className="px-3 py-2 rounded-xl text-xs text-white max-w-[80%]" style={{ background: '#1B2A4A' }}>
                    {entry.query}
                  </div>
                </div>
                {/* AI response */}
                <div className="flex justify-start">
                  <div className="px-3 py-2 rounded-xl text-xs max-w-[90%] bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)]">
                    <div className="whitespace-pre-wrap" style={{ lineHeight: '1.6' }}>
                      {entry.response.text.split('**').map((part, j) =>
                        j % 2 === 1 ? <strong key={j}>{part}</strong> : <span key={j}>{part}</span>
                      )}
                    </div>
                    {/* Clickable case results */}
                    {entry.response.data && entry.response.data.length > 0 && (
                      <div className="mt-2 space-y-1 border-t border-[var(--color-border)] pt-2">
                        {entry.response.data.slice(0, 5).map(c => (
                          <button key={c.id} onClick={() => { onSelectCase(c.id); setIsOpen(false); }}
                            className="w-full flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-[var(--color-bg-secondary)] transition text-left">
                            <span className="text-[11px] font-semibold">{c.debtor.name}</span>
                            <span className="text-[10px] font-mono" style={{ color: '#F28C28' }}>{formatCurrency(c.loan.currentBalance, c.loan.currency)}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>

          {/* Quick Suggestions (when empty) */}
          {chatHistory.length === 0 && (
            <div className="px-5 py-4 space-y-2">
              <p className="text-[10px] text-[var(--color-text-tertiary)] uppercase font-bold tracking-widest">Try asking:</p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  'Show PTP cases due today',
                  'Cases above 100K',
                  'How is our portfolio doing?',
                  'Stale cases no contact 7 days',
                  'Top 5 highest balance',
                  'Non-contactable cases',
                ].map(s => (
                  <button key={s} onClick={() => { setQuery(s); handleSubmit(s); }}
                    className="text-left text-[11px] text-[var(--color-text-secondary)] hover:text-[var(--color-accent)] px-3 py-2 rounded-lg border border-[var(--color-border)] hover:border-[var(--color-accent)] transition">
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Input */}
          <form onSubmit={e => { e.preventDefault(); handleSubmit(query); }} className="flex items-center gap-2 px-4 py-3 border-t border-[var(--color-border)]">
            <input
              ref={inputRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Ask AI anything..."
              className="flex-1 bg-transparent border-none outline-none text-sm text-[var(--color-text-primary)]"
              autoFocus
            />
            <button type="submit" disabled={!query.trim()} className="px-3 py-1.5 text-xs font-bold rounded-lg text-white disabled:opacity-30 transition" style={{ background: '#F28C28' }}>
              Send
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AiCopilot;
