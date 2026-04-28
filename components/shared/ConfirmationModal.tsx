import React from 'react';
import { ICONS } from '../../constants';
import { useEscKey } from '../../hooks/useEscKey';

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: React.ReactNode;
  confirmText?: string;
  confirmButtonClass?: string;
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  confirmButtonClass = 'btn-primary'
}) => {
  useEscKey(onClose, isOpen);
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex justify-center items-center p-4 animate-fade-in-up"
      style={{ animationDuration: '0.2s' }}
      onClick={onClose}
    >
      <div className="panel w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center p-4 border-b border-border">
          <h2 className="text-xl font-bold text-text-primary flex items-center gap-2">
            {ICONS.danger('w-6 h-6 text-danger')}
            {title}
          </h2>
          <button onClick={onClose} className="text-text-secondary hover:text-text-primary">
            {ICONS.close('h-6 w-6')}
          </button>
        </div>
        <div className="p-6 text-sm text-text-secondary">
          {message}
        </div>
        <div className="flex justify-end p-4 bg-surface-muted border-t border-border rounded-b-lg">
          <button
            type="button"
            onClick={onClose}
            className="btn-secondary px-4 py-2 text-sm font-medium mr-3"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2 text-sm ${confirmButtonClass}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmationModal;