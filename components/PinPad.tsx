import React, { useState, useCallback, useEffect } from 'react';
import { X, Delete } from 'lucide-react';

interface PinPadProps {
  title?: string;
  onSubmit: (pin: string) => void;
  onCancel: () => void;
  errorCount: number;
}

export const PinPad: React.FC<PinPadProps> = ({ title, onSubmit, onCancel, errorCount }) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [shake, setShake] = useState(false);
  const [waiting, setWaiting] = useState(false);

  const triggerShake = useCallback(() => {
    setShake(true);
    setTimeout(() => setShake(false), 500);
  }, []);

  useEffect(() => {
    if (errorCount > 0) {
      setError('Wrong PIN');
      setPin('');
      setWaiting(false);
      triggerShake();
    }
  }, [errorCount, triggerShake]);

  const handleDigit = (digit: string) => {
    if (pin.length >= 4 || waiting) return;
    const next = pin + digit;
    setPin(next);
    setError('');

    if (next.length === 4) {
      setTimeout(() => {
        setWaiting(true);
        onSubmit(next);
      }, 150);
    }
  };

  const handleBackspace = () => {
    if (waiting) return;
    setPin(pin.slice(0, -1));
    setError('');
  };

  const headerText = title || 'Enter PIN';

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4" onClick={onCancel}>
      <div className="bg-slate-900 border-2 border-slate-700 rounded-3xl p-6 max-w-xs w-full" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-header text-lg text-white">{headerText}</h3>
          <button onClick={onCancel} className="text-slate-500 hover:text-slate-300">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className={`flex justify-center gap-4 mb-2 ${shake ? 'animate-shake' : ''}`}>
          {[0, 1, 2, 3].map(i => (
            <div
              key={i}
              className={`w-4 h-4 rounded-full border-2 transition-all ${
                i < pin.length
                  ? 'bg-blue-500 border-blue-500'
                  : 'border-slate-600'
              }`}
            />
          ))}
        </div>

        {error && <p className="text-red-400 text-xs text-center mb-2">{error}</p>}
        <div className="h-4" />

        <div className="grid grid-cols-3 gap-3">
          {['1','2','3','4','5','6','7','8','9'].map(d => (
            <button
              key={d}
              onClick={() => handleDigit(d)}
              className="w-16 h-16 mx-auto rounded-2xl bg-slate-800 border border-slate-700 text-2xl font-bold text-slate-100 active:bg-slate-700 active:scale-95 transition-all"
            >
              {d}
            </button>
          ))}
          <div />
          <button
            onClick={() => handleDigit('0')}
            className="w-16 h-16 mx-auto rounded-2xl bg-slate-800 border border-slate-700 text-2xl font-bold text-slate-100 active:bg-slate-700 active:scale-95 transition-all"
          >
            0
          </button>
          <button
            onClick={handleBackspace}
            className="w-16 h-16 mx-auto rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400 active:bg-slate-700 active:scale-95 transition-all"
          >
            <Delete className="w-6 h-6" />
          </button>
        </div>
      </div>
    </div>
  );
};
