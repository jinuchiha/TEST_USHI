import React, { useState, useRef, useEffect } from 'react';
import { User } from '../../types';
import { ICONS } from '../../constants';

// ── Debtor personas ──────────────────────────────────────────────────────────
type PersonaType = 'angry' | 'hardship' | 'evasive' | 'disputer' | 'engaged' | 'student';

interface Persona {
  type: PersonaType;
  name: string;
  bg: string;
  description: string;
  difficulty: 1 | 2 | 3 | 4 | 5;
  initialMood: number; // -100 to +100
  responses: ResponsePattern[];
}

interface ResponsePattern {
  triggers: string[];           // keywords in officer's message
  responses: string[];          // possible debtor responses
  moodDelta: number;            // how mood changes
  scoreImpact: number;          // points officer earns/loses
  hint?: string;                // optional coaching tip
}

const PERSONAS: Persona[] = [
  {
    type: 'angry', name: 'Khalid Mahmood (Angry)',
    bg: 'Lost job last month, owes AED 65,000. Hates collection calls.',
    description: '🔥 Angry, defensive, ready to hang up. Difficulty 4/5.',
    difficulty: 4, initialMood: -50,
    responses: [
      {
        triggers: ['assalam', 'hello', 'hi', 'introduction', 'main'],
        responses: ['Aap kaun? Number kahan se mila? Mujhe call mat kiya karein!', 'Yaar yeh number kahan se liya tum logon ne? Block kar raha hoon.'],
        moodDelta: -5, scoreImpact: 0,
        hint: 'Stay calm. Don\'t apologize excessively. Identify yourself and the bank clearly.',
      },
      {
        triggers: ['settle', 'settlement', 'discount', 'offer'],
        responses: ['Settlement? Pehle full waiver karo, phir baat karenge.', 'Mujhe 80% discount chahiye, warna kuch nahi.'],
        moodDelta: 5, scoreImpact: 10,
        hint: 'Good — pivot to settlement de-escalates anger. Counter with realistic %.',
      },
      {
        triggers: ['legal', 'court', 'lawyer', '489', 'case'],
        responses: ['Karo legal! Mere paas kuch nahi hai!', 'Damaki de rahe ho? Recording kar raha hoon.'],
        moodDelta: -15, scoreImpact: -15,
        hint: '⚠️ Avoid legal threats early. This raises hostility. Focus on resolution.',
      },
      {
        triggers: ['bank', 'enbd', 'fab', 'adcb', 'snb', 'loan', 'card'],
        responses: ['Haan ek dafa loan liya tha, lekin ab bank merge ho gaya hai. Mere paisay khaye huye hain bank ne.', 'Bank ne galat charges lagaye hain. Pay nahi karunga.'],
        moodDelta: 0, scoreImpact: 5,
        hint: 'Acknowledge his concern. Offer to resolve disputes through proper channel.',
      },
      {
        triggers: ['sorry', 'apologize', 'understand', 'samjh', 'maaf'],
        responses: ['Acha bhai theek hai. Bolo kya kehna hai?', 'Hmm. 5 minute hain, jaldi bolo.'],
        moodDelta: 15, scoreImpact: 8,
        hint: 'Empathy works on angry debtors. Now stay focused and propose action.',
      },
    ],
  },
  {
    type: 'hardship', name: 'Sumera Ali (Genuine Hardship)',
    bg: 'Husband passed away 6 months ago. AED 28,000 credit card. 2 kids. No income.',
    description: '😔 Genuinely struggling, sympathetic. Difficulty 2/5.',
    difficulty: 2, initialMood: 0,
    responses: [
      {
        triggers: ['assalam', 'hello', 'main', 'bank', 'recovery'],
        responses: ['Ji, bolein. Lekin pehle bata doon — meri situation kharab hai.', 'Aap ko meri situation samajhna chahiye.'],
        moodDelta: 5, scoreImpact: 5,
      },
      {
        triggers: ['why', 'kyun', 'reason', 'kyo'],
        responses: ['Mere shohar 6 mahine pehle inteqal kar gaye. Mai ghar pe hoon, 2 bachay hain. Koi job nahi mil rahi.', 'Mai aapko jhooth nahi keh rahi. Aap khud check kar sakte ho.'],
        moodDelta: 10, scoreImpact: 8,
        hint: 'Listen genuinely. Document hardship for hardship review.',
      },
      {
        triggers: ['settle', 'pay', 'discount', 'kitna'],
        responses: ['Mai 5,000 AED de sakti hoon, woh bhi family help mangne ke baad.', 'Agar discount mil jaye to kuch arrange kar sakti hoon.'],
        moodDelta: 5, scoreImpact: 15,
        hint: 'Good. Hardship cases respond well to deep settlement (60-80% off). Get bank approval.',
      },
      {
        triggers: ['document', 'death', 'certificate', 'proof'],
        responses: ['Death certificate hai mere paas. Bank ko nahi diya kabhi.', 'Aap ko kya documents chahiye?'],
        moodDelta: 8, scoreImpact: 12,
        hint: 'Crucial — collect death certificate, this changes case classification entirely.',
      },
      {
        triggers: ['family', 'walid', 'bhai', 'support'],
        responses: ['Mere walid retired hain, 50,000 PKR pension hai. Bhai unemployed hai.', 'Ghar walay help kar rahe hain magar ye amount bohat zyada hai.'],
        moodDelta: 5, scoreImpact: 5,
      },
    ],
  },
  {
    type: 'evasive', name: 'Tariq Hussain (Evasive)',
    bg: 'AED 45,000 personal loan. Has money but plays dumb. Always "out of station".',
    description: '🦊 Slippery, makes excuses, never commits. Difficulty 5/5.',
    difficulty: 5, initialMood: 10,
    responses: [
      {
        triggers: ['assalam', 'hello', 'bank'],
        responses: ['Acha haan haan. Mai abhi out of station hoon, baad mein call karna.', 'Yaar abhi busy hoon, weekend mein milte hain.'],
        moodDelta: 0, scoreImpact: 0,
        hint: 'He delays. Don\'t accept vague timing. Pin a specific time TODAY.',
      },
      {
        triggers: ['when', 'kab', 'specific', 'today', 'aaj', 'time'],
        responses: ['Hmm... agle hafte? Mai dekhta hoon.', 'Pakka time abhi nahi de sakta yaar.'],
        moodDelta: -3, scoreImpact: 5,
        hint: 'Push harder. Offer 2 specific time slots ("4 PM ya 6 PM?"). Make him pick.',
      },
      {
        triggers: ['settlement', 'discount', '50', '60', '70', 'kitna'],
        responses: ['Settlement to mujhe karna hi nahi. Bank ko bolo extra time de.', 'Discount itna kam hai? Mai 70% off pe sochon ga.'],
        moodDelta: 0, scoreImpact: 5,
        hint: 'He plays for time. Set a 7-day deadline. After that, escalate.',
      },
      {
        triggers: ['final', 'last', 'deadline', 'legal', 'escalate'],
        responses: ['Yaar dramatic mat ho. Hum log dost hain.', 'Theek hai theek hai, kal payment kar deta hoon.'],
        moodDelta: 5, scoreImpact: 12,
        hint: 'Firmness works. But "kal" is still vague — get bank reference at moment of call.',
      },
      {
        triggers: ['employer', 'office', 'job', 'work', 'company'],
        responses: ['Job change ho gayi hai, naya company ka address nahi de sakta.', 'Mere office ko mat call karna please.'],
        moodDelta: -10, scoreImpact: 8,
        hint: '🎯 Employer mention = leverage. He fears it. Use ethically.',
      },
    ],
  },
  {
    type: 'disputer', name: 'Imran Sheikh (Disputer)',
    bg: 'AED 18,000 credit card. Claims charges are fraudulent. Says he never used it.',
    description: '⚖️ Disputes everything, demands paperwork. Difficulty 3/5.',
    difficulty: 3, initialMood: -10,
    responses: [
      {
        triggers: ['assalam', 'hello', 'bank'],
        responses: ['Han bolo, lekin pehle bata doon — yeh charges meray nahi hain.', 'Mujhe pehle proof do kya kya charges hain.'],
        moodDelta: 0, scoreImpact: 5,
      },
      {
        triggers: ['statement', 'proof', 'dispute', 'document'],
        responses: ['Bilkul, mai dispute file karna chahta hoon. Form bhejo.', 'Statement bhejo email pe, mai check karunga.'],
        moodDelta: 8, scoreImpact: 12,
        hint: 'Engage the dispute process formally. Bank handles disputes — log this.',
      },
      {
        triggers: ['fraud', 'cyber', 'identity', 'theft'],
        responses: ['Haan exactly! Card chori ho gaya tha, FIR bhi ki thi.', 'Iska matlab cyber crime case banta hai.'],
        moodDelta: 10, scoreImpact: 10,
        hint: '🚨 Cyber/fraud claim = case classification change. Document FIR if real.',
      },
      {
        triggers: ['settle', 'discount', 'pay', 'amount'],
        responses: ['Settle kyun karoon, mera kuch nahi hai!', 'Pehle dispute resolve karo, phir baat karenge.'],
        moodDelta: -5, scoreImpact: -5,
        hint: '⚠️ Don\'t push settlement before dispute resolves. He\'ll dig in.',
      },
      {
        triggers: ['investigation', 'audit', 'verify', 'check'],
        responses: ['Bilkul, investigation karo. Mai cooperation karunga.', 'Bank ko bolo audit kare.'],
        moodDelta: 5, scoreImpact: 15,
        hint: 'Excellent — cooperation tone. Forward to bank dispute team.',
      },
    ],
  },
  {
    type: 'engaged', name: 'Ahmed Raza (Engaged but cash-flow problem)',
    bg: 'Salaried IT pro, AED 35,000 personal loan. Lost overtime, salary cut by 30%.',
    description: '✅ Wants to pay, just needs flexibility. Difficulty 1/5.',
    difficulty: 1, initialMood: 30,
    responses: [
      {
        triggers: ['assalam', 'hello', 'bank', 'recovery'],
        responses: ['Haan bhai, mai khud aap se contact karna chahta tha. Salary kam ho gayi hai.', 'Aap ka phone aagaya, accha hua. Plan banate hain.'],
        moodDelta: 5, scoreImpact: 10,
      },
      {
        triggers: ['installment', 'plan', 'qist', 'monthly'],
        responses: ['Mai 5,000 monthly afford kar sakta hoon, 7 mahine mein.', 'Installment plan agar bana lein to perfect.'],
        moodDelta: 10, scoreImpact: 20,
        hint: 'Capture this — get bank reference for first installment immediately.',
      },
      {
        triggers: ['salary', 'income', 'job', 'employer'],
        responses: ['IT firm mein hoon, 7 saal se. Salary slip de sakta hoon.', '120,000 PKR le ke aata tha, ab 85,000 hai.'],
        moodDelta: 5, scoreImpact: 8,
      },
      {
        triggers: ['settle', 'discount', 'one-time', 'lumpsum'],
        responses: ['Lumpsum ke liye paisa nahi hai. Installments mein kar sakta hoon.', 'Agar 30% off ka offer ho to family se le ke ek shot mein de doon.'],
        moodDelta: 5, scoreImpact: 15,
        hint: 'Good signal. Offer settlement at 25-30% off if paid in 7 days. Bank approval needed.',
      },
      {
        triggers: ['date', 'when', 'kab', 'kal', 'today'],
        responses: ['Aaj sham tak bank account number bhejo, mai online transfer kar deta hoon.', 'Kal subah branch jaaunga.'],
        moodDelta: 5, scoreImpact: 18,
        hint: 'Excellent — make sure transfer reference comes back to you same day.',
      },
    ],
  },
  {
    type: 'student', name: 'Omar Saeed (Student/Young)',
    bg: 'AED 12,000 credit card. Used as student in UAE, came back to PK without job.',
    description: '🎓 Young, defensive, parents don\'t know about debt. Difficulty 3/5.',
    difficulty: 3, initialMood: -20,
    responses: [
      {
        triggers: ['assalam', 'hello', 'bank'],
        responses: ['Aap mere ghar pe call mat karein please. Mere walid ko nahi pata.', 'Bhai chup chup bolein, ghar mein hoon.'],
        moodDelta: 0, scoreImpact: 0,
        hint: '⚠️ He fears family disclosure. Use ethically — never threaten to tell family.',
      },
      {
        triggers: ['parents', 'walid', 'family', 'disclose'],
        responses: ['Plz family ko mat batayein! Mai khud hi solution nikaalta hoon.', 'Yeh personal hai mera, ghar walay involve mat karein.'],
        moodDelta: -10, scoreImpact: -20,
        hint: '🚫 NEVER threaten family disclosure. Strict regulatory violation.',
      },
      {
        triggers: ['job', 'work', 'career', 'income'],
        responses: ['Job dhoondh raha hoon, ek mahine mein lag jayegi shayad.', 'Freelance kar raha hoon, monthly 50k PKR aata hai.'],
        moodDelta: 5, scoreImpact: 8,
      },
      {
        triggers: ['settle', 'discount', 'help', 'small'],
        responses: ['Yaar mai 5000 AED arrange kar sakta hoon ek dafa, baqi waiver kar do?', 'Mai itna kama nahi sakta turant.'],
        moodDelta: 10, scoreImpact: 15,
        hint: 'Small credit card cases — bank often approves 50-70% settlement for clean closure.',
      },
      {
        triggers: ['plan', 'installment', 'qist', 'monthly'],
        responses: ['Monthly 1500 AED de sakta hoon, 8 mahine mein settle ho jayega.', 'Plan banate hain to commit kar sakta hoon.'],
        moodDelta: 8, scoreImpact: 18,
      },
    ],
  },
];

// ── Component ────────────────────────────────────────────────────────────────
interface NegotiationSimProps {
  currentUser: User;
}

interface SimMessage {
  role: 'officer' | 'debtor' | 'system';
  text: string;
  hint?: string;
  scoreImpact?: number;
  timestamp: string;
}

const NegotiationSim: React.FC<NegotiationSimProps> = ({ currentUser }) => {
  const [persona, setPersona] = useState<Persona | null>(null);
  const [messages, setMessages] = useState<SimMessage[]>([]);
  const [input, setInput] = useState('');
  const [mood, setMood] = useState(0);
  const [score, setScore] = useState(0);
  const [turnCount, setTurnCount] = useState(0);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages.length]);

  const startSession = (p: Persona) => {
    setPersona(p);
    setMood(p.initialMood);
    setScore(0);
    setTurnCount(0);
    setMessages([
      { role: 'system', text: `🎬 Session started: ${p.name}\nDifficulty: ${'⭐'.repeat(p.difficulty)}\nBackground: ${p.bg}\n\nOfficer ${currentUser.name}, you can begin. Type your opening line.`, timestamp: new Date().toISOString() },
    ]);
  };

  const send = () => {
    if (!input.trim() || !persona) return;
    const officerMsg: SimMessage = { role: 'officer', text: input, timestamp: new Date().toISOString() };

    // Find matching response pattern
    const lower = input.toLowerCase();
    const matches = persona.responses.filter(r => r.triggers.some(t => lower.includes(t)));
    const pattern = matches.length > 0 ? matches[Math.floor(Math.random() * matches.length)] : null;

    let debtorMsg: SimMessage;
    if (pattern) {
      const pick = pattern.responses[Math.floor(Math.random() * pattern.responses.length)];
      debtorMsg = {
        role: 'debtor',
        text: pick,
        hint: pattern.hint,
        scoreImpact: pattern.scoreImpact,
        timestamp: new Date().toISOString(),
      };
      setMood(prev => Math.max(-100, Math.min(100, prev + pattern.moodDelta)));
      setScore(prev => prev + pattern.scoreImpact);
    } else {
      // No keyword match — generic response based on mood
      const generic = mood > 30
        ? ['Hmm. Aage bolein.', 'Kya kehna hai aap ka?']
        : mood > -30
          ? ['Theek hai sun raha hoon...', 'Acha?']
          : ['Yaar yeh sab waste of time hai.', 'Mai kya kahun aap se?'];
      debtorMsg = {
        role: 'debtor',
        text: generic[Math.floor(Math.random() * generic.length)],
        hint: 'Try keywords: settlement, installment, employer, dispute, family, salary, why.',
        timestamp: new Date().toISOString(),
      };
    }

    setMessages(prev => [...prev, officerMsg, debtorMsg]);
    setInput('');
    setTurnCount(t => t + 1);
  };

  const endSession = () => {
    if (!persona) return;
    const moodOutcome = mood > 30 ? 'positive — debtor opened up' : mood > -30 ? 'neutral' : 'hostile — debtor disengaged';
    const grade = score >= 60 ? 'A — excellent recovery setup'
      : score >= 30 ? 'B — solid, room to improve'
        : score >= 0 ? 'C — survived, but no commitment'
          : 'F — case damaged, would need recovery from new officer';
    setMessages(prev => [...prev, {
      role: 'system',
      text: `🏁 Session ended.\n\nTurns: ${turnCount}\nFinal mood: ${mood} (${moodOutcome})\nScore: ${score}\nGrade: ${grade}\n\nKey insight: ${score >= 30 ? 'You navigated this case well. Replicate this approach.' : 'Review the hints — they show where points were lost.'}`,
      timestamp: new Date().toISOString(),
    }]);
  };

  return (
    <div className="space-y-6 animate-page-enter">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-text-primary flex items-center gap-3">
            <span className="text-3xl">🎭</span>
            AI Negotiation Simulator
          </h1>
          <p className="text-sm text-text-secondary mt-1">Practice on AI debtor — different personas, real-time feedback, scoring</p>
        </div>
        {persona && (
          <div className="flex gap-2">
            <button onClick={endSession} className="btn-secondary px-3 py-2 text-xs">End Session</button>
            <button onClick={() => { setPersona(null); setMessages([]); }} className="btn-primary px-3 py-2 text-xs">New Persona</button>
          </div>
        )}
      </div>

      {!persona ? (
        <>
          <div className="panel p-4 border-l-4 border-blue-400">
            <p className="text-xs text-text-secondary leading-relaxed">
              <strong>How it works:</strong> Pick a debtor persona below. AI roleplays as that debtor based on real Pakistani recovery patterns.
              You type your responses, AI replies + tracks mood + scores your moves. Hints appear after each turn so you learn in real time.
              Used for training new officers and refining experienced ones.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {PERSONAS.map(p => (
              <button
                key={p.type}
                onClick={() => startSession(p)}
                className="panel p-4 text-left hover:border-[var(--color-primary)] hover:bg-[var(--color-bg-muted)] transition-colors space-y-2"
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold">{p.name}</h3>
                  <span className="text-xs">{'⭐'.repeat(p.difficulty)}</span>
                </div>
                <p className="text-xs text-text-tertiary">{p.description}</p>
                <p className="text-[11px] text-text-secondary border-t border-[var(--color-border)] pt-2">{p.bg}</p>
              </button>
            ))}
          </div>
        </>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          {/* Live stats */}
          <div className="space-y-3">
            <div className="panel p-3">
              <p className="text-[10px] text-text-tertiary uppercase">Persona</p>
              <p className="text-sm font-bold mt-1">{persona.name}</p>
              <p className="text-[10px] text-text-tertiary mt-1">{'⭐'.repeat(persona.difficulty)} difficulty</p>
            </div>
            <div className="panel p-3">
              <p className="text-[10px] text-text-tertiary uppercase">Mood</p>
              <div className="flex items-center gap-2 mt-1">
                <div className="flex-1 h-2 rounded-full bg-[var(--color-bg-tertiary)] overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${mood > 30 ? 'bg-emerald-500' : mood > -30 ? 'bg-amber-500' : 'bg-red-500'}`}
                    style={{ width: `${Math.max(5, (mood + 100) / 2)}%` }}
                  />
                </div>
                <span className="text-xs font-bold">{mood > 0 ? '+' : ''}{mood}</span>
              </div>
              <p className="text-[10px] text-text-tertiary mt-1">{mood > 30 ? '😊 Engaged' : mood > -30 ? '😐 Neutral' : '😡 Hostile'}</p>
            </div>
            <div className="panel p-3">
              <p className="text-[10px] text-text-tertiary uppercase">Score</p>
              <p className={`text-2xl font-bold mt-1 ${score >= 30 ? 'text-emerald-600' : score >= 0 ? 'text-amber-600' : 'text-red-600'}`}>{score}</p>
              <p className="text-[10px] text-text-tertiary">{turnCount} turns</p>
            </div>
            <div className="panel p-3">
              <p className="text-[10px] text-text-tertiary uppercase mb-2">Try keywords</p>
              <div className="flex flex-wrap gap-1">
                {['assalam', 'salary', 'settlement', 'installment', 'employer', 'family', 'why', 'when', 'discount', 'plan'].map(k => (
                  <span key={k} className="text-[9px] px-1.5 py-0.5 bg-[var(--color-bg-tertiary)] rounded text-text-secondary">{k}</span>
                ))}
              </div>
            </div>
          </div>

          {/* Chat */}
          <div className="lg:col-span-3 panel flex flex-col h-[calc(100vh-220px)]">
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.map((m, i) => (
                <div key={i}>
                  {m.role === 'system' ? (
                    <div className="text-center my-3">
                      <div className="inline-block max-w-[80%] bg-[var(--color-bg-tertiary)] rounded-xl px-4 py-3 text-xs whitespace-pre-line text-text-secondary">
                        {m.text}
                      </div>
                    </div>
                  ) : (
                    <div className={`flex ${m.role === 'officer' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[80%] rounded-2xl px-3 py-2 ${m.role === 'officer' ? 'bg-[var(--color-primary)] text-white' : 'bg-[var(--color-bg-tertiary)]'}`}>
                        <p className="text-xs whitespace-pre-line">{m.text}</p>
                        {m.hint && (
                          <div className="mt-2 pt-2 border-t border-[var(--color-border)] text-[10px] italic text-amber-700 dark:text-amber-400">
                            💡 {m.hint}
                          </div>
                        )}
                        {m.scoreImpact !== undefined && m.scoreImpact !== 0 && (
                          <p className={`text-[10px] mt-1 font-bold ${m.scoreImpact > 0 ? 'text-emerald-300' : 'text-red-300'}`}>
                            {m.scoreImpact > 0 ? '+' : ''}{m.scoreImpact} points
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
              <div ref={endRef} />
            </div>
            <div className="p-3 border-t border-[var(--color-border)] flex gap-2">
              <input
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && send()}
                placeholder={`Type your response to ${persona.name}...`}
                className="flex-1 px-3 py-2 text-sm rounded-lg"
              />
              <button onClick={send} disabled={!input.trim()} className="btn-primary px-4 py-2 text-sm disabled:opacity-40">Send</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NegotiationSim;
