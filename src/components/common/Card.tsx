import React from 'react';

export interface CardProps {
  children: React.ReactNode;
  className?: string;
  header?: React.ReactNode;
  footer?: React.ReactNode;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
}

export const Card: React.FC<CardProps> = ({
  children,
  className = '',
  header,
  footer,
  title,
  subtitle,
  action
}) => {
  return (
    <div className={`bg-white rounded-xl border border-slate-200/90 shadow-xs overflow-hidden ${className}`}>
      {(header || title) && (
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-3 bg-slate-50/40">
          {header ? (
            header
          ) : (
            <div>
              <h4 className="font-semibold text-slate-900 text-sm tracking-tight">{title}</h4>
              {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
            </div>
          )}
          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}
      <div className="p-5">{children}</div>
      {footer && (
        <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 text-xs text-slate-500">
          {footer}
        </div>
      )}
    </div>
  );
};
