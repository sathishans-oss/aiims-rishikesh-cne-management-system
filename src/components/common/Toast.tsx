import React from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
}

export interface ToastProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export const ToastContainer: React.FC<ToastProps> = ({ toasts, onDismiss }) => {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-md w-full px-4 sm:px-0">
      {toasts.map((t) => {
        const icon =
          t.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          ) : t.type === 'error' ? (
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          ) : (
            <Info className="w-5 h-5 text-blue-600 shrink-0" />
          );

        const border =
          t.type === 'success'
            ? 'border-emerald-200 bg-white'
            : t.type === 'error'
            ? 'border-rose-200 bg-white'
            : 'border-blue-200 bg-white';

        return (
          <div
            key={t.id}
            className={`flex items-start gap-3 p-4 rounded-xl border shadow-lg ${border} transition-all`}
          >
            {icon}
            <div className="flex-1 text-sm text-slate-800 font-medium leading-5">
              {t.message}
            </div>
            <button
              onClick={() => onDismiss(t.id)}
              className="text-slate-400 hover:text-slate-600 p-0.5 rounded cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
};

export const Toast: React.FC<{
  type: 'success' | 'error' | 'info';
  message: string;
  onClose: () => void;
}> = ({ type, message, onClose }) => {
  return (
    <ToastContainer
      toasts={[{ id: 'active_toast', type, message }]}
      onDismiss={onClose}
    />
  );
};
