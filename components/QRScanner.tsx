import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Camera, CheckCircle2, RefreshCw, XCircle, ArrowLeft } from 'lucide-react';
import { Button } from './Button';
import { decodeQR, DecodedQRData } from '../lib/qr-encode';
import { MatchData, PitData } from '../types';

interface QRScannerProps {
  onImport: (data: DecodedQRData) => void;
  onBack: () => void;
}

export const QRScanner: React.FC<QRScannerProps> = ({ onImport, onBack }) => {
  const [scanning, setScanning] = useState(false);
  const [matchResults, setMatchResults] = useState<{ data: MatchData; time: number }[]>([]);
  const [pitResults, setPitResults] = useState<{ data: PitData; time: number }[]>([]);
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
          if (processedQRs.current.has(decodedText)) return;
          processedQRs.current.add(decodedText);

          const decoded = decodeQR(decodedText);
          if (decoded.matches.length > 0 || decoded.pits.length > 0) {
            onImport(decoded);
            if (decoded.matches.length > 0) {
              const newResults = decoded.matches.map(m => ({ data: m, time: Date.now() }));
              setMatchResults(prev => [...newResults, ...prev]);
            }
            if (decoded.pits.length > 0) {
              const newResults = decoded.pits.map(p => ({ data: p, time: Date.now() }));
              setPitResults(prev => [...newResults, ...prev]);
            }
          }
        },
        () => {}
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

  const totalImported = matchResults.length + pitResults.length;

  return (
    <div className="space-y-6">
      <button onClick={onBack} className="flex items-center gap-2 text-slate-400 font-semibold">
        <ArrowLeft className="w-5 h-5" /> Back
      </button>

      <h2 className="text-3xl font-header text-white">QR SCANNER</h2>
      <p className="text-xs text-slate-500">Scans match QR codes, pit data QR codes, and bulk "Share All" QR codes. Newer data overwrites older data automatically.</p>

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

      {totalImported > 0 && (
        <div className="space-y-3">
          <h3 className="font-header text-xl text-slate-200">
            Imported ({matchResults.length} match{matchResults.length !== 1 ? 'es' : ''}{pitResults.length > 0 ? `, ${pitResults.length} pit record${pitResults.length !== 1 ? 's' : ''}` : ''})
          </h3>
          {matchResults.map((r, i) => (
            <div key={`m-${i}`} className="flex items-center gap-3 p-3 bg-green-500/5 border border-green-500/20 rounded-xl">
              <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
              <div>
                <p className="text-sm font-bold text-slate-200">Match #{r.data.matchNumber} - Team {r.data.teamNumber}</p>
                <p className="text-xs text-slate-500">{r.data.teleopRole} | Climb: {r.data.climbLevel}</p>
              </div>
            </div>
          ))}
          {pitResults.map((r, i) => (
            <div key={`p-${i}`} className="flex items-center gap-3 p-3 bg-purple-500/5 border border-purple-500/20 rounded-xl">
              <CheckCircle2 className="w-5 h-5 text-purple-500 flex-shrink-0" />
              <div>
                <p className="text-sm font-bold text-slate-200">Pit Data - Team {r.data.teamNumber}</p>
                <p className="text-xs text-slate-500">{r.data.drivetrain.type} | {r.data.selfAssessedRole}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
