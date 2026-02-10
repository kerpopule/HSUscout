
import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export const Input: React.FC<InputProps> = ({ label, className = '', ...props }) => {
  return (
    <div className="flex flex-col gap-1.5 w-full">
      {label && <label className="text-xs font-bold uppercase tracking-wider text-slate-400">{label}</label>}
      <input 
        className={`bg-slate-900 border-2 border-slate-800 rounded-xl px-4 py-2.5 text-slate-100 placeholder:text-slate-600 focus:border-blue-600 focus:outline-none transition-colors ${className}`}
        {...props}
      />
    </div>
  );
};

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: string[];
}

export const Select: React.FC<SelectProps> = ({ label, options, className = '', ...props }) => {
  return (
    <div className="flex flex-col gap-1.5 w-full">
      {label && <label className="text-xs font-bold uppercase tracking-wider text-slate-400">{label}</label>}
      <select 
        className={`bg-slate-900 border-2 border-slate-800 rounded-xl px-4 py-2.5 text-slate-100 focus:border-blue-600 focus:outline-none transition-colors appearance-none ${className}`}
        {...props}
      >
        {options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
      </select>
    </div>
  );
};

interface RadioGroupProps {
  label?: string;
  options: string[];
  value: string;
  onChange: (val: string) => void;
}

export const RadioGroup: React.FC<RadioGroupProps> = ({ label, options, value, onChange }) => {
  return (
    <div className="flex flex-col gap-1.5 w-full">
      {label && <label className="text-xs font-bold uppercase tracking-wider text-slate-400">{label}</label>}
      <div className="flex flex-wrap gap-2">
        {options.map(opt => (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt)}
            className={`flex-1 min-w-[80px] px-4 py-2.5 rounded-xl border-2 font-semibold transition-all text-sm ${
              value === opt 
                ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-900/20' 
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
            }`}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
};

interface ToggleProps {
  label: string;
  checked: boolean;
  onChange: (val: boolean) => void;
}

export const Toggle: React.FC<ToggleProps> = ({ label, checked, onChange }) => {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`flex items-center justify-between p-4 rounded-xl border-2 transition-all ${
        checked 
          ? 'bg-blue-600/10 border-blue-600 text-blue-400' 
          : 'bg-slate-900 border-slate-800 text-slate-400'
      }`}
    >
      <span className="font-semibold">{label}</span>
      <div className={`w-10 h-6 rounded-full p-1 transition-colors ${checked ? 'bg-blue-600' : 'bg-slate-700'}`}>
        <div className={`w-4 h-4 bg-white rounded-full transition-transform ${checked ? 'translate-x-4' : 'translate-x-0'}`} />
      </div>
    </button>
  );
};
