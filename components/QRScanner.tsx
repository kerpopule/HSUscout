import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { Camera, CheckCircle2, RefreshCw, XCircle, ArrowLeft, Image as ImageIcon, Eye, X } from 'lucide-react';
import { Button } from './Button';
import { decodeQR, DecodedQRData } from '../lib/qr-encode';
import { MatchData, PitData } from '../types';

interface ScanToast {
  id: number;
  matches: MatchData[];
  pits: PitData[];
  time: number;
}

interface QRScannerProps {
  onImport: (data: DecodedQRData) => void;
  onBack: () => void;
  onViewTeam?: (teamNumber: number) => void;
}

export const QRScanner: React.FC<QRScannerProps> = ({ onImport, onBack, onViewTeam }) => {
  const [scanning, setScanning] = useState(false);
  const [matchResults, setMatchResults] = useState<{ data: MatchData; time: number }[]>([]);
  const [pitResults, setPitResults] = useState<{ data: PitData; time: number }[]>([]);
  const [error, setError] = useState('');
  const [detectHint, setDetectHint] = useState(false);
  const [toasts, setToasts] = useState<ScanToast[]>([]);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const processedQRs = useRef(new Set<string>());
  const failCountRef = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const toastIdRef = useRef(0);

  const addToast = useCallback((matches: MatchData[], pits: PitData[]) => {
    const id = ++toastIdRef.current;
    setToasts(prev => [{ id, matches, pits, time: Date.now() }, ...prev]);
    // Auto-dismiss after 8 seconds
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 8000);
  }, []);

  const dismissToast = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const handleDecoded = useCallback((decodedText: string, source: 'camera' | 'image') => {
    if (processedQRs.current.has(decodedText)) {
      if (source === 'image') setError('This QR code was already imported.');
      return;
    }
    processedQRs.current.add(decodedText);

    const decoded = decodeQR(decodedText);
    if (decoded.matches.length > 0 || decoded.pits.length > 0) {
      onImport(decoded);
      if (decoded.matches.length > 0) {
        setMatchResults(prev => [...decoded.matches.map(m => ({ data: m, time: Date.now() })), ...prev]);
      }
      if (decoded.pits.length > 0) {
        setPitResults(prev => [...decoded.pits.map(p => ({ data: p, time: Date.now() })), ...prev]);
      }
      // Show success toast
      addToast(decoded.matches, decoded.pits);
    } else {
      setError('QR code recognized but contained no valid scouting data.');
    }
  }, [onImport, addToast]);

  const startScanning = async () => {
    setError('');
    failCountRef.current = 0;
    setDetectHint(false);
    try {
      const scanner = new Html5Qrcode('qr-reader', {
        formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
        useBarCodeDetectorIfSupported: true,
        verbose: false,
      });
      scannerRef.current = scanner;
      await scanner.start(
        { facingMode: 'environment' },
        {
          fps: 5,
          qrbox: (vw: number, vh: number) => {
            const size = Math.min(Math.floor(Math.min(vw, vh) * 0.8), 400);
            return { width: size, height: size };
          },
          disableFlip: true,
        },
        (decodedText) => {
          handleDecoded(decodedText, 'camera');
        },
        (errorMessage: string) => {
          if (!errorMessage.includes('NotFoundException')) {
            failCountRef.current++;
            if (failCountRef.current >= 15) setDetectHint(true);
          } else {
            if (failCountRef.current > 0) {
              failCountRef.current = 0;
              setDetectHint(false);
            }
          }
        }
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
    processedQRs.current.clear();
    failCountRef.current = 0;
    setDetectHint(false);
  };

  const handleFileScan = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    try {
      const fileScanner = new Html5Qrcode('qr-file-temp', {
        formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
        useBarCodeDetectorIfSupported: true,
        verbose: false,
      });
      const decodedText = await fileScanner.scanFile(file, false);
      fileScanner.clear();
      handleDecoded(decodedText, 'image');
    } catch {
      setError('Could not read QR code from image. Try a clearer photo.');
    }
    e.target.value = '';
  };

  useEffect(() => {
    return () => { stopScanning(); };
  }, []);

  const totalImported = matchResults.length + pitResults.length;

  const getToastSummary = (toast: ScanToast) => {
    const parts: string[] = [];
    if (toast.matches.length === 1) {
      const m = toast.matches[0];
      parts.push(`Match #${m.matchNumber} — Team ${m.teamNumber}`);
    } else if (toast.matches.length > 1) {
      parts.push(`${toast.matches.length} matches`);
    }
    if (toast.pits.length === 1) {
      const p = toast.pits[0];
      parts.push(`Pit data — Team ${p.teamNumber}`);
    } else if (toast.pits.length > 1) {
      parts.push(`${toast.pits.length} pit records`);
    }
    return parts.join(', ');
  };

  const getToastTeam = (toast: ScanToast): number | null => {
    const teams = new Set<number>();
    toast.matches.forEach(m => teams.add(m.teamNumber));
    toast.pits.forEach(p => teams.add(p.teamNumber));
    return teams.size === 1 ? [...teams][0] : null;
  };

  return (
    <div className="space-y-6">
      <button onClick={onBack} className="flex items-center gap-2 text-slate-400 font-semibold">
        <ArrowLeft className="w-5 h-5" /> Back
      </button>

      <h2 className="text-3xl font-header text-white">QR SCANNER</h2>
      <p className="text-xs text-slate-500">Scans match QR codes, pit data QR codes, and bulk "Share All" QR codes. Newer data overwrites older data automatically.</p>

      {/* Success toasts */}
      {toasts.map(toast => {
        const singleTeam = getToastTeam(toast);
        return (
          <div
            key={toast.id}
            className="flex items-center gap-3 p-4 bg-green-500/10 border-2 border-green-500/40 rounded-2xl animate-[slideIn_0.3s_ease-out]"
          >
            <CheckCircle2 className="w-6 h-6 text-green-400 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-green-300">Imported!</p>
              <p className="text-xs text-green-400/80 truncate">{getToastSummary(toast)}</p>
            </div>
            {singleTeam && onViewTeam ? (
              <button
                onClick={() => { dismissToast(toast.id); onViewTeam(singleTeam); }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-500/20 hover:bg-green-500/30 text-green-300 text-xs font-bold transition-colors flex-shrink-0"
              >
                <Eye className="w-3.5 h-3.5" /> View
              </button>
            ) : (
              <button
                onClick={() => dismissToast(toast.id)}
                className="p-1 text-green-500/60 hover:text-green-300 transition-colors flex-shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        );
      })}

      <div id="qr-reader" className="rounded-2xl overflow-hidden bg-slate-900 border-2 border-slate-800" />
      <div id="qr-file-temp" className="hidden" />

      {error && (
        <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/30 rounded-xl p-3">
          <XCircle className="w-4 h-4 flex-shrink-0" /> {error}
        </div>
      )}

      {detectHint && scanning && (
        <div className="flex items-center gap-2 text-amber-400 text-xs bg-amber-500/10 border border-amber-500/30 rounded-xl p-3">
          QR code detected but can't decode — try holding steady, moving closer, or use "Import from Image" below.
        </div>
      )}

      <div className="space-y-3">
        <Button size="lg" className="w-full" onClick={scanning ? stopScanning : startScanning}>
          <Camera className="w-5 h-5 mr-2" />
          {scanning ? 'Stop Scanner' : 'Start Scanner'}
        </Button>

        <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileScan} className="hidden" />
        <button
          onClick={() => fileInputRef.current?.click()}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 transition-all text-sm"
        >
          <ImageIcon className="w-4 h-4" /> Import from Image
        </button>
      </div>

      {totalImported > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-header text-xl text-slate-200">
              Imported ({matchResults.length} match{matchResults.length !== 1 ? 'es' : ''}{pitResults.length > 0 ? `, ${pitResults.length} pit record${pitResults.length !== 1 ? 's' : ''}` : ''})
            </h3>
            <button onClick={() => { processedQRs.current.clear(); setMatchResults([]); setPitResults([]); }}
              className="flex items-center gap-2 text-xs text-slate-500 hover:text-slate-300 transition-colors">
              <RefreshCw className="w-3 h-3" /> Reset
            </button>
          </div>
          {matchResults.map((r, i) => (
            <div key={`m-${i}`} className="flex items-center gap-3 p-3 bg-green-500/5 border border-green-500/20 rounded-xl">
              <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-bold text-slate-200">Match #{r.data.matchNumber} - Team {r.data.teamNumber}</p>
                <p className="text-xs text-slate-500">{r.data.teleopRole} | Climb: {r.data.climbLevel}</p>
              </div>
              {onViewTeam && (
                <button onClick={() => onViewTeam(r.data.teamNumber)}
                  className="text-xs text-slate-500 hover:text-blue-400 transition-colors">
                  <Eye className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
          {pitResults.map((r, i) => (
            <div key={`p-${i}`} className="flex items-center gap-3 p-3 bg-purple-500/5 border border-purple-500/20 rounded-xl">
              <CheckCircle2 className="w-5 h-5 text-purple-500 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-bold text-slate-200">Pit Data - Team {r.data.teamNumber}</p>
                <p className="text-xs text-slate-500">{r.data.drivetrain.type} | {r.data.selfAssessedRole}</p>
              </div>
              {onViewTeam && (
                <button onClick={() => onViewTeam(r.data.teamNumber)}
                  className="text-xs text-slate-500 hover:text-purple-400 transition-colors">
                  <Eye className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
