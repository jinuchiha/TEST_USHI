import React, { useState } from 'react';
import { User, Role } from '../../types';
import { ICONS } from '../../constants';
import { importApi, ImportPreview, ImportResult } from '../../src/api';

interface ImportCenterProps {
  users: User[];
  currentUser: User;
  onImported?: () => void;
}

type Step = 'upload' | 'preview' | 'importing' | 'done';

const ImportCenter: React.FC<ImportCenterProps> = ({ users, currentUser }) => {
  const [step, setStep] = useState<Step>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [assignedOfficerId, setAssignedOfficerId] = useState<string>('');
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const officers = users.filter(u => u.role === Role.OFFICER);

  if (currentUser.role !== Role.MANAGER && currentUser.role !== Role.ADMIN && currentUser.role !== Role.CEO) {
    return (
      <div className="panel p-12 text-center">
        <p className="text-text-secondary">Only Manager / Admin / CEO can import cases.</p>
      </div>
    );
  }

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setError('');
    setLoading(true);
    try {
      const res = await importApi.preview(f);
      setPreview(res.data);
      setStep('preview');
    } catch (err: any) {
      setError(err.message || 'Failed to parse file');
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    if (!file) return;
    setStep('importing');
    setError('');
    try {
      const res = await importApi.importCases(file, assignedOfficerId || undefined);
      setResult(res.data);
      setStep('done');
    } catch (err: any) {
      setError(err.message || 'Import failed');
      setStep('preview');
    }
  };

  const reset = () => {
    setStep('upload');
    setFile(null);
    setPreview(null);
    setResult(null);
    setError('');
    setAssignedOfficerId('');
  };

  return (
    <div className="space-y-6 animate-page-enter">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-text-primary flex items-center gap-3">
            <span className="text-3xl">📥</span>
            Import Center
          </h1>
          <p className="text-sm text-text-secondary mt-1">Upload CSV from Google Sheets / Excel — auto-detects columns</p>
        </div>
        {step !== 'upload' && (
          <button onClick={reset} className="btn-secondary px-3 py-2 text-xs">Start Over</button>
        )}
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2">
        {(['upload', 'preview', 'importing', 'done'] as Step[]).map((s, i) => {
          const active = s === step;
          const done = (['upload', 'preview', 'importing', 'done'] as Step[]).indexOf(step) > i;
          return (
            <React.Fragment key={s}>
              <div className={`flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-full ${active ? 'bg-[var(--color-primary)] text-white' : done ? 'bg-[var(--color-primary-glow)] text-[var(--color-primary)]' : 'bg-[var(--color-bg-tertiary)] text-text-secondary'}`}>
                <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-[10px]">{i + 1}</span>
                {s === 'upload' ? 'Upload' : s === 'preview' ? 'Preview & Map' : s === 'importing' ? 'Importing' : 'Done'}
              </div>
              {i < 3 && <div className={`flex-1 h-0.5 ${done ? 'bg-[var(--color-primary)]' : 'bg-[var(--color-border)]'}`} />}
            </React.Fragment>
          );
        })}
      </div>

      {error && (
        <div className="panel p-3 border-l-4 border-red-400 bg-red-50 dark:bg-red-900/20">
          <p className="text-xs text-red-700 dark:text-red-400 font-semibold">⚠️ {error}</p>
        </div>
      )}

      {/* ── Step 1: Upload ──────────────────────────────────────────── */}
      {step === 'upload' && (
        <div className="panel p-8 text-center space-y-4">
          <div className="text-5xl">📁</div>
          <h2 className="text-lg font-bold">Upload CSV file</h2>
          <p className="text-sm text-text-secondary max-w-md mx-auto">
            From Google Sheets: <strong>File → Download → Comma Separated Values (.csv)</strong><br />
            From Excel: <strong>Save As → CSV (Comma delimited)</strong>
          </p>

          <div className="max-w-2xl mx-auto p-4 bg-[var(--color-bg-tertiary)] rounded-lg text-left space-y-2">
            <p className="text-[11px] font-bold text-text-tertiary uppercase">Expected columns (auto-detected, case-insensitive)</p>
            <p className="text-xs text-text-secondary">
              <strong>Required:</strong> Name, Account, O/S (or Outstanding)<br />
              <strong>Optional:</strong> CNIC, Number (phone), Email, EID, Passport, Bank, Sub Product, Bucket / Recovery, Date, DOB, LPD, WOD, CIF, ICA, BANK CORD, CRM Status, Sub Status, Contact / Non Contact, Work / Non Work, Tracing Status, CYBER, Status Code
            </p>
            <div className="pt-2 border-t border-[var(--color-border)] space-y-1">
              <p className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400">⭐ Per-officer assignment (auto)</p>
              <p className="text-xs text-text-secondary">
                Add an <strong>"Officer"</strong> or <strong>"Agent"</strong> column to your sheet with values:<br />
                <code className="text-[11px] bg-[var(--color-bg-primary)] px-1 rounded">AM</code> (Aleena),
                <code className="text-[11px] bg-[var(--color-bg-primary)] px-1 rounded ml-1">HI</code> (Hirra),
                <code className="text-[11px] bg-[var(--color-bg-primary)] px-1 rounded ml-1">MB</code> (Mehar),
                <code className="text-[11px] bg-[var(--color-bg-primary)] px-1 rounded ml-1">GS</code> (Gulaly),
                <code className="text-[11px] bg-[var(--color-bg-primary)] px-1 rounded ml-1">MG</code> (Mahreen)
                <br />Or use full names: <code className="text-[11px] bg-[var(--color-bg-primary)] px-1 rounded">Aleena</code>, <code className="text-[11px] bg-[var(--color-bg-primary)] px-1 rounded ml-1">Hirra</code>, etc.
              </p>
            </div>
          </div>

          <label className="btn-primary inline-block px-6 py-3 text-sm cursor-pointer">
            {loading ? 'Parsing...' : '📤 Choose CSV File'}
            <input type="file" accept=".csv,.txt" onChange={handleFile} className="hidden" disabled={loading} />
          </label>

          <p className="text-[11px] text-text-tertiary">Max ~5,000 rows per import (large files: split into chunks)</p>
        </div>
      )}

      {/* ── Step 2: Preview & confirm ───────────────────────────────── */}
      {step === 'preview' && preview && (
        <>
          <div className="panel p-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <p className="text-[10px] text-text-secondary uppercase">File</p>
                <p className="text-sm font-bold truncate">{file?.name}</p>
              </div>
              <div>
                <p className="text-[10px] text-text-secondary uppercase">Rows</p>
                <p className="text-sm font-bold">{preview.rowCount}</p>
              </div>
              <div>
                <p className="text-[10px] text-text-secondary uppercase">Columns</p>
                <p className="text-sm font-bold">{preview.headers.length}</p>
              </div>
              <div>
                <p className="text-[10px] text-text-secondary uppercase">Mapped</p>
                <p className="text-sm font-bold text-emerald-600">{Object.keys(preview.mapping).length}</p>
              </div>
            </div>
          </div>

          {/* Auto-detected mapping */}
          <div className="panel p-4">
            <h3 className="text-sm font-bold mb-3">Auto-detected Field Mapping</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {Object.entries(preview.mapping).map(([field, csvCol]) => (
                <div key={field} className="text-xs flex items-center justify-between p-2 rounded bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800">
                  <span className="font-bold text-emerald-700 dark:text-emerald-400">{field}</span>
                  <span className="text-text-secondary">←</span>
                  <span className="text-text-primary truncate ml-1">{csvCol}</span>
                </div>
              ))}
              {preview.headers.filter(h => !Object.values(preview.mapping).includes(h)).map(h => (
                <div key={h} className="text-xs flex items-center justify-between p-2 rounded bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 opacity-60">
                  <span className="text-text-tertiary line-through">unmapped</span>
                  <span className="text-text-tertiary">←</span>
                  <span className="text-text-tertiary truncate ml-1">{h}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Sample preview */}
          <div className="panel overflow-hidden">
            <div className="p-3 border-b border-[var(--color-border)]">
              <h3 className="text-sm font-bold">Preview — first {Math.min(5, preview.sampleRows.length)} rows</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-[var(--color-bg-tertiary)]">
                  <tr>
                    {preview.headers.slice(0, 8).map(h => (
                      <th key={h} className="text-left py-2 px-3 text-[10px] font-semibold text-text-secondary whitespace-nowrap">{h}</th>
                    ))}
                    {preview.headers.length > 8 && <th className="text-left py-2 px-3 text-[10px] text-text-tertiary">+{preview.headers.length - 8} more</th>}
                  </tr>
                </thead>
                <tbody>
                  {preview.sampleRows.slice(0, 5).map((row, i) => (
                    <tr key={i} className="border-t border-[var(--color-border)]">
                      {preview.headers.slice(0, 8).map(h => (
                        <td key={h} className="py-1.5 px-3 text-text-secondary truncate max-w-[150px]">{row[h] || '—'}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Officer assignment */}
          <div className="panel p-4 space-y-3">
            <h3 className="text-sm font-bold">Assign Cases To</h3>
            <select value={assignedOfficerId} onChange={e => setAssignedOfficerId(e.target.value)} className="w-full px-3 py-2 text-sm rounded-lg">
              <option value="">Unassigned (allocate later from Team Allocation)</option>
              {officers.map(o => (
                <option key={o.id} value={o.id}>{o.agentCode ? `${o.agentCode} ` : ''}{o.name}</option>
              ))}
            </select>
            <p className="text-[11px] text-text-tertiary">All {preview.rowCount} cases will be assigned to selected officer. Bulk re-assignment possible later.</p>
          </div>

          <div className="flex gap-2 justify-end">
            <button onClick={reset} className="btn-secondary px-5 py-2.5 text-sm">Cancel</button>
            <button onClick={handleImport} className="btn-primary px-5 py-2.5 text-sm font-bold">
              Import {preview.rowCount} cases →
            </button>
          </div>
        </>
      )}

      {/* ── Step 3: Importing ──────────────────────────────────────── */}
      {step === 'importing' && (
        <div className="panel p-12 text-center space-y-4">
          <div className="animate-spin w-12 h-12 mx-auto border-4 border-[var(--color-primary)] border-t-transparent rounded-full" />
          <p className="text-sm font-bold">Importing... please wait</p>
          <p className="text-xs text-text-tertiary">Creating debtors, loans, and cases. May take 30-60 seconds for large files.</p>
        </div>
      )}

      {/* ── Step 4: Done ───────────────────────────────────────────── */}
      {step === 'done' && result && (
        <>
          <div className="panel p-8 text-center bg-gradient-to-br from-emerald-50 to-blue-50 dark:from-emerald-900/20 dark:to-blue-900/20">
            <div className="text-6xl mb-3">✅</div>
            <h2 className="text-2xl font-bold mb-2">Import Complete</h2>
            <div className="grid grid-cols-3 gap-4 max-w-md mx-auto mt-4">
              <div>
                <p className="text-3xl font-bold text-emerald-600">{result.imported}</p>
                <p className="text-[11px] text-text-tertiary">Imported</p>
              </div>
              <div>
                <p className="text-3xl font-bold text-amber-600">{result.skipped}</p>
                <p className="text-[11px] text-text-tertiary">Skipped</p>
              </div>
              <div>
                <p className="text-3xl font-bold text-text-primary">{result.imported + result.skipped}</p>
                <p className="text-[11px] text-text-tertiary">Total</p>
              </div>
            </div>
          </div>

          {result.byOfficer && result.byOfficer.length > 0 && (
            <div className="panel">
              <div className="p-3 border-b border-[var(--color-border)]">
                <h3 className="text-sm font-bold">Distribution by officer</h3>
              </div>
              <div className="p-3 space-y-2">
                {result.byOfficer.map(o => (
                  <div key={o.officerId} className="flex items-center justify-between text-sm">
                    <span className="font-semibold">{o.officerName}</span>
                    <span className="px-3 py-1 text-xs font-bold rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                      {o.count} cases
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {result.errors.length > 0 && (
            <div className="panel">
              <div className="p-3 border-b border-[var(--color-border)]">
                <h3 className="text-sm font-bold">Skipped rows ({result.errors.length})</h3>
              </div>
              <div className="max-h-[300px] overflow-y-auto p-3 space-y-1 text-xs">
                {result.errors.slice(0, 50).map((e, i) => <p key={i} className="text-amber-700 dark:text-amber-400">{e}</p>)}
                {result.errors.length > 50 && <p className="text-text-tertiary">... and {result.errors.length - 50} more</p>}
              </div>
            </div>
          )}

          <div className="flex gap-2 justify-end">
            <button onClick={reset} className="btn-primary px-5 py-2.5 text-sm">Import another file</button>
          </div>
        </>
      )}
    </div>
  );
};

export default ImportCenter;
