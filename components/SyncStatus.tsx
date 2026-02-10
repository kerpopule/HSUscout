import React from 'react';
import { Wifi, WifiOff } from 'lucide-react';

interface SyncStatusProps {
  isConnected: boolean;
  pendingCount: number;
}

export const SyncStatus: React.FC<SyncStatusProps> = ({ isConnected, pendingCount }) => (
  <div className="flex items-center gap-1.5">
    {isConnected ? (
      <Wifi className="w-4 h-4 text-green-500" />
    ) : (
      <WifiOff className="w-4 h-4 text-red-500" />
    )}
    {pendingCount > 0 && (
      <span className="bg-amber-500 text-slate-950 text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
        {pendingCount}
      </span>
    )}
  </div>
);
