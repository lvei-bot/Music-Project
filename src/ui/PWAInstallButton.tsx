/**
 * In-App PWA Install Button with Desktop/Android prompt
 * and iOS Safari guidance modal.
 */

import React, { useState } from 'react';
import { usePWAInstall } from './usePWAInstall';
import { Download, Share2, X } from 'lucide-react';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <button
        onClick={install}
        type="button"
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md bg-[#A68A55] text-white hover:bg-[#8e7443] transition-colors shadow-xs"
        title="Install application for full offline use"
      >
        <Download className="w-3.5 h-3.5" />
        <span>Install App</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          onClick={() => setShowIOSGuide(true)}
          type="button"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md border border-[#29251F]/20 dark:border-[#EDE8E1]/20 text-[#29251F] dark:text-[#EDE8E1] hover:bg-[#EAE5DC]/50 dark:hover:bg-[#221F1C] transition-colors"
          title="Install on iPhone or iPad"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Install on iOS</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
            <div className="w-full max-w-sm rounded-xl bg-[#F8F6F1] dark:bg-[#181614] border border-[#29251F]/15 dark:border-[#EDE8E1]/15 p-6 shadow-2xl">
              <div className="flex items-center justify-between pb-3 border-b border-[#29251F]/10 dark:border-[#EDE8E1]/10">
                <h3 className="text-base font-bold font-editorial text-[#29251F] dark:text-[#EDE8E1]">
                  Install on iPhone / iPad
                </h3>
                <button
                  onClick={() => setShowIOSGuide(false)}
                  className="p-1 rounded-md text-[#29251F]/60 dark:text-[#EDE8E1]/60 hover:text-[#29251F] dark:hover:text-[#EDE8E1]"
                  aria-label="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="mt-4 space-y-3 text-sm text-[#29251F]/80 dark:text-[#EDE8E1]/80">
                <div className="flex items-start gap-2.5">
                  <span className="flex items-center justify-center w-5 h-5 rounded-full bg-[#A68A55] text-white text-xs font-bold shrink-0">1</span>
                  <span>Tap the <strong className="inline-flex items-center gap-1 font-semibold text-[#29251F] dark:text-[#EDE8E1]"><Share2 className="w-3.5 h-3.5" /> Share</strong> button in your Safari toolbar.</span>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="flex items-center justify-center w-5 h-5 rounded-full bg-[#A68A55] text-white text-xs font-bold shrink-0">2</span>
                  <span>Scroll down and select <strong className="font-semibold text-[#29251F] dark:text-[#EDE8E1]">Add to Home Screen</strong>.</span>
                </div>
              </div>
              <button
                onClick={() => setShowIOSGuide(false)}
                type="button"
                className="mt-6 w-full py-2 px-4 rounded-lg bg-[#29251F] dark:bg-[#EDE8E1] text-[#F8F6F1] dark:text-[#181614] font-semibold text-xs transition"
              >
                Got it
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
