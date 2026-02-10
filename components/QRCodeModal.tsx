import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { X, Copy, Check } from 'lucide-react';
import { Button } from './Button';

interface QRCodeModalProps {
  data: string;
  title?: string;
  subtitle?: string;
  onClose: () => void;
}

export const QRCodeModal: React.FC<QRCodeModalProps> = ({ data, title, subtitle, onClose }) => {
  const [copied, setCopied] = React.useState(false);
  const isBulk = data.startsWith('B1\n');
  const qrSize = isBulk ? 300 : 256;
  const errorLevel = isBulk ? 'L' : 'M';

  const handleCopy = async () => {
    await navigator.clipboard.writeText(data);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-slate-900 border-2 border-slate-700 rounded-3xl p-6 max-w-sm w-full space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="font-header text-xl text-white">{title || 'MATCH QR BACKUP'}</h3>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="bg-white rounded-2xl p-4 flex items-center justify-center">
          <QRCodeSVG value={data} size={qrSize} level={errorLevel} />
        </div>

        <p className="text-xs text-slate-400 text-center">
          {subtitle || 'Show this to any scout to import this data'}
        </p>

        <div className="flex gap-2">
          <Button variant="secondary" size="sm" className="flex-1" onClick={handleCopy}>
            {copied ? <Check className="w-4 h-4 mr-1" /> : <Copy className="w-4 h-4 mr-1" />}
            {copied ? 'Copied' : 'Copy Data'}
          </Button>
          <Button size="sm" className="flex-1" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    </div>
  );
};
