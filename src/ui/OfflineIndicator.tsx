/**
 * Non-intrusive offline connectivity status indicator
 */

import React, { useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';

export const OfflineIndicator: React.FC = () => {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isOnline) return null;

  return (
    <div
      className="fixed bottom-16 md:bottom-4 left-4 z-40 flex items-center gap-2 rounded-lg bg-[#29251F] text-[#F8F6F1] dark:bg-[#EDE8E1] dark:text-[#181614] px-3 py-1.5 text-xs font-semibold shadow-lg border border-[#A68A55]/30 animate-pulse"
      role="status"
      aria-live="polite"
    >
      <WifiOff className="w-3.5 h-3.5 text-[#A68A55]" />
      <span>Offline Mode — Full functionality active</span>
    </div>
  );
};
