import React from 'react';

export interface BadgeProps {
  status: string;
  className?: string;
  size?: 'sm' | 'md';
}

export const Badge: React.FC<BadgeProps> = ({ status, className = '', size = 'md' }) => {
  const s = status ? status.trim() : '';

  let colorClasses = 'bg-slate-100 text-slate-700 border-slate-200';

  // CNE lifecycle
  if (s === 'Scheduled') {
    colorClasses = 'bg-blue-50 text-blue-700 border-blue-200';
  } else if (s === 'Modified & Scheduled') {
    colorClasses = 'bg-amber-50 text-amber-800 border-amber-200';
  } else if (s === 'Completed') {
    colorClasses = 'bg-emerald-50 text-emerald-800 border-emerald-200';
  } else if (s === 'Canceled') {
    colorClasses = 'bg-rose-50 text-rose-700 border-rose-200';
  }
  // Applications
  else if (s === 'Pending') {
    colorClasses = 'bg-amber-50 text-amber-800 border-amber-200';
  } else if (s === 'Approved') {
    colorClasses = 'bg-emerald-50 text-emerald-800 border-emerald-200';
  } else if (s === 'Rejected') {
    colorClasses = 'bg-rose-50 text-rose-700 border-rose-200';
  }
  // Attendance & Participation
  else if (s === 'ATTENDED' || s === 'PASSED' || s === 'ACTIVE') {
    colorClasses = 'bg-emerald-50 text-emerald-800 border-emerald-200';
  } else if (s === 'REGISTERED') {
    colorClasses = 'bg-indigo-50 text-indigo-700 border-indigo-200';
  } else if (s === 'ABSENT' || s === 'FAILED' || s === 'INACTIVE') {
    colorClasses = 'bg-rose-50 text-rose-700 border-rose-200';
  }
  // Roles
  else if (s === 'ADMIN') {
    colorClasses = 'bg-purple-50 text-purple-800 border-purple-200 font-semibold';
  } else if (s === 'AREA_INCHARGE') {
    colorClasses = 'bg-teal-50 text-teal-800 border-teal-200 font-medium';
  } else if (s === 'EMPLOYEE') {
    colorClasses = 'bg-slate-100 text-slate-700 border-slate-200';
  }

  const sizeClass = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs';

  return (
    <span className={`inline-flex items-center rounded-full font-medium border whitespace-nowrap ${sizeClass} ${colorClasses} ${className}`}>
      <span className="w-1.5 h-1.5 rounded-full mr-1.5 bg-current opacity-60"></span>
      {s}
    </span>
  );
};
