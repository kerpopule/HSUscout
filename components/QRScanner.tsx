import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Camera, CheckCircle2, RefreshCw, XCircle, ArrowLeft } from 'lucide-react';
import { Button } from './Button';
import { decodeQR } from '../lib/qr-encode';
import { MatchData } from '../types';

interface QRScannerProps {
  onImport: (matches: MatchData[]) => void;
  onBack: () => void;
}

export const QRScanner: React.FC<QRScannerProps> = ({ onImport, onBack }) => {
  const [scanning, setScanning] = useState(false);
  const [results, setResults] = useState<{ data: MatchData; updated: boolean; time: number }[]>([]);
  const [error, setError] = useState('');
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const processedQRs = useRef(new Set<string>());

  const startScanning = async () => {
    setError('');
    try {
      const scanner = new Html5Qrcode('qr-reader');
      scannerRef.current = scanner;
      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          // Deduplicate by raw QR content so we don't re-process the same scan
          if (processedQRs.current.has(decodedText)) return;
          processedQRs.current.add(decodedText);

          const matches = decodeQR(decodedText);
          if (matches.length > 0) {
            onImport(matches);
            const newResults = matches.map(m => ({
              data: m,
              updated: false,
              time: Date.now(),
            }));
            setResults(prev => [...newResults, ...prev]);
          }
        },
        () => {} // ignore scan failures
      );
      setScanning(true);
    } catch (err: any) {
      setError(err.message || 'Camera access denied');
    }
  };

  const stopScanning = async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
      } catch {}
      scannerRef.current = null;
    }
    setScanning(false);
  };

  useEffect(() => {
    return () => { stopScanning(); };
  }, []);

  return (
    <div className="space-y-6">
      <button onClick={onBack} className="flex items-center gap-2 text-slate-400 font-semibold">
        <ArrowLeft className="w-5 h-5" /> Back
      </button>

      <h2 className="text-3xl font-header text-white">QR SCANNER</h2>
      <p className="text-xs text-slate-500">Scans single match QR codes and bulk "Share All" QR codes. Newer data overwrites older data automatically.</p>

      <div id="qr-reader" className="rounded-2xl overflow-hidden bg-slate-900 border-2 border-slate-800" />

      {error && (
        <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/30 rounded-xl p-3">
          <XCircle className="w-4 h-4 flex-shrink-0" /> {error}
        </div>
      )}

      <Button size="lg" className="w-full" onClick={scanning ? stopScanning : startScanning}>
        <Camera className="w-5 h-5 mr-2" />
        {scanning ? 'Stop Scanner' : 'Start Scanner'}
      </Button>

      {results.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-header text-xl text-slate-200">Imported ({results.length} matches)</h3>
          {results.map((r, i) => (
            <div key={i} className="flex items-center gap-3 p-3 bg-green-500/5 border border-green-500/20 rounded-xl">
              <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
              <div>
                <p className="text-sm font-bold text-slate-200">Match #{r.data.matchNumber} - Team {r.data.teamNumber}</p>
                <p className="text-xs text-slate-500">{r.data.teleopRole} | Climb: {r.data.climbLevel}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
