import React, { useState } from 'react';
import { User } from '../../types';
import { ICONS } from '../../constants';

interface SendNotificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSend: (recipientId: string, message: string, priority: 'Normal' | 'Urgent', isTask: boolean) => void;
  coordinators: User[];
}

const SendNotificationModal: React.FC<SendNotificationModalProps> = ({ isOpen, onClose, onSend, coordinators }) => {
  const [recipientId, setRecipientId] = useState('all');
  const [message, setMessage] = useState('');
  const [priority, setPriority] = useState<'Normal' | 'Urgent'>('Normal');
  const [isTask, setIsTask] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) {
      alert('Please enter a message.');
      return;
    }
    onSend(recipientId, message, priority, isTask);
    onClose();
    // Reset form for next time
    setMessage('');
    setRecipientId('all');
    setPriority('Normal');
    setIsTask(false);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/70 z-50 flex justify-center items-center p-4">
      <div className="glass-effect rounded-lg shadow-2xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
        <form onSubmit={handleSubmit}>
          <div className="flex justify-between items-center p-4 border-b border-border">
            <h2 className="text-xl font-bold text-text-primary">Send Notification / Task</h2>
            <button type="button" onClick={onClose} className="text-text-secondary hover:text-text-primary">
              {ICONS.close('h-6 w-6')}
            </button>
          </div>
          <div className="p-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="recipient" className="block text-sm font-medium text-text-secondary mb-1">Recipient</label>
                <select id="recipient" value={recipientId} onChange={e => setRecipientId(e.target.value)} className="w-full text-sm rounded-md p-2">
                  <option value="all">All Officers</option>
                  {coordinators.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="priority" className="block text-sm font-medium text-text-secondary mb-1">Priority</label>
                <select id="priority" value={priority} onChange={e => setPriority(e.target.value as 'Normal' | 'Urgent')} className="w-full text-sm rounded-md p-2">
                  <option>Normal</option>
                  <option>Urgent</option>
                </select>
              </div>
            </div>
            <div>
              <label htmlFor="message" className="block text-sm font-medium text-text-secondary mb-1">Message / Task</label>
              <textarea
                id="message"
                value={message}
                onChange={e => setMessage(e.target.value)}
                placeholder="Enter your message here..."
                rows={5}
                className="mt-1 block w-full shadow-sm sm:text-sm rounded-md p-2"
                required
              />
            </div>
             <div className="flex items-center">
                <input
                    id="isTask"
                    type="checkbox"
                    checked={isTask}
                    onChange={(e) => setIsTask(e.target.checked)}
                    className="h-4 w-4 rounded text-primary"
                />
                <label htmlFor="isTask" className="ml-2 block text-sm text-text-primary">
                    Mark as a task
                </label>
            </div>
          </div>
          <div className="flex justify-end p-4 bg-black/5 dark:bg-black/20 border-t border-border">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium border border-border rounded-md shadow-sm hover:bg-black/5 dark:hover:bg-white/10 mr-3">
              Cancel
            </button>
            <button type="submit" className="btn-primary px-4 py-2 text-sm">
              Send
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SendNotificationModal;