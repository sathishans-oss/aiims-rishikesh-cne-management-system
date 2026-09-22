import React from 'react';

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: SelectOption[];
  placeholder?: string;
}

export const Select: React.FC<SelectProps> = ({
  label,
  options,
  placeholder,
  value,
  onChange,
  className = '',
  disabled,
  ...props
}) => {
  return (
    <div className="flex flex-col gap-1">
      {label && <label className="text-xs font-semibold text-slate-700">{label}</label>}
      <select
        value={value}
        onChange={onChange}
        disabled={disabled}
        className={`w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-600/30 focus:border-emerald-600 transition-colors shadow-xs disabled:bg-slate-50 disabled:text-slate-400 cursor-pointer ${className}`}
        {...props}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
};
