import React, { useState, useEffect, useRef, useMemo } from 'react';
import { EnrichedCase, User, Role } from '../../types';
import { ICONS } from '../../constants';
import { formatCurrency } from '../../utils';

// ── Types ────────────────────────────────────────────────────────────────────
type Sentiment = 'positive' | 'neutral' | 'negative' | 'hostile';
type CallOutcome = 'answered' | 'voicemail' | 'no_answer' | 'busy' | 'switched_off' | 'wrong_number' | 'refused';

interface CallRecord {
  id: string;
  caseId: string;
  officerId: string;
  officerName: string;
  timestamp: string;
  duration: number;       // seconds
  audioDataUrl?: string;  // base64 audio (recorded or uploaded)
  audioFormat?: string;
  transcript: string;
  outcome: CallOutcome;
  sentiment: Sentiment;
  keywords: string[];      // detected
  summary: string;         // AI-generated
  ptpAmount?: number;
  ptpDate?: string;
  flags: string[];         // detected red flags
}

const STORAGE_KEY = 'rv_call_records';
const load = (): CallRecord[] => { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; } };
const save = (d: CallRecord[]) => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(d)); } catch {} };
const genId = () => `call-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

// ── Sentiment & keyword analysis (deterministic, English+Urdu mix) ──────────
const POSITIVE_WORDS = ['agreed', 'pay', 'paying', 'transfer', 'tomorrow', 'kal', 'aaj', 'today', 'haan', 'yes', 'theek', 'ok', 'sahi', 'commit', 'promise', 'will pay', 'can pay', 'sure', 'definitely', 'inshallah'];
const NEGATIVE_WORDS = ['no', 'nahi', 'not', 'cannot', 'dispute', 'fraud', 'wrong', 'mistake', 'galat', 'refuse', 'mana', 'difficult', 'mushkil', 'problem', 'unable'];
const HOSTILE_WORDS = ['shut up', 'don\'t call', 'mat karo', 'bahar', 'block', 'harassment', 'fuck', 'damn', 'idiot', 'gaali', 'illegal', 'sue', 'lawyer', 'court', 'kar lo'];
const PTP_WORDS = ['promise', 'will pay', 'paying tomorrow', 'kal pay', 'aaj transfer', 'next week', 'aglay hafte', 'commitment', 'pakka'];
const SETTLEMENT_WORDS = ['settle', 'discount', 'reduce', 'kam karo', 'less', 'half', 'adha', 'one-time', 'lump sum', 'final'];
const HARDSHIP_WORDS = ['lost job', 'naukri chali', 'sick', 'beemar', 'illness', 'death', 'inteqal', 'unemployed', 'hardship', 'mushkil', 'bachay', 'family'];
const FRAUD_WORDS = ['identity', 'cyber', 'stolen', 'fraud', 'fake', 'jaali', 'never used', 'kabhi nahi', 'fir'];
const REFUSAL_WORDS = ['won\'t pay', 'will not pay', 'nahi dunga', 'pay nahi karunga', 'refuse', 'mana', 'inkar'];

function analyze(transcript: string): { sentiment: Sentiment; keywords: string[]; flags: string[]; summary: string; suggestedOutcome: CallOutcome; ptp: { amount?: number; date?: string } } {
  const text = transcript.toLowerCase();
  const matchCount = (words: string[]) => words.filter(w => text.includes(w)).length;

  const pos = matchCount(POSITIVE_WORDS);
  const neg = matchCount(NEGATIVE_WORDS);
  const hostile = matchCount(HOSTILE_WORDS);

  let sentiment: Sentiment;
  if (hostile >= 1) sentiment = 'hostile';
  else if (neg > pos + 1) sentiment = 'negative';
  else if (pos > neg) sentiment = 'positive';
  else sentiment = 'neutral';

  const keywords: string[] = [];
  if (matchCount(PTP_WORDS) >= 1) keywords.push('PTP signal');
  if (matchCount(SETTLEMENT_WORDS) >= 1) keywords.push('settlement requested');
  if (matchCount(HARDSHIP_WORDS) >= 1) keywords.push('hardship claim');
  if (matchCount(FRAUD_WORDS) >= 1) keywords.push('fraud claim');
  if (matchCount(REFUSAL_WORDS) >= 1) keywords.push('refusal');

  const flags: string[] = [];
  if (hostile >= 2) flags.push('🚨 Highly hostile — escalate to manager');
  if (matchCount(FRAUD_WORDS) >= 1) flags.push('⚖️ Possible cyber/fraud claim — verify');
  if (matchCount(REFUSAL_WORDS) >= 1) flags.push('❌ Explicit refusal logged');
  if (text.includes('out of country') || text.includes('mulk se bahar') || text.includes('saudi') || text.includes('dubai')) flags.push('✈️ Possible out-of-country');

  // PTP extraction (simple regex for currency + date)
  const ptp: { amount?: number; date?: string } = {};
  const amountMatch = transcript.match(/(?:aed|sar|kwd|bhd|qar|omr|pkr|rs)[\s]*([\d,]+)/i);
  if (amountMatch) ptp.amount = parseInt(amountMatch[1].replace(/,/g, ''));
  const dateKeywords = ['tomorrow', 'kal', 'next week', 'aglay hafte', 'this week', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  for (const k of dateKeywords) if (text.includes(k)) { ptp.date = k; break; }

  // Outcome suggestion
  let suggestedOutcome: CallOutcome = 'answered';
  if (text.includes('voicemail') || text.includes('voice mail')) suggestedOutcome = 'voicemail';
  else if (text.includes('busy') || text.includes('engaged')) suggestedOutcome = 'busy';
  else if (text.includes('switched off') || text.includes('off') || text.includes('not reachable')) suggestedOutcome = 'switched_off';
  else if (text.includes('wrong number') || text.includes('galat number')) suggestedOutcome = 'wrong_number';
  else if (matchCount(REFUSAL_WORDS) >= 1) suggestedOutcome = 'refused';
  else if (text.length === 0) suggestedOutcome = 'no_answer';

  // AI summary (rule-based)
  const summaryParts: string[] = [];
  if (sentiment === 'positive') summaryParts.push('Positive interaction.');
  else if (sentiment === 'negative') summaryParts.push('Difficult conversation.');
  else if (sentiment === 'hostile') summaryParts.push('⚠️ Hostile interaction.');
  if (keywords.includes('PTP signal')) summaryParts.push('Debtor indicated payment commitment' + (ptp.amount ? ` (${ptp.amount})` : '') + (ptp.date ? ` for ${ptp.date}` : '') + '.');
  if (keywords.includes('settlement requested')) summaryParts.push('Settlement discussion opened.');
  if (keywords.includes('hardship claim')) summaryParts.push('Hardship claimed — verify documentation.');
  if (keywords.includes('fraud claim')) summaryParts.push('Fraud/identity dispute raised — escalate.');
  if (keywords.includes('refusal')) summaryParts.push('Refusal logged.');
  if (summaryParts.length === 0) summaryParts.push('Standard contact attempt.');

  return { sentiment, keywords, flags, summary: summaryParts.join(' '), suggestedOutcome, ptp };
}

// ── Component ────────────────────────────────────────────────────────────────
interface VoiceCallStudioProps {
  cases: EnrichedCase[];
  currentUser: User;
  onSelectCase: (caseId: string) => void;
}

const VoiceCallStudio: React.FC<VoiceCallStudioProps> = ({ cases, currentUser, onSelectCase }) => {
  const [records, setRecords] = useState<CallRecord[]>(load);
  const [selectedCaseId, setSelectedCaseId] = useState('');
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);

  // Recording
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);

  // Form
  const [transcript, setTranscript] = useState('');
  const [outcome, setOutcome] = useState<CallOutcome>('answered');
  const [audioDataUrl, setAudioDataUrl] = useState<string | undefined>();
  const [audioFormat, setAudioFormat] = useState<string | undefined>();
  const [duration, setDuration] = useState(0);
  const [search, setSearch] = useState('');
  const [filterCaseId, setFilterCaseId] = useState<string>('all');

  // Live transcription (browser SpeechRecognition where available)
  const [liveTranscriptOn, setLiveTranscriptOn] = useState(false);
  const recognitionRef = useRef<any>(null);

  const myCases = useMemo(() => {
    return currentUser.role === Role.OFFICER
      ? cases.filter(c => c.assignedOfficerId === currentUser.id)
      : cases;
  }, [cases, currentUser]);

  const myRecords = useMemo(() => {
    return currentUser.role === Role.OFFICER
      ? records.filter(r => r.officerId === currentUser.id)
      : records;
  }, [records, currentUser]);

  const filteredRecords = useMemo(() => {
    return myRecords.filter(r => {
      if (filterCaseId !== 'all' && r.caseId !== filterCaseId) return false;
      if (search) {
        const q = search.toLowerCase();
        const c = cases.find(x => x.id === r.caseId);
        if (!r.transcript.toLowerCase().includes(q) &&
            !c?.debtor.name.toLowerCase().includes(q)) return false;
      }
      return true;
    }).sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  }, [myRecords, filterCaseId, search, cases]);

  const analysis = useMemo(() => transcript ? analyze(transcript) : null, [transcript]);

  // ── Audio recording (MediaRecorder API) ──────────────────────────────────
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onload = () => {
          setAudioDataUrl(reader.result as string);
          setAudioFormat('audio/webm');
        };
        reader.readAsDataURL(blob);
        stream.getTracks().forEach(t => t.stop());
      };
      mr.start();
      mediaRecorderRef.current = mr;
      setIsRecording(true);
      setRecordingTime(0);
      timerRef.current = window.setInterval(() => setRecordingTime(t => t + 1), 1000);
    } catch (err) {
      alert('Mic access denied or unavailable. Use file upload instead.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setDuration(recordingTime);
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    }
  };

  // ── Live transcription (browser SpeechRecognition) ──────────────────────
  const toggleLiveTranscript = () => {
    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRec) {
      alert('Live transcription not supported in this browser. Use Chrome/Edge.');
      return;
    }
    if (liveTranscriptOn) {
      recognitionRef.current?.stop();
      setLiveTranscriptOn(false);
      return;
    }
    const rec = new SpeechRec();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = 'en-PK';
    rec.onresult = (e: any) => {
      let final = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) final += e.results[i][0].transcript + ' ';
      }
      if (final) setTranscript(t => t + final);
    };
    rec.onerror = () => setLiveTranscriptOn(false);
    rec.start();
    recognitionRef.current = rec;
    setLiveTranscriptOn(true);
  };

  // ── Audio file upload ───────────────────────────────────────────────────
  const handleAudioUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      setAudioDataUrl(reader.result as string);
      setAudioFormat(f.type);
    };
    reader.readAsDataURL(f);
  };

  const saveCall = () => {
    if (!selectedCaseId || !transcript.trim()) { alert('Pick a case and enter/record transcript first.'); return; }
    const a = analyze(transcript);
    const rec: CallRecord = {
      id: genId(),
      caseId: selectedCaseId,
      officerId: currentUser.id,
      officerName: currentUser.name,
      timestamp: new Date().toISOString(),
      duration,
      audioDataUrl,
      audioFormat,
      transcript,
      outcome,
      sentiment: a.sentiment,
      keywords: a.keywords,
      summary: a.summary,
      ptpAmount: a.ptp.amount,
      ptpDate: a.ptp.date,
      flags: a.flags,
    };
    const updated = [rec, ...records];
    setRecords(updated);
    save(updated);
    // Reset
    setTranscript(''); setAudioDataUrl(undefined); setDuration(0); setOutcome('answered');
    alert('Call saved with AI analysis.');
  };

  const deleteRecord = (id: string) => {
    if (!confirm('Delete this call record?')) return;
    const updated = records.filter(r => r.id !== id);
    setRecords(updated);
    save(updated);
    if (selectedRecordId === id) setSelectedRecordId(null);
  };

  const selectedRecord = records.find(r => r.id === selectedRecordId);
  const selectedCase = cases.find(c => c.id === selectedCaseId);

  const stats = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const todayCalls = myRecords.filter(r => r.timestamp.startsWith(today));
    const positive = myRecords.filter(r => r.sentiment === 'positive').length;
    const ptpDetected = myRecords.filter(r => r.keywords.includes('PTP signal')).length;
    const totalDuration = myRecords.reduce((s, r) => s + r.duration, 0);
    return {
      total: myRecords.length,
      today: todayCalls.length,
      positive,
      positiveRate: myRecords.length > 0 ? Math.round((positive / myRecords.length) * 100) : 0,
      ptpDetected,
      avgDuration: myRecords.length > 0 ? Math.round(totalDuration / myRecords.length) : 0,
      totalHours: Math.round(totalDuration / 3600 * 10) / 10,
    };
  }, [myRecords]);

  const sentimentColor: Record<Sentiment, string> = {
    positive: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    neutral: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    negative: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    hostile: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  };
  const sentimentEmoji: Record<Sentiment, string> = { positive: '😊', neutral: '😐', negative: '😟', hostile: '😡' };

  const fmtSec = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  return (
    <div className="space-y-6 animate-page-enter">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-text-primary flex items-center gap-3">
            <span className="text-3xl">🎙️</span>
            Voice Call Studio
          </h1>
          <p className="text-sm text-text-secondary mt-1">Record / upload calls — AI auto-analyzes sentiment, PTPs, red flags</p>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
        {[
          { label: 'Total Calls', value: stats.total, color: 'text-text-primary' },
          { label: 'Today', value: stats.today, color: 'text-blue-600' },
          { label: 'Positive', value: stats.positive, color: 'text-emerald-600' },
          { label: 'Positive Rate', value: `${stats.positiveRate}%`, color: stats.positiveRate >= 40 ? 'text-emerald-600' : 'text-amber-600' },
          { label: 'PTPs Detected', value: stats.ptpDetected, color: 'text-cyan-600' },
          { label: 'Total Hours', value: `${stats.totalHours}h`, color: 'text-text-primary' },
        ].map(k => (
          <div key={k.label} className="panel p-3">
            <p className="text-[10px] text-text-secondary">{k.label}</p>
            <p className={`text-lg font-bold mt-0.5 ${k.color}`}>{k.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* ── Recorder + Form ───────────────────────────────────────────── */}
        <div className="lg:col-span-2 panel p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold">New Call</h3>
            {isRecording && (
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                <span className="text-xs font-bold text-red-600">REC {fmtSec(recordingTime)}</span>
              </div>
            )}
          </div>

          {/* Case picker */}
          <div>
            <label className="block text-[10px] font-bold text-text-secondary uppercase mb-1">Case *</label>
            <select value={selectedCaseId} onChange={e => setSelectedCaseId(e.target.value)} className="w-full px-3 py-2 text-sm rounded-lg">
              <option value="">Select case</option>
              {myCases.slice(0, 200).map(c => (
                <option key={c.id} value={c.id}>{c.debtor.name} — {c.loan.accountNumber} — {c.loan.bank}</option>
              ))}
            </select>
            {selectedCase && (
              <p className="text-[11px] text-text-tertiary mt-1">{formatCurrency(selectedCase.loan.currentBalance, selectedCase.loan.currency)} • {selectedCase.crmStatus}</p>
            )}
          </div>

          {/* Recorder controls */}
          <div className="flex flex-wrap gap-2 items-center">
            {!isRecording ? (
              <button onClick={startRecording} className="px-4 py-2 text-sm font-bold bg-red-500 text-white rounded-lg flex items-center gap-2 hover:bg-red-600">
                ⏺ Start Recording
              </button>
            ) : (
              <button onClick={stopRecording} className="px-4 py-2 text-sm font-bold bg-gray-700 text-white rounded-lg flex items-center gap-2 hover:bg-gray-800">
                ⏹ Stop ({fmtSec(recordingTime)})
              </button>
            )}
            <button onClick={toggleLiveTranscript} className={`px-3 py-2 text-xs font-semibold rounded-lg ${liveTranscriptOn ? 'bg-blue-500 text-white' : 'bg-[var(--color-bg-tertiary)] text-text-secondary'}`}>
              🎤 {liveTranscriptOn ? 'Live STT ON' : 'Live STT OFF'}
            </button>
            <label className="px-3 py-2 text-xs font-semibold rounded-lg bg-[var(--color-bg-tertiary)] text-text-secondary cursor-pointer hover:bg-[var(--color-bg-muted)]">
              📁 Upload audio
              <input type="file" accept="audio/*" onChange={handleAudioUpload} className="hidden" />
            </label>
            {audioDataUrl && (
              <span className="text-[11px] text-emerald-600">✓ Audio attached</span>
            )}
          </div>

          {/* Audio preview */}
          {audioDataUrl && (
            <audio controls src={audioDataUrl} className="w-full" />
          )}

          {/* Transcript */}
          <div>
            <label className="block text-[10px] font-bold text-text-secondary uppercase mb-1">Transcript {liveTranscriptOn && <span className="text-blue-600">(live updating)</span>}</label>
            <textarea
              value={transcript}
              onChange={e => setTranscript(e.target.value)}
              rows={6}
              placeholder="Type or paste call transcript here. AI will analyze sentiment, detect PTPs, flag risks..."
              className="w-full px-3 py-2 text-sm rounded-lg resize-none"
            />
            <p className="text-[10px] text-text-tertiary mt-1">{transcript.split(/\s+/).filter(Boolean).length} words</p>
          </div>

          {/* Outcome */}
          <div>
            <label className="block text-[10px] font-bold text-text-secondary uppercase mb-1">Outcome</label>
            <select value={outcome} onChange={e => setOutcome(e.target.value as CallOutcome)} className="w-full px-3 py-2 text-sm rounded-lg">
              <option value="answered">Answered</option>
              <option value="voicemail">Voicemail</option>
              <option value="no_answer">No answer</option>
              <option value="busy">Busy</option>
              <option value="switched_off">Switched off</option>
              <option value="wrong_number">Wrong number</option>
              <option value="refused">Refused</option>
            </select>
            {analysis && (analysis.suggestedOutcome !== outcome) && (
              <button onClick={() => setOutcome(analysis.suggestedOutcome)} className="text-[10px] text-blue-600 hover:underline mt-1">
                💡 AI suggests: {analysis.suggestedOutcome}
              </button>
            )}
          </div>

          {/* Live AI analysis */}
          {analysis && transcript.length > 20 && (
            <div className="panel p-3 bg-[var(--color-bg-tertiary)] space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${sentimentColor[analysis.sentiment]}`}>
                  {sentimentEmoji[analysis.sentiment]} {analysis.sentiment.toUpperCase()}
                </span>
                {analysis.keywords.map(k => (
                  <span key={k} className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">{k}</span>
                ))}
              </div>
              <p className="text-xs"><strong>AI Summary:</strong> {analysis.summary}</p>
              {analysis.flags.length > 0 && (
                <div className="space-y-0.5">
                  {analysis.flags.map((f, i) => <p key={i} className="text-[11px]">{f}</p>)}
                </div>
              )}
              {(analysis.ptp.amount || analysis.ptp.date) && (
                <p className="text-[11px] text-cyan-700 dark:text-cyan-400">
                  💰 PTP detected: {analysis.ptp.amount ? `Amount ${analysis.ptp.amount}` : ''} {analysis.ptp.date ? `Date: ${analysis.ptp.date}` : ''}
                </p>
              )}
            </div>
          )}

          <button onClick={saveCall} disabled={!selectedCaseId || !transcript.trim()} className="btn-primary w-full py-2.5 text-sm disabled:opacity-40">
            Save Call + AI Analysis
          </button>
        </div>

        {/* ── Records list ──────────────────────────────────────────────── */}
        <div className="panel overflow-hidden flex flex-col" style={{ maxHeight: 'calc(100vh - 220px)' }}>
          <div className="p-3 border-b border-[var(--color-border)] space-y-2">
            <h3 className="text-sm font-bold">Past Calls ({filteredRecords.length})</h3>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search transcript / debtor..." className="w-full px-2 py-1.5 text-xs rounded-lg" />
            <select value={filterCaseId} onChange={e => setFilterCaseId(e.target.value)} className="w-full px-2 py-1.5 text-xs rounded-lg">
              <option value="all">All cases</option>
              {myCases.slice(0, 100).map(c => <option key={c.id} value={c.id}>{c.debtor.name}</option>)}
            </select>
          </div>
          <div className="overflow-y-auto flex-1 divide-y divide-[var(--color-border)]">
            {filteredRecords.length === 0 ? (
              <p className="p-6 text-center text-xs text-text-secondary">No calls.</p>
            ) : filteredRecords.map(r => {
              const c = cases.find(x => x.id === r.caseId);
              return (
                <button
                  key={r.id}
                  onClick={() => setSelectedRecordId(r.id === selectedRecordId ? null : r.id)}
                  className={`w-full text-left p-3 hover:bg-[var(--color-bg-muted)] ${selectedRecordId === r.id ? 'bg-[var(--color-primary-glow)]' : ''}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{c?.debtor.name || 'Unknown'}</p>
                      <p className="text-[10px] text-text-tertiary">{new Date(r.timestamp).toLocaleString()}</p>
                    </div>
                    <span className="text-lg">{sentimentEmoji[r.sentiment]}</span>
                  </div>
                  <p className="text-[10px] text-text-secondary mt-1 line-clamp-2">{r.summary}</p>
                  {r.keywords.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {r.keywords.slice(0, 2).map(k => (
                        <span key={k} className="text-[9px] px-1 py-0 bg-[var(--color-bg-tertiary)] rounded">{k}</span>
                      ))}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Selected record detail */}
      {selectedRecord && (
        <div className="panel p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold">Call Details</h3>
            <div className="flex gap-2">
              <button onClick={() => onSelectCase(selectedRecord.caseId)} className="text-xs text-[var(--color-primary)] hover:underline">Open case →</button>
              <button onClick={() => deleteRecord(selectedRecord.id)} className="text-xs text-red-600 hover:underline">Delete</button>
            </div>
          </div>
          {selectedRecord.audioDataUrl && <audio controls src={selectedRecord.audioDataUrl} className="w-full" />}
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${sentimentColor[selectedRecord.sentiment]}`}>
              {sentimentEmoji[selectedRecord.sentiment]} {selectedRecord.sentiment.toUpperCase()}
            </span>
            <span className="text-[10px] text-text-tertiary">{selectedRecord.outcome}</span>
            <span className="text-[10px] text-text-tertiary">{fmtSec(selectedRecord.duration)}</span>
            <span className="text-[10px] text-text-tertiary">by {selectedRecord.officerName}</span>
          </div>
          <p className="text-xs"><strong>Summary:</strong> {selectedRecord.summary}</p>
          <details>
            <summary className="text-xs font-bold cursor-pointer">Full transcript</summary>
            <p className="text-xs text-text-secondary whitespace-pre-line mt-2 bg-[var(--color-bg-tertiary)] p-3 rounded-lg max-h-[200px] overflow-y-auto">{selectedRecord.transcript}</p>
          </details>
          {selectedRecord.flags.length > 0 && (
            <div className="space-y-0.5">
              {selectedRecord.flags.map((f, i) => <p key={i} className="text-[11px]">{f}</p>)}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default VoiceCallStudio;
