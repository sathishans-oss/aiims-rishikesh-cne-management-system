import React from 'react';
import { Inbox } from 'lucide-react';

export interface EmptyStateProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
  icon?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  action,
  icon = <Inbox className="w-10 h-10 text-slate-300" />
}) => {
  return (
    <div className="flex flex-col items-center justify-center p-8 sm:p-12 text-center bg-white rounded-xl border border-dashed border-slate-200">
      <div className="mb-3 p-3 bg-slate-50 rounded-full">{icon}</div>
      <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
      {description && <p className="text-xs text-slate-500 mt-1 max-w-sm leading-normal">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
};
