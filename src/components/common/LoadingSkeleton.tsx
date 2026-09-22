import React from 'react';

export const LoadingSkeleton: React.FC<{ rows?: number; height?: string; className?: string }> = ({
  rows = 3,
  height = 'h-10',
  className = ''
}) => {
  return (
    <div className={`space-y-3 ${className}`}>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className={`w-full bg-slate-100 rounded-lg animate-pulse ${height}`}
        />
      ))}
    </div>
  );
};
