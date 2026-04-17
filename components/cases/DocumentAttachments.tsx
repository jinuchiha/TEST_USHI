import React, { useState, useEffect, useRef, useCallback } from 'react';
import { User } from '../../types';

interface CaseDocument {
  id: string;
  name: string;
  type: string;
  dataUrl: string;
  uploadedBy: string;
  uploadedByName: string;
  uploadedAt: string;
  category: DocCategory;
}

type DocCategory = 'ID Document' | 'Settlement Letter' | 'Payment Receipt' | 'Legal Notice' | 'Authority Letter' | 'Other';

const CATEGORIES: DocCategory[] = ['ID Document', 'Settlement Letter', 'Payment Receipt', 'Legal Notice', 'Authority Letter', 'Other'];
const ACCEPT = '.pdf,.png,.jpg,.jpeg,.gif,.bmp,.doc,.docx';
const MAX_SIZE = 5 * 1024 * 1024;

interface DocumentAttachmentsProps {
  caseId: string;
  debtorName: string;
  currentUser: User;
}

const getStorageKey = (caseId: string) => `rv_case_docs_${caseId}`;

const getFileIcon = (type: string) => {
  if (type.includes('pdf')) return { icon: '📄', color: 'var(--color-danger, #dc2626)' };
  if (type.startsWith('image/')) return { icon: '🖼️', color: 'var(--color-info, #2563eb)' };
  return { icon: '📝', color: 'var(--color-primary, #1e3a5f)' };
};

const truncate = (str: string, max = 28) => str.length > max ? str.slice(0, max) + '...' : str;

const DocumentAttachments: React.FC<DocumentAttachmentsProps> = ({ caseId, debtorName, currentUser }) => {
  const [docs, setDocs] = useState<CaseDocument[]>([]);
  const [filterCat, setFilterCat] = useState<DocCategory | 'All'>('All');
  const [uploadCat, setUploadCat] = useState<DocCategory>('Other');
  const [error, setError] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const loadDocs = useCallback(() => {
    try {
      const raw = localStorage.getItem(getStorageKey(caseId));
      setDocs(raw ? JSON.parse(raw) : []);
    } catch { setDocs([]); }
  }, [caseId]);

  useEffect(() => { loadDocs(); }, [loadDocs]);

  const saveDocs = (updated: CaseDocument[]) => {
    localStorage.setItem(getStorageKey(caseId), JSON.stringify(updated));
    setDocs(updated);
  };

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError('');
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_SIZE) { setError('File exceeds 5MB limit.'); e.target.value = ''; return; }

    const reader = new FileReader();
    reader.onload = () => {
      const newDoc: CaseDocument = {
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
        name: file.name,
        type: file.type,
        dataUrl: reader.result as string,
        uploadedBy: currentUser.id,
        uploadedByName: currentUser.name,
        uploadedAt: new Date().toISOString(),
        category: uploadCat,
      };
      saveDocs([newDoc, ...docs]);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleDelete = (id: string) => {
    saveDocs(docs.filter(d => d.id !== id));
    setConfirmDeleteId(null);
  };

  const handleDownload = (doc: CaseDocument) => {
    const a = document.createElement('a');
    a.href = doc.dataUrl;
    a.download = doc.name;
    a.click();
  };

  const filtered = filterCat === 'All' ? docs : docs.filter(d => d.category === filterCat);

  const sectionStyle: React.CSSProperties = {
    background: 'var(--color-card, var(--color-background))',
    border: '1px solid var(--color-border)',
    borderRadius: 8,
    padding: 16,
  };

  return (
    <div style={sectionStyle}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h4 style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text-primary)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>
          Documents — {debtorName}
        </h4>
        <span style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>{docs.length} file{docs.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Upload bar */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
        <select
          value={uploadCat}
          onChange={e => setUploadCat(e.target.value as DocCategory)}
          style={{
            fontSize: 12, padding: '5px 8px', borderRadius: 6,
            border: '1px solid var(--color-border)', background: 'var(--color-background)',
            color: 'var(--color-text-primary)', outline: 'none',
          }}
        >
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <button
          onClick={() => fileRef.current?.click()}
          style={{
            fontSize: 12, fontWeight: 600, padding: '5px 14px', borderRadius: 6,
            background: 'var(--color-primary)', color: 'var(--color-primary-foreground, #fff)',
            border: 'none', cursor: 'pointer',
          }}
        >
          + Upload
        </button>
        <input ref={fileRef} type="file" accept={ACCEPT} onChange={handleUpload} style={{ display: 'none' }} />
      </div>

      {error && (
        <div style={{ fontSize: 12, color: 'var(--color-danger, #dc2626)', background: 'var(--color-danger-bg, rgba(220,38,38,0.08))', padding: '6px 10px', borderRadius: 6, marginBottom: 10 }}>
          {error}
        </div>
      )}

      {/* Category filter */}
      {docs.length > 0 && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
          {(['All', ...CATEGORIES] as const).map(cat => (
            <button
              key={cat}
              onClick={() => setFilterCat(cat)}
              style={{
                fontSize: 11, padding: '3px 10px', borderRadius: 12,
                border: filterCat === cat ? '1px solid var(--color-primary)' : '1px solid var(--color-border)',
                background: filterCat === cat ? 'var(--color-primary)' : 'transparent',
                color: filterCat === cat ? 'var(--color-primary-foreground, #fff)' : 'var(--color-text-secondary)',
                cursor: 'pointer', fontWeight: 500,
              }}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      {/* Document list */}
      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '24px 12px', color: 'var(--color-text-secondary)', fontSize: 13 }}>
          {docs.length === 0
            ? 'No documents attached. Upload ID copies, settlement letters, or payment receipts.'
            : 'No documents in this category.'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map(doc => {
            const { icon, color } = getFileIcon(doc.type);
            const isConfirming = confirmDeleteId === doc.id;
            return (
              <div
                key={doc.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px',
                  borderRadius: 6, border: '1px solid var(--color-border)',
                  background: 'var(--color-background)',
                }}
              >
                {/* Icon */}
                <span style={{ fontSize: 22, lineHeight: 1, color, flexShrink: 0 }}>{icon}</span>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={doc.name}>
                    {truncate(doc.name)}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                    <span style={{
                      fontSize: 10, fontWeight: 600, padding: '1px 7px', borderRadius: 8,
                      background: 'var(--color-primary-bg, rgba(30,58,95,0.1))', color: 'var(--color-primary)',
                    }}>
                      {doc.category}
                    </span>
                    <span style={{ fontSize: 10, color: 'var(--color-text-secondary)' }}>
                      {doc.uploadedByName} &middot; {new Date(doc.uploadedAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                  <ActionBtn label="View" onClick={() => { const w = window.open(''); w?.document.write(`<iframe src="${doc.dataUrl}" style="width:100%;height:100%;border:none"></iframe>`); }} />
                  <ActionBtn label="Download" onClick={() => handleDownload(doc)} />
                  {isConfirming ? (
                    <>
                      <ActionBtn label="Yes" danger onClick={() => handleDelete(doc.id)} />
                      <ActionBtn label="No" onClick={() => setConfirmDeleteId(null)} />
                    </>
                  ) : (
                    <ActionBtn label="Delete" danger onClick={() => setConfirmDeleteId(doc.id)} />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

const ActionBtn: React.FC<{ label: string; onClick: () => void; danger?: boolean }> = ({ label, onClick, danger }) => (
  <button
    onClick={onClick}
    style={{
      fontSize: 11, fontWeight: 500, padding: '3px 8px', borderRadius: 4, cursor: 'pointer',
      border: '1px solid var(--color-border)',
      background: danger ? 'var(--color-danger, #dc2626)' : 'var(--color-background)',
      color: danger ? 'var(--color-primary-foreground, #fff)' : 'var(--color-text-secondary)',
    }}
  >
    {label}
  </button>
);

export default DocumentAttachments;
